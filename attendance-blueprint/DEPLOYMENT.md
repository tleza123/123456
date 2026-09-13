# ติดตั้ง DE TEAM บน Firebase + GitHub + Vercel

คู่มือนี้เป็นขั้นตอนที่ Gemini ต้องทำให้เป็นคู่มือติดตั้งจริงของโค้ดที่สร้างแล้ว ไม่ได้แปลว่ามีการสร้างบัญชี เปิด billing หรือ deploy ในงานพิมพ์เขียวนี้

## 1. เตรียมโค้ดและ environment

1. สร้าง repo/project แยกจากเว็บเดิม หากเป็น monorepo ระบุ Root Directory ของเว็บใหม่
2. ติดตั้ง Node LTS/package manager ตาม package.json ที่ Gemini ล็อกไว้ รัน npm ci จาก lockfile
3. คัดลอก .env.example เป็น .env.local ในเครื่อง ใส่ค่า DEV ผ่านไฟล์ส่วนตัว ไม่ส่งไฟล์จริงเข้า Git
4. CI/build ต้องทำได้โดยไม่เชื่อม production และไม่ต้องอ่านข้อมูลเงินจริงตอน build

## 2. สร้าง Firebase DEV และ PROD แยกกัน

1. สร้าง Firebase project สองชุด เลือกชื่อที่แยกชัด เช่น de-team-dev กับ de-team-prod โดยใช้ ID ที่สร้างได้จริง
2. Add web app แล้วเก็บ Firebase web config ใน environment ของแต่ละชุด
3. เปิด Authentication → Google provider ตั้ง support email ตามบัญชีเจ้าของ
4. เปิด Firestore เลือก region ที่เหมาะสม ห้ามเปิด test rules แบบสาธารณะเพื่อให้ระบบทำงาน
5. เปิด Storage ตาม billing requirement ปัจจุบัน ให้เจ้าของเป็นคนตรวจแผนและยืนยันค่าใช้จ่ายเอง ตั้ง budget alerts
6. Deploy rules/indexes เฉพาะ project ใหม่ที่ระบุชัดเจน คำสั่งตัวอย่างหลังคัดลอก config เข้าโค้ด production: `firebase deploy --only firestore:rules,firestore:indexes,storage --project <DEV_PROJECT_ID>`; สำหรับ PROD เปลี่ยนเป็น ID ที่ตรวจแล้ว ไม่ใช้ default project โดยไม่รู้ target
7. ตำแหน่งไฟล์ firebase.json และ relative rules paths ต้องตรงกับ repository จริง

## 3. ตั้ง owner UID โดยไม่เปิดช่องสมัครเป็นเจ้าของ

1. รันหน้า login ใน DEV และให้เจ้าของ sign-in Google ได้ UID ใน Firebase Authentication Users
2. ระหว่าง OWNER_UID ยังไม่ตั้ง ทุก data API ต้องปฏิเสธ ไม่ใช่ให้คนแรกเป็นเจ้าของ
3. ใส่ OWNER_UID ใน server env ผ่าน dashboard หรือไฟล์ .env.local ที่ไม่เข้าGit
4. ทำแยกใน PROD เพราะ UID อาจต่างกันตาม Firebase project
5. ทดสอบบัญชีอื่นว่า login ได้แต่ไม่มีสิทธิ์ข้อมูล, ไม่มีloginเรียกAPIไม่ได้, directFirestore/Storageไม่ได้

## 4. Credential ฝั่ง server

ตั้ง firebase-admin ด้วย identity ที่รองรับและจำกัด IAM ตามที่จำเป็นกับ Firestore, Auth verification และ bucket เป้าหมาย ไม่ให้ Owner role แบบกว้างโดยไม่จำเป็น

ถ้าใช้ service account private key ให้ใส่เฉพาะ Vercel server environment ที่ต้องใช้และ .env.local ส่วนตัว ไม่ใส่ใน repo, NEXT_PUBLIC_, buildlog, chat หรือ frontend bundle

ตัวแปรที่ต้องมีตาม implementation:

- NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_APP_ID
- FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
- FIREBASE_STORAGE_BUCKET, OWNER_UID, SHOP_ID, APP_ENV

Web config เป็นค่าที่ browser ต้องรู้ ไม่ใช่ Admin secret การป้องกันข้อมูลต้องอยู่ที่ API auth/IAM/rules ไม่อาศัยซ่อน web apiKey

ไม่ใช้ service account ของ production ใน CI/PR/Preview หาก key รั่วให้ revoke/rotate ไม่เพียงลบไฟล์ล่าสุดจากGit

## 5. Local/Emulator และ setup

1. ตั้ง Firebase Emulator Suite สำหรับ Auth/Firestore/Storage ตาม firebase.json
2. ต่อ emulator เฉพาะ DEV/test ผ่านตัวแปรที่ระบุ explicit ห้าม fallback เชื่อม production เมื่อ emulator ไม่ทำงาน
3. setup สร้าง profile/control/calendar เริ่มต้นแบบ idempotent ตรวจ schema ไม่ล้างcollection
4. demo seed ต้องตรวจ project/environment ซ้ำและปฏิเสธ PROD; demo data เป็นชื่อสมมติ
5. ทดสอบ finance engine, API owner guard, rules deny all, transactions และ close job ก่อนขึ้น Preview

