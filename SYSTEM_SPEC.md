# SYSTEM_SPEC: พิมพ์เขียวสถาปัตยกรรมระบบ DE 06 (Reverse Engineered Specification)

เอกสารนี้สร้างขึ้นจากการวิเคราะห์โครงสร้างข้อมูล ฟังก์ชันการทำงาน และซอร์สโค้ดจริงของระบบ **DIGITAL ENTREPRENEUR 06 (DE 06)** ทั้งหมด เพื่อใช้เป็นพิมพ์เขียวกลาง (Central Blueprint) อ้างอิงสถาปัตยกรรม ฐานข้อมูล และมาตรฐานการพัฒนา

---

## 1. Executive Architecture Summary

### 1.1 เทคโนโลยีหลัก (Tech Stack & Core Runtime)
- **Frontend Architecture**: Single Page Web Application (Vanilla HTML5, Vanilla CSS3, Vanilla JavaScript ES6+) ทำงานได้โดยไม่ต้องผ่าน Bundler หรือ Node.js Runtime ขณะเปิดใช้งานจริง
- **Styling Architecture**: Vanilla CSS Custom Properties (CSS Variables Design Tokens) รองรับการแสดงผลแบบ Fluid Responsive และ Dark Theme สำหรับหลังบ้าน
- **Typography Engine**: ฟอนต์ **Ekkamai New** (Regular 400 และ Bold 700) ผ่าน `@font-face` ภายในเครื่อง (WOFF2) ร่วมกับ Google Fonts **Prompt** เป็นระบบสำรอง (Fallback)
- **Database & Identity**:
  - Firebase Client SDK (Compat v10.12.0): `firebase-app-compat.js` และ `firebase-firestore-compat.js`
  - Offline Persistence: เปิดใช้งาน `db.enablePersistence({ synchronizeTabs: true })` เพื่อการเข้าถึงข้อมูลแบบ 0ms และรองรับการใช้งานออฟไลน์/เน็ตช้า
- **External Services & Integrations**:
  - Google Apps Script Webhook: ซิงค์ข้อมูลคำสั่งซื้อและการจองเสื้อลง Google Sheets อัตโนมัติ รองรับข้อมูลสลิปหลายใบ (Multi-slip) พร้อมวันเวลาโอน
  - Client-Side Image Compression: แปลงและบีบอัดภาพสลิปโอนเงินผ่าน HTML5 Canvas ให้เป็น WebP/JPEG Base64 คุณภาพสูงแต่ขนาดกะทัดรัดก่อนบันทึกเข้า Firestore

---

## 2. โครงสร้างสถาปัตยกรรมและการแบ่งส่วนการทำงาน (High-Level Architecture)

ระบบ DE 06 แบ่งออกเป็น 2 ส่วนหลัก:

1. **ระบบหน้าร้านและนักศึกษา (`index.html`)**:
   - ระบบจองเสื้อช็อป DE06 พร้อมคำนวณราคา ยอดเพิ่มไซส์พิเศษ และส่วนลดอัตโนมัติ (จอง 2 ตัวขึ้นไป ลด 10 บาท)
   - ระบบแนบสลิปชำระเงินแบบหลายใบ (Multi-slip Support) พร้อมระบุวันและเวลาโอนของแต่ละสลิป
   - ระบบตรวจสอบสถานะคำสั่งซื้อและประวัติการชำระเงินของนักศึกษา
   - กระดานกิจกรรมกลาง (Active Tasks): โพลล์สำรวจความคิดเห็น (Poll Voting), กระดานแลกเปลี่ยนข้อความ (Comment Board), ประกาศสำคัญ (Announcements)
   - แถบประกาศด่วนบนหน้าแรก (Home Alert Banner)

2. **ระบบหลังบ้านผู้ดูแลระบบ (`admin.html`)**:
   - ระบบป้องกันความปลอดภัยด้วยรหัสผ่านแอดมิน (Admin Password Authentication)
   - แดชบอร์ดสรุปสถิติและยอดผลิตเสื้อตามขนาด (Size Breakdown Engine: XS, S, M, L, XL, 2XL, ไซส์สั่งตัดพิเศษ) พร้อมแถบแจ้งเตือนยอดรอชำระ
   - ตารางตรวจสอบคำสั่งซื้อ ค้นหา กรองสถานะ ชำระแล้ว/รอชำระ และหน้าต่างป๊อปอัปตรวจสอบสลิปละเอียด
   - จัดการกิจกรรม (เพิ่ม ลบ แก้ไข โพลล์ กระดานข้อความ ฟอร์ม ลิงก์)
   - ตั้งค่าแถบประกาศด่วนหน้าแรก (Home Alert Banner) และปรับแต่งระบบ
   - ส่งออกข้อมูลคำสั่งซื้อเข้าสู่ Google Sheets
   - บันทึกประวัติการเข้าใช้งานระบบของผู้ดูแล (Admin Access Logs)

---

## 3. Data Models & Schemas (Firestore Collections)

