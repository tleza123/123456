# DE TEAM — Firebase · GitHub · Vercel

แผนฉบับใหม่สำหรับ Gemini ใช้แทนแผน Apps Script / Google Sheets เดิม

## 1. เป้าหมายและขอบเขต

เว็บเช็คชื่อและสรุปค่าจ้างภาษาไทยสำหรับเจ้าของหนึ่งคน ใช้โทรศัพท์เป็นหลัก ผู้ใช้ Gen X ไม่ถนัดเทคโนโลยี มีเพียง **เช็คชื่อ / รายงาน / ตั้งค่า** ชื่อระบบ DE TEAM เปลี่ยนชื่อที่แสดงได้ ให้ความสำคัญกับยอดถูกต้อง อ่านง่าย กดง่าย และตอบสนองลื่น

ชุดนี้เป็นแผนสำหรับพัฒนา ไม่ใช่เว็บ Firebase ที่ deploy แล้ว `preview.html` เป็น UI จำลองในหน่วยความจำ โค้ดคำนวณปัจจุบันคือ `payroll-core.cjs` พร้อม `verify.cjs` เอกสารและโค้ดระบบเดิมอยู่ใน `legacy/apps-script/` เพื่ออ้างประวัติเท่านั้น ห้ามใช้เป็น runtime ใหม่

กติกาที่เจ้าของยืนยัน: เต็มวัน 1 เท่า ครึ่งวัน 0.5 เท่า ไม่มา 0 บาท ยังไม่เช็คไม่ใช่ไม่มา เงินพิเศษหลายรายการเป็นยอดเต็มต่อเดือน ไม่เฉลี่ยตามวันทำงาน ผู้ดูแลหนึ่งคน

ใช้เดือนปฏิทินและ Asia/Bangkok; วันทำงานเสนอจันทร์–เสาร์ให้เจ้าของตรวจครั้งแรก เพิ่มวันหยุด/วันทำงานพิเศษได้ ไม่มี OT หักเงิน ภาษี ประกันสังคม เบิกล่วงหน้า หรือวันลามีค่าจ้างอัตโนมัติ ใช้คำว่า “ยอดค่าจ้าง” ไม่ใช่ยอดสุทธิหลังหัก

## 2. สถาปัตยกรรมที่เลือก

| ส่วน | เทคโนโลยี |
|---|---|
| หน้าเว็บ | Next.js App Router + TypeScript + React; Client Components เฉพาะส่วนโต้ตอบ |
| CSS | CSS Modules + design tokens ไม่มี UI framework หนักหรือ CDN runtime |
| เข้าสู่ระบบ | Firebase Authentication ผ่าน Google Account |
| ฐานข้อมูล | Cloud Firestore |
| รูปพนักงาน | Cloud Storage for Firebase แบบ private |
| API/สูตรเงิน | Next.js Route Handlers บน Vercel Functions, Node.js runtime, firebase-admin |
| เก็บโค้ดและ CI | GitHub + GitHub Actions |
| โฮสต์และ release | Vercel เชื่อม GitHub แยก Preview/Production |

เส้นทาง: Browser → Firebase Auth → ID token → Vercel API ตรวจ owner UID → Firestore/Storage ผ่าน Admin SDK → ผลลัพธ์ที่ตรวจแล้ว → UI

Browser ใช้ Firebase Web SDK เฉพาะ Auth ข้อมูลธุรกิจทั้งอ่าน/เขียนผ่าน API same-origin ไม่ใช้ Firestore Web SDK อ่านเขียนโดยตรงในรุ่นแรก จึงไม่มี Firestore offline persistence หรือ client realtime listeners ในแผนนี้

ไม่ใช้ Apps Script, Google Sheets เป็นฐานหลัก, Firebase Hosting, Cloud Functions หรือ server เพิ่มที่ไม่จำเป็น GitHub เก็บโค้ด ไม่ใช่ฐานข้อมูลพนักงาน

