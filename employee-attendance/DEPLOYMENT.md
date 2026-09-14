# คู่มือการติดตั้งและ Deploy ระบบ DE TEAM (Firebase + GitHub + Vercel)

คู่มือฉบับนี้อธิบายขั้นตอนการติดตั้งระบบตามแผนสถาปัตยกรรม Firebase + Vercel อย่างละเอียด โดยแยกสภาพแวดล้อม DEV และ PROD อย่างชัดเจนเพื่อความปลอดภัยสูงสุดของข้อมูล

---

## 1. การเตรียมโครงการ Firebase (Firebase Setup)

### ข้อควรทราบสำคัญ
- ให้สร้าง **2 โครงการ (Projects)** แยกกันใน Firebase Console:
  1. `de-team-attendance-dev` (สำหรับพัฒนาและการทดสอบ Preview บน Vercel)
  2. `de-team-attendance-prod` (สำหรับข้อมูลจริงและการใช้งาน Production)
- **ห้าม** ใช้ Production Credentials กับ Vercel Preview Deployments เป็นอันขาด

### ขั้นตอนการตั้งค่าในแต่ละโครงการ
1. **Firebase Authentication**:
   - ไปที่ **Authentication** > **Sign-in method**
   - เปิดใช้งาน **Google Provider**
   - ในแท็บ **Settings** > **Authorized domains**:
     - DEV: เพิ่ม `localhost` และ `*.vercel.app` (Preview domains)
     - PROD: เพิ่มเฉพาะ Production Domain ของ Vercel (เช่น `attendance.dps-team.com` หรือ `de-team.vercel.app`)
