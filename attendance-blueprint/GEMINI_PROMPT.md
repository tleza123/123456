# คำสั่งส่งต่อ Gemini — Firebase + GitHub + Vercel

คัดลอกข้อความด้านล่างทั้งหมด พร้อมแนบ BLUEPRINT.md, DEPLOYMENT.md, payroll-core.cjs, verify.cjs, reference-config และ preview.html

---

ให้คุณเป็นนักพัฒนา Full-stack และ UX/UI เพื่อพัฒนาเว็บ DE TEAM เช็คชื่อพนักงานและสรุปค่าจ้างให้ครบพร้อมติดตั้ง โดยใช้ Firebase + GitHub + Vercel ตามแผนใหม่เท่านั้น

อ่านไฟล์แนบทั้งหมดก่อนเริ่ม ใช้ BLUEPRINT.md ฉบับ Firebase เป็นข้อกำหนดหลัก คำสั่งฉบับนี้แทนข้อกำหนด Apps Script / Google Sheets เดิม อย่านำระบบเดิมมาเป็น backend ใหม่

1. เป้าหมายและผู้ใช้งาน

- เจ้าของหรือผู้ดูแลคนเดียว ใช้มือถือเป็นหลัก เป็น Gen X ที่ไม่ถนัดเทคโนโลยี
- จุดเด่น: ยอดเงินถูกต้อง อ่านง่าย กดง่าย ลื่น ใช้ได้บนเน็ตช้า
- มีเพียง3แท็บ เช็คชื่อ / รายงาน / ตั้งค่า
- หน้า login อยู่นอก3แท็บ ไม่เพิ่ม dashboard หรือเมนูซับซ้อน
- ไม่ต้องเปิด Firebase Console ทำงานประจำวัน
- ลงมือสร้างระบบจริงต่อจนไฟล์ครบ ไม่จบที่เสนอแผนหรือหน้าdemo

2. Stack ที่ให้ใช้

- Next.js App Router + TypeScript + React
- CSS Modules + design tokens ไม่ใช้ framework UI หนัก
- Firebase Authentication ด้วย Google
- Cloud Firestore เป็นฐานข้อมูล
- Cloud Storage for Firebase เป็นที่เก็บรูป private
- Next.js Route Handlers บน Vercel Node.js Functions เป็น API
- firebase-admin เฉพาะ server
- GitHub เก็บโค้ดและรัน CI
- Vercel เชื่อม GitHub แยก Preview/Production
- ตรวจเวอร์ชัน stable ที่เข้ากันได้แล้วล็อก package/lockfile ไม่เดาAPI

ไม่ใช้ Apps Script, Google Sheets เป็นฐานข้อมูลหลัก, Firebase Hosting, Cloud Functions หรือบริการเพิ่มที่ไม่จำเป็น

Browserใช้ Firebase SDK เฉพาะAuth ข้อมูลพนักงาน/เงินเดือน/รูปทุกอย่างผ่าน API ที่ตรวจสิทธิ์ ไม่ให้ browser เขียน Firestore โดยตรง

3. การแยกงาน

- สร้างโปรเจกต์ใหม่หรือโฟลเดอร์ employee-attendance แยก
- ห้ามแก้หน้าเว็บสั่งเสื้อเดิม ข้อมูลเดิม หรือ rules เดิม
- Firebase DEV กับ PROD แยก project และ bucket
- Vercel Preview ต้องต่อ DEV เท่านั้น ไม่มี production credential
- GitHub repo ใหม่ควร private ถ้าทำในrepoเดิมให้ Root Directory ของ Vercel ชัดเจน
- legacy/apps-script เป็นประวัติอ้างอิง ไม่ต้องใส่ใน production build

4. กติกาค่าจ้างที่ยืนยันแล้ว

