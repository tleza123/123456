# วิธีใช้ชุดส่งต่อ

1. เปิด preview.html เพื่อทดลองหน้าจอ หรือดูตัวอย่างในคำตอบของ Codex
2. ส่ง BLUEPRINT.md พร้อม GEMINI_PROMPT.md ให้ Gemini
3. แนบ Payroll.gs, AttendanceService.gs, ClientBridge.html, appsscript.json และ preview.html เป็นโค้ดอ้างอิง
4. ให้ Gemini สร้างระบบครบตาม API contract แล้วเชื่อม Spreadsheet ใหม่และทดสอบก่อนใช้งานจริง

## สิ่งที่ทำงานในต้นแบบ

- สลับ 3 แท็บ เช็คชื่อ 3 สถานะ เลือกวันย้อนหลัง ล้างรายการพร้อมยืนยัน
- สรุปยอดจากข้อมูลตัวอย่างในหน่วยความจำ และเปิดรายละเอียดรายบุคคล
- เลือกเดือนตัวอย่าง สิงหาคม/กันยายน 2569
- เพิ่มและแก้ไขพนักงาน เพิ่มรายการเงินพิเศษประจำหลายแถว เลือกรูปและย่อภาพ
- ข้อมูลตัวอย่างหายเมื่อ reload ไม่เขียนไป Google และไม่ใช่ยอดเงินเดือนจริง
- แก้เงินพิเศษประจำของคนเดิมเป็นการแก้ template จึงไม่ทับเงินพิเศษรายเดือนที่สร้างแล้ว

## ส่วนที่ต้องทำต่อก่อน production

ไฟล์ server แนบเป็นแกนอ้างอิง ยังไม่มี doGet, setupSystem_, UI ที่เชื่อม Google, CRUD พนักงาน/เงินพิเศษ/รูป, ระบบปฏิทินมีวันที่มีผล, report endpoints, snapshots/close/reopen และการพิมพ์รายงานครบชุด โปรดดูข้อ 10 และ 14 ใน BLUEPRINT.md

ต้นแบบไม่จำลองการปิดเดือน การส่งข้อมูลผ่านเน็ต หรือทุก error state ที่อธิบายในพิมพ์เขียว ฟอนต์ประกาศ Sarabun พร้อม fallback Tahoma แต่ยังไม่ได้แนบไฟล์ Sarabun WOFF2 จึงใช้ฟอนต์ที่มีในเครื่อง ห้ามอ้างว่าเห็น Sarabun แน่นอน

## ผลตรวจ ณ 14 กันยายน 2569

คำสั่ง `node attendance-blueprint/verify.cjs` ผ่าน 25 กรณี ตรวจด้วยโค้ด engine และ endpoints จริงในไฟล์อ้างอิง แต่จำลอง Google services:

- ค่าจ้างเต็มวัน/ครึ่งวันและเงินพิเศษ
- อัตราเปลี่ยนกลางเดือนและการปัดเศษรายวัน
- วันยังไม่เช็ค วันหยุด วันอนาคต ช่วงจ้าง และ leap year
- การปฏิเสธข้อมูล/อัตรา/เงินพิเศษซ้ำและค่าเงินผิดรูปแบบ
- auth, revision conflict, request receipt, retry ไม่เขียนซ้ำ, month lock
- เขียน attendance/audit/receipt เป็น batch เดียว และปล่อย lock เมื่อบริการจำลอง error
- JavaScript ในตัวอย่างและ ClientBridge parse ได้ และ manifest JSON ถูกต้อง

ยังไม่ได้ยืนยันด้วย Google deployment จริงว่า active-user email ใช้ได้ตามบริบทบัญชี, atomic write สำเร็จตามสิทธิ์, quota เพียงพอ หรือ latency เป็นเท่าใด

เครื่องมือตรวจเบราว์เซอร์ปฏิเสธการเปิดไฟล์ในเครื่องตามนโยบาย URL จึง **ไม่มีผลรับรอง responsive, ภาพหน้าจอ, console errors, accessibility, 2 Mbps หรือมือถือจริง** ในชุดนี้ เกณฑ์ตรวจรับทั้งหมดอยู่ใน BLUEPRINT.md ให้ Gemini ดำเนินการเมื่อเปิด preview และติดตั้งในสภาพแวดล้อมที่อนุญาต

ไฟล์เว็บเดิม index.html/admin.html และข้อมูลหลังบ้านเดิมไม่ได้เปลี่ยน จึงไม่อ้างว่าได้ทดสอบธุรกรรมจริงของระบบสั่งเสื้อซ้ำ

## เครื่องมือสำหรับนักพัฒนา

- `node attendance-blueprint/verify.cjs` รันทดสอบอ้างอิง
- `node attendance-blueprint/build-preview.cjs` สร้าง preview.html จาก mockup.fragment.html
- Node ใช้เฉพาะการเตรียมตัวอย่างและทดสอบในเครื่อง ไม่เป็นส่วนหนึ่งของระบบ production ที่ผู้ใช้ต้องติดตั้ง
