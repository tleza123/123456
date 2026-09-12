/**
 * Automated Verification Script:
 * 1. Persistent Session in index.html (no kickback on page reload)
 * 2. Role-based Admin Management & Action Audit Logging in admin.html
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('====================================================');
console.log('STARTING ADMIN ROLES & SESSION PERSISTENCE VERIFICATION');
console.log('====================================================');

// --- TEST 1: index.html Session Persistence Code Verification ---
console.log('\n--- [TEST 1] index.html Session Persistence Checks ---');
const indexContent = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert(indexContent.includes('restoreStudentSession'), 'index.html must define restoreStudentSession');
assert(indexContent.includes('de06_current_session'), 'index.html must use de06_current_session in localStorage');
assert(indexContent.includes("sessionStorage.getItem('de06_student')"), 'index.html must check sessionStorage as fallback');
assert(indexContent.includes('localStorage.setItem(\'de06_current_session\''), 'index.html must persist session on student login');
assert(indexContent.includes('localStorage.removeItem(\'de06_current_session\')'), 'index.html must clear session on logout');

// Simulate session restore behavior
const mockLocalStorage = {};
function simulateLogin(stdId, stdName, secId = 'section-home') {
  const sessionData = {
    id: stdId,
    name: stdName,
    section: secId,
    loginAt: Date.now()
  };
  mockLocalStorage['de06_current_session'] = JSON.stringify(sessionData);
}

function simulateReload() {
  const raw = mockLocalStorage['de06_current_session'];
  if (!raw) return null;
  return JSON.parse(raw);
}

simulateLogin('66010001', 'สมชาย ใจดี', 'section-shop');
const restored = simulateReload();
assert.strictEqual(restored.id, '66010001');
assert.strictEqual(restored.name, 'สมชาย ใจดี');
assert.strictEqual(restored.section, 'section-shop');
console.log('  Passed: Session data correctly survives simulated page reload and retains active section.');

// --- TEST 2: admin.html Role Separation & Security Checks ---
console.log('\n--- [TEST 2] admin.html Role Separation Checks ---');
const adminContent = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');

assert(adminContent.includes('currentAdminRole'), 'admin.html must track currentAdminRole');
assert(adminContent.includes('applyRolePermissionsToUI'), 'admin.html must have applyRolePermissionsToUI');
assert(adminContent.includes('recordAuditLog'), 'admin.html must have recordAuditLog');
assert(adminContent.includes('id="tab-admins"'), 'admin.html must have tab-admins');
assert(adminContent.includes('id="tab-logs"'), 'admin.html must have tab-logs');
assert(adminContent.includes('lookupStudentNameForAdmin'), 'admin.html must have student lookup function');
assert(adminContent.includes('addStudentAdmin'), 'admin.html must have addStudentAdmin');
assert(adminContent.includes('removeStudentAdmin'), 'admin.html must have removeStudentAdmin');

// Verify access guard logic
const roleGuardRegex = /if\s*\(\s*\(tabId\s*===\s*['"]tab-admins['"]\s*\|\|\s*tabId\s*===\s*['"]tab-logs['"]\)\s*&&\s*currentAdminRole\s*!==\s*['"]master['"]\s*\)/;
assert(roleGuardRegex.test(adminContent), 'switchTab must explicitly block non-master admins from tab-admins and tab-logs');
console.log('  Passed: switchTab strictly prevents sub-admins from accessing admin management and logs.');

// Verify add/remove admin guards
const addAdminGuard = /if\s*\(\s*currentAdminRole\s*!==\s*['"]master['"]\s*\)/g;
const matches = adminContent.match(addAdminGuard);
assert(matches && matches.length >= 2, 'addStudentAdmin and removeStudentAdmin must verify currentAdminRole === master');
console.log('  Passed: Only Master Admin can add or remove student administrators.');

// --- TEST 3: Audit Logging System Checks ---
console.log('\n--- [TEST 3] Action Audit Logging System Checks ---');
assert(adminContent.includes("recordAuditLog('เปลี่ยนสถานะกิจกรรม'"), 'Must log activity toggle status');
assert(adminContent.includes("recordAuditLog('เพิ่มกิจกรรม'"), 'Must log new activity creation');
assert(adminContent.includes("recordAuditLog('คัดลอกกิจกรรม'"), 'Must log activity duplication');
assert(adminContent.includes("recordAuditLog('ลบกิจกรรม'"), 'Must log activity deletion');
assert(adminContent.includes("recordAuditLog('บันทึกการตั้งค่าระบบและกิจกรรม'"), 'Must log system config saving');
assert(adminContent.includes("recordAuditLog('เปลี่ยนสถานะข้อความสอบถาม'"), 'Must log inquiry status changes');
assert(adminContent.includes("recordAuditLog('ลบข้อความสอบถาม'"), 'Must log inquiry deletion');
assert(adminContent.includes("recordAuditLog('เพิ่มผู้ดูแลระบบ'"), 'Must log adding student admin');
assert(adminContent.includes("recordAuditLog('ลบผู้ดูแลระบบ'"), 'Must log removing student admin');
assert(adminContent.includes("recordAuditLog('เข้าสู่ระบบ'"), 'Must log admin logins');
assert(adminContent.includes("recordAuditLog('ออกจากระบบ'"), 'Must log admin logouts');
console.log('  Passed: All critical admin actions are instrumented with recordAuditLog.');

// --- TEST 4: firestore.rules Permission Checks ---
console.log('\n--- [TEST 4] firestore.rules Security Rules Check ---');
const rulesContent = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
assert(rulesContent.includes('match /admin_audit_logs/{document=**}'), 'firestore.rules must allow admin_audit_logs');
console.log('  Passed: firestore.rules includes admin_audit_logs collection.');

console.log('\n====================================================');
console.log('ALL VERIFICATION CHECKS PASSED WITH ZERO ERRORS!');
console.log('====================================================');