### 3.1 คอลเลกชัน `orders_shirts` (ข้อมูลการจองเสื้อช็อปและการชำระเงิน)
| ฟิลด์ | ชนิดข้อมูล | คำอธิบาย |
|---|---|---|
| `studentId` | `string` | รหัสนักศึกษา (Key สำคัญ) |
| `studentName` | `string` | ชื่อ-นามสกุลนักศึกษา |
| `phone` | `string` | เบอร์โทรศัพท์ติดต่อ |
| `email` | `string` | อีเมลสำหรับส่งหลักฐาน |
| `summary` | `string` | สรุปรายการไซส์เสื้อและจำนวนที่จอง (เช่น `L: 1 ตัว, M: 1 ตัว`) |
| `details` | `object` | อ็อบเจกต์เก็บจำนวนแต่ละไซส์ `{ xs: 0, s: 0, m: 1, l: 1, xl: 0, xxl: 0, custom: 0, customText: "" }` |
| `totalQty` | `number` | จำนวนเสื้อทั้งหมดที่จอง |
| `totalPrice` | `number` | ยอดเงินที่ต้องชำระสุทธิ (หักส่วนลดแล้ว) |
| `paidAmount` | `number` | จำนวนเงินที่บันทึกการชำระ |
| `paymentStatus` | `"paid"` \| `"pending"` | สถานะการชำระเงิน (ชำระแล้ว / รอชำระ) |
| `slips` | `Array<{ id, url, name, transferTime, uploadedAt }>` | รายการสลิปหลายใบพร้อมข้อมูลวันเวลาโอน |
| `slipUrl` | `string?` | ลิงก์สลิปหลัก (Backward Compatibility สำหรับระบบเดิม) |
| `transferTime` | `string?` | วันและเวลาที่โอนเงิน |
| `createdAt` | `string` \| `Timestamp` | วันและเวลาที่บันทึกข้อมูลการจอง |
| `updatedAt` | `string` \| `Timestamp`? | วันและเวลาที่มีการอัปเดตสลิปหรือสถานะล่าสุด |

### 3.2 คอลเลกชัน `tasks` (กิจกรรมและภารกิจนักศึกษา)
| ฟิลด์ | ชนิดข้อมูล | คำอธิบาย |
|---|---|---|
| `id` | `string` | รหัสกิจกรรม |
| `title` | `string` | หัวข้อกิจกรรม |
| `desc` | `string` | รายละเอียดกิจกรรม |
| `type` | `"poll"` \| `"comment"` \| `"announcement"` \| `"form"` \| `"booking"` \| `"link"` | ประเภทกิจกรรม |
| `active` | `boolean` | สถานะเปิดใช้งานในหน้าร้าน |
| `priority` | `"urgent"` \| `"important"` \| `"normal"` | ระดับความสำคัญ |
| `options` | `string[]?` | ตัวเลือกคำตอบ (สำหรับประเภท `poll`) |
| `linkUrl` | `string?` | ลิงก์ภายนอก (สำหรับประเภท `link` หรือ `form`) |
| `targetTime` | `string?` | วันเวลาปิดรับกิจกรรม / นาฬิกานับถอยหลัง |

### 3.3 คอลเลกชัน `polls` (ผลการลงคะแนนโหวต)
| ฟิลด์ | ชนิดข้อมูล | คำอธิบาย |
|---|---|---|
| `taskId` | `string` | รหัสกิจกรรมที่โหวต |
| `studentId` | `string` | รหัสนักศึกษาที่ลงคะแนน (ป้องกันการโหวตซ้ำ) |
| `optionIndex` | `number` | ลำดับตัวเลือกที่เลือก |
| `optionText` | `string` | ข้อความตัวเลือกที่เลือก |
| `votedAt` | `Timestamp` | เวลาที่ลงคะแนน |

### 3.4 คอลเลกชัน `comments` (กระดานข้อความความคิดเห็น)
| ฟิลด์ | ชนิดข้อมูล | คำอธิบาย |
|---|---|---|
| `taskId` | `string` | รหัสกิจกรรมที่แสดงความคิดเห็น |
| `studentId` | `string` | รหัสนักศึกษา |
| `studentName` | `string` | ชื่อนักศึกษา |
| `message` | `string` | เนื้อหาข้อความ |
| `imageUrl` | `string?` | รูปภาพประกอบความคิดเห็น (WebP Base64) |
| `createdAt` | `Timestamp` | วันเวลาที่โพสต์ข้อความ |

### 3.5 คอลเลกชัน `site_config` (การตั้งค่าระบบ)
- เอกสาร `settings`: รหัสผ่านแอดมิน, ค่าจัดส่ง, บัญชีรับโอนพร้อมเพย์, แบนเนอร์ประกาศหน้าแรก