- เต็มวันได้ค่าแรง1เท่า ครึ่งวัน0.5เท่า ไม่มา0บาท
- ยังไม่เช็คไม่ใช่ไม่มา และไม่ใช่ยอด0ที่ยืนยันแล้ว
- เงินพิเศษพิมพ์ชื่อเองได้หลายรายการ เป็นยอดเต็มต่อเดือน ไม่เฉลี่ยตามวันทำงาน
- รอบรายงานเดือนปฏิทิน เวลาAsia/Bangkok
- วันทำงานเริ่มต้นเสนอจันทร์–เสาร์ ให้เจ้าของตรวจครั้งแรก
- ไม่มีOT/รายการหัก/ภาษี/ประกันสังคม/วันลามีค่าจ้าง/โอนเงินอัตโนมัติ
- ใช้คำว่ายอดค่าจ้าง ไม่เรียกเงินสุทธิหลังหัก

5. รูปแบบเว็บ

- น้ำเงิน#003566 น้ำเงินเข้ม#001D3D เหลือง#FFC300 พื้น#F3F6FA การ์ดขาว
- ตัวหลัก#172B43 ตัวรอง#526277 ขอบ#D7E0EA
- ใช้Sarabunแบบมีหัว400/700 จากWOFF2จริงในpublic/fonts พร้อมlicense
- fallback Tahoma,sans-serif ไม่ใช้Ekkamai Newเป็นหลัก ไม่โหลดฟอนต์CDNตอนเข้าชม
- เนื้อหา/ฟอร์ม/ปุ่มประมาณ18pxบนมือถือ ชื่อ20px หัว25px ยอด30px ตัวรองอย่างน้อย16px
- ใช้remและroot responsiveตามBLUEPRINT.md line-heightเนื้อหา1.65 หัว1.3 letter-spacing:normal
- ปุ่มหลัก/สถานะอย่างน้อย52px จุดกดรองอย่างน้อย44px
- ไม่มีอิโมจิ glass blur glow backdrop-filter หรือanimationรบกวน
- ใช้Lucideเฉพาะที่จำเป็นพร้อมคำกำกับ
- ภาพคงสัดส่วนเดิม ไม่ครอปวงกลม ไม่บีบรูป
- เมนู3แท็บด้านล่างมือถือ ป้องกันบังเนื้อหาด้วยsafe-areaและbottomclearance
- รองรับ320pxถึงultrawide,200%textzoom,keyboard,focus-visible,reduced-motion
- ไม่ทำตัวหนังสือเล็กลงเพื่อยัดข้อมูลให้ครบแถว

6. เข้าสู่ระบบและสิทธิ์

- หน้าloginมีปุ่มเข้าสู่ระบบด้วยGoogleปุ่มเดียว
- Firebase Auth ใช้session persistence ไม่เขียนtokenเองลงlocalStorage
- ส่งID tokenในAuthorization BearerไปAPI
- APIตรวจverifyIdTokenและUIDตรงOWNER_UIDที่serverตั้งทุกendpoint
- sign-inได้ไม่ได้แปลว่ามีสิทธิ์เงินเดือน
- ห้ามownerคนแรกอัตโนมัติ ห้ามเชื่อemail/isAdmin/roleจากclient
- บัญชีอื่นเห็นไม่มีสิทธิ์พร้อมเปลี่ยนบัญชี ไม่เปิดเผยemailเจ้าของ
- popupเริ่มจากusergesture ถ้าใช้redirectfallbackต้องตั้งauthDomain/cross-originตามเอกสารและทดสอบSafari
- ไม่มีsalary/photoในHTMLก่อนauth
- logoutล้างcacheและป้องกันresponseเก่ากลับมาแสดง
- tokenหมดอายุrefresh/retryได้1ครั้งโดยใช้requestIdเดิม

7. แท็บเช็คชื่อ

จัดลำดับหัวข้อ วันที่ เลือกวัน/วันนี้ เช็คแล้วกี่คน ตัวกรองทั้งหมด/ยังไม่เช็ค ช่องค้นหาเมื่อคนมาก และการ์ดรายชื่อ

การ์ดมีรูป ชื่อใหญ่ ตำแหน่ง และ3ปุ่มเต็มวัน/ครึ่งวัน/ไม่มา ใต้ปุ่มมีสถานะการบันทึกและแก้ไขรายการ ไม่ต้องแสดงค่าแรงในหน้านี้

