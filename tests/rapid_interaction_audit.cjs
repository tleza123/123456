const assert = require('assert');
module.exports = async function auditRapidInteractions(browser, base, mockFirebase, fixture) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(mockFirebase, fixture);
  await page.addInitScript(() => { window.unhandledErrors = []; addEventListener('unhandledrejection', event => unhandledErrors.push(String(event.reason))); });
  await page.route('**/*', route => /^(?:http:\/\/127\.0\.0\.1|blob:|data:)/.test(route.request().url()) ? route.continue() : route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  try {
    await page.goto(base + '/index.html?student');
    await page.waitForFunction(() => allTasks.length === 6 && currentStudentId === '66000000');
    await page.evaluate(async () => {
      mockDelay = 100;
      for (let i = 0; i < 50; i++) {
        for (const section of ['dynamic-poll', 'dynamic-comment', 'dynamic-form', 'shop-section', 'check-booking-section', 'home-section']) switchSection(section);
      }
      await new Promise(resolve => setTimeout(resolve, 350));
      mockDelay = 0;
    });
    assert.equal(await page.locator('.section.active').count(), 1);
    assert.equal(await page.evaluate(() => mockListeners.size), 0);
    assert.equal(await page.locator('.dynamic-section').count(), 6);
    await page.evaluate(() => switchSection('dynamic-form'));
    await page.locator('#custom-form-form input').fill('คำตอบทดสอบกดซ้ำ');
    await page.evaluate(async () => {
      const collection = db.collection;
      db.collection = name => {
        const query = collection(name);
        if (name === 'dynamic_submissions') query.add = async () => { throw new Error('<img src=x onerror=window.injectedError=true>'); };
        return query;
      };
      try { await handleDynamicFormSubmit({ preventDefault() {} }, 'form'); } finally { db.collection = collection; }
    });
    assert.equal(await page.locator('#form-msg-form img').count(), 0, 'Failed submission error must be escaped');
    assert.equal(await page.locator('#btn-submit-form-form').isDisabled(), false, 'Failure must allow retry');
    const before = await page.evaluate(() => mockWrites.length);
    await page.evaluate(() => Promise.all(Array.from({ length: 30 }, () => handleDynamicFormSubmit({ preventDefault() {} }, 'form'))));
    await page.evaluate(() => Promise.all(Array.from({ length: 30 }, () => handleDynamicFormSubmit({ preventDefault() {} }, 'form'))));
    assert.equal(await page.evaluate(() => mockWrites.length), before + 1, 'Repeated Enter after success must not create more answers');
    await page.locator('#custom-form-form input').fill('แก้ไขคำตอบ');
    assert.equal(await page.locator('#btn-submit-form-form').isDisabled(), false);
    await page.evaluate(() => handleDynamicFormSubmit({ preventDefault() {} }, 'form'));
    assert.equal(await page.evaluate(() => mockWrites.length), before + 2);
    // An old authentication read cannot restore a session after logout, even if its input is restored.
    await page.evaluate(async () => {
      logout(); DE06.storage.removeItem('de06_student_66000000');
      document.getElementById('studentId').value = '66000000'; mockDelay = 100;
      const pending = checkStudent(); logout(); document.getElementById('studentId').value = '66000000';
      await pending; mockDelay = 0;
    });
    assert.equal(await page.evaluate(() => currentStudentId), '');
    assert(await page.locator('#login-section').evaluate(el => el.classList.contains('active')));
    assert.equal(await page.locator('#btnLogin').isDisabled(), false);
    const loginReads = await page.evaluate(() => mockReads.filter(key => key === 'students/66000000').length);
    await page.evaluate(async () => { mockDelay = 100; await Promise.all(Array.from({ length: 30 }, () => checkStudent())); mockDelay = 0; });
    assert.equal(await page.evaluate(() => mockReads.filter(key => key === 'students/66000000').length), loginReads + 1);
    assert.equal(await page.evaluate(() => currentStudentId), '66000000');
    await page.evaluate(async () => {
      logout(); DE06.storage.removeItem('de06_student_66000000');
      DE06.storage.setItem('de06_student_cached-other', JSON.stringify({ studentId: 'cached-other', name: 'บัญชีแคช' }));
      document.getElementById('studentId').value = '66000000'; mockDelay = 100;
      const pending = checkStudent(); document.getElementById('studentId').value = 'cached-other';
      await checkStudent(); await pending; mockDelay = 0;
    });
    assert.equal(await page.evaluate(() => currentStudentId), 'cached-other');
    assert.equal(await page.locator('#btnLogin').isDisabled(), false, 'Switch to a cached login must restore button state');
    await page.goto(base + '/admin.html');
    await page.evaluate(async () => {
      isAdminAuthenticated = true; currentAdminRole = 'master'; currentAdminId = 'master';
      document.getElementById('loginBox').style.display = 'none'; document.getElementById('adminPanel').style.display = 'block';
      await loadInitialData(); switchTab('tab-responses');
      mockDelay = 100;
      const loads = [];
      for (let i = 0; i < 30; i++) {
        document.getElementById('responseActivitySelect').value = ['poll', 'comment', 'form'][i % 3];
        loads.push(displaySelectedActivityResponses());
      }
      document.getElementById('responseActivitySelect').value = 'form'; loads.push(displaySelectedActivityResponses());
      await Promise.all(loads); mockDelay = 0;
    });
    assert((await page.locator('#responsesContent').innerText()).includes('การตอบรับแบบฟอร์ม'));
    await page.evaluate(async () => {
      mockDelay = 100;
      for (let i = 0; i < 30; i++) { switchTab('tab-bookings'); switchTab('tab-activities'); switchTab('tab-settings'); }
      await new Promise(resolve => setTimeout(resolve, 650)); mockDelay = 0;
    });
    assert.equal(await page.locator('.tab-pane.active').count(), 1);
    assert.equal(await page.evaluate(() => mockListeners.size), 0);
    await page.evaluate(() => switchTab('tab-activities'));
    // Exercise modal handlers through actual clicks rather than invoking only their functions.
    for (let i = 0; i < 10; i++) {
      await page.getByRole('button', { name: 'เพิ่มกิจกรรม', exact: true }).evaluate(el => el.click());
      await page.keyboard.press('Escape');
    }
    assert.equal(await page.locator('#activityTypeDialog').evaluate(el => getComputedStyle(el).display), 'none');
    assert.deepEqual(errors, []); assert.deepEqual(await page.evaluate(() => unhandledErrors), []);
    return '300 storefront transitions and 90 admin transitions under pending reads; 30 repeated logins/submissions/response switches; logout race, completed-form retry and modal clicks passed';
  } finally { await page.close(); }
};
