const assert = require('assert');

// Use the actual builder, saved documents and storefront scripts. Never contact production.
module.exports = async function auditAdminFrontend(browser, base, init, original) {
  const data = structuredClone(original);
  data.config.main.ADMIN_PASSWORD = 'fixture-master';
  data.config.main.ADMIN_STUDENTS = [{ studentId: '66000000', name: 'ผู้ดูแลทดสอบ', pin: 'old-pin' }];
  const errors = [];
  async function createPage(fixture = data) {
    const page = await browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(init, fixture);
    await page.route('**/*', route => /^(?:http:\/\/127\.0\.0\.1|blob:|data:)/.test(route.request().url()) ? route.continue() : route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    return page;
  }
  const admin = await createPage();
  try {
    for (const configured of [true, false]) {
      const loginData = structuredClone(data);
      if (!configured) delete loginData.config.main.ADMIN_PASSWORD;
      const legacy = await createPage(loginData);
      try {
        await legacy.goto(base + '/admin.html');
        await legacy.locator('#adminLoginInput').fill('incorrect-fixture');
        await legacy.locator('#adminLoginInput').press('Enter');
        await legacy.waitForFunction(() => document.getElementById('loginMsg').textContent.includes('ไม่ถูกต้อง'));
        assert.equal(await legacy.evaluate(() => isAdminAuthenticated), false);
        await legacy.locator('#adminLoginInput').fill('');
        await legacy.evaluate(() => attemptLogin());
        await legacy.waitForFunction(() => document.getElementById('loginMsg').textContent.includes('กรุณากรอก'));
        assert.equal(await legacy.evaluate(() => isAdminAuthenticated), false);
        await legacy.locator('#adminLoginInput').fill('de06admin');
        await legacy.locator('#adminLoginInput').press('Enter');
        await legacy.waitForFunction(() => isAdminAuthenticated && currentAdminRole === 'master');
      } finally { await legacy.close(); }
    }
    await admin.goto(base + '/admin.html');
    assert.equal(await admin.locator('#loginBox input').count(), 1);
    assert.equal(await admin.locator('#loginTabMaster, #loginTabStudent').count(), 0);
    await admin.locator('#adminLoginInput').fill('fixture-master');
    await admin.locator('#adminLoginInput').press('Enter');
    await admin.waitForFunction(() => isAdminAuthenticated && appActivities.length === 6);
    assert.equal(await admin.locator('.activity-editor[open]').count(), 0);
    const added = {};
    for (const type of ['announcement', 'poll', 'form', 'comment', 'product', 'link', 'html']) {
      await admin.getByRole('button', { name: 'เพิ่มกิจกรรม', exact: true }).click();
      await admin.locator(`#activityTypeDialog button[onclick="chooseActivityType('${type}')"]`).click();
      const index = await admin.evaluate(() => appActivities.length - 1);
      const editor = admin.locator('#activity-card-' + index);
      await editor.locator('.activity-title-input').fill('ทดสอบ ' + type);
      added[type] = await admin.evaluate(index => appActivities[index].id, index);
      if (type === 'product') {
        await editor.getByRole('spinbutton', { name: 'ราคา บาท', exact: true }).fill('379');
        await editor.getByRole('spinbutton', { name: 'ราคาลด บาท', exact: true }).fill('350');
        await editor.getByRole('textbox', { name: 'สี', exact: true }).fill('ขาว, ดำ');
        await editor.getByRole('textbox', { name: 'ไซส์', exact: true }).fill('S, M');
        await editor.locator('input[onchange*=hasCustomSize]').check();
        await editor.getByRole('spinbutton', { name: 'ราคาเพิ่มสำหรับไซส์พิเศษ บาท', exact: true }).fill('30');
      }
      if (type === 'poll') {
        await editor.locator('input[onchange*="allowChangeVote"]').uncheck();
        await editor.locator('input[onchange*="showResults"]').uncheck();
      }
      if (type === 'comment') {
        await editor.locator('textarea').fill('กติกาทดสอบ');
        await editor.locator('input[onchange*="allowDeleteOwn"]').uncheck();
        await editor.locator('input[onchange*="allowImageInComment"]').uncheck();
      }
      if (type === 'announcement') {
        await editor.locator('#type-config-' + index + ' textarea').fill('รายละเอียดจากหลังบ้าน');
        await editor.locator('#type-config-' + index + ' select').selectOption('urgent');
        await editor.locator('input[oninput*="actionUrl"]').fill('https://example.test/announcement');
      }
      if (type === 'link') await editor.locator('input[oninput*="targetUrl"]').fill('https://example.test/activity');
      if (type === 'html') await editor.locator('textarea').fill('<p>HTML จากหลังบ้าน</p>');
      if (type === 'form') {
        await editor.getByRole('button', { name: '+ เพิ่มคำถามใหม่', exact: true }).click();
        await editor.locator('input[oninput*="formQuestions"]').nth(1).fill('จำนวนที่ต้องการ');
        await editor.locator('select[onchange*="formQuestions"]').nth(1).selectOption('number');
      }
      assert(await editor.locator('.activity-editor').evaluate(element => element.open));
    }
    await admin.evaluate(() => saveAllChanges());
    assert((await admin.locator('#globalMsg').innerText()).includes('สำเร็จ'));
    const saved = await admin.evaluate(() => mockData);
    assert.equal(Object.keys(saved.activities).length, 13);
    assert.equal(new Set(Object.keys(saved.activities)).size, 13);
    assert.equal(saved.activities[added.poll].showResults, false);
    assert.equal(saved.activities[added.comment].allowImageInComment, false);
    for (const type of Object.keys(added)) assert.equal(saved.activities[added[type]].title, 'ทดสอบ ' + type, 'Editor must not steal field focus');

    // Each editor must fit at every requested width, including its type-specific controls.
    for (const width of [320, 375, 390, 414, 768, 1024, 1440, 2560]) {
      await admin.setViewportSize({ width, height: 900 });
      await admin.evaluate(() => document.querySelectorAll('.activity-editor').forEach(element => { element.open = true; }));
      assert(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Expanded editors overflow at ' + width);
      const spacing = await admin.evaluate(() => ({ root: parseFloat(getComputedStyle(document.documentElement).fontSize), gutter: document.querySelector('.dashboard-container').getBoundingClientRect().left }));
      assert.equal(spacing.root, width < 640 ? 15 : width < 1024 ? 15.5 : width < 1440 ? 16 : width < 1920 ? 16.5 : 17.5);
      assert(spacing.gutter >= spacing.root * .75 - 1);
      assert(await admin.evaluate(() => Array.from(document.querySelectorAll('.nav-tab')).every(tab => tab.scrollWidth <= tab.clientWidth + 1)), 'Navigation labels must fit their buttons at ' + width);
    }
    if (process.env.SYSTEM_SCREENSHOTS) {
      await admin.setViewportSize({ width: 390, height: 844 });
      await admin.evaluate(() => { document.querySelectorAll('.activity-editor').forEach((element, index) => { element.open = index === 0; }); window.scrollTo(0, 0); });
      await admin.screenshot({ path: require('path').join(__dirname, 'reports', 'admin-editor-mobile.png') });
      await admin.setViewportSize({ width: 1440, height: 900 });
      await admin.evaluate(() => openActivityChooser());
      await admin.screenshot({ path: require('path').join(__dirname, 'reports', 'admin-chooser-desktop.png') });
      await admin.evaluate(() => closeActivityChooser());
    }
    await admin.evaluate(() => {
      switchTab('tab-announcement');
      document.getElementById('ann_enable').checked = true;
      document.getElementById('ann_title').value = 'ประกาศด่วนจากหลังบ้าน';
      document.getElementById('ann_desc').value = 'รายละเอียดแถบประกาศ';
      document.getElementById('ann_type').value = 'urgent';
      document.getElementById('ann_target_activity').value = 'booking-section';
      return saveAllChanges();
    });
    const configured = await admin.evaluate(() => mockData);
    assert.equal(configured.config.main.HOME_ANNOUNCEMENT.target, 'booking-section');
    assert.equal(await admin.evaluate(() => Array.from(document.getElementById('responseActivitySelect').options).filter(o => o.value).every(o => ['poll', 'comment', 'form', 'product'].includes(appActivities.find(a => a.id === o.value).type))), true);

    const home = await createPage(configured);
    try {
      await home.goto(base + '/index.html?student');
      await home.waitForFunction(() => allTasks.length === 13 && !!document.querySelector('.admin-access-card'));
      assert((await home.locator('.home-banner').innerText()).includes('ประกาศด่วนจากหลังบ้าน'));
      assert(await home.locator('.home-banner.banner-urgent').count());
      await home.locator('.home-banner button').click();
      assert(await home.locator('#booking-section').evaluate(el => el.classList.contains('active')));
      await home.evaluate(() => { window.open = (url, target) => { window.openedLink = { url, target }; }; });
      const taskButton = type => home.locator(`#active-tasks-container button`).filter({ hasText: type === 'booking' ? 'สั่งจองเสื้อช็อป' : type === 'poll' ? 'ร่วมลงคะแนนโหวต' : type === 'comment' ? 'เปิดกระดานพูดคุย' : type === 'form' ? 'เปิดแบบฟอร์ม' : 'เข้าสู่กิจกรรม' });
      for (const type of ['announcement', 'poll', 'form', 'comment', 'product', 'link', 'html']) {
        await home.evaluate(() => switchSection('home-section'));
        const card = home.locator('.task-card').filter({ hasText: 'ทดสอบ ' + type });
        await card.locator('button').click();
        if (type === 'booking') assert(await home.locator('#booking-section').evaluate(el => el.classList.contains('active')));
        else if (type === 'link') assert.equal(await home.evaluate(() => openedLink.url), 'https://example.test/activity');
        else assert(await home.locator('#dynamic-' + added[type]).evaluate(el => el.classList.contains('active')));
        if (type === 'announcement') {
          assert((await home.locator('#dynamic-' + added[type]).innerText()).includes('รายละเอียดจากหลังบ้าน'));
          assert(await home.locator('#dynamic-' + added[type] + ' .badge-urgent').count());
          assert.equal(await home.locator('#dynamic-' + added[type] + ' .btn-success').count(), 1, JSON.stringify(await home.evaluate(id => ({ task: allTasks.find(t => t.id === id), html: document.getElementById('dynamic-' + id).innerHTML, errors: window.lastAlert }), added[type])));
          await home.locator('#dynamic-' + added[type] + ' .btn-success').click();
          assert.equal(await home.evaluate(() => openedLink.url), 'https://example.test/announcement');
        }
        if (type === 'poll') {
          await home.waitForFunction(id => document.getElementById('poll-total-' + id).textContent.includes('ไม่เปิด'), added[type]);
          assert.equal(await home.locator('#dynamic-' + added[type] + ' .poll-status-tag:visible').count(), 0);
          await home.locator('#poll-opt-' + added[type] + '-0').click();
          await home.locator('#btn-vote-' + added[type]).click();
          await home.waitForFunction(id => studentCurrentVoteMap[id] === 0, added[type]);
          const before = await home.evaluate(() => mockWrites.length);
          await home.evaluate(id => { selectedVoteOption[id] = 1; return submitSelectedVote(id); }, added[type]);
          assert.equal(await home.evaluate(() => mockWrites.length), before);
          assert(await home.locator('#btn-vote-' + added[type]).isDisabled());
        }
        if (type === 'comment') {
          assert(!(await home.locator('#comment-file-' + added[type]).evaluate(el => el.parentElement.getClientRects().length)));
          await home.locator('#comment-input-' + added[type]).fill('ความคิดเห็นจากหน้าบ้าน');
          await home.evaluate(id => { commentImageBlobMap[id] = 'data:image/png;base64,AAAA'; }, added[type]);
          await home.locator('#btn-post-comment-' + added[type]).click();
          await home.waitForFunction(id => Object.values(mockData.comments).some(row => row.activityId === id), added[type]);
          assert.equal(await home.evaluate(id => Object.values(mockData.comments).find(row => row.activityId === id).imageUrl, added[type]), '');
          assert.equal(await home.locator('#dynamic-' + added[type] + ' .comment-del-btn:visible').count(), 0);
        }
        if (type === 'form') {
          await home.locator('#custom-form-' + added[type] + ' input[type=text]').fill('คำตอบจากหน้าบ้าน');
          await home.locator('#custom-form-' + added[type] + ' input[type=number]').fill('3');
          await home.locator('#btn-submit-form-' + added[type]).click();
          await home.waitForFunction(id => Object.values(mockData.dynamic_submissions || {}).some(row => row.activityId === id), added[type]);
          assert.equal(await home.evaluate(id => Object.values(mockData.dynamic_submissions).find(row => row.activityId === id).formData['จำนวนที่ต้องการ'], added[type]), '3');
        }
        if (type === 'product') {
          const productForm = home.locator('#product-order-' + added[type]);
          await productForm.locator('select[name=colors]').selectOption('ดำ');
          await productForm.locator('select[name=sizes]').selectOption('ไซส์พิเศษ');
          await productForm.locator('input[name=customSize]').fill('รอบอก 50 นิ้ว');
          await productForm.locator('input[name=quantity]').fill('2');
          assert((await home.locator('#product-total-' + added[type]).innerText()).includes('760'));
          await home.evaluate(id => Promise.all([submitProductOrder(id), submitProductOrder(id)]), added[type]);
          const orders = await home.evaluate(id => Object.values(mockData.dynamic_submissions || {}).filter(row => row.activityId === id), added[type]);
          assert.equal(orders.length, 1); assert.equal(orders[0].productSnapshot.totalPrice, 760);
          assert.equal(orders[0].formType, 'product_order');
          assert.equal(orders[0].formData['สี'], 'ดำ');
          assert(await home.evaluate(id => {
            const task = allTasks.find(t => t.id === id);
            try { DE06.productQuote(task, { colors: 'ไม่มี', sizes: 'M' }, 1); return false; } catch { return true; }
          }, added[type]));
          await admin.evaluate(rows => { mockData.dynamic_submissions = Object.fromEntries(rows.map((row, i) => ['product-test-' + i, row])); }, orders);
          await admin.evaluate(async id => { document.getElementById('responseActivitySelect').value = id; await displaySelectedActivityResponses(); }, added[type]);
          assert((await admin.locator('#responsesContent').innerText()).includes('760'));

        }
        if (type === 'html') assert.equal(await home.locator('#dynamic-' + added[type] + ' iframe').getAttribute('sandbox'), 'allow-forms allow-scripts allow-popups');
      }
      await home.evaluate(() => { const task = allTasks.find(t => t.type === 'announcement'); task.active = false; switchSection('home-section'); });
      await home.evaluate(() => switchSection('dynamic-announcement'));
      assert(await home.locator('#home-section').evaluate(el => el.classList.contains('active')));
      await home.evaluate(() => { DE06.session.setItem('de06_admin_auth', 'true'); DE06.session.setItem('de06_admin_role', 'master'); DE06.session.setItem('de06_admin_id', 'master'); });
      await home.getByRole('button', { name: 'เข้าหลังบ้าน', exact: true }).click();
      await home.waitForURL('**/admin.html');
      await home.waitForFunction(() => isAdminAuthenticated && currentAdminRole === 'subadmin' && currentAdminId === '66000000');
      assert.equal(await home.locator('#adminStudentPinInput').count(), 0);
      assert(!(await home.locator('#nav-tab-admins').isVisible()));
      await home.evaluate(() => { mockData.config.main.ADMIN_STUDENTS = []; });
      await home.evaluate(() => attemptAutoLogin());
      assert.equal(await home.evaluate(() => isAdminAuthenticated), false);
      assert(!(await home.locator('#adminPanel').isVisible()));
    } finally { await home.close(); }

    const direct = await createPage();
    try {
      await direct.goto(base + '/admin.html');
      await direct.locator('#adminLoginInput').fill('66000000');
      await direct.locator('#adminLoginInput').press('Enter');
      await direct.waitForFunction(() => isAdminAuthenticated && currentAdminRole === 'subadmin');
      await direct.locator('#headerLogoutBtn').click();
      await direct.reload();
      assert.equal(await direct.evaluate(() => isAdminAuthenticated), false);
      await direct.locator('#adminLoginInput').fill('unauthorized');
      await direct.locator('#adminLoginInput').press('Enter');
      await direct.waitForFunction(() => document.getElementById('loginMsg').textContent.includes('ไม่ได้รับสิทธิ์'));
      assert.equal(await direct.evaluate(() => isAdminAuthenticated), false);
      await direct.goto(base + '/index.html');
      await direct.evaluate(() => { currentStudentId = 'unauthorized'; currentStudentName = 'ผู้ใช้ทั่วไป'; switchSection('home-section'); });
      assert.equal(await direct.locator('.admin-access-card').count(), 0);
    } finally { await direct.close(); }
    assert.deepEqual(errors, []);
    return 'Seven activity types created in admin, saved, used in storefront; role handoff, revocation, student-only login and expanded responsive editors passed';
  } finally { await admin.close(); }
};
