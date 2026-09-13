# ชุดส่งต่อฉบับ Firebase + GitHub + Vercel

ใช้ BLUEPRINT.md และ GEMINI_PROMPT.md ฉบับปัจจุบันแทนแผน Apps Script / Google Sheets เดิมทั้งหมด

ไฟล์ที่ส่ง Gemini: BLUEPRINT.md, GEMINI_PROMPT.md, DEPLOYMENT.md, payroll-core.cjs, verify.cjs, reference-config/, preview.html และ mockup.fragment.html

## สิ่งที่เปลี่ยน

- Apps Script HTML Service → Next.js บน Vercel
- google.script.run → authenticated same-origin API
- Google identity ในApps Script → Firebase Auth ID token + server OWNER_UID
- Google Sheets → Firestore
- ScriptLock/Sheets batch → Firestore transaction + persistent request receipt + finance gate
- รูปbase64ในSheet → private Firebase Storage ผ่านAPI
- ฟอนต์ฝังbase64 → local WOFF2 ในpublic/fonts
- DeployAppsScript → GitHub CI/PreviewDEV/VercelProduction

## โค้ดและผลทดสอบ

payroll-core.cjs เป็นpure engineที่ย้ายจากโค้ดสูตรเดิม ไม่ขึ้นกับApps Script/Firestore มี11กรณีสูตรเงินในverify.cjs และมีการตรวจไฟล์ประกอบเพิ่มตามที่ระบุในผลรัน

ต้องportเป็นTypeScript เพิ่มcalendarversionresolver เชื่อมrepository/auth/transactions และสร้างAPI/UIจริงตามแผน ไม่ได้มีFirebaseimplementationในชุดนี้

ผลทดสอบ25กรณีของชุดเก่าเป็นสูตรและAppsScriptบริการจำลอง ไม่ใช่หลักฐานว่าFirebase/Vercelผ่าน เอกสารlegacyเก็บสถานะในอดีตเท่านั้น

ยังไม่ได้สร้างFirebaseproject,GitHubrepoใหม่,Vercelproject,เปิดbillingหรือdeploy ไม่มีproductioncredentials/ข้อมูลจริงในชุด

preview.html คงเป็นUIตัวอย่างที่ลองเช็คชื่อ รายงาน และตั้งค่าในหน่วยความจำ ข้อมูลหายเมื่อreload ไม่เชื่อมFirebase รูปแบบfontมีfallbackTahoma ยังไม่ได้แนบSarabunWOFF2จริง ไม่รับรองresponsive/2Mbps/มือถือจริงจากการตรวจsyntaxเพียงอย่างเดียว

เครื่องมือตรวจเบราว์เซอร์เคยปฏิเสธการเปิดไฟล์localตามนโยบายURL ไม่มีการตรวจหน้าใหม่ในงานอัปเดตแผนนี้

## ประวัติและแพ็กส่งต่อ

legacy/apps-script/ เก็บสำเนาแผนและโค้ดเดิมเพื่อย้อนอ่าน ไม่ใช้ในruntimeใหม่และไม่รวมในZIPฉบับFirebaseเพื่อกันGeminiทำตามแผนเก่า

ไฟล์attendance-blueprint.zipเดิมถูกลบอยู่ก่อนเริ่มงานรอบนี้ จึงไม่สร้างทับหรือstageการลบนั้น ชุดใหม่ชื่อattendance-firebase-plan.zip

ไม่แก้เว็บสั่งเสื้อเดิมหรือrulesเดิม ไฟล์AGENTS.md/GEMINI.md/CLAUDE.mdของโปรเจกต์หลักยังตรงกัน

## คำสั่งตรวจในเครื่อง

`node attendance-blueprint/verify.cjs`

โค้ดอ้างอิงนี้ไม่มีdependency Firebase จึงรันได้โดยไม่ต้องมีบัญชีหรือcredential ส่วนintegration/rules/E2Eเป็นงานที่Geminiต้องสร้างและทดสอบต่อ