เลือกเวอร์ชัน stable ที่เข้ากันได้ขณะเริ่มงาน ระบุใน package.json และ lockfile ไม่เดา import API หรือใช้เลขเวอร์ชันลอย ตรวจ [Next.js project structure](https://nextjs.org/docs/app/getting-started/project-structure) และ [Vercel Node runtime](https://vercel.com/docs/functions/runtimes/node-js)

## 3. แยกโปรเจกต์และวางงบ

สร้าง Firebase project ใหม่ แยก dev/staging และ production คนละ project ไม่ใช้ project, collections, rules หรือ bucket ของเว็บสั่งเสื้อเดิม ควรมี GitHub repo แยก ถ้าอยู่ repo เดิมให้โฟลเดอร์ employee-attendance และ Vercel project/Root Directory แยก

เลือก Firestore/Storage region ใกล้ไทย และ Vercel Function region ใกล้ฐานข้อมูลตามบริการที่รองรับ ตรวจค่าที่มีจริงก่อนสร้าง ไม่เลือก region แบบสุ่ม

Cloud Storage for Firebase มีข้อกำหนดแผน Blaze ส่วน Vercel Hobby จำกัด personal/non-commercial จึงต้องเลือกแผนที่รองรับการใช้งานในกิจการนี้ ไม่รับรองว่าฟรีทั้งหมด และไม่เปิด billing ให้เจ้าของเอง [Storage billing](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024), [Vercel Hobby](https://vercel.com/docs/plans/hobby)

ตั้ง budget alerts และติดตาม reads/writes/storage/egress/function usage; alerts ไม่ใช่ hard spending cap ตรวจราคาและ spend controls ก่อนเปิดจริง [Firebase pricing](https://firebase.google.com/pricing)

## 4. Design system

| Token | ค่า |
|---|---|
| primary / dark | #003566 / #001D3D |
| accent | #FFC300 ใช้คู่ข้อความน้ำเงินเข้ม |
| background / surface | #F3F6FA / #FFFFFF |
| text / muted / border | #172B43 / #526277 / #D7E0EA |
| FULL | #166534 บน #F0FDF4 |
| HALF | #854D0E บน #FFFBEB |
| ABSENT | #991B1B บน #FEF2F2 |

สถานะมีข้อความและเครื่องหมายเลือก ไม่สื่อด้วยสีอย่างเดียว ปุ่มที่ยังไม่เลือกพื้นขาว ไม่ทำทุกปุ่มเข้มแข่งกัน

ฟอนต์ **Sarabun แบบมีหัว** ไฟล์ WOFF2 จริง 400/700 ใน `public/fonts/` พร้อมใบอนุญาต ใช้ @font-face font-display:swap; fallback Tahoma,sans-serif ไม่ใช้ Ekkamai New เป็นหลัก ไม่โหลด CDN และไม่ฝัง base64 ฟอนต์ตามข้อจำกัด Apps Script เดิม

- root html: <640=15px, 640–1023=15.5px, 1024–1439=16px, 1440–1919=16.5px, ≥1920=17.5px
- เนื้อหา/ฟอร์ม/ปุ่ม 1.2rem ประมาณ18px บนมือถือ; ชื่อ1.33rem หัวหน้า1.67rem ยอดใหญ่2rem รอง≥1.067rem
- เนื้อหา line-height1.65 หัวข้อ1.3; letter-spacing:normal; 400 สำหรับเนื้อหา 700 เฉพาะหัวข้อ ชื่อ ยอด และปุ่มสำคัญ
- ปุ่มหลัก/สถานะ≥3.467rem ประมาณ52px; รอง≥3rem ประมาณ45px; gap≥0.533rem; ขอบจอ1.067rem
- มุมการ์ด1.067rem ปุ่ม0.8rem border1px เงาเบา; ใช้ rem เป็นหลัก
- ไม่มีอิโมจิ glass blur glow backdrop-filter หรือการสร้าง GPU layer กับข้อความขณะอยู่นิ่ง ใช้ Lucide เฉพาะไอคอนที่จำเป็น
- touch-action:manipulation, ปุ่ม user-select:none, focus-visible ชัด; ไม่ปิด pinch zoom; ช่องกรอกบน touch≥16px
- viewport-fit=cover,100dvh,safe-area,scrollbar-gutter:stable; bottom clearance≥6rem+safe-area
- มือถือหนึ่งคอลัมน์ เมนู3แท็บด้านล่าง; desktop กึ่งกลาง max-widthประมาณ64rem เมนูชุดเดียวตาม breakpoint
- ภาพสัดส่วนเดิม height:auto max-width:100% และ contain ในพื้นที่สงวนไว้ ไม่ครอปวงกลมหรือบีบรูป
- รองรับ text zoom200%; ถ้าปุ่มไม่พอให้ reflow แทนการลดฟอนต์ ไม่มี horizontal overflow

## 5. หน้าเข้าสู่ระบบและ session

หน้า login อยู่นอก3แท็บ แสดงชื่อระบบ หัว “เข้าสู่ระบบ” และปุ่ม “เข้าสู่ระบบด้วย Google” ไม่มีสมัครสมาชิก/รหัสผ่านเอง

เริ่มด้วย popup จากการกดโดยตรง หากถูกบล็อกให้ข้อความแก้ไขสั้น ๆ ถ้าเพิ่ม redirect fallback ต้องทำตามข้อจำกัด authDomain และ third-party storage พร้อมทดสอบ Safari ไม่เพียงสลับเป็น signInWithRedirect แล้วถือว่าเสร็จ [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin), [Redirect best practices](https://firebase.google.com/docs/auth/web/redirect-best-practices)

ใช้ browserSessionPersistence เป็นค่าเริ่มต้น ไม่เขียน token ลง localStorage เอง ไม่ log token หรือใส่ query string หลัง auth ส่ง `Authorization: Bearer <ID token>` ไป API

API ตรวจ Firebase ID token และ UID ตรง OWNER_UID จาก server environment ทุก endpoint การ sign-in สำเร็จไม่ได้ให้สิทธิ์เงินเดือน ห้ามตั้งผู้สมัครคนแรกเป็น owner อัตโนมัติ หรือเชื่อ email/isAdmin/role จาก body

บัญชีอื่นเห็น “บัญชีนี้ไม่มีสิทธิ์ใช้งาน” และ “เปลี่ยนบัญชี” ไม่เปิดเผย email เจ้าของ Token หมดอายุ refresh ผ่าน SDK แล้ว retryได้1ครั้งโดย mutation ใช้ requestId เดิม

HTML shell ไม่มีเงินเดือน/รูปก่อน auth มี logout ในตั้งค่า เมื่อ logout ล้าง memory cache และ revoke blob URLs และป้องกัน response จาก session เก่ากลับมา render

## 6. แท็บเช็คชื่อ

ลำดับ: หัวเช็คชื่อ → วันที่ไทย → เลือกวัน/วันนี้ → “เช็คแล้ว 8 จาก 12 คน” → ทั้งหมด/ยังไม่เช็ค → ค้นหาเมื่อ>8คน → การ์ดรายชื่อ

การ์ด: รูปหรือชื่อย่อ + ชื่อใหญ่ + ตำแหน่งรอง → **เต็มวัน / ครึ่งวัน / ไม่มา** สามปุ่มเท่ากัน → สถานะบันทึก/เวลา → “แก้ไขรายการ” ไม่จำเป็นต้องโชว์ค่าแรงในหน้านี้

กดแล้วแสดง pending ทันที ปิดเฉพาะปุ่มคนที่กำลังบันทึก คนอื่นยังใช้งานได้ สำเร็จจึงแสดง “บันทึกแล้ว” ครั้งแรกไม่ต้องยืนยันทุกคน ไม่เรียงคนใหม่ทุกครั้งจนกดผิดคน

เปลี่ยนสถานะเก็บ audit; undo เป็น mutation ใหม่ที่อ้าง revision ล่าสุด; ล้างต้องยืนยัน ใช้ UNMARKED เพิ่ม revision ไม่ delete ประวัติ

Server คุม today Bangkok ห้ามใช้ UTC slice ของเครื่อง เช็คอนาคตไม่ได้ ย้อนหลังได้เฉพาะ OPEN; CLOSING/CLOSED อ่านอย่างเดียว

วันหยุดแสดงวันหยุดตามตาราง หากมาทำงานจริงกด “บันทึกวันทำงานเพิ่ม” เปลี่ยน calendar แบบมี audit ก่อน ไม่ถือว่าขาดงานและไม่คิด OT เอง รายชื่อขึ้นตามช่วง startDate/endDate ของวันที่เลือก

ไม่มีคน: “ยังไม่มีรายชื่อพนักงาน”+เพิ่มพนักงาน; โหลดไม่ได้: “โหลดรายชื่อไม่สำเร็จ”+ลองอีกครั้ง; ไม่พบชื่อ: ล้างค้นหา

Offline ก่อนส่งให้รักษา draft และแจ้งยังบันทึกไม่ได้; timeout แสดง “ยังยืนยันการบันทึกไม่ได้” + ตรวจสอบอีกครั้ง โดยอ่าน receipt หรือส่ง requestId เดิม ห้ามเดาว่า server ไม่ได้เขียนแล้วส่ง ID ใหม่; conflict โหลดสถานะใหม่ให้ตรวจไม่ทับเอง

## 7. แท็บรายงาน

หัวรายงาน → เดือน/ปี → ยอดค่าจ้างเดือนนี้ → ค่าแรงสะสมและเงินพิเศษแยกกัน → pending → รายชื่อ → ตรวจและปิดเดือน/พิมพ์รายงาน

เดือนยังไม่จบใช้ “ยอดสะสมถึง …” เงินพิเศษยังเป็นยอดเต็มของเดือน หากยังไม่เช็คต้องเห็นชัด ไม่ทำให้ดูเป็นยอดปิดแล้ว

การ์ดรายคนเป็นปุ่มเต็มความกว้าง แสดงชื่อ/ตำแหน่ง/ยอด/FULLกี่วัน/HALFกี่วัน/ABSENTกี่วัน/pending ไม่มีตารางเลื่อนข้างหรือกราฟที่ไม่ช่วยจ่ายเงิน

กดชื่อ: กลับรายงาน → ชื่อและเดือน → ยอดใหญ่ → จำนวนวันแต่ละสถานะและวันคิดค่าจ้าง → ค่าแรงรวม → เงินพิเศษแต่ละรายการ → รวม → ประวัติรายวัน

วันที่มาทำงาน = FULL+HALF; วันคิดค่าจ้าง = FULL+HALF×0.5 ต้องแยกความหมาย ถ้าเปลี่ยนอัตรากลางเดือนแสดงช่วงอัตรา ไม่ใช้ค่าแรงล่าสุดคูณทั้งเดือน

กดวันที่ไปแก้เมื่อ OPEN ได้ มี “แก้เงินพิเศษเดือนนี้” จากหน้านี้โดยตรง วันยังไม่เช็คแสดงรอเช็คและ “—” วันหยุดไม่เป็น absent อนาคตไม่เป็น pending; คนสิ้นสุดงานยังปรากฏเมื่อมีข้อมูล/ช่วงจ้างในเดือนนั้น

พิมพ์ใช้ print CSS ซ่อนเมนู/ปุ่ม แสดงชื่อร้าน เดือน เวลา สถานะร่าง/ปิด และยอด ไม่ต้องเพิ่มบริการ PDF ภายนอก

## 8. แท็บตั้งค่า

หน้าหลัก: เพิ่มพนักงาน → รายชื่อพร้อมรูป/ตำแหน่ง/ค่าแรง/แก้ไข → filter ทำงานอยู่/สิ้นสุดงาน → วันทำงาน/วันหยุด → ชื่อร้าน → logout

ฟอร์มหน้าเต็ม: รูป → ชื่อ1–100ตัวอักษร → ชื่อเล่น≤40 → ตำแหน่ง≤80 → เริ่มงาน → ค่าแรงต่อวัน → วันที่เริ่มใช้อัตรา → เงินพิเศษหลายรายการพร้อมเดือนมีผล → รายละเอียด≤500 → บันทึก/ยกเลิก

ตำแหน่งพิมพ์ได้และแนะนำคำเดิม ไม่ต้องสร้างหมวดก่อน ชื่อซ้ำให้เตือนแยกคนแต่ยอมรับเพราะใช้ employeeId เป็น key จำนวนเงิน0ถึง1,000,000.00บาท≤2ทศนิยม ค่า0ต้องยืนยันกันผิดพลาด ใช้ strict parser ปฏิเสธ1e6/NaN/Infinity/ค่าลบ ไม่ปัดเองเงียบ ๆ

เปลี่ยนค่าแรงสร้าง RateHistory effectiveFrom; วันมีผลซ้ำต้องแก้แบบ explicit revision ห้ามมีสองอัตราวันเดียวกัน ตรวจผลกระทบเดือนปิดและกัน race กับ close

เงินพิเศษประจำเป็น template ชื่อ/จำนวน/เดือนเริ่มสิ้นสุด/version; เงินพิเศษรายเดือนเป็น snapshot ที่สร้างครั้งเดียวตาม employee/month/template/version ไม่สร้างซ้ำทุก GET และไม่ sync ทับเมื่อ template เปลี่ยน

เพิ่ม/แก้/ลบ MonthlyExtras ต้อง invalidate review เดิม มีการ review แม้0รายการ ผู้เข้า/ออกกลางเดือนยังได้ยอดเต็มตามกติกานี้ ให้เจ้าของปรับรายเดือนเอง

พนักงานออกใช้ endDate รวมวันสุดท้าย ไม่ลบประวัติ ถ้ามี attendance หลังวันที่กำลังตั้งให้แจ้งและหยุด ไม่ลบทิ้ง เดือนปิดต้องเปิดก่อนแก้ข้อมูลที่กระทบ

ปฏิทินมี workweek versions + date overrides + systemStartDate ไม่เปลี่ยนตารางปัจจุบันแล้วทำอดีตเปลี่ยน ไม่สมมติทุกคนมีวันหยุดส่วนตัวต่างกัน หากต้องการให้พัฒนา employee calendar เพิ่มชัดเจน

## 9. Firestore schema

ทุกเส้นทางใต้ `shops/{SHOP_ID}` โดย SHOP_ID มาจาก server environment ไม่รับจาก browser ให้เลือกข้ามร้านได้

```text
shops/{shopId}/profile/main
shops/{shopId}/control/finance
shops/{shopId}/employees/{employeeId}
shops/{shopId}/employees/{employeeId}/rates/{rateId}
shops/{shopId}/employees/{employeeId}/extraTemplates/{templateId}
shops/{shopId}/calendarVersions/{versionId}
shops/{shopId}/calendarOverrides/{YYYY-MM-DD}
shops/{shopId}/months/{YYYY-MM}
shops/{shopId}/months/{YYYY-MM}/attendance/{dateKey_employeeId}
shops/{shopId}/months/{YYYY-MM}/extras/{extraId}
shops/{shopId}/months/{YYYY-MM}/extraReviews/{employeeId}
shops/{shopId}/months/{YYYY-MM}/closures/{closureId}
shops/{shopId}/months/{YYYY-MM}/closures/{closureId}/employees/{employeeId}
shops/{shopId}/months/{YYYY-MM}/closures/{closureId}/employees/{employeeId}/parts/{partId}
shops/{shopId}/closeJobs/{requestId}
shops/{shopId}/requests/{requestId}
shops/{shopId}/audit/{eventId}
```

| เอกสาร | ฟิลด์หลัก |
|---|---|
| profile | schemaVersion,displayName,timezone,systemStartDate,revision |
| finance control | revision,closingMonth:nullหรือmonth,activeCloseJobId,updatedAt |
| employee | name,nickname,position,notes,startDate,endDate,revision,photo:{objectPath,width,height,version},createdAt,updatedAt |
| rate | effectiveFrom,dailySatang:int,revision,createdAt,updatedAt |
| extra template | label,amountSatang:int,effectiveFromMonth,effectiveToMonth,version,revision |
| calendar version/override | effectiveFrom,weekdays:[0..6],revision / kind:WORKDAYหรือHOLIDAY,note,revision |
| month | state:OPEN/CLOSING/CLOSED,revision,extrasRevision,currentClosureId,closedAt,closedBy |
| attendance | employeeId,dateKey,status:FULL/HALF/ABSENT/UNMARKED,revision,updatedAt,updatedBy,requestId |
| monthly extra | employeeId,label,amountSatang,sourceTemplateId,sourceTemplateVersion,revision,deletedAt |
| review | employeeId,extrasRevision,reviewedExtrasRevision,confirmedAt,confirmedBy |
| request receipt | actorUid,method,entityKey,payloadHash,response,createdAt ไม่เก็บ token |
| audit | actorUid,action,entityKey,before,after,reason,requestId,createdAt |
| closure manifest | status:STAGING/READY,sourceRevision,employeeIds,totalsSatang,manifestHash,algorithmVersion |
| snapshot per person | name,position,counts,ratePeriods,extras,baseSatang,extraSatang,totalSatang,partsCount,checksum |
| close job | monthKey,status,cursor,sourceRevision,closureId,errorCode,createdAt,updatedAt |

UUIDเป็นID ไม่ใช้ชื่อหรือarray index; เงินinteger satang; วันที่ธุรกิจstringYYYY-MM-DD ค.ศ.; เดือนYYYY-MM; serverTimestampสำหรับเวลาที่เหมาะสม และ serialize เป็นISOเมื่อคืนAPI

UNMARKEDคงdocument/revision; ลบเงินพิเศษเป็น tombstone และ audit; ข้อมูลขาด/schemaผิดต้อง error ไม่เดายอด0

เดือนที่ยังไม่มี document ให้ GET แสดงสถานะ OPEN/revision0 โดยไม่เขียนข้อมูล การ mutation ครั้งแรกสร้าง month document พร้อมข้อมูลใน transaction เดียวกัน ส่วน profile/control ต้องผ่าน setup ก่อน การเปลี่ยน extras ของคนใดให้เพิ่ม extrasRevision ใน review document ของคนนั้นและทำให้ reviewedExtrasRevision ไม่ตรง ยืนยันใหม่เฉพาะคนนั้น; month.extrasRevision ใช้ invalidation ภาพรวม ไม่บังคับตรวจทุกคนใหม่เพราะแก้คนเดียว

สร้าง firestore.indexes.json จาก query จริง เช่น attendance(employeeId,dateKey), audit(entityKey,createdAt) ดึงเฉพาะเดือน ไม่ scan ทุกปี ยกเว้น index สำหรับ text/JSONยาวที่ไม่ query

ตั้ง application budget snapshot doc≤256KiB แบ่ง daily parts เมื่อเกิน ไม่รวมทุกคนใน doc เดียว เก็บ algorithmVersion/checksum สำหรับตรวจ restore และสูตร

## 10. สูตรเงินและโค้ดอ้างอิง

```text
FULL = rateOfDateSatang
HALF = floor((rateOfDateSatang + 1) / 2)
ABSENT = 0
UNMARKED / HOLIDAY = null ในแถวรายงาน
base = sum(confirmed daily amounts)
extra = sum(active monthly extra amounts)
total = base + extra
```

ปัดแบบ half-up ต่อวัน:500.01บาทครึ่งวัน=250.01บาท รวมหลังปัดแต่ละวัน เก็บกติกาในคู่มือและ algorithmVersion ไม่แก้ snapshot เก่าเมื่อสูตรเปลี่ยน

22FULL+4HALF+2ABSENT ค่าแรง500บาท +พิเศษ2500บาท =14500บาท โดย fixture ต้องมี28วันที่กำหนดทำงานจริง ไม่ใส่เดือนตัวอย่างที่ปฏิทินไม่ตรง

อัตราที่ใช้คือ effectiveFrom ล่าสุด≤dateKey ห้ามเชื่อยอด/อัตราจากclient; missing rate/duplicate key/rate/date ต้องหยุด ไม่เลือกตัวแรกเงียบ ๆ

Expected work dates = calendar version+override ∩ employment ∩ systemStartDate ∩ ถึงtodayBangkok โค้ด payroll-core.cjs ยังรับ weekdays ชุดเดียว+override จึงต้องเพิ่ม calendar version resolver ในTypeScriptก่อนใช้งานจริง

## 11. สิทธิ์และ API safety

ทุก Route Handler ข้อมูลใช้ Node runtime, firebase-admin อยู่ server-only module ตรวจ ID token/OWNER_UID ทุกครั้ง ตรวจ revoked token ในเส้นทางอ่อนไหวตามนโยบายที่ทดสอบแล้ว ห้ามเชื่อ role/email/isAdmin ใน body [Verify ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens)

Firestore/Storage client rules deny all ตาม reference-config เพราะข้อมูลผ่าน API; Admin SDK ข้าม Firestore Rules จึงต้องมี owner guard, schema validation และ IAM ฝั่ง server จริง ห้ามอ้างว่ามี rules แล้ว API ปลอดภัยเอง [Admin SDK and rules](https://firebase.google.com/docs/firestore/security/rules-conditions)

JSON/รูป/รายงานใช้ `Cache-Control: private, no-store`; ไม่ให้ Next/CDN/shared data cache เก็บเงินเดือนร่วมผู้ใช้ HTML shellไม่มีข้อมูลก่อนauth ใช้ same-origin fetch/CORSไม่wildcard, method/content-type/body limit และ reject unknown fields

Bearer tokenส่งheaderเองและไม่อาศัยcookie authโดยปริยาย ถ้าจะเปลี่ยนเป็นsession cookieต้องออกแบบ CSRF,SameSite,secure,httpOnly ให้ครบ ไม่ทำครึ่งระบบ

ไม่logtoken,privatekey,salarypayload,รูป หรือข้อมูลจริงในanalytics แสดง errorไทยจากcodeไม่rawstack; CSP/securityheadersต้องทดสอบกับGoogleAuthไม่ตั้งจนloginเสีย

Firebase web config เช่น apiKey/projectId ไม่ใช่ Admin credential แต่ต้องจำกัดการใช้ API ตามบริการที่ใช้ ส่วน Admin private key/OWNER_UID ไม่ใส่ NEXT_PUBLIC_ [Firebase API keys](https://firebase.google.com/docs/projects/api-keys)

## 12. Transaction และการส่งซ้ำ

Mutationทุกตัวมี requestId UUID + expectedRevision; normalize/hash canonical payloadรวมmethod/actor/entity เก็บreceiptถาวรในFirestore ไม่ใช้memorymapในVercelแทนreceipt

อ่านreceiptในtransactionก่อน ถ้าID/payload/actorตรงคืนผลเดิมแม้เดือนปิดแล้ว ถ้าIDเดิมpayloadต่างปฏิเสธ REQUEST_ID_REUSED; receiptเป็นผลคำขอเก่า UIต้องไม่ renderทับrevisionใหม่กว่า

คำขอใหม่อ่านcontrol/finance,month,employee,calendar/rateและentityที่เกี่ยวข้องในtransaction ตรวจgate/ช่วงจ้าง/วันที่/revision แล้วเขียนentity+audit+receipt+เพิ่มfinanceRevisionและmonthRevisionแบบatomic อ่านทั้งหมดก่อนเขียน

การแก้ชื่อ/ตำแหน่งที่ใช้snapshot,rate,calendar,employment,template ใช้ finance gate ร่วมกัน Rate/calendarย้อนหลังต้องตรวจทุก CLOSED month ที่อาจกระทบ และเพิ่มfinanceRevision เพื่อกันraceกับclose

Transactioncallbackอาจถูกเรียกซ้ำ ห้าม upload Storage/ส่งข้อความ/เปลี่ยนclientstate/สุ่มIDใหม่หรือside effectภายนอกภายในcallback สร้างID/hashก่อนเข้า [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)

control docเป็นจุดรวมwriteโดยตั้งใจสำหรับเจ้าของคนเดียว ทีม≤50คนในรุ่นแรก หากขยายต้องวัดcontentionและปรับpartition ไม่อ้างว่าscaleไม่จำกัด

Success `{ok:true,data,requestId,serverTime}`; error `{ok:false,error:{code,message,fields?,requestId}}`; ใช้401ไม่มีauth,403ไม่ใช่owner,409conflict/closed,422input,429busy,503service; timeoutclientเป็นUNKNOWN ไม่สรุปว่าไม่ได้เขียน

## 13. ปิดเดือนแบบทำต่อได้

ไม่ยัด snapshot ทุกคนใน transaction ใหญ่ ใช้ close job ที่กั้นfinancial writes ระหว่างสร้างsnapshot และทำต่อได้เมื่อVercel requestจบ

1. Start transactionตรวจเดือนสิ้นสุดBangkok,OPEN,expectedRevision,receipt/control แล้วตั้งmonth CLOSING และcontrol.closingMonth/activeCloseJobId เก็บsourceRevision,closureId และroster ทุกfinancial mutationต้องผ่านgateนี้ก่อนเขียน
2. Continue API ตรวจowner/jobที่ผูกกับgate ทำทีละชุดเล็กและcheckpointในFirestore ไม่พึ่งงานหลังHTTPresponseหรือlocaldisk ข้อมูลต้นทางนิ่งเพราะgateเริ่มก่อนอ่านและทุกmutationใช้ร่วมกัน
3. ตรวจpending,extra reviews,ratesและข้อมูลครบ ถ้าผิดแสดงชื่อ/ปัญหาให้เจ้าของcancelกลับไปแก้ ระหว่างCLOSINGยังไม่ถือว่าเดือนปิด
4. เขียนSTAGING closureและsnapshotต่อคน/parts ด้วยdeterministic keys/checksums ทำซ้ำไม่บวกยอดซ้ำ ทุกchunktransactionตรวจjob/gate กันworkerเก่าหลังcancel
5. Finalize serverตรวจmanifestครบroster,checksums,totals,sourceRevision แล้วtransactionเช็คgate/month/jobรุ่นเดิม เปลี่ยนclosure READY,month CLOSED/currentClosureId ปล่อยgateและเก็บaudit/receipt
6. UIแสดง “กำลังตรวจ … จาก … คน” ทำต่อหลังหลุดได้ Continueเรียกเฉพาะงานactive ไม่pollทั้งวัน
7. Cancel transactionตรวจjobแล้วกลับOPENปล่อยgate เก็บSTAGINGที่ยกเลิกแยกไม่ใช้รายงาน Cleanupภายหลังอย่างปลอดภัย ไม่มีการปล่อยล็อกเองตามเวลาจนworkerเก่ากลับมาเขียนได้
8. Reopenต้องยืนยัน+reason เก็บclosureเก่าimmutable การปิดใหม่สร้างclosureIdใหม่ CLOSED reportอ่านเฉพาะcurrentClosureที่READY

การแก้rate/calendarย้อนหลังต้องเปิดเดือนที่กระทบก่อน ไม่แก้snapshotเดิม Rollbackโค้ดVercelไม่ใช่rollbackFirestore

## 14. รูปพนักงานใน Storage

เลิกเก็บbase64ในSheet/Firestore เก็บเฉพาะobjectPath/dimensions/version ในFirestore ภาพอยู่private Storage

ClientรับJPEG/PNG/WebPต้นทาง≤5MBและ≤20ล้านพิกเซล Canvasย่อด้านยาว≤800pxคงสัดส่วน แปลงJPEGเป้าหมาย≤200KiB ลดขนาดแบบมีขอบเขต ถ้าไม่ผ่านแจ้งก่อนส่ง ไม่ส่งต้นฉบับ5MBเข้าVercel

API upload bodyรวม≤1MiBตรวจbytesจริงไม่เชื่อContent-Length ตรวจownerก่อนdecodeภาพ ใช้sharpหรือไลบรารีที่ตรวจสอบแล้วจำกัดpixels,rotateตามorientation,stripmetadata,re-encodeเป็นthumb≤192pxและdisplay≤800px ไม่เชื่อMIME/headerอย่างเดียว

Path `shops/{SHOP_ID}/employees/{employeeId}/{requestId}/thumb.jpg` และdisplay.jpgสร้างจากserver ไม่รับpathอิสระ ไม่มีpublicACL/permanentdownloadtoken ไม่ใช้getDownloadURLทำรูปพนักงานเปิดสาธารณะ

StorageกับFirestoreไม่atomicร่วมกัน: uploadobjectใหม่ก่อน → ตรวจสำเร็จ → Firestoretransactionสลับphoto pointer+revision+audit+receipt → cleanupภาพเก่าทีหลัง หากล้มเหลวรูปเดิมยังใช้งานได้ retryใช้requestId/hashรูปเดิม ไม่รับIDเดิมรูปต่าง orphan cleanupตรวจreferenceก่อนลบ

อ่านผ่านauthenticated GET photo API ซึ่งหาpathจากemployee doc Browserfetchblobด้วยtokenแล้วcreateObjectURLใส่img revokeเมื่อเปลี่ยน/ออกจากระบบ มีlazyloadingและplaceholder ไม่ให้image optimizerสาธารณะแคชรูปprivate

Vercel Functionมีเพดานpayload4.5MB ณเอกสารที่ตรวจ จึงกำหนดapplication limitต่ำกว่าอย่างตั้งใจ [Function limits](https://vercel.com/docs/functions/limitations)

## 15. API contract ที่ต้องทำครบ

| Endpoint | หน้าที่ |
|---|---|
| GET /api/bootstrap | profile,serverToday,เดือน,รายชื่อย่อ,เช็ควันนี้,state ไม่มีภาพbase64/ประวัติทุกปี |
| GET /api/attendance?date= | คนและสถานะวันที่เลือก+revision+workday/closed flags |
| POST /api/attendance | date/employeeId/status/revision/requestId |
| GET /api/requests/{id} | receiptของowner/shopเพื่อแก้UNKNOWN |
| GET /api/reports?month= | totals/countsรายคน+pending+sourceRevision |
| GET /api/reports/{employeeId}?month= | รายวัน ช่วงอัตรา extras ยอด |
| GET/POST /api/employees | รายชื่อ/เพิ่มคนและอัตราเริ่มต้นแบบatomic |
| PATCH /api/employees/{id} | ชื่อ ตำแหน่ง notes revision ไม่รับfieldลับแก้rate |
| POST /api/employees/{id}/end-employment | ตรวจendDateกับattendanceก่อนสิ้นสุด |
| POST /api/employees/{id}/rates | เพิ่ม/แก้อัตราวันมีผลแบบexplicit revision |
| POST/PATCH /api/employees/{id}/extra-templates | versionของtemplate ไม่ทับmonthlyextras |
| POST /api/months/{month}/prepare-extras | materializeครั้งเดียว ทุกGETread-only |
| POST/PATCH /api/months/{month}/extras | เพิ่ม/แก้/tombstoneและinvalidate review |
| POST /api/months/{month}/review-extras | ยืนยันrevisionต่อคน แม้0 |
| GET/POST /api/calendar | versions/overridesไม่แก้เดือนปิด |
| GET/POST /api/employees/{id}/photo | private read/upload; ลบรูปเป็นmutationแยกมีrevision |
| POST /api/months/{month}/close | เริ่มclose job |
| GET /api/close-jobs/{id} | สถานะ/ความคืบหน้า |
| POST /api/close-jobs/{id}/continue | ทำchunk/finalizeโดยserver |
| POST /api/close-jobs/{id}/cancel | กลับOPENหลังเช็คgate/job |
| POST /api/months/{month}/reopen | reason+revisionคงsnapshotเก่า |
| PATCH /api/settings | displayName/configที่อนุญาต ไม่มีแก้owner/secretในUI |

ทุกmutationรับrequestId/revisionตามentity คุมbody/schema/length ไม่เปิดGETที่เขียนข้อมูล ปรับชื่อได้เมื่อUI/server/testsตรงกันทั้งหมด

Reportหลายqueryต้องอ่านfinanceRevisionก่อน/หลังและmonthstate ถ้าเปลี่ยนให้retryอย่างมีขอบเขต ไม่คืนรายงานผสมคนละรุ่น CLOSEDอ่านimmutable snapshot; frontendผูกresponseกับdate/month/session generation กันผลเก่าทับหน้าปัจจุบัน

## 16. ความลื่นและcache

เป้าหมายวัด: UI feedback≤100ms, cached tab≤100ms, INP≤200ms, CLS≤0.1มุ่งใกล้0, firstusefulcontent2Mbpsตั้งเป้า≤4s แยกcold/warmและเวลาauthจากAPI latency ไม่รับรองก่อนวัด

App shellเดิม stateแยกtab/date/month/person Reactkeyคงที่ ไม่remountทั้งรายชื่อเมื่อแก้คนเดียว ทุกหน้ามีskeletonตรงโครง โหลดตั้งค่าเมื่อเปิด รายงานเฉพาะเดือน font2weights local ไอคอนเฉพาะใช้

MemoryquerycacheผูกsessionUID invalidateเฉพาะส่วนหลังmutation จำกัดrequestพร้อมกัน ไม่intervalทุกวินาที refreshเมื่อfocus/staleหรือผู้ใช้กดโดยรักษาdraft privateAPIno-storeยังใช้clientmemorycacheที่แสดงเวลาโหลดได้

ไม่cacheเงินเดือน/รูปในserviceworker/localStorage ไม่ทำofflinewritesค้างคืน Pending requestIdอยู่session memory ถ้าปิดtabแล้วเปิดใหม่ต้องอ่านสถานะล่าสุดก่อนส่งคำสั่งใหม่

วัดcoldstart/readcounts/storagebytesจริง โหลดratesเป็นชุดไม่queryทีละวัน indexed monthqueries auditpagination ไม่ทำN+1 callsจากbrowser

## 17. Environment และไฟล์ production

```text
employee-attendance/
  src/app/layout.tsx, page.tsx, login/page.tsx
  src/app/api/.../route.ts
  src/components/{shell,attendance,reports,settings,shared}/
  src/features/{auth,attendance,reports,employees,extras,calendar}/
  src/lib/firebase/{client,admin}.ts
  src/lib/server/{auth,repository,idempotency,errors,finance-gate}.ts
  src/lib/payroll/{money,dates,calendar,engine,snapshots}.ts
  src/lib/validation/
  src/styles/{tokens,globals}.css
  public/fonts/{Sarabun-Regular.woff2,Sarabun-Bold.woff2,OFL.txt}
  tests/{unit,integration,rules,e2e}/
  scripts/{setup,seed-demo,backup,restore-check}.ts
  firestore.rules, storage.rules, firestore.indexes.json, firebase.json
  .github/workflows/ci.yml
  .env.example, .gitignore, package.json, lockfile
  README_TH.md, DEPLOYMENT.md, TEST_RESULTS.md
```

Client env: NEXT_PUBLIC_FIREBASE_API_KEY/AUTH_DOMAIN/PROJECT_ID/APP_ID และค่าที่SDKใช้จริง; server env: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY หรือidentityที่ตั้งถูกต้อง, FIREBASE_STORAGE_BUCKET, OWNER_UID, SHOP_ID, APP_ENV

Admin module server-only singletonเฉพาะSDKconnection ไม่เก็บbusinessstateในinstance; .env.exampleไม่มีค่าจริง .env/credentialไม่เข้าGit; productionห้ามเปิดemulator envvars

reference-config rules เป็นdenyallสำหรับprojectใหม่/architectureนี้ ห้ามdeployทับrulesเว็บเดิม

## 18. GitHub → Vercel และการสำรอง

repoใหม่privateเป็นค่าเริ่มต้น .gitignoreกัน.env*,serviceaccount,emulator exports,privatebackups,logs และอนุญาต.env.exampleที่ปลอดภัย CIใช้npm ci/lint/typecheck/unit/emulator integration/rules/build ไม่มีproductionsecretsในPRหรือfork

featurebranch codex/... → PR/CI → VercelPreviewต่อFirebaseDEVเท่านั้น → ตรวจแล้วreleaseProductionตามสิทธิ์ งานเอกสารในrepoปัจจุบันส่งorigin mainตามกฎเดิมได้ แต่ไม่ใช่อนุมัติเปิดbillingหรือเชื่อมcredentialproduction

เชื่อมrepoและRootDirectoryถูกต้อง Productionbranchmain แยกPreview/Production env; ใช้previewdomainคงที่สำหรับGoogleAuth/authorizeddomains ไม่เพิ่มทุกdeploymentdomainกว้าง ๆ Previewต้องไม่มีสิทธิ์production ใช้projectId/appEnvassertionsให้failclosedเมื่อจับคู่ผิด [GitHub integration](https://vercel.com/docs/git/vercel-for-github), [Environment variables](https://vercel.com/docs/environment-variables)

Push/mergeอาจtriggerdeployment ต้องรู้targetก่อนทำ สำรองFirestoreและStorageพร้อมmanifestในพื้นที่ownerควบคุมก่อนmigrationและตามรอบ RestoreในDEVเทียบchecksums/counts/totals GitHubสำรองโค้ดไม่ใช่เงินเดือน Migrationมีversion/dryrun/idempotency ไม่clear/resetproduction

## 19. แผนพัฒนา

1. ตรวจช่องว่างreference → scaffoldNext/TypeScript/CI/fonts ไม่แก้เว็บเดิม
2. DEV+Emulator+ownerAuth+AdminAPI+denyallrules+testsการเรียกตรง
3. schema/setup/demoแยกenvironment/calendar version resolver
4. UI3แท็บทุกempty/loading/errorstate พร้อมkeyboard/touch
5. attendance transaction/receipt/revision/financegate พร้อมtimeout/concurrency
6. employee/rates/templates/monthlyextras/reviews/privatephotosและorphan handling
7. reportengine/monthqueries/effective dates/pending/money rounding
8. closejobs/chunks/finalize/cancel/reopen/snapshotimmutability
9. print/responsive/2Mbps/realphones/accessibility/performance
10. PreviewDEV/ownerUAT → Productionsetup/releaseตามสิทธิ์ พร้อมbackup/restoreคู่มือ

## 20. เกณฑ์ส่งมอบและทดสอบ

ส่งsourceครบทุกไฟล์ ไม่มีTODO/stubในfeatureที่กดได้ ไม่มีdemoในproduction READMEไทยละเอียดและTEST_RESULTSแยกunit/emulator/browser/realFirebase/Vercel/physicaldevice

ทดสอบสูตร:เต็ม/ครึ่ง/ไม่มา/pending/วันหยุด/อนาคต/เข้าออกงาน/leapyear/เศษสตางค์/rateเปลี่ยนกลางเดือน/calendarเปลี่ยนกลางเดือน/duplicate/missingrate/templateไม่เพิ่มซ้ำ/เงินพิเศษเต็มเดือน

ทดสอบระบบ:ownerUIDผิด/expired/revokedtoken/directFirestore&Storagedenied/AdminAPIguard/privatephoto/IDซ้ำpayloadต่าง/responseหายretry/revisionconflict/rateย้อนหลังชนCLOSED/rateเปลี่ยนระหว่างclose/closefail-resume-cancel/staleworker/manifestขาด/logoutระหว่างpending/Previewจับคู่productionผิด

UI320/375/390/414/768/1024/1440/2560 portrait/landscape AndroidChrome+iOSSafari 200%zoom reducedmotion Enter/focus ไม่มีfooterบัง/overflow เน็ต2Mbps upload512kbps RTT150ms cold/warm≥5รอบ ทีม50คนข้อมูล12เดือน วัดจริงไม่แต่งผล

ยังไม่เพิ่มGPS/สแกนหน้า/QRเช็คตัวเอง/พนักงานlogin/chat/notifications/หลายร้าน/หลายผู้ดูแล/กราฟจำนวนมาก หากขยายต้องตกลงกติกาใหม่

ถ้าGeminiไม่มีสิทธิ์บัญชี ให้ทำsource/tests/คู่มือ/envexampleครบแล้วระบุขั้นตอนConsoleที่เจ้าของต้องทำ ไม่ขอprivatekeyหรือรหัสผ่านในแชต และไม่อ้างออนไลน์แล้วโดยไม่มีdeploymentที่ตรวจจริง