- กดครั้งเดียว แสดงpendingทันที ไม่ถามยืนยันทุกคน
- ปิดเฉพาะปุ่มคนที่กำลังบันทึก ไม่ล็อกทั้งหน้า
- บันทึกแล้วเฉพาะเมื่อserverยืนยัน
- แก้สถานะได้และมีaudit
- undoเป็นmutationใหม่บนrevisionล่าสุด
- ล้างต้องยืนยันและเปลี่ยนเป็นUNMARKED ไม่ลบประวัติ
- เช็คย้อนหลังได้ในOPEN ห้ามอนาคต CLOSING/CLOSEDอ่านอย่างเดียว
- วันหยุดไม่เป็นขาดงาน เพิ่มวันทำงานพิเศษก่อนเช็คเมื่อจำเป็น
- ใช้รายชื่อที่อยู่ในช่วงจ้างของวันที่ดู
- รักษาscroll/focus ไม่จัดเรียงคนใหม่ทุกครั้ง

แสดงempty/error/offlineอย่างชัดเจนมีปุ่มแก้ไขที่ตรงเหตุการณ์

timeoutต้องแสดงยังยืนยันการบันทึกไม่ได้ อ่านreceiptหรือretryIDเดิม ห้ามสร้างIDใหม่เพราะเดาว่าการบันทึกล้มเหลว conflictต้องให้ตรวจข้อมูลล่าสุดก่อนเลือกใหม่

8. แท็บรายงาน

เลือกเดือน ดูยอดรวม ค่าแรงสะสมและเงินพิเศษแยกกัน pending และรายชื่อพร้อมยอดรายคน

การ์ดแสดงชื่อ ตำแหน่ง ยอด เต็มวันกี่วัน ครึ่งวันกี่วัน ไม่มากี่วัน และยังไม่เช็คเมื่อมี

กดชื่อดูรายละเอียด ชื่อ/เดือน ยอดใหญ่ จำนวนวัน ค่าแรงรวม ช่วงอัตรา เงินพิเศษแยกรายการ และประวัติรายวัน มีปุ่มกลับและแก้เงินพิเศษเดือนนี้

- วันที่มาทำงาน=FULL+HALF
- วันคิดค่าจ้าง=FULL+HALF×0.5
- เดือนปัจจุบันแสดงยอดสะสมถึงวันที่เท่าไร
- pendingไม่ใช่absent และไม่แสดงเป็นยอดปิดแล้ว
- rateเปลี่ยนกลางเดือนต้องคิดตามแต่ละวัน
- พนักงานออกยังอยู่ในรายงานย้อนหลัง
- พิมพ์รายงานด้วยprintCSS ไม่เพิ่มบริการภายนอก
- ไม่เพิ่มกราฟมากจนชื่อและยอดหาไม่เจอ

9. แท็บตั้งค่า

เพิ่ม/แก้พนักงาน รูป ชื่อ ชื่อเล่น ตำแหน่ง เริ่มงาน ค่าแรง วันที่เริ่มใช้อัตรา เงินพิเศษประจำหลายรายการ เดือนมีผล และรายละเอียด

- labelเหนือช่อง ไม่ใช้placeholderแทนlabel
- ชื่อซ้ำได้แต่employeeIdต้องต่างกัน
- ตำแหน่งพิมพ์เองได้
- จำนวนเงินstrict0ถึง1ล้านบาทไม่เกิน2ทศนิยม ค่า0ให้ยืนยัน
- เปลี่ยนrateสร้างประวัติeffectiveFrom ไม่ทับทั้งอดีต
- รายการเงินพิเศษเพิ่มชื่อ/จำนวน/ลบรายการได้
- templateแยกจากmonthlyextras ไม่ทับเดือนที่materializeแล้ว
- รีวิวเงินพิเศษทุกคนก่อนปิดเดือน แม้0รายการ
- พนักงานออกใช้endDateไม่ลบ ถ้ามีattendanceหลังendDateให้แจ้งขัดแย้งก่อน
- วันทำงานมีeffective-datedversionsและวันหยุดoverride ไม่เปลี่ยนอดีตเงียบ ๆ
- มีชื่อร้านและlogout ไม่ใส่secretsettingsในUI