### 3.6 คอลเลกชัน `inquiries` (ข้อความสอบถามจากนักศึกษาผ่านหน้าเว็บ)
| ฟิลด์ | ชนิดข้อมูล | คำอธิบาย |
|---|---|---|
| `studentId` | `string` | รหัสนักศึกษาของผู้สอบถาม หรือ `"Guest"` |
| `studentName` | `string` | ชื่อ-นามสกุลนักศึกษา |
| `topic` | `string` | หัวข้อคำถาม (เช่น เสื้อช็อป, กิจกรรม, ทั่วไป) |
| `message` | `string` | รายละเอียดข้อความสอบถาม |
| `contact` | `string` | ช่องทางติดต่อกลับ (เบอร์โทร, ไลน์ไอดี, อีเมล) |
| `status` | `"pending"` \| `"resolved"` | สถานะข้อความ (รอดำเนินการ / ตอบแล้ว) |
| `createdAt` | `Timestamp` | วันและเวลาที่บันทึกข้อมูล |
| `createdAtStr` | `string` | วันและเวลาแบบข้อความสำหรับแสดงผลฉับไว |

---

## 4. สถาปัตยกรรมโครงร่างหน้าเว็บและกิจกรรมซ้ำหลายรายการ (Scaffolding & Multi-Activity Architecture)

### 4.1 โครงสร้างหน้าเว็บพร้อมใช้งาน (Pre-built Scaffolding Hub)
1. **Quick Navigation Hub**: ทางลัด 4 โซนหลักบนหน้าแรก (ร้านค้า, แบบฟอร์ม, กิจกรรม, ตรวจสอบสถานะการจอง)
2. **โซนร้านค้าและสั่งซื้อ (`shop-section`)**:
   - โครงร่างแสดงรายการสินค้า/เสื้อ พร้อมป้ายสถานะและราคา
   - รองรับการเชื่อมต่อกับระบบจองเสื้อช็อปหลักหรือกิจกรรมสั่งจองอื่นๆ
3. **โซนแบบฟอร์มและสอบถาม (`forms-section`)**:
   - กล่องแบบฟอร์มสอบถามสด (Direct Inquiry Form) บันทึกลง Firestore `inquiries` ทันที
   - รายการแบบสอบถามที่เปิดรับคำตอบ พร้อมปุ่มเปิดทำแบบสอบถาม
4. **ตัวกรองหมวดหมู่กิจกรรม (Activity Filter Tabs)**:
   - กรองกิจกรรมตามประเภท: ทั้งหมด, โพลล์, แบบฟอร์ม, พูดคุย, สินค้า/สั่งจอง, ประกาศ/งาน

### 4.2 ระบบเพิ่มและคัดลอกกิจกรรมซ้ำกันได้หลายรายการ (Duplicate & Multi-instance Activity Engine)
- **การแยก ID แบบอิสระ**: ทุกกิจกรรมสร้างรหัสเฉพาะ (`act-${type}-${timestamp}`) ทำให้สามารถเพิ่มกิจกรรมชนิดเดียวกันได้ไม่จำกัด (เช่น โพลล์ 5 โพลล์, แบบฟอร์ม 3 ฟอร์ม, กระดานคุยหลายหัวข้อ) โดยไม่ทับซ้อนกัน
- **1-Click Duplication ในระบบแอดมิน**: ฟังก์ชัน `duplicateActivity(index)` คัดลอกการตั้งค่า ตัวเลือกโพลล์ คำถามในฟอร์ม หรือรายละเอียดกิจกรรมทั้งหมดเป็นกิจกรรมใหม่ได้ใน 1 วินาที พร้อมแก้รายละเอียดต่อได้ทันที
- **Typed Quick Add**: ปุ่มลัดสร้างกิจกรรมตามประเภททันที (`+ โพลล์`, `+ แบบฟอร์ม`, `+ พูดคุย`, `+ สั่งจอง`)

---

## 5. มาตรฐานประสิทธิภาพและส่วนต่อประสาน (UI/UX Performance Standards)
1. **Typography & Anti-GPU-Blur**:
   - ใช้ฟอนต์ **Ekkamai New** ทั่วทั้งระบบ โดยไม่มีการใช้ `translateZ(0)` หรือ `will-change: transform` บนองค์ประกอบข้อความ เพื่อให้ตัวอักษรคมชัดสูงสุด 100%
2. **Natural Aspect Ratio Image Preview**:
   - แสดงผลภาพตัวอย่างสินค้า เสื้อช็อป กิจกรรม สลิป และรูปภาพแนบตามสัดส่วนและขนาดจริงของรูปที่อัปโหลด (Natural Aspect Ratio) โดยไม่บังคับครอบตัด 1:1 เพื่อให้เห็นภาพจริงครบถ้วนสมบูรณ์ (`height: auto; max-width: 100%; object-fit: contain;`)
3. **Responsive Scaling & Ergonomics**:
   - กำหนดสเกลราก `html { font-size: 15px; }` (<640px), 15.5px (tablet), 16px (desktop), 16.5px (large), 17.5px (2k/4k)
   - ป้องกัน iOS Safari Auto-Zoom ด้วย `font-size: 16px` บน `input, select, textarea`
   - Touch Target ของปุ่มมีขนาดไม่ต่ำกว่า 44x44px
4. **Resilience Under Slow Networks (2 Mbps)**:
   - มี Skeleton Loading ตรงกับขนาดจริง ปราศจาก Layout Shift (CLS)