2. **Cloud Firestore**:
   - ไปที่ **Firestore Database** > **Create database**
   - เลือก Location เป็น `asia-southeast1` (สิงคโปร์) เพื่อความเร็วสูงสุดในประเทศไทย
   - เลือกโหมด **Production Mode**
   - นำไฟล์ [firestore.rules](file:///c:/attendance-blueprint/employee-attendance/firestore.rules) ไป Publish (กฎจะเป็น `deny all` ป้องกันการเข้าถึงโดยตรงจาก client)
   - นำไฟล์ [firestore.indexes.json](file:///c:/attendance-blueprint/employee-attendance/firestore.indexes.json) ไป Deploy ผ่าน Firebase CLI หรือสร้าง Composite Indexes ใน Console ตามไฟล์
3. **Firebase Storage**:
   - ไปที่ **Storage** > **Get started**
   - เลือก Location เดียวกับ Firestore (`asia-southeast1`)
   - นำไฟล์ [storage.rules](file:///c:/attendance-blueprint/employee-attendance/storage.rules) ไป Publish (กฎจะเป็น `deny all` รูปทั้งหมดจะถูกดาวน์โหลดผ่าน Server Proxy เท่านั้น)
4. **Service Account (สำหรับ Server Admin SDK)**:
   - ไปที่ **Project settings** > **Service accounts**
   - กดปุ่ม **Generate new private key**
   - บันทึกไฟล์ JSON ไว้ในที่ปลอดภัย (ห้าม commit ลง Git)
   - ข้อมูลที่ต้องนำไปใช้ใน Environment Variables ได้แก่:
     - `project_id`
     - `client_email`
     - `private_key`

---

## 2. การหาและกำหนด OWNER_UID

1. ให้เจ้าของร้านเข้าสู่ระบบด้วยบัญชี Google ของตนเองในหน้า `/login`
2. ไปที่ Firebase Console > **Authentication** > **Users**
3. คัดลอกค่า **User UID** ของบัญชีเจ้าของร้าน (เช่น `abc123XYZ...`)
4. นำค่านั้นมากำหนดลงในตัวแปรสิ่งแวดล้อม `OWNER_UID` บน Vercel
5. เมื่อตั้งค่านี้แล้ว ระบบจะอนุญาตเฉพาะบัญชีที่มี UID ตรงกับค่านี่เท่านั้นในการเรียกใช้ API และจัดการข้อมูล

---

## 3. ตัวแปรสิ่งแวดล้อม (Environment Variables)

กำหนดตัวแปรสิ่งแวดล้อมบน Vercel (Settings > Environment Variables) โดยแยก Scope ให้ชัดเจน:

| ตัวแปร | Scope | คำอธิบาย |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Production, Preview, Dev | Web API Key จาก Firebase Config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Production, Preview, Dev | Auth Domain จาก Firebase Config |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Production, Preview, Dev | Project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Production, Preview, Dev | Storage Bucket Domain |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Production, Preview, Dev | Web App ID |
| `FIREBASE_PROJECT_ID` | Production, Preview, Dev | Project ID ฝั่ง Server |
| `FIREBASE_CLIENT_EMAIL` | Production, Preview, Dev | Service Account Email |
| `FIREBASE_PRIVATE_KEY` | Production, Preview, Dev | Private Key (ขึ้นต้นด้วย `-----BEGIN PRIVATE KEY-----`) |
| `FIREBASE_STORAGE_BUCKET` | Production, Preview, Dev | Storage Bucket สำหรับ Admin SDK |
| `OWNER_UID` | Production, Preview, Dev | Firebase User UID ของเจ้าของร้าน |

> **คำเตือนความปลอดภัย**: ตัวแปรของฝั่ง PROD ต้องกรอกเฉพาะใน Environment: `Production` บน Vercel เท่านั้น ส่วน `Preview` และ `Development` ให้กรอกข้อมูลของโครงการ DEV

---

## 4. การเชื่อมต่อ GitHub และการตั้งค่า Vercel

1. สร้าง GitHub Repository และ Push ซอร์สโค้ดขึ้นไป:
   ```bash
   git add .
   git commit -m "feat: complete DE TEAM attendance and payroll system"
   git push origin main
   ```
2. เชื่อมต่อ Vercel:
   - ไปที่แดชบอร์ด Vercel > กด **Add New Project** > นำเข้าจาก GitHub Repository
   - ตั้งค่า **Root Directory**: `employee-attendance`
   - Framework Preset: **Next.js**
   - Node.js Version: 20.x
3. กำหนด Environment Variables ตามตารางด้านบนให้ครบถ้วน
4. กด **Deploy**

---

## 5. การตั้งค่าข้อมูลเริ่มต้น (Initialization)

เมื่อ Deploy เสร็จสิ้นแล้ว ให้เปิด Terminal ในเครื่องที่เชื่อมต่อกับ Firebase Database และรันคำสั่ง:
```bash
# ตั้งค่าเอกสารร้านค้า การเงิน และปฏิทิน
npm run setup

# (เฉพาะ DEV) หากต้องการสร้างข้อมูลพนักงานและประวัติเช็คชื่อตัวอย่าง
npm run seed:demo
```

---

## 6. คำอธิบายค่าใช้จ่ายและโควตา (Cost & Quotas)

- **Firebase Authentication**: ใช้งานฟรีไม่จำกัดสำหรับการล็อกอินด้วย Google Identity Platform
- **Cloud Firestore**:
  - โควตาฟรี (Spark Plan): อ่าน 50,000 ครั้ง/วัน, เขียน 20,000 ครั้ง/วัน, จัดเก็บข้อมูล 1 GB
  - สำหรับร้านค้าขนาด 10–30 คน มีการเช็คชื่อวันละครั้งและดูรายงานสัปดาห์ละ 1–2 ครั้ง ปริมาณการใช้งานอยู่ที่ประมาณ **50–200 ครั้ง/วัน** ซึ่งอยู่ภายใต้โควตาฟรีอย่างสบาย
- **Firebase Storage**:
  - โควตาฟรี: จัดเก็บข้อมูล 5 GB, ดาวน์โหลด 1 GB/วัน
  - รูปถ่ายพนักงานถูกย่อเหลือขนาดไม่เกิน 200 KB ต่อรูป สำหรับพนักงาน 20 คน ใช้พื้นที่เพียงประมาณ 4 MB
- **Vercel**:
  - แผน Hobby (ฟรี): Bandwidth 100 GB/เดือน, Serverless Function Execution เพียงพอสำหรับการใช้งานคนเดียวอย่างเหลือเฟือ
- **หมายเหตุ**: ไม่จำเป็นต้องเปิดบัตรเครดิตหรือ Upgrade เป็น Blaze Plan หากปริมาณการใช้งานไม่เกินโควตาฟรีข้างต้น อย่างไรก็ตาม ในอนาคตหากมีการขยายสาขาหรือเก็บข้อมูลต่อเนื่องหลายปี ควรหมั่นตรวจสอบการใช้งานในแดชบอร์ด