10. สูตรเงิน

เก็บสตางค์เป็นinteger ใช้strictdecimalparser ห้ามfloatingpointทำยอดคลาดเคลื่อน

FULL=rateSatang
HALF=floor((rateSatang+1)/2)
ABSENT=0
UNMARKED/HOLIDAY=nullในรายการรายวัน
total=sum(confirmed daily amounts)+sum(active monthly extras)

ปัดhalf-upต่อวัน 500.01บาทครึ่งวัน=250.01บาท บันทึกกติกาและalgorithmVersion

ตัวอย่าง22FULL+4HALF+2ABSENT ค่าแรง500 พิเศษ2500 ต้องได้14500บาท

เลือกrateล่าสุดที่effectiveFromไม่เกินวันนั้น Missingrate/duplicatekeyต้องerror ไม่ใช้0แทน ห้ามเชื่อtotalจากclient

โค้ดpayroll-core.cjsเป็นแกนอ้างอิงที่ต้องportเป็นTypeScriptและเพิ่มcalendarversionresolver รวมทั้งตรวจrecordschema/integrationให้ครบ

11. Firestoreและสิทธิ์ฐานข้อมูล

ใช้schemaภายใต้shops/{SHOP_ID}ในBLUEPRINT.md ได้แก่profile,financecontrol,employees,rates,templates,calendarversions/overrides,months,attendance,extras,reviews,closures,closejobs,requests,audit

- SHOP_IDและOWNER_UIDเลือกจากserver ไม่รับให้clientเปลี่ยนเอง
- UUIDเป็นID ไม่ใช้ชื่อหรือแถว
- dateKeyYYYY-MM-DD ค.ศ.; monthKeyYYYY-MM; timezoneBangkok
- serverTimestampสำหรับเวลาที่เหมาะสม serializeDTOก่อนส่งclient
- queriesจำกัดmonth/employeeและมีindexesตรงจริง ไม่อ่านทุกปี
- snapshotต่อคนแบ่งpartsเมื่อเกินbudget ไม่รวมทุกคนในdocเดียว
- clientFirestore/Storagerulesdenyallตามreference-config เพราะAPIใช้Admin
- AdminSDKข้ามrules ดังนั้นAPIguard/validation/IAMต้องทำจริงและทดสอบ
- ห้ามdeployrulesนี้ทับFirebaseของเว็บเดิม

12. Mutationที่ถูกต้อง

ทุกmutationมีrequestIdและexpectedRevision มีcanonicalpayloadhashรวมactor/method/entity

Firestoretransaction:
- อ่านreceiptก่อน ถ้าID/payload/actorเดิมคืนผลเดิมโดยไม่เขียนซ้ำ
- IDเดิมpayloadต่างปฏิเสธ
- คำขอใหม่อ่านfinancecontrol/month/employee/entityและข้อมูลที่เกี่ยวข้อง
- ตรวจauth gate ช่วงจ้าง calendar rate revision
- อ่านทั้งหมดก่อนwrite
- เขียนentity+audit+receipt+revisionsในtransactionเดียว

ห้ามใช้in-memorylock/receiptในVercel ห้ามStorageuploadหรือsideeffectนอกFirestoreในtransactioncallbackที่อาจretry ห้ามสุ่มIDใหม่ระหว่างretry

ทุกการแก้ชื่อที่เข้าsnapshot,rate,calendar,employment,templateและattendanceต้องผ่านfinancegate เพื่อไม่หลุดตอนปิดเดือน

13. ปิดเดือน

ใช้OPEN→CLOSING→CLOSEDและclosejobที่resumeได้ตามBLUEPRINT ไม่ทำงานยาวแล้วหวังว่าจะรันต่อหลังresponse

