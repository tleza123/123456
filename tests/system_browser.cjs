// Full application scripts run against an in-memory Firestore; external writes are blocked.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert');
const { execFileSync } = require('child_process');
const { chromium, firefox, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseline = process.argv.includes('--baseline');
const baselineHtml = baseline ? Object.fromEntries(['index.html', 'admin.html'].map(file => [file, execFileSync('git', ['show', '6db26c6^:' + file], { encoding: 'utf8' })])) : {};
const fixture = {
  config: { main: { PRICE_PER_SHIRT: 300, EXTRA_PRICE: 50, HOME_ANNOUNCEMENT: { enabled: false } } },
  activities: {
    poll: { title: 'กิจกรรมโหวต', type: 'poll', active: true, order: 1, pollOptions: ['วันเสาร์', 'วันอาทิตย์'], endDate: '2099-12-31T23:59' },
    form: { title: 'แบบสอบถาม', type: 'form', active: true, order: 2, formQuestions: [{ label: 'ความคิดเห็น', type: 'text' }] },
    comment: { title: 'พูดคุย', type: 'comment', active: true, order: 3 },
    link: { title: 'ลิงก์', type: 'link', targetUrl: 'https://example.test/', active: true, order: 4 },
    announcement: { title: 'ประกาศ', type: 'announcement', taskDetails: 'รายละเอียดประกาศ', actionUrl: 'https://example.test/', active: true, order: 5 },
    html: { title: 'เนื้อหาเดิม', type: 'html', htmlCode: '<p>เนื้อหาประกอบกิจกรรม</p>', active: true, order: 6 }
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
  window.mockData = data; window.mockReads = []; window.mockWrites = []; window.mockDelay = location.search.includes('slow') ? 150 : 0; window.mockFailure = ''; window.mockListeners = new Set();
  function query(name, filters = [], ordering = null, max = Infinity, cursor = null) {
    return {
      where: (key, op, value) => query(name, [...filters, [key, value]], ordering, max, cursor),
      orderBy: (key, direction) => query(name, filters, [key, direction], max, cursor),
      limit: n => query(name, filters, ordering, n, cursor),
      startAfter: doc => query(name, filters, ordering, max, doc.id),
      onSnapshot(next, error) {
        const token = { name, emit: () => this.get().then(snapshot => { if (window.mockListeners.has(token)) next(snapshot); }).catch(error) };
        window.mockListeners.add(token); token.emit(); return () => window.mockListeners.delete(token);
      },
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
    runTransaction: async f => { const writes = []; const result = await f({ get: ref => ref.get(), set: (ref, row, opts) => writes.push(() => ref.set(row, opts)), delete: ref => writes.push(() => ref.delete()) }); for (const write of writes) await write(); return result; } };
  function firestore() { return db; }
  firestore.FieldValue = { serverTimestamp: () => '2026-10-07T00:00:00Z' };
  firestore.FieldPath = { documentId: () => '__name__' };
  window.firebase = { initializeApp() {}, firestore };
  if (location.search.includes('student')) localStorage.setItem('de06_current_session', JSON.stringify({ studentId: '66000000', name: 'นักศึกษา', activeSection: 'home-section' }));
  window.alert = message => { window.lastAlert = message; }; window.confirm = () => true;
}
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  if (req.url === '/fixture-api') {
    req.resume(); res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true, imageUrl: '/IMG_3131.jpeg', fileUrl: '/fixture-upload.jpg' })); return;
  }
  const filename = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!filename.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  try {
    res.setHeader('Content-Type', filename.endsWith('.html') ? 'text/html; charset=utf-8' : filename.endsWith('.js') ? 'application/javascript' : filename.endsWith('.css') ? 'text/css' : filename.endsWith('.woff2') ? 'font/woff2' : 'image/jpeg');
    res.end(baselineHtml[path.basename(filename)] || fs.readFileSync(filename));
  } catch { res.writeHead(404); res.end(); }
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const engine = process.env.TEST_ENGINE || 'chromium';
  const browser = await ({ chromium, firefox, webkit }[engine]).launch({ headless: true, ...(engine === 'chromium' ? { channel: process.env.BROWSER_CHANNEL || 'msedge' } : {}) });
  const results = { engine, browserVersion: browser.version(), platform: process.platform, fixtureOrders: 650, mode: baseline ? 'baseline' : 'updated', environment: 'Local HTTP with mocked Firebase SDK and in-memory data; 2 Mbps / 150ms for static assets and 150ms mock database latency', measurements: [], checks: [] };
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
      await page.route('**/*', route => /^(?:http:\/\/127\.0\.0\.1|blob:|data:)/.test(route.request().url()) ? route.continue() : route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
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
        if (!baseline) assert.equal(await page.evaluate(() => mockListeners.size), 1);
        await page.evaluate(async () => { switchSection('dynamic-comment'); await initCommentSection(allTasks.find(t => t.id === 'comment')); });
        await page.evaluate(() => switchSection('home-section'));
        if (!baseline) assert.equal(await page.evaluate(() => mockListeners.size), 0);
        if (!baseline) {
          // The actual form node and its value must survive navigation and unchanged refreshes.
          await page.evaluate(() => switchSection('dynamic-form'));
          const formInput = page.locator('#custom-form-form input').first();
          await formInput.fill('เก็บข้อความที่ยังไม่ได้ส่ง');
          await page.evaluate(async () => { window.savedForm = document.getElementById('custom-form-form'); switchSection('home-section'); switchSection('dynamic-form'); await loadConfigFromFirestore(); });
          assert(await page.evaluate(() => savedForm === document.getElementById('custom-form-form')));
          assert.equal(await formInput.inputValue(), 'เก็บข้อความที่ยังไม่ได้ส่ง');
          // Price boundaries use the shipped calculation, not a copied implementation.
          for (const [normal, special, expected] of [[0, 0, 0], [1, 0, 379], [2, 0, 748], [0, 2, 808], [-1, 0, 0]]) {
            const amount = await page.evaluate(([normal, special]) => { document.getElementById('qty-m').value = normal; document.getElementById('qty-other-num').value = special; calculateTotal(); return document.getElementById('total-price').textContent; }, [normal, special]);
            assert.equal(amount, String(expected));
          }
          await page.evaluate(() => { document.getElementById('qty-m').value = 1; document.getElementById('qty-other-num').value = 0; });
          const writesBefore = await page.evaluate(() => mockWrites.length);
          await page.evaluate(async () => { mockDelay = 75; await Promise.all(Array.from({ length: 20 }, () => submitOrder())); mockDelay = 0; });
          assert.equal(await page.evaluate(() => mockWrites.length), writesBefore + 1);
          await page.evaluate(async () => {
            document.getElementById('contact-phone').value = '0812345678'; document.getElementById('contact-email').value = 'student@example.test';
            uploadedSlips = [{ status: 'done', imageUrl: '/IMG_3102.jpeg', fileUrl: '/new-slip.jpeg', fileName: 'ใหม่', transferDate: '2026-10-07', transferHour: '10', transferMinute: '00' }];
            await Promise.all(Array.from({ length: 10 }, () => finalizeOrderFast()));
          });
          assert.equal(await page.evaluate(() => mockData.bookings['66000000'].slips.length), 3);
          await page.waitForFunction(() => document.getElementById('receipt-status').textContent.includes('ยังยืนยัน'));
          await page.evaluate(async () => {
            const prior = mockReads.length; await Promise.all([loadUsageHistory(), loadUsageHistory(), loadUsageHistory()]);
            window.historyCoalescedReads = mockReads.length - prior;
          });
          assert.equal(await page.evaluate(() => historyCoalescedReads), 6);
          await page.evaluate(async () => { mockDelay = 75; const result = loadUsageHistory(); currentStudentId = 'different'; document.getElementById('booking-details-content').textContent = 'บัญชีใหม่'; await result; mockDelay = 0; });
          assert.equal(await page.locator('#booking-details-content').innerText(), 'บัญชีใหม่');
          await page.evaluate(() => { currentStudentId = '66000000'; switchSection('home-section'); });
          // Offline cache is visible and does not block the shell; malformed cache is recoverable.
          await page.evaluate(async () => { mockFailure = 'activities'; await loadConfigFromFirestore(); mockFailure = ''; });
          assert((await page.locator('#configuration-status').innerText()).includes('แสดงข้อมูลที่บันทึกไว้'));
          await page.evaluate(async () => { localStorage.setItem('de06_cached_acts', '{invalid'); await loadConfigFromFirestore(); });
          assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('de06_cached_acts')).length), 6);
          // Canvas rejects active SVG uploads; JavaScript URLs never reach an image or external link.
          assert.equal(await page.evaluate(() => DE06.safeUrl('javascript:alert(1)', true)), '');
          assert.equal(await page.evaluate(() => DE06.safeUrl('data:image/svg+xml;base64,AAAA', true)), '');
          assert(await page.evaluate(async () => { try { await DE06.compress(new File(['<svg/>'], 'bad.svg', { type: 'image/svg+xml' })); return false; } catch { return true; } }));
          await page.evaluate(() => { window.originalApiUrl = API_URL; API_URL = location.origin + '/fixture-api'; });
          await page.locator('#slipFileInput').setInputFiles(path.join(root, 'IMG_3131.jpeg'));
          await page.waitForFunction(() => uploadedSlips.some(slip => slip.status === 'done' || slip.status === 'error'));
          assert.equal(await page.evaluate(() => uploadedSlips[0].error || ''), '', 'Canvas upload must finish without an error');
          assert.deepEqual(await page.evaluate(() => { const slip = uploadedSlips.find(s => s.status === 'done'); return [slip.width, slip.height]; }), [885, 1200]);
          await page.evaluate(() => { API_URL = originalApiUrl; uploadedSlips.forEach(slip => { if (slip.previewUrl) URL.revokeObjectURL(slip.previewUrl); }); uploadedSlips = []; renderSlipsList(); });
          await page.evaluate(() => { window.apiRejected = false; });
          assert(await page.evaluate(async () => { try { await callAPI('sendEmail', {}); return false; } catch { return true; } }));
          results.checks.push({ file, dataIntegrity: 'prices, duplicate submits, slip merge, account race, cache recovery, API acknowledgment passed' });
        }
      } else {
        await page.evaluate(async () => { isAdminAuthenticated = true; currentAdminRole = 'master'; appConfig = (await db.collection('config').doc('main').get()).data(); document.getElementById('adminPanel').style.display = 'block'; await loadInitialData(); switchTab('tab-bookings'); await loadBookingsData(); });
        const count = await page.evaluate(() => allBookingsList.length);
        results.measurements.push({ file, bookingsLoaded: count });
        if (!baseline) { assert.equal(count, 650); assert.equal(await page.evaluate(() => currentAggregatedSizeStats.all.totalShirts), 650); assert(await page.locator('#bookingsTableBody tr').count() <= 50); }
        await page.locator('#bookingSearchInput').fill('66000649'); await page.evaluate(() => filterBookingsTable());
        if (!baseline) assert((await page.locator('#bookingsTableBody').innerText()).includes('66000649'));
        await page.locator('#bookingSearchInput').fill(''); await page.evaluate(() => { filterBookingsTable(); openSlipModal('66000000'); });
        await page.evaluate(() => closeImageModal());
        if (!baseline) {
          assert.equal(await page.evaluate(() => currentAggregatedSizeStats.all.paidAmount), 48750);
          assert.equal(await page.locator('#stat_total_shirts').innerText(), '650');
          assert.equal(await page.locator('#stat_paid_shirts_val').innerText(), '325');
          assert.equal(await page.locator('#imageModalBody img').count(), 1);
          await page.evaluate(async () => { mockFailure = 'bookings:66000199'; await loadBookingsData(true); });
          assert.equal(await page.evaluate(() => bookingsComplete), false);
          assert((await page.locator('#bookings-status').innerText()).includes('ยังยืนยัน'));
          assert.equal(await page.locator('#stat_total_income').innerText(), '—');
          await page.evaluate(async () => { mockFailure = ''; await loadBookingsData(true); });
          const readsBefore = await page.evaluate(() => mockReads.length);
          await page.evaluate(async () => { await Promise.all([loadBookingsData(false), loadBookingsData(false)]); });
          assert.equal(await page.evaluate(() => mockReads.length), readsBefore);
          const saveWrites = await page.evaluate(() => mockWrites.length);
          await page.evaluate(async () => { mockData.activities.concurrent = { title: 'เพิ่มจากอีกเซสชัน', type: 'announcement', order: 7 }; await saveAllChanges(); });
          assert((await page.evaluate(() => mockWrites.length)) >= saveWrites + 7, 'Successful atomic save must actually write the config and six managed activities');
          assert(await page.evaluate(() => !!mockData.activities.concurrent));
          await page.evaluate(async () => { mockData.activities.poll.title = 'แก้จากอีกเซสชัน'; await saveAllChanges(); });
          assert((await page.locator('#globalMsg').innerText()).includes('อีกเซสชัน'));
          await page.evaluate(() => { currentAdminRole = 'subadmin'; switchTab('tab-admins'); });
          assert(!(await page.locator('#tab-admins').getAttribute('class')).includes('active'));
          await page.evaluate(() => { currentAdminRole = 'master'; switchTab('tab-bookings'); });
          results.checks.push({ file, dataIntegrity: '650 totals, 50 rows, global search, partial failure, payment amounts, role guard and concurrent save passed' });
        }
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
      if (!baseline) {
        assert(Math.max(...durations) < 50, 'Navigation must not produce a >50ms task');
        const sections = file === 'index.html' ? ['home-section', 'shop-section', 'forms-section', 'booking-section', 'upload-section', 'done-section', 'check-booking-section', 'dynamic-form', 'dynamic-poll', 'dynamic-comment', 'dynamic-link', 'dynamic-announcement', 'dynamic-html'] : ['tab-activities', 'tab-announcement', 'tab-responses', 'tab-bookings', 'tab-settings', 'tab-admins', 'tab-inquiries', 'tab-logs'];
        for (const width of [320, 375, 390, 414, 768, 1024, 1440, 2560]) {
          await page.setViewportSize({ width, height: 900 });
          for (const section of sections) {
            await page.evaluate(([file, section]) => file === 'index.html' ? switchSection(section) : switchTab(section), [file, section]);
            await page.waitForTimeout(20);
            assert(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${file}/${section}: overflow at ${width}`);
            const handlerErrors = await page.evaluate(() => Array.from(document.querySelectorAll('*')).flatMap(element => Array.from(element.attributes).filter(attribute => attribute.name.startsWith('on')).flatMap(attribute => { try { new Function('event', attribute.value); return []; } catch (error) { return [element.tagName + ':' + attribute.name + ':' + error.message]; } })));
            assert.deepEqual(handlerErrors, [], `${file}/${section}: malformed inline handler`);
          }
        }
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.setViewportSize({ width: 844, height: 390 });
        for (const section of sections) {
          await page.evaluate(([file, section]) => file === 'index.html' ? switchSection(section) : switchTab(section), [file, section]);
          assert(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), file + ': landscape overflow');
        }
        const motion = await page.evaluate(() => getComputedStyle(document.querySelector('.section.active, .tab-pane.active')).animationDuration);
        assert(parseFloat(motion) <= .001);
        await page.setViewportSize({ width: 390, height: 844 });
        if (file === 'index.html') {
          await page.evaluate(() => switchSection('booking-section'));
          assert((await page.locator('#qty-m').evaluate(e => parseFloat(getComputedStyle(e).fontSize))) >= 16);
          await page.locator('#qty-m').focus(); await page.keyboard.press('Tab');
          assert(await page.evaluate(() => document.activeElement !== document.body));
        }
        // Network throttling affects real static assets; database latency is injected into the fixture.
        if (engine === 'chromium') {
          const cdp = await page.context().newCDPSession(page);
          await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 250000, uploadThroughput: 250000 });
          await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
          const slowStart = Date.now(); await page.goto(`http://127.0.0.1:${server.address().port}/${file}?slow&student`); await page.waitForTimeout(300);
          if (file === 'admin.html') {
            await page.locator('#adminPassInput').click();
            await page.evaluate(async () => { isAdminAuthenticated = true; currentAdminRole = 'master'; document.getElementById('adminPanel').style.display = 'block'; document.getElementById('loginBox').style.display = 'none'; await loadInitialData(); });
            await page.locator('.nav-tab[onclick*="tab-bookings"]').click(); await page.evaluate(() => loadBookingsData(false));
          }
          else await page.waitForFunction(() => document.querySelectorAll('#active-tasks-container .task-card').length === 6);
          results.measurements.push({ file, slowNetworkLoadMs: Date.now() - slowStart, slowNetworkMetrics: await page.evaluate(() => metrics) });
          await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
        }
        if (process.env.SYSTEM_SCREENSHOTS) {
          await page.screenshot({ path: path.join(root, 'tests', 'reports', file.replace('.html', '') + '-mobile.png'), fullPage: true });
        }
        assert.deepEqual(errors, []);
        results.checks.push({ file, responsive: 'all sections at eight widths, reduced motion and keyboard checks passed' });
        if (engine === 'chromium') {
          await page.evaluate(async file => {
            if (file === 'index.html') { currentStudentId = '66000000'; switchSection('home-section'); }
            else { isAdminAuthenticated = true; currentAdminRole = 'master'; switchTab('tab-bookings'); await loadBookingsData(false); }
          }, file);
          const traceSession = await page.context().newCDPSession(page); const events = [];
          traceSession.on('Tracing.dataCollected', event => events.push(...event.value));
          await traceSession.send('Tracing.start', { categories: 'toplevel,devtools.timeline,blink.user_timing', transferMode: 'ReportEvents' });
          const frames = await page.evaluate(() => new Promise(resolve => {
            let previous = null, count = 0; const intervals = [];
            function frame(time) {
              if (previous !== null) intervals.push(time - previous); previous = time;
              const max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
              window.scrollTo(0, Math.min(max, count * 80));
              if (++count < 60) requestAnimationFrame(frame); else { window.scrollTo(0, 0); resolve(intervals); }
            }
            requestAnimationFrame(frame);
          }));
          const completed = new Promise(resolve => traceSession.once('Tracing.tracingComplete', resolve)); await traceSession.send('Tracing.end'); await completed;
          const ordered = frames.slice().sort((a, b) => a - b);
          const tasks = events.filter(event => /(?:RunTask|ProcessTaskFromWorkQueue)$/.test(event.name) && event.dur).map(event => event.dur / 1000);
          results.measurements.push({ file, scrollFrameP95Ms: ordered[Math.floor(ordered.length * .95)], scrollFrameMaxMs: Math.max(...frames), traceTaskMaxMs: tasks.length ? Math.max(...tasks) : null, traceFunctionMaxMs: Math.max(0, ...events.filter(event => event.name === 'FunctionCall' && event.dur).map(event => event.dur / 1000)) });
          fs.mkdirSync(path.join(root, 'tests', 'reports'), { recursive: true });
          fs.writeFileSync(path.join(root, 'tests', 'reports', file.replace('.html', '') + '-trace.json'), JSON.stringify({ traceEvents: events }));
        }
      }
      if (baseline && engine === 'chromium') {
        const cdp = await page.context().newCDPSession(page); await cdp.send('Network.enable');
        await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 250000, uploadThroughput: 250000 });
        await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
        const slowStart = Date.now(); await page.goto(`http://127.0.0.1:${server.address().port}/${file}?slow&student`); await page.waitForTimeout(300);
        if (file === 'admin.html') {
          await page.locator('#adminPassInput').click();
          await page.evaluate(async () => { isAdminAuthenticated = true; currentAdminRole = 'master'; document.getElementById('adminPanel').style.display = 'block'; document.getElementById('loginBox').style.display = 'none'; await loadInitialData(); });
          await page.locator('.nav-tab[onclick*="tab-bookings"]').click(); await page.evaluate(() => loadBookingsData());
        }
        else await page.waitForFunction(() => document.querySelectorAll('#active-tasks-container .task-card').length === 6);
        results.measurements.push({ file, slowNetworkLoadMs: Date.now() - slowStart, slowNetworkMetrics: await page.evaluate(() => metrics) });
        await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      }
      await page.reload(); await page.waitForTimeout(250); results.measurements.push({ file, warm: await page.evaluate(() => metrics) });
      await page.close();
    }
    fs.mkdirSync(path.join(root, 'tests', 'reports'), { recursive: true });
    fs.writeFileSync(path.join(root, 'tests', 'reports', `${results.mode}-${engine}.json`), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => server.close());

