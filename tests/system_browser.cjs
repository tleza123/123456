// Full application scripts run against an in-memory Firestore; external writes are blocked.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert');
const { chromium, firefox, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseline = process.argv.includes('--baseline');
const fixture = {
  config: { main: { PRICE_PER_SHIRT: 300, EXTRA_PRICE: 50, HOME_ANNOUNCEMENT: { enabled: false } } },
  activities: {
    poll: { title: 'กิจกรรมโหวต', type: 'poll', active: true, order: 1, pollOptions: ['วันเสาร์', 'วันอาทิตย์'], endDate: '2099-12-31T23:59' },
    form: { title: 'แบบสอบถาม', type: 'form', active: true, order: 2, formQuestions: [{ label: 'ความคิดเห็น', type: 'text' }] },
    comment: { title: 'พูดคุย', type: 'comment', active: true, order: 3 }
  },
  bookings: Object.fromEntries(Array.from({ length: 650 }, (_, i) => [String(66000000 + i), {
    studentId: String(66000000 + i), studentName: 'นักศึกษา ' + i, m: 1, summary: 'M (1)', totalPrice: 300,
    status: i % 2 ? 'pending' : 'paid', paidAmount: i % 2 ? 0 : 150, bookedAt: '2026-09-01',
    slips: i === 0 ? [{ imageUrl: '/IMG_3102.jpeg', fileUrl: '/IMG_3102.jpeg', transferDateTime: '1/9/2569 10:00' }, { imageUrl: '/IMG_3131.jpeg', fileUrl: '/IMG_3131.jpeg' }] : []
  }])),
  votes: { first: { studentId: '66000000', activityId: 'poll', optionIndex: 0, optionText: 'วันเสาร์', votedAt: '2026-09-01' } },
  comments: { first: { studentId: '66000000', studentName: 'นักศึกษา', activityId: 'comment', message: 'ทดสอบข้อความ', createdAt: '2026-09-01' } },
  students: { '66000000': { name: 'นักศึกษา' } }
};
function mockFirebase(data) {
  window.mockData = data; window.mockReads = []; window.mockWrites = []; window.mockDelay = 0; window.mockFailure = '';
  function query(name, filters = [], ordering = null, max = Infinity, cursor = null) {
    return {
      where: (key, op, value) => query(name, [...filters, [key, value]], ordering, max, cursor),
      orderBy: (key, direction) => query(name, filters, [key, direction], max, cursor),
      limit: n => query(name, filters, ordering, n, cursor),
      startAfter: doc => query(name, filters, ordering, max, doc.id),
      async get() {
        window.mockReads.push(name); if (window.mockDelay) await new Promise(r => setTimeout(r, window.mockDelay));
        if (window.mockFailure === name || window.mockFailure === name + ':' + cursor) throw new Error('fixture unavailable');
        let entries = Object.entries(window.mockData[name] || {}).filter(([id, row]) => filters.every(([key, val]) => row[key] === val));
        if (ordering) entries.sort((a, b) => String(ordering[0] === '__name__' ? a[0] : a[1][ordering[0]]).localeCompare(String(ordering[0] === '__name__' ? b[0] : b[1][ordering[0]])) * (ordering[1] === 'desc' ? -1 : 1));
        if (cursor) entries = entries.slice(entries.findIndex(([id]) => id === cursor) + 1);
        const docs = entries.slice(0, max).map(([id, row]) => ({ id, data: () => structuredClone(row), ref: this.doc(id) }));
        return { docs, size: docs.length, empty: !docs.length, forEach: f => docs.forEach(f) };
      },
      doc(id) {
        return { id, async get() { window.mockReads.push(name + '/' + id); if (window.mockDelay) await new Promise(r => setTimeout(r, window.mockDelay)); const row = window.mockData[name]?.[id]; return { exists: !!row, data: () => structuredClone(row), id }; },
          async set(row, opts) { window.mockWrites.push({ name, id, row }); window.mockData[name] ||= {}; window.mockData[name][id] = opts?.merge ? { ...window.mockData[name][id], ...row } : row; },
          async delete() { delete window.mockData[name]?.[id]; } };
      },
      async add(row) { const ref = this.doc('fixture-' + window.mockWrites.length); await ref.set(row); return ref; }
    };
  }
  const db = { collection: query, enablePersistence: async () => {}, batch: () => ({ set() {}, delete() {}, commit: async () => {} }),
    runTransaction: async f => f({ get: ref => ref.get(), set: (ref, row, opts) => ref.set(row, opts) }) };
  function firestore() { return db; }
  firestore.FieldValue = { serverTimestamp: () => '2026-10-07T00:00:00Z' };
  firestore.FieldPath = { documentId: () => '__name__' };
  window.firebase = { initializeApp() {}, firestore };
  window.alert = message => { window.lastAlert = message; }; window.confirm = () => true;
}
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const filename = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!filename.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  try {
    res.setHeader('Content-Type', filename.endsWith('.html') ? 'text/html; charset=utf-8' : filename.endsWith('.js') ? 'application/javascript' : filename.endsWith('.css') ? 'text/css' : filename.endsWith('.woff2') ? 'font/woff2' : 'image/jpeg');
    res.end(fs.readFileSync(filename));
  } catch { res.writeHead(404); res.end(); }
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const engine = process.env.TEST_ENGINE || 'chromium';
  const browser = await ({ chromium, firefox, webkit }[engine]).launch({ headless: true, ...(engine === 'chromium' ? { channel: process.env.BROWSER_CHANNEL || 'msedge' } : {}) });
  const results = { engine, mode: baseline ? 'baseline' : 'updated', measurements: [], checks: [] };
  try {
    for (const file of ['index.html', 'admin.html']) {
      const page = await browser.newPage(); const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(mockFirebase, fixture);
      await page.addInitScript(() => {
        window.metrics = { cls: 0, lcp: 0, longTasks: [] };
        for (const [type, callback] of [['layout-shift', e => { if (!e.hadRecentInput) metrics.cls += e.value; }], ['largest-contentful-paint', e => { metrics.lcp = e.startTime; }], ['longtask', e => metrics.longTasks.push(e.duration)]]) {
          try { new PerformanceObserver(list => list.getEntries().forEach(callback)).observe({ type, buffered: true }); } catch {}
        }
      });
      await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1') ? route.continue() : route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
      const started = Date.now(); await page.goto(`http://127.0.0.1:${server.address().port}/${file}`); await page.waitForTimeout(350);
      results.measurements.push({ file, coldLoadMs: Date.now() - started, ...await page.evaluate(() => metrics) });
      if (file === 'index.html') {
        await page.evaluate(() => { currentStudentId = '66000000'; currentStudentName = 'นักศึกษา'; switchSection('home-section'); });
        await page.evaluate(async () => { await loadUsageHistory(); });
        assert(await page.locator('.history-card').count() >= 3);
        await page.evaluate(() => { switchSection('booking-section'); document.getElementById('qty-m').value = 2; calculateTotal(); });
        assert.equal(await page.locator('#total-price').innerText(), '748');
        await page.evaluate(async () => { switchSection('dynamic-poll'); await initPollSection(allTasks.find(t => t.id === 'poll')); });
        assert((await page.locator('#poll-total-poll').innerText()).includes('1'));
        await page.evaluate(async () => { switchSection('dynamic-comment'); await initCommentSection(allTasks.find(t => t.id === 'comment')); });
        await page.evaluate(() => switchSection('home-section'));
      } else {
        await page.evaluate(async () => { isAdminAuthenticated = true; currentAdminRole = 'master'; document.getElementById('adminPanel').style.display = 'block'; await loadInitialData(); switchTab('tab-bookings'); await loadBookingsData(); });
        const count = await page.evaluate(() => allBookingsList.length);
        results.measurements.push({ file, bookingsLoaded: count });
        if (!baseline) { assert.equal(count, 650); assert.equal(await page.evaluate(() => currentAggregatedSizeStats.all.totalShirts), 650); assert(await page.locator('#bookingsTableBody tr').count() <= 50); }
        await page.locator('#bookingSearchInput').fill('66000649'); await page.evaluate(() => filterBookingsTable());
        if (!baseline) assert((await page.locator('#bookingsTableBody').innerText()).includes('66000649'));
        await page.locator('#bookingSearchInput').fill(''); await page.evaluate(() => { filterBookingsTable(); openSlipModal('66000000'); });
        await page.evaluate(() => closeImageModal());
      }
      const overflows = [];
      for (const width of [320, 375, 390, 414, 768, 1024, 1440, 2560]) {
        await page.setViewportSize({ width, height: 900 });
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) overflows.push(width);
      }
      results.checks.push({ file, overflows, errors });
      if (!baseline) { assert.deepEqual(errors, []); assert.deepEqual(overflows, []); }
      const durations = await page.evaluate(file => {
        const values = [];
        for (let i = 0; i < 20; i++) { const t = performance.now(); if (file === 'index.html') { switchSection('shop-section'); switchSection('home-section'); } else { switchTab('tab-activities'); switchTab('tab-settings'); } values.push(performance.now() - t); }
        return values;
      }, file);
      results.measurements.push({ file, navigationPairMaxMs: Math.max(...durations), navigationPairMeanMs: durations.reduce((a, b) => a + b, 0) / durations.length });
      await page.reload(); await page.waitForTimeout(250); results.measurements.push({ file, warm: await page.evaluate(() => metrics) });
      await page.close();
    }
    fs.mkdirSync(path.join(root, 'tests', 'reports'), { recursive: true });
    fs.writeFileSync(path.join(root, 'tests', 'reports', `${results.mode}-${engine}.json`), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => server.close());

