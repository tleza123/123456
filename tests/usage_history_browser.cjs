const fs = require('fs');
const assert = require('assert');
const http = require('http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('index.html', 'utf8');
const script = html.slice(html.indexOf('  var usageHistory ='), html.indexOf('  async function goToReuploadSlips()'));
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/fonts/')) { res.end(fs.readFileSync('.' + req.url)); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1') ? route.continue() : route.abort());
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.addScriptTag({ content: `var currentStudentId = 'test'; var allTasks = []; function stripEmojis(s) { return s; } function escapeHtml(s) { var e=document.createElement('span'); e.textContent=s; return e.innerHTML.replace(/"/g, '&quot;'); }` + script });
    await page.evaluate(() => {
      document.getElementById('loading-screen').style.display = 'none';
      document.querySelectorAll('.section').forEach(e => e.classList.remove('active'));
      document.getElementById('check-booking-section').classList.add('active');
      usageHistory.rows = [historyBooking({ summary: 'M 1 ตัว, XL 1 ตัว', totalPrice: 590, paidAmount: 590, status: 'paid', bookedAt: '2026-09-12T10:30:00+07:00', slips: [{ imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', transferDateTime: '12/9/2569 เวลา 10:35 น.' }] }, 'bookings'), historySubmission({ activityTitle: 'เลือกวันจัดกิจกรรม', optionText: 'วันเสาร์', votedAt: '12/9/2569 11:00' }, 'votes'), historySubmission({ activityTitle: 'แบบสอบถามกิจกรรม', formData: { 'อยากเข้าร่วมกิจกรรมอะไร': 'การทำธุรกิจออนไลน์', 'ข้อเสนอแนะเพิ่มเติม': 'ข้อความยาว'.repeat(60) }, timestamp: { seconds: 1789200000 } }, 'dynamic_submissions'), historySubmission({ activityTitle: 'กระดานความคิดเห็น', message: 'ขอบคุณสำหรับกิจกรรมครับ', createdAt: { seconds: 1789200000 } }, 'comments')];
      renderUsageHistory();
    });
    for (const width of [320, 375, 390, 414, 768, 1024, 1440, 2560]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert(!overflow, 'Overflow at ' + width);
      const targets = await page.locator('.history-card summary, .history-refresh').evaluateAll(es => es.map(e => e.getBoundingClientRect().height));
      assert(targets.every(h => h >= 44), 'Touch target at ' + width);
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.locator('.history-card summary').focus();
    await page.keyboard.press('Enter');
    assert(await page.locator('.history-card details').evaluate(e => e.open));
    if (process.env.HISTORY_SCREENSHOT) await page.screenshot({ path: process.env.HISTORY_SCREENSHOT, fullPage: true, animations: 'disabled' });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 250000, uploadThroughput: 250000 });
    await page.evaluate(() => {
      db = { collection: () => ({ doc: () => ({ get: () => fetch('/fixture').then(() => ({ exists: false })) }), where: () => ({ get: () => fetch('/fixture').then(() => []) }) }) };
      window.historyPending = loadUsageHistory();
    });
    assert.equal(await page.locator('#booking-details-content').getAttribute('aria-busy'), 'true');
    await page.evaluate(() => window.historyPending);
    assert.equal(await page.locator('#booking-details-content').getAttribute('aria-busy'), 'false');
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('Browser: eight widths, 44px targets, keyboard expansion, 2 Mbps loading state, no script errors passed.');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
