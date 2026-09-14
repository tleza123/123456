import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { verifyOwner } from '@/lib/server/auth';
import { createSuccessResponse, createErrorResponse } from '@/lib/server/errors';
import {
  getShopId,
  getEmployeeRef,
  getRequestsCol,
  recordAudit
} from '@/lib/server/repository';
import { getAdminFirestore, getAdminStorage } from '@/lib/firebase/admin';
import { computePayloadHash, checkRequestReceipt, recordRequestReceipt } from '@/lib/server/idempotency';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyOwner(req);
    const { id: employeeId } = await params;
    const shopId = getShopId();

    const empSnap = await getEmployeeRef(employeeId, shopId).get();
    if (!empSnap.exists) {
      return createErrorResponse('NOT_FOUND', 'ไม่พบพนักงาน', 404);
    }

    const emp = empSnap.data();
    if (!emp?.photo?.objectPath) {
      return createErrorResponse('NOT_FOUND', 'พนักงานไม่มีรูปภาพ', 404);
    }

    const storage = getAdminStorage();
    const bucket = storage.bucket();
    const file = bucket.file(emp.photo.objectPath);
    const [exists] = await file.exists();
    if (!exists) {
      return createErrorResponse('NOT_FOUND', 'ไม่พบไฟล์รูปภาพในระบบจัดเก็บ', 404);
    }

    const [buffer] = await file.download();

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
        'Content-Length': buffer.length.toString()
      }
    });
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string; statusCode?: number };
    return createErrorResponse(
      error.code || 'INTERNAL_ERROR',
      error.message,
      error.statusCode || 500
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const owner = await verifyOwner(req);
    const { id: employeeId } = await params;
    const body = await req.json();
    const { base64Data, expectedRevision, requestId } = body;

    if (!requestId || typeof requestId !== 'string') {
      return createErrorResponse('INVALID_INPUT', 'กรุณาระบุ requestId ให้ถูกต้อง', 422);
    }
    if (typeof expectedRevision !== 'number') {
      return createErrorResponse('INVALID_INPUT', 'กรุณาระบุ expectedRevision', 422);
    }
    if (!base64Data || typeof base64Data !== 'string') {
      return createErrorResponse('INVALID_INPUT', 'กรุณาส่งข้อมูลรูปภาพ base64', 422);
    }

    // Strip prefix e.g. "data:image/jpeg;base64,"
    const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    const inputBuffer = Buffer.from(cleanBase64, 'base64');

    if (inputBuffer.length > 1024 * 1024) {
      return createErrorResponse('INVALID_INPUT', 'ขนาดไฟล์รูปภาพเกินกำหนด (ไม่เกิน 1 MB)', 422);
    }

    // Process image with sharp: strip metadata, rotate by EXIF, resize to thumbnail <= 192px and display <= 800px
    const image = sharp(inputBuffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height || metadata.width * metadata.height > 20_000_000) {
      return createErrorResponse('INVALID_INPUT', 'ความละเอียดของรูปภาพสูงเกินไป', 422);
    }

    const thumbBuffer = await sharp(inputBuffer)
      .rotate()
      .resize(192, 192, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const thumbMeta = await sharp(thumbBuffer).metadata();

    const shopId = getShopId();
    const storage = getAdminStorage();
    const bucket = storage.bucket();
    const objectPath = `shops/${shopId}/employees/${employeeId}/${requestId}/thumb.jpg`;
    const file = bucket.file(objectPath);

    // 1. Upload to private Storage bucket first
    await file.save(thumbBuffer, {
      metadata: {
        contentType: 'image/jpeg',
        metadata: {
          employeeId,
          uploadedBy: owner.uid,
          requestId
        }
      }
    });

    const db = getAdminFirestore();
    const payloadHash = computePayloadHash(owner.uid, 'POST', `${employeeId}:photo`, {
      objectPath,
      expectedRevision
    });

    const requestRef = getRequestsCol(shopId).doc(requestId);
    const employeeRef = getEmployeeRef(employeeId, shopId);

    // 2. Transaction to update photo pointer in employee document
    const result = await db.runTransaction(async tx => {
      const cached = await checkRequestReceipt(tx, requestRef, payloadHash);
      if (cached) return cached;

      const empSnap = await tx.get(employeeRef);
      if (!empSnap.exists) {
        throw new Error('NOT_FOUND');
      }

      const current = empSnap.data() as any;
      if (current.revision !== expectedRevision) {
        throw new Error('CONFLICT');
      }

      const previousObjectPath = current.photo?.objectPath;
      const newVersion = (current.photo?.version || 0) + 1;
      const newRevision = current.revision + 1;
      const now = new Date().toISOString();

      const photoData = {
        objectPath,
        width: thumbMeta.width || 192,
        height: thumbMeta.height || 192,
        version: newVersion,
        updatedAt: now
      };

      tx.update(employeeRef, {
        photo: photoData,
        revision: newRevision,
        updatedAt: now
      });

      recordAudit(
        tx,
        shopId,
        owner.uid,
        'UPDATE_PHOTO',
        employeeId,
        current.photo,
        photoData,
        requestId
      );

      const responsePayload = {
        employeeId,
        photo: photoData,
        revision: newRevision
      };

      recordRequestReceipt(tx, requestRef, {
        requestId,
        actorUid: owner.uid,
        method: 'POST',
        entityKey: `${employeeId}:photo`,
        payloadHash,
        response: responsePayload,
        createdAt: now
      });

      // Cleanup old file asynchronously if path differs
      if (previousObjectPath && previousObjectPath !== objectPath) {
        bucket.file(previousObjectPath).delete().catch(() => {});
      }

      return responsePayload;
    });

    return createSuccessResponse(result, requestId);
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string; statusCode?: number };
    if (error.message === 'CONFLICT') {
      return createErrorResponse('CONFLICT', undefined, 409);
    }
    return createErrorResponse(
      error.code || 'INTERNAL_ERROR',
      error.message,
      error.statusCode || 500
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const owner = await verifyOwner(req);
    const { id: employeeId } = await params;
    const body = await req.json();
    const { expectedRevision, requestId } = body;

    const shopId = getShopId();
    const db = getAdminFirestore();
    const payloadHash = computePayloadHash(owner.uid, 'DELETE', `${employeeId}:photo`, {
      expectedRevision
    });

    const requestRef = getRequestsCol(shopId).doc(requestId);
    const employeeRef = getEmployeeRef(employeeId, shopId);

    const result = await db.runTransaction(async tx => {
      const cached = await checkRequestReceipt(tx, requestRef, payloadHash);
      if (cached) return cached;

      const empSnap = await tx.get(employeeRef);
      if (!empSnap.exists) throw new Error('NOT_FOUND');

      const current = empSnap.data() as any;
      if (current.revision !== expectedRevision) throw new Error('CONFLICT');

      const previousObjectPath = current.photo?.objectPath;
      const newRevision = current.revision + 1;
      const now = new Date().toISOString();

      tx.update(employeeRef, {
        photo: null,
        revision: newRevision,
        updatedAt: now
      });

      recordAudit(
        tx,
        shopId,
        owner.uid,
        'DELETE_PHOTO',
        employeeId,
        current.photo,
        null,
        requestId
      );

      const responsePayload = {
        employeeId,
        photo: null,
        revision: newRevision
      };

      recordRequestReceipt(tx, requestRef, {
        requestId,
        actorUid: owner.uid,
        method: 'DELETE',
        entityKey: `${employeeId}:photo`,
        payloadHash,
        response: responsePayload,
        createdAt: now
      });

      if (previousObjectPath) {
        const storage = getAdminStorage();
        storage.bucket().file(previousObjectPath).delete().catch(() => {});
      }

      return responsePayload;
    });

    return createSuccessResponse(result, requestId);
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string; statusCode?: number };
    if (error.message === 'CONFLICT') {
      return createErrorResponse('CONFLICT', undefined, 409);
    }
    return createErrorResponse(
      error.code || 'INTERNAL_ERROR',
      error.message,
      error.statusCode || 500
    );
  }
}