- starttransactionตั้งCLOSINGและfinancegateพร้อมjob/sourceRevision
- financialmutationsทั้งหมดหยุดชั่วคราวผ่านgateเดียวกัน
- ทำsnapshotทีละชุดและcheckpoint
- ตรวจpending/reviews/ratesทุกคน
- STAGINGยังไม่ใช่รายงานเดือนปิด
- ทุกchunkตรวจjob/gate ป้องกันstaleworker
- finalizeserverตรวจmanifest/checksum/roster/totalsครบ
- เปลี่ยนREADY/currentClosureId/CLOSEDและปล่อยgateอย่างatomic
- หลุดแล้วทำต่อได้ ยกเลิกแล้วกลับOPENได้อย่างปลอดภัย
- reopenต้องยืนยันและreason เก็บsnapshotเก่าimmutable
- rate/calendarย้อนหลังชนCLOSEDต้องปฏิเสธจนเปิดเดือนที่กระทบ

14. รูปพนักงาน

ใช้privateStorage ไม่เก็บbase64ในFirestore

- clientรับJPEG/PNG/WebPต้นทาง≤5MBและ≤20ล้านพิกเซล
- Canvasย่อไม่ครอป ด้านยาว≤800px เป้าหมาย≤200KiBก่อนส่ง
- uploadAPIรับbodyรวม≤1MiB ตรวจauth/bytes/schemaก่อนdecode
- serverdecodeจำกัดpixels rotate stripmetadataและre-encodeด้วยsharpหรือlibraryที่เหมาะสม
- สร้างthumbและdisplayตามสัดส่วนเดิม
- pathสร้างจากserver ใช้requestId/hashป้องกันภาพชน
- StorageและFirestoreไม่transactionร่วมกัน ต้องuploadใหม่ก่อนสลับpointerและcleanupภายหลัง
- failureต้องไม่ทำภาพเดิมหาย orphancleanupตรวจreferenceก่อนลบ
- อ่านรูปผ่านauthenticatedAPIเป็นblob ไม่มีpublicACL/permanenttoken/getDownloadURLสาธารณะ
- revokeobjectURLsตอนเปลี่ยน/ออกระบบ และไม่ให้imageoptimizerแคชprivateภาพสาธารณะ

15. APIและcache

สร้างendpointครบตามตารางBLUEPRINT รวมbootstrap,attendance,receipts,reports,employees,rates,templates,monthlyextras,reviews,calendar,photo,closejobs,reopen,settings

- Node.jsruntimeและserver-onlyAdminmodule
- Cache-Control private,no-storeสำหรับข้อมูลและรูป
- same-origin Bearerfetch ไม่CORSwildcard
- strictschema/unknownfields/bodylimit/method/contenttype
- errorcodeไทยไม่rawstack
- ไม่GETที่เขียนข้อมูล
- reportหลายqueryอ่านrevisionก่อน/หลังและretryเมื่อเปลี่ยน กันยอดคนละรุ่น
- responseผูกdate/month/sessiongeneration ไม่ให้ผลเก่าทับหน้าใหม่

16. ความลื่น

- สลับแท็บไม่reloaddocument ใช้shellเดิม
- state/querycacheแยกวันเดือนคน ไม่remountรายชื่อทั้งหมด
- memorycacheผูกUID invalidateเฉพาะส่วนที่แก้
- skeletonตรงโครงจริง ภาพสงวนพื้นที่ lazyload
- ไม่มีintervalpollingตลอด ไม่มีrequestหลายสิบอันพร้อมกัน
- ไม่เก็บเงินเดือน/รูปในlocalStorage/serviceworker
- ไม่ทำofflinewritesค้างคืน รักษาdraftและแสดงสถานะจริง
- วัด2Mbps cold/warm INP CLS responseเวลาและreadsจริง ไม่รับรอง0ms/120FPSทุกเครื่อง

17. GitHub/Vercel/Firebase setup

