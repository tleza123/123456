import 'server-only';
import { getAdminAuth } from '../firebase/admin';

export interface AuthenticatedOwner {
  uid: string;
  email?: string;
}

export class AuthError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, statusCode: number, message?: string) {
    super(message || code);
    this.name = 'AuthError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Validates request Bearer token against Firebase Admin and confirms UID matches OWNER_UID.
 * Fails closed if OWNER_UID is missing or token is invalid.
 */
export async function verifyOwner(req: Request): Promise<AuthenticatedOwner> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthError('AUTH_REQUIRED', 401, 'กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแล');
  }

  const idToken = authHeader.slice(7).trim();
  if (!idToken) {
    throw new AuthError('AUTH_REQUIRED', 401, 'กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแล');
  }

  const ownerUid = process.env.OWNER_UID;
  if (!ownerUid) {
    // If OWNER_UID is not configured on the server, reject all requests safely
    throw new AuthError('FORBIDDEN', 403, 'ระบบยังไม่ได้กำหนดผู้ดูแล (OWNER_UID)');
  }

  try {
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(idToken);

    if (decoded.uid !== ownerUid) {
      throw new AuthError('FORBIDDEN', 403, 'บัญชีนี้ไม่มีสิทธิ์เข้าถึงระบบเงินเดือน');
    }

    return {
      uid: decoded.uid,
      email: decoded.email
    };
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      throw err;
    }
    throw new AuthError('AUTH_REQUIRED', 401, 'เซสชันหมดอายุหรือข้อมูลประจำตัวไม่ถูกต้อง');
  }
}