## 6. GitHub และ CI

1. ใช้ repo private เมื่อสร้างใหม่ ไม่มีค่าจริงใน .env.example
2. ignore env, credentials, emulator exports, backups และlogs แต่ commit lockfile/rules/indexes/schema/scripts
3. Actions รัน npm ci → lint → typecheck → unit → Emulator integration/rules → build
4. CI ของPRไม่ใช้ production secrets โดยเฉพาะfork
5. code changes ใช้ branch codex/... หรือชื่อที่เจ้าของกำหนด ตรวจCIก่อน release; งานเอกสารในrepoเดิมยังทำตามกฎorigin mainที่เจ้าของให้ไว้

## 7. Vercel Preview

1. Import GitHub repository เลือก Next.js และ Root Directory ถูกต้อง
2. ตั้ง Preview env เฉพาะ DEV Firebase/Admin/OWNER_UID ของDEV
3. กำหนด preview domain คงที่เพื่อทดสอบAuth หรือเพิ่ม authorized domain ที่แน่นอน ไม่เพิ่ม wildcardโดยเดา
4. เพิ่ม domain นี้ใน Firebase Authentication Authorized Domains; localhostต้องตรวจว่ามีหรือเพิ่มเฉพาะDEVที่ใช้งาน
5. หากใช้ popup ตรวจมือถือจริง หากใช้ redirect ทำ authDomain/handler ตาม Firebase redirect guidance ไม่สมมติว่าข้ามdomainทำงานทุกSafari
6. ตั้ง function region ใกล้ Firestore ตามแผนที่รองรับ ตรวจ bundle ใช้Node runtimeและมีsharp/native dependencyที่buildได้จริง
7. ทดสอบการเปิดURLใหม่,login,เช็คชื่อ,reports,privatephoto,close/resume/cancel/reopen และlogout ไม่มี401loopหรือข้อมูลDEVไปPROD

## 8. Vercel Production

1. เจ้าของตรวจเลือกแผนที่รองรับกิจการตามเงื่อนไขปัจจุบัน ไม่ใช้Hobbyโดยอ้างว่าเหมาะกับธุรกิจโดยอัตโนมัติ
2. ตั้ง Production env เฉพาะ PROD, Production branch main และdomainที่ตกลง
3. productionไม่มี *_EMULATOR_HOST, ไม่มีdemo flags, APP_ENVต้องตรง deployment และFirebase projectที่คาดไว้
4. Deploy rules/indexes ของPRODในโปรเจกต์ใหม่ ตรวจเสร็จก่อนเปิดเส้นทางใช้งานจริง
5. ตรวจ Firebase authorized domain ของProduction และเจ้าของUIDของPROD
6. รันsetupที่idempotentโดยช่องทางที่ownerเท่านั้น ไม่เปิดpublicsetupendpoint และไม่seedข้อมูลdemo
7. Deploy version ที่ผ่านCI/UAT แล้ว smoke test ตามรายการ ห้ามทดสอบลบหรือแก้ข้อมูลจริงเพื่อจำลองfailure ใช้DEVสำหรับfault injection
8. Environment changes อาจต้อง redeploy ตรวจURL/commitที่ใช้งานจริง ไม่อ้างว่าเปลี่ยนค่าแล้วdeploymentเก่าได้รับทันทีเสมอ

## 9. สำรองและดูแล

GitHubเก็บเฉพาะโค้ด ไม่ได้สำรองFirestore/Storage จัดสำรองข้อมูลและรูปแบบprivateโดยมีmanifest/checksumและretentionตามที่เจ้าของเลือก ทดสอบrestoreในDEVพร้อมเทียบยอดเดือนปิด

ก่อนmigrationสำรองและdryrun มีschemaVersion/idempotency ไม่clear/resetproduction RollbackVercelคืนโค้ดไม่คืนข้อมูล จึงต้องรักษาbackward compatibilityของschemaและsnapshot

ติดตามค่าใช้จ่าย read/write/storage/egress/functions ตั้งbudget alertsและspend controlsที่บริการรองรับ alertsไม่ใช่hardcap Logเฉพาะcode/requestId/เวลา ไม่ใส่tokenหรือเงินเดือนทั้งpayload

## 10. หลักฐานส่งมอบที่ต้องมี

- GitHub repo/commit และVercelURLที่ตรวจจริง
- Firebase projectID/environment mapping โดยไม่เผยcredential
- CIผลผ่านและผลEmulator
- ผลresponsive/มือถือจริง/2Mbps พร้อมเครื่องและเงื่อนไข
- ยืนยันownerเข้าได้ บัญชีอื่นเข้าไม่ได้ และรูปไม่public
- ผลsnapshotปิดเดือน/เปลี่ยนอัตรา/คืนข้อมูลในDEV
- ส่วนที่เจ้าของยังต้องทำในConsoleหรือการเลือกbilling ระบุอย่างชัดเจน

เอกสารทางการประกอบ: [Vercel GitHub](https://vercel.com/docs/git/vercel-for-github), [Vercel env](https://vercel.com/docs/environment-variables), [Firebase Auth](https://firebase.google.com/docs/auth/web/google-signin), [Redirect guidance](https://firebase.google.com/docs/auth/web/redirect-best-practices), [Storage billing](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024), [Vercel plans](https://vercel.com/docs/plans/hobby)