ทำตามDEPLOYMENT.md ตั้งDEV/PRODแยก repo/rootdirectoryถูกต้อง lockfileครบ CIมีlint/type/unit/emulator/rules/build

clientenvเฉพาะFirebasewebconfig serverenvแยกAdmincredential/OWNER_UID/SHOP_ID/APP_ENV ห้ามAdminsecretอยู่NEXT_PUBLIC_หรือGitหรือแชต

VercelPreviewใช้FirebaseDEVและauthorizeddomainที่กำหนด Productionใช้PROD ห้ามเปิดemulatorenvในProduction

Push/mergeอาจtriggerdeploy ต้องรู้targetก่อนทำ FirebaseStorageมีBlaze requirement และVercelHobbyจำกัดnon-commercial ต้องอธิบายค่าใช้จ่ายตามข้อมูลจริง ไม่สัญญาว่าฟรีทั้งหมดและไม่เปิดbillingเอง

18. ทดสอบ

- สูตรเงินทุกกรณีเดิม+calendarversion+rateย้อนหลัง+template/materialization
- FirebaseEmulator:transaction/idempotency/concurrency/closedmonth/ownerAPI/directclientrules
- closejobfail/resume/cancel/staleworker/manifestขาด/แก้rateพร้อมclose
- authหมดอายุ/revoked/บัญชีอื่น/logoutระหว่างpending
- photoprivate/ไฟล์ปลอม/ขนาดเกิน/Storageสำเร็จFirestoreล้มเหลว
- Previewenvproductionmismatch
- viewport320/375/390/414/768/1024/1440/2560 portrait/landscape 200%zoom AndroidChrome/iOSSafari
- 2Mbps upload512kbps RTT150ms cold/warm≥5รอบ ทีม50คนข้อมูล12เดือน
- ไม่มีconsoleerrors/overflow/footerบัง Focus/Enter/labelsใช้ได้
- แยกผลunit/emulator/browser/realFirebase/Vercel/physicaldeviceตามที่ทำจริง ห้ามแต่งผล

19. ไฟล์ส่งมอบ

ส่งsourceNext.jsครบ components/features/routes/server/payroll/validation/styles/localfonts และconfigrules/indexes/firebasejson/envexample/gitignore/CI/package-lockfile

มีsetupแบบidempotent,demo-seedเฉพาะDEV,backup/restorecheck,schemaVersion/migrations ไม่มีclear/resetproduction

มีREADME_TH.md,DEPLOYMENT.md,TEST_RESULTS.md คู่มือสร้างFirebase,Auth,UID,Firestore,Storage,rules,env,GitHub,VercelPreview/Production,authorizeddomains,release,backup,restore

ไม่มีTODO/stubในfeatureที่กดได้ ไม่มีsecretหรือพนักงานจริงในrepo ไม่มีdemoปนproduction

20. วิธีทำงานต่อ

เริ่มจากอ่านไฟล์และสรุปช่องว่างอย่างสั้น จากนั้นลงมือทำตามลำดับauth/schema→UI→attendance→employees/extras/photos→reports→close→tests→deployment

ไม่ต้องถามซ้ำเรื่องที่ยืนยันในเอกสารแล้ว ถ้าขาดสิทธิ์บัญชีให้ทำโค้ด/tests/คู่มือครบก่อนระบุสิ่งที่เจ้าของต้องทำ อย่าขอรหัสผ่านหรือprivatekeyผ่านแชต

ถ้าตอบผ่านแชตให้ส่งชื่อไฟล์และโค้ดเต็ม แบ่งตามไฟล์ได้พร้อมรายการที่ยังขาด ไม่ใช้ “ที่เหลือเหมือนเดิม” หากแก้workspaceได้ให้สร้างไฟล์จริงและZIP

ห้ามอ้างว่าdeployแล้วหรือไม่มีบั๊ก100%ถ้ายังไม่ได้ตรวจจริง ตอนจบรายงานสิ่งเสร็จ ผลทดสอบ วิธีเปิด และขั้นตอนบัญชี/ข้อจำกัดที่เหลือ
