const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const html = fs.readFileSync('index.html', 'utf8');
const code = html.slice(html.indexOf('  var usageHistory ='), html.indexOf('  async function goToReuploadSlips()'));
const elements = {};
const element = id => elements[id] ||= { innerHTML: '', textContent: '', setAttribute() {} };
const ctx = vm.createContext({ URL, console, currentStudentId: 'one', allTasks: [], document: { getElementById: element }, stripEmojis: s => s,
  escapeHtml: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;') });
vm.runInContext(code, ctx);
assert.equal(ctx.historyDate('12/9/2569 14:35:00'), Date.parse('2026-09-12T14:35:00+07:00'));
assert.equal(ctx.historyDate({ seconds: 100 }), 100000);
assert.equal(ctx.historyDate('invalid'), 0);
assert.equal(ctx.historyUrl('javascript:alert(1)'), '');
assert.equal(ctx.historyUrl('data:image/svg+xml;base64,AAAA'), '');
assert.equal(ctx.historyUrl('https://example.test/a'), 'https://example.test/a');
const booking = ctx.historyBooking({ summary: 'M 1 ตัว', totalPrice: 300, status: 'paid', slips: [{ imageUrl: 'https://example.test/a', transferDateTime: '12/9/2569 14:35' }, { url: 'https://example.test/b' }] }, 'bookings');
assert(booking.body.includes('สลิปที่แนบ 2 ใบ'));
assert(booking.body.includes('ไม่ระบุยอด'), 'Never invent paidAmount from order total');
assert(booking.body.includes('goToReuploadSlips'));
assert(ctx.historyBooking({ slipUrl: 'https://example.test/a', paidAmount: 0 }, 'orders_shirts').body.includes('0 บาท'));
assert(ctx.historyBooking({ slipUrls: ['https://example.test/a'] }, 'bookings').body.includes('สลิปที่แนบ 1 ใบ'));
const form = ctx.historySubmission({ activityTitle: '<img onerror=alert(1)>', formData: { 'คำถาม': '<script>bad()</script>', zero: 0 } }, 'dynamic_submissions');
assert(form.body.includes('&lt;script&gt;'));
assert(form.body.includes('คำตอบ: 0'));
const doc = (id, data) => ({ id, exists: true, data: () => data });
const records = {
  bookings: doc('one', { studentId: 'one', summary: 'M 1', totalPrice: 300, updatedAt: { seconds: 1 } }),
  orders_shirts: [],
  votes: [doc('v', { studentId: 'one', activityId: 'poll', optionText: 'A', timestamp: { seconds: 2 } })],
  comments: [doc('c', { studentId: 'one', message: 'hello', createdAt: { seconds: 4 } })],
  dynamic_submissions: [doc('v', { studentId: 'one', activityId: 'poll', formType: 'vote', optionText: 'B', timestamp: { seconds: 3 } }), doc('f', { studentId: 'one', formData: { q: 'yes' } })],
  inquiries: []
};
let fail = '', gate = null;
ctx.db = { collection(source) { return {
  doc(id) { assert.equal(id, 'one'); return { get: async () => { if (gate) await gate; return records[source]; } }; },
  where(field, op, id) { assert.equal(field, 'studentId'); assert.equal(op, '=='); assert.equal(id, 'one'); return { get: async () => { if (gate) await gate; if (fail === source) throw Error('offline'); return records[source]; } }; }
}; } };
(async () => {
  await ctx.loadUsageHistory();
  assert.equal(ctx.usageHistory.rows.length, 4);
  assert.equal(ctx.usageHistory.rows[0].type, 'comment');
  assert(ctx.usageHistory.rows.find(r => r.type === 'vote').body.includes('B'));
  fail = 'comments'; await ctx.loadUsageHistory();
  assert(element('history-status').textContent.includes('บางส่วน'));
  assert.equal(ctx.usageHistory.rows.length, 3);
  let release; gate = new Promise(resolve => { release = resolve; });
  const pending = ctx.loadUsageHistory();
  ctx.currentStudentId = 'two'; element('booking-details-content').innerHTML = 'new session'; release();
  await pending;
  assert.equal(element('booking-details-content').innerHTML, 'new session');
  console.log('Usage history: legacy data, ordering, vote fallback, XSS, amounts, query scope, partial failure and account race passed.');
})().catch(e => { console.error(e); process.exitCode = 1; });
