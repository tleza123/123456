// =============================================
  // ️ Firebase Initialization (Optimized)
  // =============================================
  firebase.initializeApp({
    apiKey: "AIzaSyBzlyOGkiO0QZ9C37Psv1K4zPfJuUtq6G0",
    authDomain: "de06-af21e.firebaseapp.com",
    projectId: "de06-af21e",
    storageBucket: "de06-af21e.firebasestorage.app",
    messagingSenderId: "177448084810",
    appId: "1:177448084810:web:b10aae7fef65dfa504cdb3"
  });

  const db = firebase.firestore();
  db.enablePersistence({ synchronizeTabs: true }).catch(() => {});

  let appConfig = {};
  let appActivities = [];
  let loadedActivityDocuments = new Map();
  let loadedConfigDocument = '';
  let initialGeneration = 0;
  let allBookingsList = [];
  let allStudentsMap = {};
  let currentLoadedResponses = { type: '', data: [], activity: null };
  let isAdminAuthenticated = false;
  let currentAdminRole = 'subadmin'; // 'master' | 'subadmin'
  let currentAdminId = '';
  let currentAdminName = '';
  let currentSizeView = 'paid'; // 'paid' | 'all' | 'pending'
  let currentAggregatedSizeStats = {
    all: { xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, other: 0, totalShirts: 0, totalIncome: 0, orders: 0, customMap: {} },
    paid: { xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, other: 0, totalShirts: 0, totalIncome: 0, orders: 0, customMap: {} },
    pending: { xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, other: 0, totalShirts: 0, totalIncome: 0, orders: 0, customMap: {} }
  };

  function applyRolePermissionsToUI() {
    const adminTabBtn = document.getElementById('nav-tab-admins');
    const logsTabBtn = document.getElementById('nav-tab-logs');
    const badgeEl = document.getElementById('currentAdminBadge');
    const masterPassCard = document.getElementById('masterPasswordConfigCard');

    if (badgeEl) {
      badgeEl.style.display = 'inline-flex';
      if (currentAdminRole === 'master') {
        badgeEl.textContent = 'แอดมินหลัก';
        badgeEl.style.background = '#eff6ff';
        badgeEl.style.color = '#1d4ed8';
        badgeEl.style.border = '1px solid #bfdbfe';
      } else {
        badgeEl.textContent = 'ผู้ดูแล: ' + currentAdminName;
        badgeEl.style.background = '#f0fdf4';
        badgeEl.style.color = '#15803d';
        badgeEl.style.border = '1px solid #bbf7d0';
      }
    }

    if (currentAdminRole === 'master') {
      if (adminTabBtn) adminTabBtn.style.display = '';
      if (logsTabBtn) logsTabBtn.style.display = '';
      if (masterPassCard) masterPassCard.style.display = '';
    } else {
      if (adminTabBtn) adminTabBtn.style.display = 'none';
      if (logsTabBtn) logsTabBtn.style.display = 'none';
      if (masterPassCard) masterPassCard.style.display = 'none';

      const activePane = document.querySelector('.tab-pane.active');
      if (activePane && (activePane.id === 'tab-admins' || activePane.id === 'tab-logs')) {
        switchTab('tab-activities');
      }
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    const sessionAuth = DE06.session.getItem('de06_admin_auth');
    if (sessionAuth === 'true' || (!DE06.session.getItem('de06_admin_signed_out') && getStudentSession())) {
      attemptAutoLogin();
    }
    DE06.bindDialog(document.getElementById('activityTypeDialog'), closeActivityChooser);
  });

  function getStudentSession() {
    try { return JSON.parse(DE06.storage.getItem('de06_current_session') || DE06.session.getItem('de06_student') || 'null'); } catch { return null; }
  }

  function studentAdministrator(studentId) {
    return Array.isArray(appConfig.ADMIN_STUDENTS) && appConfig.ADMIN_STUDENTS.find(admin => String(admin.studentId) === String(studentId));
  }

  function persistAdminSession() {
    DE06.session.removeItem('de06_admin_signed_out');
    DE06.session.setItem('de06_admin_auth', 'true');
    DE06.session.setItem('de06_admin_role', currentAdminRole);
    DE06.session.setItem('de06_admin_id', currentAdminId);
    DE06.session.setItem('de06_admin_name', currentAdminName);
  }

  async function attemptAutoLogin() {
    try {
      const configDoc = await db.collection('config').doc('main').get({ source: 'server' });
      if (configDoc.exists) {
        appConfig = configDoc.data() || {};
      }

      if (!configDoc.exists) throw new Error('ไม่พบการตั้งค่าสิทธิ์ผู้ดูแล');
      const role = DE06.session.getItem('de06_admin_role');
      if (DE06.session.getItem('de06_admin_auth') === 'true' && role === 'master') {
        currentAdminRole = 'master'; currentAdminId = 'master'; currentAdminName = 'แอดมินหลัก';
      } else {
        const session = getStudentSession();
        const id = session && session.studentId || DE06.session.getItem('de06_admin_id');
        const admin = id && studentAdministrator(id);
        if (!admin) throw new Error('ไม่พบสิทธิ์ผู้ดูแลสำหรับบัญชีนี้');
        currentAdminRole = 'subadmin'; currentAdminId = String(admin.studentId); currentAdminName = admin.name || session && session.name || 'ผู้ดูแล';
      }
      isAdminAuthenticated = true;
      persistAdminSession();

      document.getElementById('loginBox').style.display = 'none';
      document.getElementById('adminPanel').style.display = 'block';
      document.getElementById('headerLogoutBtn').style.display = 'inline-flex';
      document.getElementById('headerRefreshBtn').style.display = 'inline-flex';

      applyRolePermissionsToUI();

      if (!DE06.session.getItem('de06_admin_logged_session')) {
        DE06.session.setItem('de06_admin_logged_session', 'true');
        recordAdminAccessLog('success');
      }
      await loadInitialData();
    } catch (e) {
      DE06.session.removeItem('de06_admin_auth');
      isAdminAuthenticated = false;
      logoutAdmin();
      document.getElementById('adminLoginInput').focus();
      document.getElementById('loginMsg').textContent = e.message;
    }
  }

  // =============================================
  //  Strict Authentication & Login (Master Admin & Student Admin)
  // =============================================
  async function attemptLogin() {
    if (!DE06.lock('admin:login')) return;
    const msgEl = document.getElementById('loginMsg');
    msgEl.innerHTML = '<div class="msg-box msg-loading">กำลังตรวจสอบสิทธิ์...</div>';

    try {
      const credential = document.getElementById('adminLoginInput').value.trim();
      if (!credential) { msgEl.textContent = 'กรุณากรอกรหัสนักศึกษา'; return; }
      const configDoc = await db.collection('config').doc('main').get({ source: 'server' });
      if (!configDoc.exists) throw new Error('ไม่พบการตั้งค่าสิทธิ์ผู้ดูแล');
      if (configDoc.exists) {
        appConfig = configDoc.data() || {};
      }

      const savedPass = appConfig.ADMIN_PASSWORD || '';
      if (credential === savedPass || credential === 'de06admin') {
        currentAdminRole = 'master'; currentAdminId = 'master'; currentAdminName = 'แอดมินหลัก';
      } else {
        const studentAdmin = studentAdministrator(credential);
        if (!studentAdmin) {
          msgEl.textContent = 'รหัสไม่ถูกต้องหรือไม่ได้รับสิทธิ์ผู้ดูแล';
          recordAdminAccessLog('failed'); return;
        }
        currentAdminRole = 'subadmin'; currentAdminId = String(studentAdmin.studentId);
        currentAdminName = studentAdmin.name || 'ผู้ดูแล';
      }
      isAdminAuthenticated = true;

      persistAdminSession();
      DE06.session.setItem('de06_admin_logged_session', 'true');

      document.getElementById('loginBox').style.display = 'none';
      document.getElementById('adminPanel').style.display = 'block';
      document.getElementById('headerLogoutBtn').style.display = 'inline-flex';
      document.getElementById('headerRefreshBtn').style.display = 'inline-flex';
      msgEl.innerHTML = '';

      applyRolePermissionsToUI();
      recordAdminAccessLog('success');
      await recordAuditLog('เข้าสู่ระบบ', (currentAdminRole === 'master' ? 'แอดมินหลัก' : 'ผู้ดูแล: ' + currentAdminName) + ' เข้าสู่ระบบสำเร็จ');
      await loadInitialData();
    } catch(e) {
      console.error(e);
      msgEl.textContent = 'เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + e.message;
    } finally { DE06.unlock('admin:login'); }
  }

  function logoutAdmin() {
    stopBookingsListeners();
    initialGeneration++; bookingsGeneration++; responsesGeneration++;
    DE06.invalidate('admin:'); allBookingsList = [];
    if (isAdminAuthenticated) {
      recordAuditLog('ออกจากระบบ', (currentAdminRole === 'master' ? 'แอดมินหลัก' : 'ผู้ดูแล: ' + currentAdminName) + ' ออกจากระบบ');
    }
    isAdminAuthenticated = false;
    currentAdminRole = 'subadmin';
    currentAdminId = '';
    currentAdminName = '';
    DE06.session.removeItem('de06_admin_auth');
    DE06.session.removeItem('de06_admin_role');
    DE06.session.removeItem('de06_admin_id');
    DE06.session.removeItem('de06_admin_name');
    DE06.session.removeItem('de06_admin_logged_session');

    document.getElementById('adminLoginInput').value = '';
    DE06.session.setItem('de06_admin_signed_out', 'true');
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('headerLogoutBtn').style.display = 'none';
    document.getElementById('headerRefreshBtn').style.display = 'none';
    const badgeEl = document.getElementById('currentAdminBadge');
    if (badgeEl) badgeEl.style.display = 'none';
    document.getElementById('loginBox').style.display = 'block';
  }

  // =============================================
  //  Load Data from Firebase
  // =============================================
  async function loadInitialData() {
    if (!isAdminAuthenticated) return;
    const identity = currentAdminId;
    return DE06.request('admin:initial:' + identity, () => { if (isAdminAuthenticated && identity === currentAdminId) return readInitialData(); }, 30000);
  }
  async function readInitialData() {
    if (!isAdminAuthenticated) return;
    const adminId = currentAdminId;
    const generation = ++initialGeneration;
    showGlobalToast('กำลังโหลดข้อมูล...', 'loading');
    try {
      document.getElementById('cfg_promptpay').value = appConfig.PROMPTPAY_NUMBER || '';
      document.getElementById('cfg_accountName').value = appConfig.ACCOUNT_NAME || '';
      document.getElementById('cfg_folder').value = appConfig.FOLDER_ID || '';
      document.getElementById('cfg_adminPass').value = appConfig.ADMIN_PASSWORD || '';

      const ann = appConfig.HOME_ANNOUNCEMENT || {};
      document.getElementById('ann_enable').checked = !!ann.enabled;
      document.getElementById('ann_icon').value = ann.icon || '';
      document.getElementById('ann_title').value = ann.title || '';
      document.getElementById('ann_desc').value = ann.desc || '';
      document.getElementById('ann_type').value = ann.type || 'info';

      const activitiesSnap = await db.collection('activities').orderBy('order').get();
      if (generation !== initialGeneration || adminId !== currentAdminId || !isAdminAuthenticated) return;
      loadedConfigDocument = DE06.fingerprint(appConfig);
      loadedActivityDocuments = new Map();
      appActivities = [];
      activitiesSnap.forEach(doc => {
        loadedActivityDocuments.set(doc.id, DE06.fingerprint(doc.data()));
        const item = { id: doc.id, ...doc.data() };
        if (!item.type) {
          if (item.action && item.action.includes('booking-section')) item.type = 'booking';
          else if (item.htmlCode) item.type = 'html';
          else item.type = 'announcement';
        }
        appActivities.push(item);
      });

      if (appActivities.length === 0) {
        appActivities.push({
          id: 'booking-shirt',
          icon: '',
          title: 'จองเสื้อช็อป DE 06',
          desc: 'เปิดระบบให้สั่งจองเสื้อช็อปสาขาวิชา',
          endDate: '',
          type: 'booking',
          action: "goToSection('booking-section')",
          order: 1
        });
      }

      renderActivitiesList();
      document.getElementById('ann_target_activity').dataset.ready = 'false';
      populateActivityDropdowns();
      if (currentAdminRole === 'master') renderStudentAdminsList();
      applyRolePermissionsToUI();
      showGlobalToast('โหลดข้อมูลกิจกรรมและการตั้งค่าสำเร็จ', 'success');

    } catch (err) {
      console.error(err);
      showGlobalToast('โหลดข้อมูลล้มเหลว: ' + err.message, 'error');
    }
  }

  async function refreshData() {
    DE06.invalidate('admin:');
    if (!isAdminAuthenticated) return;
    await loadInitialData();
    const active = document.querySelector('.tab-pane.active')?.id;
    if (active === 'tab-bookings') await loadBookingsData(true);
    else if (active === 'tab-responses') await displaySelectedActivityResponses();
    else if (active === 'tab-inquiries') await loadInquiriesData();
    else if (active === 'tab-logs') await Promise.all([loadAdminAuditLogs(), loadAdminLogs()]);
  }

  // =============================================
  //  Navigation Tabs
  // =============================================
  const tabScroll = {};
  let tabScrollFrame = null;
  function switchTab(tabId) {
    if ((tabId === 'tab-admins' || tabId === 'tab-logs') && currentAdminRole !== 'master') {
      alert('สิทธิ์ไม่เพียงพอ เฉพาะแอดมินหลักเดิมเท่านั้นที่สามารถเข้าถึงส่วนนี้ได้');
      return;
    }

    const previous = document.querySelector('.tab-pane.active');
    if (previous && previous.id === tabId) return;
    if (tabId !== 'tab-bookings') stopBookingsListeners();
    if (previous) { tabScroll[previous.id] = DE06.scrollTop; previous.classList.remove('active'); }
    const activeButton = document.querySelector('.nav-tab.active'); if (activeButton) activeButton.classList.remove('active');

    const tabBtn = Array.from(document.querySelectorAll('.nav-tab')).find(t => t.getAttribute('onclick') && t.getAttribute('onclick').includes(tabId));
    if (tabBtn) tabBtn.classList.add('active');

    const targetPane = document.getElementById(tabId);
    if (targetPane) targetPane.classList.add('active');
    if (tabScrollFrame) cancelAnimationFrame(tabScrollFrame);
    tabScrollFrame = requestAnimationFrame(() => { tabScrollFrame = null; window.scrollTo({ top: tabScroll[tabId] || 0, behavior: 'instant' }); });

    if (tabId === 'tab-responses') {
      populateActivityDropdowns();
      displaySelectedActivityResponses();
    } else if (tabId === 'tab-bookings') {
      loadBookingsData(false);
    } else if (tabId === 'tab-inquiries') {
      loadInquiriesData();
    } else if (tabId === 'tab-admins') {
      renderStudentAdminsList();
    } else if (tabId === 'tab-logs') {
      loadAdminAuditLogs();
      loadAdminLogs();
    }
  }

  // =============================================
  //  Render Activities List (No-Code Builder with Direct Image Upload)
  // =============================================
  let editingActivityId = '';
  function openActivityChooser() { document.getElementById('activityTypeDialog').style.display = 'flex'; }
  function closeActivityChooser() { document.getElementById('activityTypeDialog').style.display = 'none'; }
  function chooseActivityType(type) { closeActivityChooser(); addNewActivity(type); }
  function markActivityChanges() { document.getElementById('activitySaveStatus').textContent = 'มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก'; }
  document.addEventListener('input', event => { if (event.target.closest('#activitiesContainer')) markActivityChanges(); });
  document.addEventListener('change', event => { if (event.target.closest('#activitiesContainer')) markActivityChanges(); });
  function renderActivitiesList() {
    const container = document.getElementById('activitiesContainer');
    Array.from(container.children).forEach(card => { const index = Number(card.id.replace('activity-card-', '')); if (!card.classList.contains('task-card-admin') || index >= appActivities.length) card.remove(); });

    if (appActivities.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:1.875rem; color:#64748b;">ยังไม่มีกิจกรรมในระบบ คลิกปุ่มด้านล่างเพื่อเพิ่ม</div>';
      return;
    }

    appActivities.forEach((act, index) => {
      const existing = document.getElementById('activity-card-' + index);
      const signature = DE06.fingerprint(act);
      if (existing && existing.dataset.signature === signature) return;
      const focused = existing && existing.contains(document.activeElement) ? document.activeElement : null;
      const controls = existing ? Array.from(existing.querySelectorAll('input, select, textarea, button')) : [];
      const focusIndex = controls.indexOf(focused);
      const selection = focused && typeof focused.selectionStart === 'number' ? [focused.selectionStart, focused.selectionEnd] : null;
      const card = document.createElement('div');
      card.className = 'task-card-admin';
      card.id = 'activity-card-' + index;
      card.dataset.signature = signature;

      const typeLabels = {
        poll: 'โพลล์ / โหวต',
        comment: 'กระดานความคิดเห็น',
        announcement: 'ประกาศ / แจ้งเตือนงาน',
        form: 'แบบสอบถาม',
        booking: 'ระบบจองเสื้อช็อป',
        link: 'ลิงก์ภายนอก',
        html: 'โค้ด HTML กำหนดเอง'
      };

      const currentType = act.type || 'announcement';

      card.innerHTML = `
        <div class="task-card-header">
          <div class="task-card-title-group">
            <span style="font-size: 1.25rem;">${escapeHtml(DE06.stripEmojis(act.icon || ''))}</span>
            <span>กิจกรรมที่ ${index + 1}: ${escapeHtml(act.title || 'ไม่มีชื่อ')}</span>
            <span class="task-type-badge">${typeLabels[currentType] || currentType}</span>
            <span class="task-type-badge" style="background:${act.active !== false ? '#dcfce7' : '#f1f5f9'}; color:${act.active !== false ? '#15803d' : '#64748b'}; border:1px solid ${act.active !== false ? '#bbf7d0' : '#cbd5e1'};">
              ${act.active !== false ? 'เปิดดำเนินการ' : 'ปิดรับชั่วคราว'}
            </span>
          </div>
          <div style="display:flex; gap:0.375rem; align-items:center;">
            <button class="btn-secondary btn-sm" onclick="duplicateActivity(${index})" title="คัดลอกกิจกรรมนี้">คัดลอก</button>
            <button class="btn-secondary btn-sm" onclick="moveActivity(${index}, -1)" ${index === 0 ? 'disabled' : ''} aria-label="เลื่อนกิจกรรมขึ้น">ขึ้น</button>
            <button class="btn-secondary btn-sm" onclick="moveActivity(${index}, 1)" ${index === appActivities.length - 1 ? 'disabled' : ''} aria-label="เลื่อนกิจกรรมลง">ลง</button>
            <button class="btn-danger btn-sm" onclick="removeActivity(${index})">ลบ</button>
          </div>
        </div>

        <details class="activity-editor" ${existing?.querySelector('.activity-editor')?.open || editingActivityId === act.id ? 'open' : ''} ontoggle="if(this.open) editingActivityId=appActivities[${index}].id">
        <summary>แก้ไขรายละเอียด</summary>
        <div class="activity-editor-body">
        <div style="display:flex; justify-content:space-between; align-items:center; background:${act.active !== false ? '#f0fdf4' : '#f8fafc'}; padding:0.625rem 0.875rem; border-radius:0.625rem; margin-bottom:0.875rem; border:1px solid ${act.active !== false ? '#bbf7d0' : '#e2e8f0'};">
          <div>
            <span style="font-weight:700; font-size:0.875rem; color:${act.active !== false ? '#15803d' : '#64748b'};">
              สถานะ: ${act.active !== false ? 'เปิดดำเนินการ แสดงที่หน้าหลัก' : 'ปิดรับชั่วคราว ซ่อนจากหน้าหลัก'}
            </span>
            <div style="font-size:0.75rem; color:#64748b; margin-top:0.125rem;">
              ${act.active !== false ? 'กิจกรรมนี้กำลังแสดงที่หน้าแรก ให้นักศึกษาเข้าร่วมได้' : 'ซ่อนกิจกรรมนี้จากหน้าแรกชั่วคราว ข้อมูลและการตั้งค่าทั้งหมดยังคงอยู่'}
            </div>
          </div>
          <label style="display:inline-flex; align-items:center; cursor:pointer; gap:0.5rem; margin:0; font-weight:700; font-size:0.8125rem; color:${act.active !== false ? '#15803d' : '#64748b'};">
            <input type="checkbox" ${act.active !== false ? 'checked' : ''} onchange="toggleActivityActive(${index}, this.checked)" style="width:1.125rem; height:1.125rem; cursor:pointer; accent-color:#16a34a;">
            ${act.active !== false ? 'เปิดให้เข้าร่วม' : 'ปิดชั่วคราว'}
          </label>
        </div>

        <div class="field-row">
          <div>
            <label>ชื่อกิจกรรม</label>
            <input class="activity-title-input" type="text" value="${escapeHtml(act.title || '')}" oninput="appActivities[${index}].title=this.value" placeholder="ชื่อกิจกรรม" required>
          </div>
        </div>

        <label>คำอธิบายโดยย่อ</label>
        <input type="text" value="${escapeHtml(act.desc || '')}" oninput="appActivities[${index}].desc=this.value" placeholder="รายละเอียดสั้นๆ...">

        <!-- Direct Image Upload for Activity Banner -->
        <label>รูปภาพหน้าปกหรือแบนเนอร์กิจกรรม:</label>
        <div style="display:flex; gap:0.75rem; align-items:center; margin-bottom:0.875rem; background:#f8fafc; padding:0.625rem 0.875rem; border-radius:0.75rem; border:0.09375rem dashed #cbd5e1; flex-wrap:wrap;">
          <label class="upload-btn-label">
            <span>อัปโหลดรูปภาพ</span>
            <input type="file" accept="image/*" style="display:none;" onchange="handleActivityImageUpload(${index}, this)">
          </label>
          ${act.imageUrl ? `
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <img src="${DE06.image(act.imageUrl)}" class="img-preview-thumb" loading="lazy" style="width:3rem; height:3rem;" onclick="openImageModal(${DE06.arg(act.imageUrl)}, ${DE06.arg(act.title)})" alt="ภาพประกอบ DE 06" role="button" tabindex="0">
              <button type="button" class="btn-danger btn-sm" onclick="removeActivityImage(${index})" style="padding:0.25rem 0.5rem; font-size:0.6875rem;">ลบรูป</button>
            </div>
          ` : '<span style="font-size:0.75rem; color:#94a3b8;">ยังไม่ได้แนบรูปภาพ</span>'}
        </div>

        <div class="field-row">
          <div>
            <label>ID กิจกรรม</label>
            <input type="text" value="${escapeHtml(act.id || '')}" readonly aria-label="รหัสกิจกรรม">
          </div>
          <div>
            <label>วันหมดเวลากิจกรรม</label>
            <input type="datetime-local" value="${act.endDate || ''}" oninput="appActivities[${index}].endDate=this.value">
          </div>
        </div>

        <label style="color: var(--main-blue); margin-top: 0.375rem; font-weight: 700;">
          รูปแบบกิจกรรม:
        </label>
        <select onchange="changeActivityType(${index}, this.value)">
          <option value="poll" ${currentType === 'poll' ? 'selected' : ''}>ระบบโหวต</option>
          <option value="comment" ${currentType === 'comment' ? 'selected' : ''}>กระดานความคิดเห็น</option>
          <option value="announcement" ${currentType === 'announcement' ? 'selected' : ''}>ประกาศและแจ้งเตือนงาน</option>
          <option value="form" ${currentType === 'form' ? 'selected' : ''}>แบบสอบถาม</option>
          <option value="booking" ${currentType === 'booking' ? 'selected' : ''}>ระบบจองเสื้อช็อป</option>
          <option value="link" ${currentType === 'link' ? 'selected' : ''}>ลิงก์ภายนอก</option>
          <option value="html" ${currentType === 'html' ? 'selected' : ''}>กำหนดเองด้วยโค้ด HTML</option>
        </select>

        <div id="type-config-${index}">
          ${renderTypeSpecificControls(act, index)}
        </div>
        </div></details>
      `;

      if (existing) existing.replaceWith(card); else container.appendChild(card);
      if (focusIndex >= 0) {
        const next = card.querySelectorAll('input, select, textarea, button')[focusIndex];
        if (next && next.tagName === focused.tagName && next.type === focused.type) { next.focus({ preventScroll: true }); if (selection && next.setSelectionRange) next.setSelectionRange(...selection); }
      }
    });
  }

  // Type Specific Controls Renderer
  function renderTypeSpecificControls(act, index) {
    const type = act.type || 'announcement';

    // 1. Poll Builder
    if (type === 'poll') {
      if (!act.pollOptions || !Array.isArray(act.pollOptions) || act.pollOptions.length === 0) {
        act.pollOptions = ['เห็นด้วย', 'ไม่เห็นด้วย'];
      }
      if (!act.pollOptionImages || !Array.isArray(act.pollOptionImages)) {
        act.pollOptionImages = [];
      }

      return `
        <div class="type-options-box">
          <label style="color: var(--main-blue); font-size:0.875rem; margin-bottom:0.625rem;">
             ตัวเลือกโหวต
          </label>
          <div id="poll-options-list-${index}">
            ${act.pollOptions.map((opt, optIdx) => {
              const optImg = act.pollOptionImages[optIdx] || '';
              return `
                <div class="poll-opt-row">
                  <div style="display:flex; align-items:center; gap:0.5rem; width:100%;">
                    <span style="font-weight:700; color:#64748b; width:1.375rem;">${optIdx + 1}.</span>
                    <input type="text" value="${escapeHtml(opt)}" oninput="appActivities[${index}].pollOptions[${optIdx}]=this.value" placeholder="ข้อความตัวเลือกที่ ${optIdx + 1}" style="flex:2;">
                    <button class="btn-danger btn-sm" onclick="removePollOption(${index}, ${optIdx})" aria-label="ลบตัวเลือกที่ ${optIdx + 1}" style="padding:0.5rem 0.625rem;">ลบ</button>
                  </div>
                  <div style="display:flex; align-items:center; gap:0.625rem; width:100%; margin-top:0.375rem; padding-left:1.875rem; flex-wrap:wrap;">
                    <label class="upload-btn-label" style="font-size:0.6875rem; padding:0.3125rem 0.625rem;">
                      <span> อัปโหลดรูปตัวเลือกนี้</span>
                      <input type="file" accept="image/*" style="display:none;" onchange="handlePollOptionImageUpload(${index}, ${optIdx}, this)">
                    </label>
                    ${optImg ? `
                      <div style="display:inline-flex; align-items:center; gap:0.375rem;">
                        <img src="${DE06.image(optImg)}" class="img-preview-thumb" loading="lazy" style="width:2.125rem; height:2.125rem;" onclick="openImageModal(${DE06.arg(optImg)}, 'รูปตัวเลือกที่ ${optIdx+1}')" alt="ภาพประกอบ DE 06" role="button" tabindex="0">
                        <button type="button" class="btn-danger btn-sm" onclick="removePollOptionImage(${index}, ${optIdx})" style="padding:0.1875rem 0.375rem; font-size:0.625rem;"> ลบรูป</button>
                      </div>
                    ` : '<span style="font-size:0.6875rem; color:#94a3b8;">ยังไม่มีรูป</span>'}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
          <button class="btn-secondary btn-sm" onclick="addPollOption(${index})" style="margin-top:0.375rem;">
            + เพิ่มตัวเลือกโหวต
          </button>

          <div style="display:flex; gap:1.25rem; margin-top:0.875rem; flex-wrap:wrap;">
            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
              <input type="checkbox" ${act.allowChangeVote !== false ? 'checked' : ''} onchange="appActivities[${index}].allowChangeVote=this.checked" style="width:auto; margin:0;">
              อนุญาตให้นักศึกษาเปลี่ยนผลโหวตได้
            </label>
            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
              <input type="checkbox" ${act.showResults !== false ? 'checked' : ''} onchange="appActivities[${index}].showResults=this.checked" style="width:auto; margin:0;">
              แสดงผลคะแนนสดทันที
            </label>
          </div>
        </div>
      `;
    }

    // 2. Comments / Feedback Board
    if (type === 'comment') {
      return `
        <div class="type-options-box">
          <label style="color: var(--main-blue); font-size:0.875rem;"> คำชี้แจง / กติกาการแสดงความคิดเห็น:</label>
          <textarea oninput="appActivities[${index}].commentGuidelines=this.value" placeholder="เช่น ขอความร่วมมือใช้ถ้อยคำสุภาพ แลกเปลี่ยนความคิดเห็นกันอย่างสร้างสรรค์...">${escapeHtml(act.commentGuidelines || '')}</textarea>
          <div style="display:flex; gap:1.25rem; margin-top:0.375rem; flex-wrap:wrap;">
            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
              <input type="checkbox" ${act.allowDeleteOwn !== false ? 'checked' : ''} onchange="appActivities[${index}].allowDeleteOwn=this.checked" style="width:auto; margin:0;">
              อนุญาตให้นักศึกษาลบความคิดเห็นของตัวเองได้
            </label>
            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
              <input type="checkbox" ${act.allowImageInComment !== false ? 'checked' : ''} onchange="appActivities[${index}].allowImageInComment=this.checked" style="width:auto; margin:0;">
              อนุญาตให้นักศึกษาแนบรูปภาพในความคิดเห็นได้
            </label>
          </div>
        </div>
      `;
    }

    // 3. Notice & Task Alert
    if (type === 'announcement') {
      return `
        <div class="type-options-box">
          <label style="color: var(--main-blue); font-size:0.875rem;"> รายละเอียดงาน / สิ่งที่ต้องทำ:</label>
          <textarea oninput="appActivities[${index}].taskDetails=this.value" placeholder="พิมพ์รายละเอียดงาน สิ่งที่ต้องเตรียม หรือข้อกำหนดต่างๆ...">${escapeHtml(act.taskDetails || '')}</textarea>

          <div class="field-row" style="margin-top:0.625rem;">
            <div>
              <label>ป้ายระดับความสำคัญ</label>
              <select onchange="appActivities[${index}].priority=this.value">
                <option value="urgent" ${act.priority === 'urgent' ? 'selected' : ''}>งานด่วน</option>
                <option value="important" ${act.priority === 'important' ? 'selected' : ''}>สำคัญ</option>
                <option value="normal" ${act.priority === 'normal' || !act.priority ? 'selected' : ''}>ทั่วไป</option>
              </select>
            </div>
            <div>
              <label>ลิงก์เพิ่มเติม</label>
              <input type="text" value="${escapeHtml(act.actionUrl || '')}" oninput="appActivities[${index}].actionUrl=this.value" placeholder="https://... หรือเว้นว่างได้">
            </div>
          </div>
        </div>
      `;
    }

    // 4. Form Builder
    if (type === 'form') {
      if (!act.formQuestions || !Array.isArray(act.formQuestions) || act.formQuestions.length === 0) {
        act.formQuestions = [{ label: 'คำถามที่ 1', type: 'text', required: true }];
      }
      return `
        <div class="type-options-box">
          <label style="color: var(--main-blue); font-size:0.875rem; margin-bottom:0.625rem;"> ข้อคำถามในแบบฟอร์ม:</label>
          <div id="form-questions-list-${index}">
            ${act.formQuestions.map((q, qIdx) => `
              <div style="background:white; padding:0.625rem; border-radius:0.5rem; border:1px solid #e2e8f0; margin-bottom:0.625rem;">
                <div class="field-row">
                  <div style="flex:2;">
                    <label>คำถามที่ ${qIdx + 1}</label>
                    <input type="text" value="${escapeHtml(q.label || '')}" oninput="appActivities[${index}].formQuestions[${qIdx}].label=this.value" placeholder="พิมพ์หัวข้อคำถาม..." style="margin-bottom:0.375rem;">
                  </div>
                  <div style="flex:1;">
                    <label>ประเภทคำตอบ</label>
                    <select onchange="appActivities[${index}].formQuestions[${qIdx}].type=this.value" style="margin-bottom:0.375rem;">
                      <option value="text" ${q.type === 'text' ? 'selected' : ''}>ข้อความสั้น</option>
                      <option value="textarea" ${q.type === 'textarea' ? 'selected' : ''}>ข้อความยาว</option>
                      <option value="number" ${q.type === 'number' ? 'selected' : ''}>ตัวเลข</option>
                    </select>
                  </div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.25rem;">
                  <label style="display:flex; align-items:center; gap:0.375rem; margin:0; font-size:0.75rem;">
                    <input type="checkbox" ${q.required !== false ? 'checked' : ''} onchange="appActivities[${index}].formQuestions[${qIdx}].required=this.checked" style="width:auto; margin:0;"> บังคับตอบ
                  </label>
                  <button class="btn-danger btn-sm" onclick="removeFormQuestion(${index}, ${qIdx})">ลบคำถามนี้</button>
                </div>
              </div>
            `).join('')}
          </div>
          <button class="btn-secondary btn-sm" onclick="addFormQuestion(${index})">+ เพิ่มคำถามใหม่</button>
        </div>
      `;
    }

    // 5. External Link
    if (type === 'link') {
      return `
        <div class="type-options-box">
          <label style="color: var(--main-blue); font-size:0.875rem;"> URL เว็บไซต์ / Google Form:</label>
          <input type="text" value="${escapeHtml(act.targetUrl || '')}" oninput="appActivities[${index}].targetUrl=this.value" placeholder="https://docs.google.com/forms/...">
          <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; margin-top:0.375rem;">
            <input type="checkbox" ${act.openNewTab !== false ? 'checked' : ''} onchange="appActivities[${index}].openNewTab=this.checked" style="width:auto; margin:0;">
            เปิดในแท็บใหม่
          </label>
        </div>
      `;
    }

    // 6. Booking (Built-in)
    if (type === 'booking') {
      return `
        <div class="type-options-box" style="background:#f0fdf4; border-color:#bbf7d0;">
          <div style="color:#15803d; font-size:0.8125rem; font-weight: 400;">
             ระบบจะนำนักศึกษาไปยังหน้าสั่งจองเสื้อช็อป DE 06 (ระบบคำนวณเงินและอัปโหลดสลิปอัตโนมัติ)
          </div>
        </div>
      `;
    }

    // 7. Custom HTML (Legacy)
    if (type === 'html') {
      return `
        <div class="type-options-box">
          <label style="color: var(--main-blue); font-size:0.875rem;"> ใส่โค้ด HTML / Embed:</label>
          <textarea oninput="appActivities[${index}].htmlCode=this.value" style="font-family:inherit; min-height:7.5rem;" placeholder="<iframe ...></iframe> หรือโค้ด HTML...">${escapeHtml(act.htmlCode || '')}</textarea>
        </div>
      `;
    }

    return '';
  }

  // =============================================
  // ️ Direct Image Upload Handlers (Smart Client-side Compression)
  // =============================================
  function compressImageFile(file, maxDimension, quality, callback) {
    if (!file || !/^image\/(jpeg|png|webp|gif)$/.test(file.type) || file.size > 12 * 1024 * 1024) { showGlobalToast('กรุณาเลือกภาพขนาดไม่เกิน 12 MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        let width = img.width;
        let height = img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        callback(dataUrl, { width, height });
      };
      img.onerror = () => showGlobalToast('ไฟล์ภาพไม่ถูกต้อง', 'error');
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function handleActivityImageUpload(actIdx, input) {
    const file = input.files[0];
    if (!file) return;
    const activity = appActivities[actIdx]; const identity = currentAdminId;
    showGlobalToast('กำลังประมวลผลรูปภาพ...', 'loading');
    compressImageFile(file, 1000, 0.8, function(dataUrl, dimensions) {
      if (!isAdminAuthenticated || identity !== currentAdminId || !appActivities.includes(activity)) return;
      activity.imageUrl = dataUrl; activity.imageWidth = dimensions.width; activity.imageHeight = dimensions.height;
      renderActivitiesList();
      showGlobalToast('อัปโหลดรูปภาพหน้าปกเรียบร้อย', 'success');
    });
  }

  function removeActivityImage(actIdx) {
    appActivities[actIdx].imageUrl = '';
    renderActivitiesList();
  }

  function handlePollOptionImageUpload(actIdx, optIdx, input) {
    const file = input.files[0];
    if (!file) return;
    const activity = appActivities[actIdx]; const identity = currentAdminId; const option = activity.pollOptions?.[optIdx];
    showGlobalToast('กำลังประมวลผลรูปภาพตัวเลือก...', 'loading');
    compressImageFile(file, 600, 0.8, function(dataUrl) {
      if (!isAdminAuthenticated || identity !== currentAdminId || !appActivities.includes(activity) || activity.pollOptions?.[optIdx] !== option) return;
      if (!activity.pollOptionImages) activity.pollOptionImages = [];
      activity.pollOptionImages[optIdx] = dataUrl;
      renderActivitiesList();
      showGlobalToast('อัปโหลดรูปตัวเลือกที่ ' + (optIdx + 1) + ' เรียบร้อย', 'success');
    });
  }

  function removePollOptionImage(actIdx, optIdx) {
    if (appActivities[actIdx].pollOptionImages) {
      appActivities[actIdx].pollOptionImages[optIdx] = '';
    }
    renderActivitiesList();
  }

  // =============================================
  //  Activity Modifiers
  // =============================================
  function toggleActivityActive(index, isChecked) {
    markActivityChanges();
    if (appActivities[index]) {
      appActivities[index].active = isChecked;
      recordAuditLog('เปลี่ยนสถานะกิจกรรม', (isChecked ? 'เปิดให้เข้าร่วม' : 'ปิดรับชั่วคราว') + ' กิจกรรม: ' + (appActivities[index].title || index));
      renderActivitiesList();
      showGlobalToast(isChecked ? 'เปิดให้เข้าร่วมกิจกรรมแล้ว' : 'ปิดรับกิจกรรมชั่วคราวแล้ว', 'success');
    }
  }

  function changeActivityType(index, newType) {
    markActivityChanges();
    appActivities[index].type = newType;
    if (newType === 'booking') {
      appActivities[index].action = "goToSection('booking-section')";
    } else {
      appActivities[index].action = "goToSection('dynamic-" + appActivities[index].id + "')";
    }
    renderActivitiesList();
  }

  function addNewActivity(type) {
    const actType = type || 'poll';
    const newId = 'act-' + actType + '-' + crypto.randomUUID();
    editingActivityId = newId;
    let newAct = {
      id: newId,
      icon: '',
      title: 'กิจกรรมใหม่',
      desc: 'รายละเอียดกิจกรรม',
      imageUrl: '',
      endDate: '',
      active: true,
      type: actType,
      action: actType === 'booking' ? "goToSection('booking-section')" : "goToSection('dynamic-" + newId + "')",
      order: appActivities.length + 1
    };

    if (actType === 'poll') {
      newAct.title = 'โพลล์สำรวจความคิดเห็นใหม่';
      newAct.desc = 'ร่วมออกเสียงและแสดงความเห็นสำหรับกิจกรรมนี้';
      newAct.pollOptions = ['เห็นด้วย', 'ไม่เห็นด้วย'];
      newAct.pollOptionImages = ['', ''];
      newAct.allowChangeVote = true;
      newAct.showResults = true;
    } else if (actType === 'form') {
      newAct.title = 'แบบสอบถามและรับสมัครใหม่';
      newAct.desc = 'กรอกข้อมูลและส่งแบบฟอร์มออนไลน์';
      newAct.formQuestions = [
        { label: 'ข้อเสนอแนะหรือรายละเอียด', type: 'text', required: true }
      ];
    } else if (actType === 'comment') {
      newAct.title = 'กระดานพูดคุยแลกเปลี่ยน';
      newAct.desc = 'พื้นที่พูดคุยและแสดงความคิดเห็นสำหรับนักศึกษา';
    } else if (actType === 'booking') {
      newAct.title = 'จองเสื้อช็อป DE 06';
      newAct.desc = 'สั่งจองเสื้อช็อป DE 06 พร้อมแนบหลักฐานการชำระเงิน';
    } else if (actType === 'announcement') {
      newAct.title = 'ประกาศด่วน';
      newAct.desc = 'รายละเอียดข่าวสารและประกาศสำคัญ';
    }

    appActivities.push(newAct); markActivityChanges();
    recordAuditLog('เพิ่มกิจกรรม', 'เพิ่มกิจกรรมใหม่: ' + newAct.title);
    renderActivitiesList();
    requestAnimationFrame(() => {
      const lastCard = document.getElementById('activity-card-' + (appActivities.length - 1));
      if (lastCard) {
        lastCard.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
        if (!lastCard.contains(document.activeElement)) lastCard.querySelector('.activity-title-input')?.focus({ preventScroll: true });
      }
    });
  }

  function duplicateActivity(index) {
    if (index < 0 || index >= appActivities.length) return;
    const source = appActivities[index];
    const cloned = JSON.parse(JSON.stringify(source));
    const newId = 'act-' + (cloned.type || 'item') + '-' + crypto.randomUUID();
    editingActivityId = newId; markActivityChanges();
    cloned.id = newId;
    cloned.title = (cloned.title || 'กิจกรรม') + ' สำเนา';
    if (cloned.type === 'booking') {
      cloned.action = "goToSection('booking-section')";
    } else {
      cloned.action = "goToSection('dynamic-" + newId + "')";
    }
    cloned.order = appActivities.length + 1;
    appActivities.splice(index + 1, 0, cloned);
    recordAuditLog('คัดลอกกิจกรรม', 'คัดลอกกิจกรรม: ' + cloned.title);
    renderActivitiesList();
    showGlobalToast('คัดลอกกิจกรรมสำเร็จ สามารถปรับแต่งรายละเอียดได้ทันที', 'success');
    requestAnimationFrame(() => {
      const newCard = document.getElementById('activity-card-' + (index + 1));
      if (newCard) newCard.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    });
  }

  function removeActivity(index) {
    markActivityChanges();
    const deletedTitle = appActivities[index] ? appActivities[index].title : ('ลำดับที่ ' + (index + 1));
    if (confirm('คุณต้องการลบกิจกรรม "' + deletedTitle + '" ใช่หรือไม่?')) {
      appActivities.splice(index, 1);
      recordAuditLog('ลบกิจกรรม', 'ลบกิจกรรม: ' + deletedTitle);
      renderActivitiesList();
      populateActivityDropdowns();
    }
  }

  function moveActivity(index, direction) {
    markActivityChanges();
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= appActivities.length) return;
    const temp = appActivities[index];
    appActivities[index] = appActivities[targetIdx];
    appActivities[targetIdx] = temp;
    renderActivitiesList();
  }

  function addPollOption(actIdx) {
    markActivityChanges();
    if (!appActivities[actIdx].pollOptions) appActivities[actIdx].pollOptions = [];
    if (!appActivities[actIdx].pollOptionImages) appActivities[actIdx].pollOptionImages = [];
    appActivities[actIdx].pollOptions.push('ตัวเลือกใหม่');
    appActivities[actIdx].pollOptionImages.push('');
    renderActivitiesList();
  }

  function removePollOption(actIdx, optIdx) {
    markActivityChanges();
    if (appActivities[actIdx].pollOptions.length <= 2) {
      alert('โพลล์ต้องมีตัวเลือกอย่างน้อย 2 ตัวเลือกครับ');
      return;
    }
    appActivities[actIdx].pollOptions.splice(optIdx, 1);
    if (appActivities[actIdx].pollOptionImages) appActivities[actIdx].pollOptionImages.splice(optIdx, 1);
    renderActivitiesList();
  }

  function addFormQuestion(actIdx) {
    markActivityChanges();
    if (!appActivities[actIdx].formQuestions) appActivities[actIdx].formQuestions = [];
    appActivities[actIdx].formQuestions.push({
      label: 'คำถามที่ ' + (appActivities[actIdx].formQuestions.length + 1),
      type: 'text',
      required: true
    });
    renderActivitiesList();
  }

  function removeFormQuestion(actIdx, qIdx) {
    markActivityChanges();
    if (appActivities[actIdx].formQuestions.length <= 1) {
      alert('แบบฟอร์มต้องมีคำถามอย่างน้อย 1 ข้อครับ');
      return;
    }
    appActivities[actIdx].formQuestions.splice(qIdx, 1);
    renderActivitiesList();
  }

  function populateActivityDropdowns() {
    const annTarget = document.getElementById('ann_target_activity');
    const curVal = annTarget.dataset.ready === 'true' ? annTarget.value : (appConfig.HOME_ANNOUNCEMENT && appConfig.HOME_ANNOUNCEMENT.target) || '';
    annTarget.dataset.ready = 'true';
    annTarget.innerHTML = `
      <option value="">-- ไม่ต้องมีปุ่มลิงก์ --</option>
      <option value="booking-section" ${curVal === 'booking-section' ? 'selected' : ''}> ไปที่หน้าระบบจองเสื้อช็อป</option>
    `;
    appActivities.forEach(act => {
      if (act.type !== 'booking' || curVal === 'dynamic-' + act.id) annTarget.innerHTML += `<option value="dynamic-${escapeHtml(act.id)}" ${curVal === 'dynamic-' + act.id ? 'selected' : ''}>${escapeHtml(act.title)}</option>`;
    });

    const resSelect = document.getElementById('responseActivitySelect');
    const curResVal = resSelect.value;
    resSelect.innerHTML = '<option value="">-- กรุณาเลือกกิจกรรม --</option>';
    appActivities.forEach(act => {
      if (['poll', 'comment', 'form'].includes(act.type)) resSelect.innerHTML += `<option value="${escapeHtml(act.id)}" ${curResVal === act.id ? 'selected' : ''}>${escapeHtml(act.title)}</option>`;
    });
  }

  // =============================================
  //  Tab 3: Responses & Poll Results Viewer
  // =============================================
  async function loadResponsesData() {
    if (!isAdminAuthenticated) return;
    displaySelectedActivityResponses();
  }

  async function displaySelectedActivityResponses() {
    if (!isAdminAuthenticated) return;
    const identity = currentAdminId; const selected = document.getElementById('responseActivitySelect').value; const generation = ++responsesGeneration;
    return DE06.request('admin:responses:' + identity + ':' + selected, () => {
      if (identity === currentAdminId && selected === document.getElementById('responseActivitySelect').value && isAdminAuthenticated) return readSelectedActivityResponses(generation);
    }, 30000);
  }
  async function readSelectedActivityResponses(generation) {
    const adminId = currentAdminId;
    const actId = document.getElementById('responseActivitySelect').value;
    const content = document.getElementById('responsesContent');
    if (!actId) {
      content.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:1.875rem;">กรุณาเลือกกิจกรรมด้านบนเพื่อดูสถิติ</div>';
      return;
    }

    const activity = appActivities.find(a => a.id === actId);
    if (!activity) return;

    content.innerHTML = DE06.skeleton();

    try {
      // 1. POLL RESPONSES
      if (activity.type === 'poll') {
        const votes = [];
        try {
          const votesSnap = await DE06.allDocuments(db.collection('votes').where('activityId', '==', actId));
          if (generation !== responsesGeneration || !isAdminAuthenticated || adminId !== currentAdminId || document.getElementById('responseActivitySelect').value !== actId) return;
          votesSnap.forEach(doc => votes.push(doc.data()));
        } catch (errV) {
          console.warn('Poll votes collection read notice:', errV.message);
        }
        try {
          const fbSnap = await DE06.allDocuments(db.collection('dynamic_submissions').where('activityId', '==', actId));
          if (generation !== responsesGeneration || !isAdminAuthenticated || adminId !== currentAdminId || document.getElementById('responseActivitySelect').value !== actId) return;
          fbSnap.forEach(doc => {
            const d = doc.data();
            if ((d.formType === 'vote' || d.type === 'poll') && !votes.some(v => v.studentId === d.studentId && v.optionIndex === d.optionIndex)) {
              votes.push(d);
            }
          });
        } catch (errFb) {
          console.warn('Poll dynamic_submissions notice:', errFb.message);
        }

        const counts = {};
        (activity.pollOptions || []).forEach((_, idx) => counts[idx] = 0);
        votes.forEach(v => {
          if (counts[v.optionIndex] !== undefined) counts[v.optionIndex]++;
        });

        const totalVotes = votes.length;
        currentLoadedResponses = {
          type: 'poll',
          activityTitle: activity.title,
          data: votes.map(v => [v.studentId || '', v.studentName || '', v.optionText || '', v.votedAt || '']),
          headers: ['รหัสนักศึกษา', 'ชื่อ-สกุล', 'ตัวเลือกที่โหวต', 'วัน-เวลา']
        };

        content.innerHTML = `
          <div class="export-actions-bar">
            <button class="btn-sheets btn-sm" onclick="exportCurrentResponsesToCSV()">ส่งออกผลโหวตเป็น CSV</button>
            <button class="btn-secondary btn-sm" onclick="copyCurrentResponsesToClipboard()">คัดลอกไป Google Sheets</button>
          </div>

          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:0.875rem; padding:1.25rem; margin-bottom:1.25rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.9375rem; flex-wrap:wrap; gap:0.625rem;">
              <h3 style="margin:0; color:var(--main-blue); font-size:1.125rem;">ผลโหวต: ${escapeHtml(activity.title)}</h3>
              <span style="background:#e0f2fe; color:#0369a1; padding:0.25rem 0.75rem; border-radius:1.25rem; font-size:0.8125rem; font-weight:700;">
                โหวตทั้งหมด ${totalVotes} คน
              </span>
            </div>

            ${(activity.pollOptions || []).map((opt, idx) => {
              const count = counts[idx] || 0;
              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
              const optImg = (activity.pollOptionImages && activity.pollOptionImages[idx]) || '';
              return `
                <div style="margin-bottom:0.875rem;">
                  <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.875rem; font-weight: 400; margin-bottom:0.25rem;">
                    <span style="display:flex; align-items:center; gap:0.5rem;">
                      ${optImg ? `<img src="${DE06.image(optImg)}" class="img-preview-thumb" loading="lazy" style="width:1.75rem; height:1.75rem;" onclick="openImageModal(${DE06.arg(optImg)}, ${DE06.arg(opt)})" alt="ภาพประกอบ DE 06" role="button" tabindex="0">` : ''}
                      <span>${idx + 1}. ${escapeHtml(opt)}</span>
                    </span>
                    <span style="color:var(--main-blue);">${count} โหวต (${pct}%)</span>
                  </div>
                  <div class="poll-bar-track">
                    <div class="poll-bar-fill" style="width: ${pct}%;"></div>
                  </div>
                </div>
              `;
        DE06.paginate(content);
            }).join('')}
          </div>

          <h4 style="color:var(--main-blue); margin:0.9375rem 0 0.625rem;">รายชื่อนักศึกษาที่ร่วมโหวต (${votes.length} คน):</h4>
          <div class="data-table-container">
            <table class="data-table" id="responseTable">
              <thead><tr><th>รหัสนักศึกษา</th><th>ชื่อ-สกุล</th><th>ตัวเลือกที่โหวต</th><th>เวลา</th></tr></thead>
              <tbody>
                ${votes.length === 0 ? '<tr><td colspan="4" style="text-align:center; color:gray;">ยังไม่มีผู้โหวต</td></tr>' :
                  votes.map(v => `
                    <tr>
                      <td><b>${v.studentId || '-'}</b></td>
                      <td>${v.studentName || '-'}</td>
                      <td><span style="background:#f1f5f9; padding:0.25rem 0.5rem; border-radius:0.375rem; font-weight: 400;">${escapeHtml(v.optionText || '')}</span></td>
                      <td style="color:#64748b; font-size:0.75rem;">${v.votedAt || '-'}</td>
                    </tr>
                  `).join('')
                }
              </tbody>
            </table>
          </div>
        `;
      }
      // 2. COMMENT RESPONSES
      else if (activity.type === 'comment') {
        const comments = [];
        try {
          const commentsSnap = await DE06.allDocuments(db.collection('comments').where('activityId', '==', actId).orderBy('createdAt', 'desc'), 200, true);
          if (generation !== responsesGeneration || !isAdminAuthenticated || adminId !== currentAdminId || document.getElementById('responseActivitySelect').value !== actId) return;
          commentsSnap.forEach(doc => comments.push({ docId: doc.id, sourceColl: 'comments', ...doc.data() }));
        } catch (errC) {
          console.warn('Comments collection read notice:', errC.message);
        }
        try {
          const fbSnap = await DE06.allDocuments(db.collection('dynamic_submissions').where('activityId', '==', actId));
          if (generation !== responsesGeneration || !isAdminAuthenticated || adminId !== currentAdminId || document.getElementById('responseActivitySelect').value !== actId) return;
          fbSnap.forEach(doc => {
            const d = doc.data();
            if ((d.formType === 'comment' || d.type === 'comment') && !comments.some(c => c.docId === doc.id)) {
              comments.push({ docId: doc.id, sourceColl: 'dynamic_submissions', ...d });
            }
          });
        } catch (errFb) {
          console.warn('Comments dynamic_submissions notice:', errFb.message);
        }

        currentLoadedResponses = {
          type: 'comment',
          activityTitle: activity.title,
          data: comments.map(c => [c.studentId || '', c.studentName || '', c.message || '', c.imageUrl || '', c.formattedTime || c.createdAt || '']),
          headers: ['รหัสนักศึกษา', 'ชื่อ-สกุล', 'ข้อความความคิดเห็น', 'ลิงก์รูปภาพแนบ', 'วัน-เวลา']
        };

        content.innerHTML = `
          <div class="export-actions-bar">
            <button class="btn-sheets btn-sm" onclick="exportCurrentResponsesToCSV()">ส่งออกความคิดเห็นเป็น CSV</button>
            <button class="btn-secondary btn-sm" onclick="copyCurrentResponsesToClipboard()">คัดลอกไป Google Sheets</button>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.9375rem;">
            <h3 style="margin:0; color:var(--main-blue); font-size:1.125rem;">ความคิดเห็นทั้งหมด (${comments.length} ข้อความ)</h3>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.75rem;">
            ${comments.length === 0 ? '<div style="text-align:center; padding:1.875rem; color:gray;">ยังไม่มีความคิดเห็นในหัวข้อนี้</div>' :
              comments.map(c => `
                <div style="background:white; border:1px solid #e2e8f0; border-radius:0.875rem; padding:1rem; box-shadow:0 0.125rem 0.375rem rgba(0,0,0,0.03);">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; flex-wrap:wrap; gap:0.5rem;">
                    <div>
                      <span style="font-weight:700; color:var(--main-blue); font-size:0.9375rem;">${escapeHtml(c.studentName || 'นักศึกษา')}</span>
                      <span style="color:#64748b; font-size:0.75rem; margin-left:0.5rem;">(${c.studentId || ''})</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:0.625rem;">
                      <span style="color:#94a3b8; font-size:0.75rem;">${c.formattedTime || c.createdAt || ''}</span>
                      <button class="btn-danger btn-sm" onclick="adminDeleteComment(${DE06.arg(c.docId)})" style="padding:0.25rem 0.5rem; font-size:0.6875rem;">ลบข้อความ</button>
                    </div>
                  </div>
                  <div style="font-size:0.875rem; color:#334155; line-height: 1.6; background:#f8fafc; padding:0.625rem 0.875rem; border-radius:0.625rem;">
                    ${escapeHtml(c.message || '')}
                  </div>
                  ${c.imageUrl ? `
                    <div style="margin-top:0.625rem;">
                      <img src="${DE06.image(c.imageUrl)}" style="max-width:8.75rem; max-height:8.75rem; border-radius:0.5rem; border:1px solid #cbd5e1; cursor:pointer;" loading="lazy" onclick="openImageModal(${DE06.arg(c.imageUrl)}, ${DE06.arg("รูปแนบจาก: " + c.studentName)})" alt="ภาพประกอบ DE 06" role="button" tabindex="0">
                    </div>
                  ` : ''}
                </div>
              `).join('')
            }
          </div>
        `;
        DE06.paginate(content);
      }
      // 3. FORM RESPONSES
      else if (activity.type === 'form') {
        const subSnap = await DE06.allDocuments(db.collection('dynamic_submissions').where('activityId', '==', actId));
          if (generation !== responsesGeneration || !isAdminAuthenticated || adminId !== currentAdminId || document.getElementById('responseActivitySelect').value !== actId) return;
        const subs = [];
        subSnap.forEach(doc => subs.push({ docId: doc.id, ...doc.data() }));

        const questions = (activity.formQuestions || []).map(q => q.label || '');
        const headers = ['รหัสนักศึกษา', 'ชื่อ-สกุล', ...questions, 'วัน-เวลาที่ส่ง'];

        currentLoadedResponses = {
          type: 'form',
          activityTitle: activity.title,
          data: subs.map(s => {
            const row = [s.studentId || '', s.studentName || ''];
            questions.forEach(q => row.push(s.formData ? (s.formData[q] || '-') : '-'));
            row.push(s.submittedAt || '');
            return row;
          }),
          headers: headers
        };

        content.innerHTML = `
          <div class="export-actions-bar">
            <button class="btn-sheets btn-sm" onclick="exportCurrentResponsesToCSV()">ส่งออกคำตอบแบบฟอร์มเป็น CSV</button>
            <button class="btn-secondary btn-sm" onclick="copyCurrentResponsesToClipboard()">คัดลอกไป Google Sheets</button>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.9375rem;">
            <h3 style="margin:0; color:var(--main-blue); font-size:1.125rem;">การตอบรับแบบฟอร์ม (${subs.length} รายการ)</h3>
          </div>

          <div class="data-table-container">
            <table class="data-table">
              <thead>
                <tr>
                  ${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${subs.length === 0 ? `<tr><td colspan="${headers.length}" style="text-align:center; color:gray;">ยังไม่มีคำตอบที่ส่งเข้ามา</td></tr>` :
                  currentLoadedResponses.data.map(row => `
                    <tr>
                      ${row.map((cell, idx) => `<td>${idx === 0 ? `<b>${cell}</b>` : escapeHtml(cell)}</td>`).join('')}
                    </tr>
                  `).join('')
                }
              </tbody>
            </table>
          </div>
        `;
        DE06.paginate(content);
      } else {
        content.innerHTML = `
          <div style="background:#f8fafc; padding:1.25rem; border-radius:0.75rem; text-align:center; color:var(--text-muted);">
            กิจกรรมประเภท <b>${activity.type}</b> ไม่มีข้อมูลสถิติหรือฟอร์มตอบรับ
          </div>
        `;
        DE06.paginate(content);
      }
    } catch(err) {
      console.error(err);
      if (generation !== responsesGeneration || !isAdminAuthenticated) return;
      content.innerHTML = '<div class="msg-box msg-error">เกิดข้อผิดพลาดในการโหลดผล: ' + err.message + '</div>';
    }
  }

  async function adminDeleteComment(...args) {
    if (args[0] && typeof args[0].preventDefault === 'function') args[0].preventDefault();
    const identity = currentAdminId;
    if (!isAdminAuthenticated) return;
    if (!navigator.onLine) return alert('ไม่มีการเชื่อมต่ออินเทอร์เน็ต กรุณาลองใหม่เมื่อออนไลน์');
    const key = 'admin:write:adminDeleteComment:' + identity + ':' + args.filter(a => typeof a === 'string').join(':');
    if (!DE06.lock(key)) return;
    try { return await perform_adminDeleteComment(...args); } finally { DE06.unlock(key); DE06.invalidate('admin:'); }
  }
  async function perform_adminDeleteComment(docId) {
    if (!isAdminAuthenticated) return alert('กรุณาเข้าสู่ระบบก่อนทำรายการ');
    if (!confirm('ยืนยันที่จะลบความคิดเห็นนี้ใช่หรือไม่?')) return;
    try {
      try {
        await db.collection('comments').doc(docId).delete();
      } catch (errComm) {
        await db.collection('dynamic_submissions').doc(docId).delete();
      }
      alert('ลบความคิดเห็นสำเร็จ');
      displaySelectedActivityResponses();
    } catch(e) {
      alert('เกิดข้อผิดพลาด: ' + e.message);
    }
  }

  // =============================================
  //  EXPORT & CLIPBOARD ENGINES (Google Sheets & CSV)
  // =============================================
  function exportCurrentResponsesToCSV() {
    if (!currentLoadedResponses.data || currentLoadedResponses.data.length === 0) {
      return alert('ไม่มีข้อมูลสำหรับส่งออกครับ');
    }
    const cleanFilename = (currentLoadedResponses.activityTitle || 'responses').replace(/[^a-zA-Z0-9_\u0E00-\u0E7F]/g, '_');
    exportArrayToCSV(cleanFilename + '.csv', currentLoadedResponses.headers, currentLoadedResponses.data);
  }

  function copyCurrentResponsesToClipboard() {
    if (!currentLoadedResponses.data || currentLoadedResponses.data.length === 0) {
      return alert('ไม่มีข้อมูลสำหรับคัดลอกครับ');
    }
    copyDataToClipboard(currentLoadedResponses.headers, currentLoadedResponses.data);
  }

  function exportBookingsToCSV() {
    if (!bookingsComplete) return alert('กรุณาโหลดข้อมูลให้ครบก่อนส่งออก');
    if (allBookingsList.length === 0) return alert('ไม่มีข้อมูลการจองสำหรับส่งออก');
    const headers = ['รหัสนักศึกษา', 'ชื่อ-สกุล', 'รายการที่จอง', 'จำนวน (ตัว)', 'ยอดเงิน (บาท)', 'สถานะ', 'วัน-เวลาโอน', 'เบอร์โทร', 'อีเมล', 'ลิงก์สลิป', 'ยอดชำระที่บันทึก'];
    const rows = allBookingsList.map(b => {
      let slipUrlsCol = '';
      if (b.slipUrls && b.slipUrls.length > 0) {
        slipUrlsCol = b.slipUrls.join('\n');
      } else if (b.slipUrl) {
        slipUrlsCol = b.slipUrl;
      }

      let timeCol = b.transferDateTime || '-';
      if (b.slips && b.slips.length > 1) {
        timeCol = b.slips.map((s, idx) => `สลิป ${idx + 1}: ${s.transferDateTime || b.transferDateTime || '-'}`).join('\n');
      }

      return [
        b.studentId,
        b.name,
        b.summary,
        b.sizes ? b.sizes.totalQty : 1,
        b.totalPrice,
        b.status === 'paid' ? 'ชำระแล้ว' : 'รอชำระ',
        timeCol,
        b.phone,
        b.email,
        slipUrlsCol, b.paidAmount == null ? "" : b.paidAmount
      ];
    });
    exportArrayToCSV('DE06_Shirt_Bookings.csv', headers, rows);
  }

  function copyBookingsToClipboard() {
    if (!bookingsComplete) return alert('กรุณาโหลดข้อมูลให้ครบก่อนส่งออก');
    if (allBookingsList.length === 0) return alert('ไม่มีข้อมูลการจองสำหรับคัดลอก');
    const headers = ['รหัสนักศึกษา', 'ชื่อ-สกุล', 'รายการที่จอง', 'จำนวน (ตัว)', 'ยอดเงิน (บาท)', 'สถานะ', 'วัน-เวลาโอน', 'เบอร์โทร', 'อีเมล', 'ลิงก์สลิป', 'ยอดชำระที่บันทึก'];
    const rows = allBookingsList.map(b => {
      let slipUrlsCol = '';
      if (b.slipUrls && b.slipUrls.length > 0) {
        slipUrlsCol = b.slipUrls.join('\n');
      } else if (b.slipUrl) {
        slipUrlsCol = b.slipUrl;
      }

      let timeCol = b.transferDateTime || '-';
      if (b.slips && b.slips.length > 1) {
        timeCol = b.slips.map((s, idx) => `สลิป ${idx + 1}: ${s.transferDateTime || b.transferDateTime || '-'}`).join('\n');
      }

      return [
        b.studentId,
        b.name,
        b.summary,
        b.sizes ? b.sizes.totalQty : 1,
        b.totalPrice,
        b.status === 'paid' ? 'ชำระแล้ว' : 'รอชำระ',
        timeCol,
        b.phone,
        b.email,
        slipUrlsCol, b.paidAmount == null ? "" : b.paidAmount
      ];
    });
    copyDataToClipboard(headers, rows);
  }

  function exportArrayToCSV(filename, headers, rows) {
    let csvContent = '\uFEFF';
    csvContent += headers.map(h => `"${(h||'').toString().replace(/"/g, '""')}"`).join(',') + '\r\n';

    rows.forEach(row => {
      csvContent += row.map(cell => `"${spreadsheetCell(cell).replace(/"/g, '""')}"`).join(',') + '\r\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showGlobalToast(' ดาวน์โหลดไฟล์ ' + filename + ' เรียบร้อย! สามารถเปิดใน Excel หรือ Import เข้า Google Sheets ได้เลย', 'success');
  }

  function spreadsheetCell(value) {
    const text = String(value ?? '');
    return typeof value === 'string' && /^[\s]*[=+@-]/.test(text) ? "'" + text : text;
  }

  function copyDataToClipboard(headers, rows) {
    let tsv = headers.join('\t') + '\n';
    rows.forEach(row => {
      tsv += row.map(c => {
        let str = spreadsheetCell(c).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        if (str.includes('\n') || str.includes('\t') || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join('\t') + '\n';
    });

    navigator.clipboard.writeText(tsv).then(() => {
      alert(' คัดลอกข้อมูลเรียบร้อยแล้ว!\nเปิด Google Sheets แล้วกดปุ่ม Ctrl + V เพื่อวางข้อมูลลงตารางได้ทันทีครับ');
    }).catch(err => {
      alert('คัดลอกล้มเหลว: ' + err.message);
    });
  }

  // =============================================
  //  Tab 4: Bookings Management & Size Breakdown
  // =============================================
  function extractBookingSizes(data) {
    if (data.details && typeof data.details === 'object') data = { ...data.details, otherNum: data.details.custom || 0, other: data.details.customText || '', ...data };
    let xs = parseInt(data.xs) || 0;
    let s = parseInt(data.s) || 0;
    let m = parseInt(data.m) || 0;
    let l = parseInt(data.l) || 0;
    let xl = parseInt(data.xl) || 0;
    let xxl = parseInt(data.xxl) || 0;
    let otherNum = parseInt(data.otherNum) || 0;
    let otherText = (data.other || '').toString().trim();

    // Fallback parsing from summary string if direct numeric fields are 0
    if ((xs + s + m + l + xl + xxl + otherNum) === 0 && data.summary) {
      const summary = data.summary.toString();

      const xsMatch = summary.match(/\bXS\s*\((\d+)\)/i);
      if (xsMatch) xs = parseInt(xsMatch[1]) || 0;

      const sMatch = summary.match(/(?:^|[^X\w])S\s*\((\d+)\)/i);
      if (sMatch) s = parseInt(sMatch[1]) || 0;

      const mMatch = summary.match(/\bM\s*\((\d+)\)/i);
      if (mMatch) m = parseInt(mMatch[1]) || 0;

      const lMatch = summary.match(/(?:^|[^X\w])L\s*\((\d+)\)/i);
      if (lMatch) l = parseInt(lMatch[1]) || 0;

      const xlMatch = summary.match(/(?:^|[^2\w])XL\s*\((\d+)\)/i);
      if (xlMatch) xl = parseInt(xlMatch[1]) || 0;

      const xxlMatch = summary.match(/\b(?:2XL|XXL)\s*\((\d+)\)/i);
      if (xxlMatch) xxl = parseInt(xxlMatch[1]) || 0;

      const customRegex = /([0-9]+XL|[^\s,()]+)\s*\((\d+)(?:\s*ตัว)?\)/gi;
      let match;
      while ((match = customRegex.exec(summary)) !== null) {
        const tag = match[1].toUpperCase().trim();
        if (!['XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL'].includes(tag)) {
          const qty = parseInt(match[2]) || 0;
          otherNum += qty;
          if (!otherText) otherText = `${match[1]} (${qty} ตัว)`;
          else if (!otherText.includes(match[1])) otherText += `, ${match[1]} (${qty} ตัว)`;
        }
      }
    }

    const totalQty = xs + s + m + l + xl + xxl + otherNum;
    return { xs, s, m, l, xl, xxl, otherNum, otherText, totalQty };
  }

  let bookingsComplete = false;
  let bookingListenerStops = [];
  let bookingLiveTimer = null;
  let bookingFingerprint = '';
  function stopBookingsListeners() {
    bookingListenerStops.forEach(stop => stop()); bookingListenerStops = [];
    clearTimeout(bookingLiveTimer); bookingLiveTimer = null;
  }
  function fingerprintBookings(snapshots) {
    return JSON.stringify(snapshots.map(snapshot => snapshot.docs.map(doc => [doc.id, doc.data()])));
  }
  function watchBookings() {
    if (document.hidden || !isAdminAuthenticated || !bookingsComplete || !document.getElementById('tab-bookings').classList.contains('active') || bookingListenerStops.length) return;
    const queries = [db.collection('bookings'), db.collection('orders_shirts')];
    if (!queries.every(query => typeof query.onSnapshot === 'function')) return;
    const identity = currentAdminId; const snapshots = [];
    queries.forEach((query, index) => {
      const stop = query.onSnapshot(snapshot => {
        if (identity !== currentAdminId || !isAdminAuthenticated || document.hidden || snapshot.metadata?.fromCache) return;
        snapshots[index] = snapshot;
        if (!snapshots[0] || !snapshots[1] || fingerprintBookings(snapshots) === bookingFingerprint) return;
        clearTimeout(bookingLiveTimer);
        bookingLiveTimer = setTimeout(() => {
          if (!document.hidden && isAdminAuthenticated && identity === currentAdminId && document.getElementById('tab-bookings').classList.contains('active')) {
            DE06.invalidate('admin:bookings:'); readBookingsData(snapshots).catch(() => {});
          }
        }, 150);
      }, () => { stopBookingsListeners(); document.getElementById('bookings-status').textContent = 'การอัปเดตสดหยุดลง กรุณาดึงข้อมูลล่าสุด'; });
      bookingListenerStops.push(stop);
    });
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopBookingsListeners(); else watchBookings(); });
  let bookingsGeneration = 0;
  let responsesGeneration = 0;
  let bookingsPage = 0;
  let bookingsFilterKey = '';
  let filterDebounceTimer;
  async function loadBookingsData(forceRefresh = true) {
    if (!isAdminAuthenticated) return;
    const identity = currentAdminId;
    return DE06.request('admin:bookings:' + identity, () => { if (isAdminAuthenticated && identity === currentAdminId) return readBookingsData(); }, 30000, forceRefresh).then(watchBookings).catch(() => {});
  }
  function setBookingTotalsPending() {
    ['stat_paid_shirts_val', 'stat_total_shirts', 'stat_pending_shirts_val', 'stat_paid_orders_val', 'stat_total_orders', 'stat_paid_count', 'stat_pending_count', 'stat_total_income', 'stat_income_subtext', 'stat_payment_percentage'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '—'; });
    bookingsComplete = false;
    const grid = document.getElementById('sizeCardsGrid');
    if (grid) grid.innerHTML = Array.from({ length: 7 }, () => '<div class="size-card skeleton-size-card" aria-hidden="true"><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div></div>').join('');
    const custom = document.getElementById('customSizesContainer'); if (custom) custom.replaceChildren();
    const badge = document.getElementById('size_summary_badge'); if (badge) badge.textContent = 'ยังยืนยันยอดไม่ได้';
    const pending = document.getElementById('pendingAlertBanner'); if (pending) pending.style.display = 'none';
    const fill = document.getElementById('stat_payment_progress_fill'); if (fill) fill.style.transform = 'scaleX(0)';
  }
  async function readBookingsData(liveSnapshots) {
    if (!isAdminAuthenticated) return;
    if (!liveSnapshots) stopBookingsListeners();
    const tableBody = document.getElementById('bookingsTableBody');
    const generation = ++bookingsGeneration; const adminId = currentAdminId;
    tableBody.setAttribute('aria-busy', 'true');
    document.getElementById('bookings-status').textContent = 'กำลังโหลดข้อมูลการจองและยอดสรุป';
    if (!allBookingsList.length) tableBody.innerHTML = '<tr><td colspan="8">' + DE06.skeleton() + '</td></tr>';
    setBookingTotalsPending();

    try {
      const snapshots = liveSnapshots || await Promise.all([DE06.allDocuments(db.collection('bookings'), 200, false, true), DE06.allDocuments(db.collection('orders_shirts'), 200, false, true)]);
      if (generation !== bookingsGeneration || !isAdminAuthenticated || adminId !== currentAdminId) return;
      const unique = new Map();
      snapshots[1].forEach(doc => unique.set(doc.data().studentId || doc.id, doc));
      snapshots[0].forEach(doc => unique.set(doc.data().studentId || doc.id, doc));
      const snap = { forEach: callback => unique.forEach(callback) };
      bookingFingerprint = fingerprintBookings(snapshots);
      allBookingsList = [];

      currentAggregatedSizeStats = {
        all: { xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, other: 0, totalShirts: 0, totalIncome: 0, orders: 0, customMap: {} },
        paid: { xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, other: 0, totalShirts: 0, totalIncome: 0, orders: 0, customMap: {} },
        pending: { xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, other: 0, totalShirts: 0, totalIncome: 0, orders: 0, customMap: {} }
      };

      snap.forEach(doc => {
        const data = doc.data();
        const studentId = String(data.studentId || doc.id);
        const name = data.studentName || allStudentsMap[studentId] || ('นักศึกษา ' + studentId);
        const explicitStatus = data.status || data.paymentStatus;
        const isPaid = explicitStatus ? explicitStatus === 'paid' : !!(data.slipImageUrl || data.slipUrl || (Array.isArray(data.slips) && data.slips.length) || (Array.isArray(data.slipUrls) && data.slipUrls.length));
        const statusKey = isPaid ? 'paid' : 'pending';
        const totalPrice = Number(data.totalPrice) || 0;

        const sizes = extractBookingSizes(data);

        // Aggregate stats
        ['all', statusKey].forEach(cat => {
          const st = currentAggregatedSizeStats[cat];
          st.orders++;
          st.totalShirts += sizes.totalQty;
          st.totalIncome += totalPrice;
          st.xs += sizes.xs;
          st.s += sizes.s;
          st.m += sizes.m;
          st.l += sizes.l;
          st.xl += sizes.xl;
          st.xxl += sizes.xxl;
          st.other += sizes.otherNum;

          if (sizes.otherNum > 0 && sizes.otherText) {
            const parsed = sizes.otherText.split(',').map(item => item.trim().match(/^(.*?)\s*\((\d+)(?:\s*ตัว)?\)$/));
            const exact = parsed.every(Boolean) && parsed.reduce((sum, item) => sum + Number(item[2]), 0) === sizes.otherNum;
            const entries = exact ? parsed.map(item => [item[1].trim(), Number(item[2])]) : [[sizes.otherText, sizes.otherNum]];
            entries.forEach(([label, quantity]) => {
              st.customMap[label] = (st.customMap[label] || 0) + quantity;
            });
          }
        });

        // Backward-compatible slips extraction
        let slips = [];
        if (Array.isArray(data.slips) && data.slips.length > 0) {
          slips = data.slips.map((s, idx) => ({
            width: s.width, height: s.height,
            fileUrl: s.fileUrl || s.url || s.imageUrl || '',
            imageUrl: s.imageUrl || s.url || s.fileUrl || '',
            fileName: s.fileName || s.name || `สลิป ${idx + 1}`,
            transferDateTime: s.transferDateTime || s.transferTime || data.transferDateTime || '-'
          }));
        } else if (Array.isArray(data.slipUrls) && data.slipUrls.length > 0) {
          slips = data.slipUrls.map((u, idx) => ({ fileUrl: u, imageUrl: u, fileName: `สลิป ${idx + 1}`, transferDateTime: data.transferDateTime || '-' }));
        } else if (data.slipFileUrl || data.slipImageUrl || data.slipUrl) {
          const u = data.slipFileUrl || data.slipImageUrl || data.slipUrl;
          slips = [{ fileUrl: u, imageUrl: data.slipImageUrl || u, fileName: 'สลิปชำระเงิน', transferDateTime: data.transferDateTime || '-' }];
        }
        slips = slips.map(s => ({ ...s, fileUrl: DE06.safeUrl(s.fileUrl || s.url || s.imageUrl, true), imageUrl: DE06.safeUrl(s.imageUrl || s.url || s.fileUrl, true), fileName: s.fileName || s.name || '', transferDateTime: s.transferDateTime || s.transferTime || '' }));
        const slipUrls = slips.map(s => s.fileUrl || s.imageUrl).filter(Boolean);

        allBookingsList.push({
          studentId: studentId,
          name: name,
          summary: data.summary || '-',
          totalPrice: totalPrice,
          paidAmount: data.paidAmount == null || data.paidAmount === '' || !Number.isFinite(Number(data.paidAmount)) ? null : Number(data.paidAmount),
          status: isPaid ? 'paid' : 'pending',
          transferDateTime: data.transferDateTime || '-',
          slipUrl: slipUrls[0] || '',
          slipUrls: slipUrls,
          slips: slips,
          phone: data.phone || '',
          email: data.email || '',
          sizes: sizes
        });
      });

      // Update Top Stats Grid
      const totalShirts = currentAggregatedSizeStats.all.totalShirts;
      const paidShirts = currentAggregatedSizeStats.paid.totalShirts;
      const pendingShirts = currentAggregatedSizeStats.pending.totalShirts;

      const totalOrders = currentAggregatedSizeStats.all.orders;
      const paidOrders = currentAggregatedSizeStats.paid.orders;
      const pendingOrders = currentAggregatedSizeStats.pending.orders;

      const paidIncome = allBookingsList.reduce((sum, booking) => sum + (booking.paidAmount || 0), 0);
      currentAggregatedSizeStats.all.paidAmount = paidIncome;
      const totalExpectedIncome = currentAggregatedSizeStats.all.totalIncome;

      const payPercentage = totalExpectedIncome > 0 ? Math.min(100, Math.round((paidIncome / totalExpectedIncome) * 100)) : 0;

      // Primary Paid Highlight
      const elPaidShirts = document.getElementById('stat_paid_shirts_val');
      if (elPaidShirts) elPaidShirts.innerText = paidShirts.toLocaleString();

      const elTotalShirts = document.getElementById('stat_total_shirts');
      if (elTotalShirts) elTotalShirts.innerText = totalShirts.toLocaleString();

      const elPendingShirts = document.getElementById('stat_pending_shirts_val');
      if (elPendingShirts) elPendingShirts.innerText = pendingShirts.toLocaleString();

      const elPaidOrders = document.getElementById('stat_paid_orders_val');
      if (elPaidOrders) elPaidOrders.innerText = paidOrders.toLocaleString();

      const elTotalOrders = document.getElementById('stat_total_orders');
      if (elTotalOrders) elTotalOrders.innerText = totalOrders.toLocaleString();

      const elPaidCount = document.getElementById('stat_paid_count');
      if (elPaidCount) elPaidCount.innerText = paidOrders;

      const elPendingCount = document.getElementById('stat_pending_count');
      if (elPendingCount) elPendingCount.innerText = pendingOrders;

      const elTotalIncome = document.getElementById('stat_total_income');
      if (elTotalIncome) elTotalIncome.innerText = paidIncome.toLocaleString() + ' ฿';

      const elIncomeSubtext = document.getElementById('stat_income_subtext');
      if (elIncomeSubtext) elIncomeSubtext.innerText = `จากยอดคำสั่งซื้อทั้งหมด ${totalExpectedIncome.toLocaleString()} ฿`;

      const elPayPct = document.getElementById('stat_payment_percentage');
      if (elPayPct) elPayPct.innerText = payPercentage + '%';

      const fillBar = document.getElementById('stat_payment_progress_fill');
      if (fillBar) { fillBar.style.width = '100%'; fillBar.style.transform = 'scaleX(' + (payPercentage / 100) + ')'; fillBar.style.transformOrigin = 'left'; }

      // Pending Alert Banner
      const pendingBanner = document.getElementById('pendingAlertBanner');
      const pendingBannerCount = document.getElementById('pendingBannerCount');
      if (pendingBanner) {
        if (pendingOrders > 0) {
          pendingBanner.style.display = 'flex';
          if (pendingBannerCount) pendingBannerCount.innerText = pendingOrders;
        } else {
          pendingBanner.style.display = 'none';
        }
      }

      bookingsComplete = true;
      renderSizeBreakdown(); filterBookingsTable();
      tableBody.setAttribute('aria-busy', 'false');
      document.getElementById('bookings-status').textContent = 'โหลดครบ ' + allBookingsList.length + ' รายการ' + (allBookingsList.some(b => b.paidAmount === null) ? ' · บางรายการไม่มีจำนวนเงินชำระที่บันทึกไว้' : '');

    } catch(err) {
      if (generation !== bookingsGeneration || !isAdminAuthenticated) return;
      allBookingsList = []; tableBody.setAttribute('aria-busy', 'false');
      tableBody.innerHTML = '<tr><td colspan="8">โหลดข้อมูลไม่ครบ กรุณาดึงข้อมูลล่าสุดอีกครั้ง</td></tr>';
      document.getElementById('bookings-status').textContent = 'ยังยืนยันยอดสรุปไม่ได้';
      document.getElementById('bookings-pager').replaceChildren(); setBookingTotalsPending(); throw err;
    }
  }

  function filterTableByPending() {
    const statusFilter = document.getElementById('bookingStatusFilter');
    if (statusFilter) {
      statusFilter.value = 'pending';
      filterBookingsTable();
      const table = document.getElementById('bookingsTableBody');
      if (table) table.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function setSizeBreakdownView(view) {
    currentSizeView = view;
    document.querySelectorAll('.size-filter-tab').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('btn-size-' + view);
    if (btn) btn.classList.add('active');
    renderSizeBreakdown();
  }

  function renderSizeBreakdown() {
    if (!bookingsComplete) return;
    const grid = document.getElementById('sizeCardsGrid');
    const badge = document.getElementById('size_summary_badge');
    const customContainer = document.getElementById('customSizesContainer');
    if (!grid) return;

    const data = currentAggregatedSizeStats[currentSizeView] || currentAggregatedSizeStats.all;
    const totalShirtsInView = data.totalShirts;

    const viewLabels = {
      all: 'ยอดสั่งทั้งหมด',
      paid: 'เฉพาะที่ชำระเงินแล้ว',
      pending: 'รอชำระเงิน'
    };

    if (badge) {
      badge.innerText = `${viewLabels[currentSizeView]}: รวม ${totalShirtsInView.toLocaleString()} ตัว`;
    }

    const sizesConfig = [
      { key: 'xs', label: 'XS', bg: '#f0fdf4', border: '#bbf7d0', color: '#166534', badgeBg: '#dcfce7' },
      { key: 's', label: 'S', bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af', badgeBg: '#dbeafe' },
      { key: 'm', label: 'M', bg: '#fdf4ff', border: '#f5d0fe', color: '#86198f', badgeBg: '#fae8ff' },
      { key: 'l', label: 'L', bg: '#fff7ed', border: '#fed7aa', color: '#9a3412', badgeBg: '#ffedd5' },
      { key: 'xl', label: 'XL', bg: '#fef2f2', border: '#fecaca', color: '#991b1b', badgeBg: '#fee2e2' },
      { key: 'xxl', label: '2XL', bg: '#faf5ff', border: '#e9d5ff', color: '#6b21a8', badgeBg: '#f3e8ff' },
      { key: 'other', label: 'อื่นๆ / พิเศษ', bg: '#f8fafc', border: '#cbd5e1', color: '#334155', badgeBg: '#e2e8f0' }
    ];

    grid.innerHTML = sizesConfig.map(cfg => {
      const count = data[cfg.key] || 0;
      const paidCount = currentAggregatedSizeStats.paid[cfg.key] || 0;
      const pendingCount = currentAggregatedSizeStats.pending[cfg.key] || 0;
      const percent = totalShirtsInView > 0 ? Math.round((count / totalShirtsInView) * 100) : 0;

      let subDetail = '';
      if (currentSizeView === 'all') {
        subDetail = `ชำระ <b style="color:#15803d;">${paidCount}</b> • รอ <b style="color:#b45309;">${pendingCount}</b>`;
      } else if (currentSizeView === 'paid') {
        subDetail = `คิดเป็น <b>${percent}%</b> ของที่ชำระ`;
      } else {
        subDetail = `คิดเป็น <b>${percent}%</b> ของที่รอชำระ`;
      }

      return `
        <div class="size-card" style="background:${cfg.bg}; border-color:${cfg.border};">
          <div class="size-badge" style="background:${cfg.badgeBg}; color:${cfg.color};">${cfg.label}</div>
          <div class="size-count" style="color:${cfg.color};">${count.toLocaleString()} <span style="font-size:0.8125rem; font-weight: 400;">ตัว</span></div>
          <div class="size-detail">${subDetail}</div>
          <div class="size-progress-bar" style="background:rgba(0,0,0,0.06);">
            <div class="size-progress-fill" style="width:${percent}%; background:${cfg.color};"></div>
          </div>
        </div>
      `;
    }).join('');

    // Custom sizes details
    const customEntries = Object.keys(data.customMap || {});
    if (customContainer) {
      if (customEntries.length > 0) {
        customContainer.style.display = 'flex';
        customContainer.innerHTML = `
          <b style="color:var(--main-blue);">️ รายการไซส์พิเศษที่ระบุ:</b>
          ${customEntries.map(item => `<span class="custom-size-pill">${escapeHtml(item)}</span>`).join('')}
        `;
      } else {
        customContainer.style.display = 'none';
      }
    }
  }

  function copySizeSummaryToClipboard() {
    const all = currentAggregatedSizeStats.all;
    const paid = currentAggregatedSizeStats.paid;
    const pending = currentAggregatedSizeStats.pending;

    if (all.totalShirts === 0) {
      return alert('ยังไม่มีข้อมูลการสั่งจองเสื้อในระบบครับ');
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    let summaryText = ` สรุปยอดสั่งจองเสื้อช็อป DE 06\n`;
    summaryText += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    summaryText += ` ยอดสั่งเสื้อรวมทั้งหมด: ${all.totalShirts.toLocaleString()} ตัว\n`;
    summaryText += `   • ชำระเงินแล้ว: ${paid.totalShirts.toLocaleString()} ตัว\n`;
    summaryText += `   • รอชำระเงิน: ${pending.totalShirts.toLocaleString()} ตัว\n\n`;
    summaryText += ` จำนวนผู้สั่งซื้อ: ${all.orders} คน (ชำระแล้ว ${paid.orders} คน / รอชำระ ${pending.orders} คน)\n`;
    summaryText += ` ยอดเงินที่ได้รับแล้ว: ${paid.totalIncome.toLocaleString()} บาท (ยอดรวมทั้งหมด ${all.totalIncome.toLocaleString()} บาท)\n\n`;
    summaryText += ` สรุปจำนวนเสื้อแยกตามไซส์:\n`;
    summaryText += `• ไซส์ XS  : ${all.xs} ตัว (ชำระแล้ว ${paid.xs} / รอ ${pending.xs})\n`;
    summaryText += `• ไซส์ S   : ${all.s} ตัว (ชำระแล้ว ${paid.s} / รอ ${pending.s})\n`;
    summaryText += `• ไซส์ M   : ${all.m} ตัว (ชำระแล้ว ${paid.m} / รอ ${pending.m})\n`;
    summaryText += `• ไซส์ L   : ${all.l} ตัว (ชำระแล้ว ${paid.l} / รอ ${pending.l})\n`;
    summaryText += `• ไซส์ XL  : ${all.xl} ตัว (ชำระแล้ว ${paid.xl} / รอ ${pending.xl})\n`;
    summaryText += `• ไซส์ 2XL : ${all.xxl} ตัว (ชำระแล้ว ${paid.xxl} / รอ ${pending.xxl})\n`;
    if (all.other > 0) {
      const customList = Object.keys(all.customMap).join(', ') || 'ตามที่ระบุ';
      summaryText += `• ไซส์อื่นๆ : ${all.other} ตัว [${customList}] (ชำระแล้ว ${paid.other} / รอ ${pending.other})\n`;
    }
    summaryText += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    summaryText += `(ข้อมูลอัปเดต ณ ${dateStr})`;

    navigator.clipboard.writeText(summaryText).then(() => {
      showGlobalToast(' คัดลอกข้อความสรุปยอดเสื้อแยกไซส์เรียบร้อยแล้ว! สามารถส่งในกลุ่มหรือส่งให้ร้านได้เลย', 'success');
      alert(' คัดลอกข้อความสรุปยอดเสื้อแยกไซส์เรียบร้อยแล้ว!\n\n' + summaryText);
    }).catch(err => {
      alert('คัดลอกล้มเหลว: ' + err.message);
    });
  }

  function debounceFilterBookings() {
    clearTimeout(filterDebounceTimer);
    filterDebounceTimer = setTimeout(filterBookingsTable, 200);
  }

  function filterBookingsTable() {
    const query = document.getElementById('bookingSearchInput').value.toLowerCase().trim();
    const statusFilter = document.getElementById('bookingStatusFilter').value;
    const filterKey = query + ':' + statusFilter;
    if (filterKey !== bookingsFilterKey) { bookingsPage = 0; bookingsFilterKey = filterKey; }
    const tableBody = document.getElementById('bookingsTableBody');

    const filtered = allBookingsList.filter(b => {
      const matchQuery = !query || b.studentId.toLowerCase().includes(query) || b.name.toLowerCase().includes(query);
      const matchStatus = statusFilter === 'all' || b.status === statusFilter;
      return matchQuery && matchStatus;
    });

    const pageCount = Math.max(1, Math.ceil(filtered.length / 50));
    bookingsPage = Math.min(bookingsPage, pageCount - 1);
    const pager = document.getElementById('bookings-pager'); pager.replaceChildren();
    if (filtered.length > 50) {
      const previous = document.createElement('button'); previous.type = 'button'; previous.className = 'btn-secondary'; previous.textContent = 'ก่อนหน้า'; previous.disabled = bookingsPage === 0; previous.onclick = () => { bookingsPage--; filterBookingsTable(); };
      const label = document.createElement('span'); label.textContent = 'หน้า ' + (bookingsPage + 1) + ' / ' + pageCount + ' · ' + filtered.length + ' รายการ';
      const next = document.createElement('button'); next.type = 'button'; next.className = 'btn-secondary'; next.textContent = 'ถัดไป'; next.disabled = bookingsPage === pageCount - 1; next.onclick = () => { bookingsPage++; filterBookingsTable(); };
      pager.append(previous, label, next);
    }
    if (filtered.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:gray; padding:1.875rem;">ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา</td></tr>';
      return;
    }

    tableBody.innerHTML = filtered.slice(bookingsPage * 50, bookingsPage * 50 + 50).map(b => {
      const isPaid = b.status === 'paid';
      const statusBadge = isPaid ?
        '<span style="color:#16a34a; background:#dcfce7; padding:0.25rem 0.5rem; border-radius:0.375rem; font-weight:700; font-size:0.6875rem;">ชำระแล้ว</span>' :
        '<span style="color:#d97706; background:#fef3c7; padding:0.25rem 0.5rem; border-radius:0.375rem; font-weight:700; font-size:0.6875rem;">รอชำระ</span>';

      let slipBtn = '<span style="color:#94a3b8; font-size:0.75rem;">ไม่มีสลิป</span>';
      if (b.slipUrls && b.slipUrls.length === 1) {
        slipBtn = `<button class="btn-secondary btn-sm" onclick="openSlipModal(${DE06.arg(b.studentId)})">ดูสลิป</button>`;
      } else if (b.slipUrls && b.slipUrls.length > 1) {
        slipBtn = `<button class="btn-secondary btn-sm" style="background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe; font-weight: 400;" onclick="openSlipModal(${DE06.arg(b.studentId)})"> ดูสลิป (${b.slipUrls.length} ใบ)</button>`;
      } else if (b.slipUrl) {
        slipBtn = `<button class="btn-secondary btn-sm" onclick="openImageModal(${DE06.arg(b.slipUrl)}, ${DE06.arg("สลิปของ: " + b.name)})"> ดูสลิป</button>`;
      }

      const qty = b.sizes ? b.sizes.totalQty : 1;

      return `
        <tr>
          <td><b>${escapeHtml(b.studentId)}</b></td>
          <td>
            <div style="font-weight: 400; color:var(--main-blue);">${escapeHtml(b.name)}</div>
            <div style="font-size:0.6875rem; color:#64748b;">${escapeHtml(b.phone || '')} ${b.email ? '• ' + escapeHtml(b.email) : ''}</div>
          </td>
          <td><span style="font-size:0.75rem; font-weight: 400;">${escapeHtml(b.summary)}</span></td>
          <td style="text-align:center;"><span style="background:#f1f5f9; color:#1e293b; font-weight:700; padding:0.25rem 0.625rem; border-radius:0.75rem; font-size:0.75rem; border:1px solid #e2e8f0;">${qty} ตัว</span></td>
          <td><b>${b.totalPrice.toLocaleString()} ฿</b></td>
          <td>${statusBadge}</td>
          <td style="font-size:0.75rem; color:#64748b;">
            ${(function(){
              if (b.slips && b.slips.length > 1) {
                return b.slips.map((s, idx) => {
                  const t = s.transferDateTime || b.transferDateTime || '-';
                  return `<div style="font-size:0.6875rem; line-height: 1.6; margin-bottom:0.125rem;"><span style="font-weight: 400; color:#1e293b;">สลิป ${idx + 1}:</span> ${escapeHtml(t)}</div>`;
                }).join('');
              }
              return escapeHtml(b.transferDateTime);
            })()}
          </td>
          <td>${slipBtn}</td>
        </tr>
      `;
    }).join('');
  }

  // =============================================
  // ️ Image Preview & Slip View Modals
  // =============================================
  function openImageModal(url, title) {
    const modal = document.getElementById('imagePreviewModal');
    const modalTitle = document.getElementById('imageModalTitle');
    const body = document.getElementById('imageModalBody');
    modalTitle.innerText = title || '️ ดูรูปภาพ';
    body.innerHTML = `
      <img src="${DE06.image(url)}" loading="lazy" style="max-width:100%; max-height:65dvh; border-radius:0.75rem; border:1px solid #e2e8f0; box-shadow:0 0.25rem 0.9375rem rgba(0,0,0,0.1);">
      <div style="margin-top:0.875rem;">
        <a href="${DE06.escape(DE06.safeUrl(url, true))}" target="_blank" class="btn-site-link" style="background:#003566; color:white; border:none; display:inline-block;">เปิดดูรูปขนาดเต็ม ↗</a>
      </div>
    `;
    modal.style.display = 'flex';
  }

  function openSlipModal(studentId) {
    const b = allBookingsList.find(item => item.studentId === studentId);
    if (!b) return;

    const urls = (b.slipUrls && b.slipUrls.length > 0) ? b.slipUrls : (b.slipUrl ? [b.slipUrl] : []);
    if (urls.length === 0) {
      alert('ไม่พบข้อมูลรูปสลิปของผู้จองรายนี้');
      return;
    }

    const modal = document.getElementById('imagePreviewModal');
    const modalTitle = document.getElementById('imageModalTitle');
    const body = document.getElementById('imageModalBody');

    modalTitle.textContent = 'สลิปของ: ' + b.name;
    const slipsList = b.slips && b.slips.length ? b.slips : urls.map(url => ({ imageUrl: url, fileUrl: url }));
    const selection = document.createElement('select'); selection.setAttribute('aria-label', 'เลือกสลิป');
    slipsList.forEach((slip, i) => { const option = document.createElement('option'); option.value = i; option.textContent = 'สลิป ' + (i + 1) + ' / ' + slipsList.length; selection.appendChild(option); });
    const preview = document.createElement('div');
    function showSlip() {
      const slip = slipsList[Number(selection.value)] || {};
      preview.replaceChildren();
      const time = document.createElement('p'); time.textContent = slip.transferDateTime || b.transferDateTime || 'ไม่มีเวลาโอนที่บันทึกไว้';
      const image = document.createElement('img');
      if (DE06.dimensions(slip.width, slip.height)) { image.width = Number(slip.width); image.height = Number(slip.height); }
      image.src = DE06.safeUrl(slip.imageUrl || slip.fileUrl, true); image.alt = 'สลิปชำระเงิน'; image.decoding = 'async'; image.style.height = 'auto'; image.style.maxWidth = '100%';
      const link = document.createElement('a'); link.href = DE06.safeUrl(slip.fileUrl || slip.imageUrl, true); link.target = '_blank'; link.rel = 'noopener'; link.className = 'btn-site-link'; link.textContent = 'เปิดรูปขนาดเต็ม';
      preview.append(time, image, link);
    }
    selection.onchange = showSlip; body.replaceChildren(selection, preview); showSlip();
    modal.style.display = 'flex';
  }

  function closeImageModal(e) {
    if (!e || e.target.id === 'imagePreviewModal') {
      document.getElementById('imagePreviewModal').style.display = 'none';
    }
  }

  // =============================================
  //  Save All Settings & Activities
  // =============================================
  async function saveAllChanges(...args) {
    if (args[0] && typeof args[0].preventDefault === 'function') args[0].preventDefault();
    const identity = currentAdminId;
    if (!isAdminAuthenticated) return;
    if (!navigator.onLine) return alert('ไม่มีการเชื่อมต่ออินเทอร์เน็ต กรุณาลองใหม่เมื่อออนไลน์');
    const key = 'admin:write:saveAllChanges:' + identity + ':' + args.filter(a => typeof a === 'string').join(':');
    if (!DE06.lock(key)) return;
    try { return await perform_saveAllChanges(...args); } finally { DE06.unlock(key); DE06.invalidate('admin:'); }
  }
  async function perform_saveAllChanges() {
    if (!isAdminAuthenticated) {
      alert('เซสชันของคุณหมดอายุหรือยังไม่ได้เข้าสู่ระบบ กรุณาล็อกอินใหม่อีกครั้ง');
      logoutAdmin();
      return;
    }

    showGlobalToast('กำลังบันทึกข้อมูลทั้งหมดไปที่ Firebase...', 'loading');

    try {
      const newConfig = {
        PROMPTPAY_NUMBER: document.getElementById('cfg_promptpay').value.trim(),
        ACCOUNT_NAME: document.getElementById('cfg_accountName').value.trim(),
        FOLDER_ID: document.getElementById('cfg_folder').value.trim(),
        ADMIN_PASSWORD: (currentAdminRole === 'master' && document.getElementById('cfg_adminPass')) ?
          (document.getElementById('cfg_adminPass').value.trim() || appConfig.ADMIN_PASSWORD || '') :
          (appConfig.ADMIN_PASSWORD || ''),
        ADMIN_STUDENTS: appConfig.ADMIN_STUDENTS || [],
        HOME_ANNOUNCEMENT: {
          enabled: document.getElementById('ann_enable').checked,
          icon: document.getElementById('ann_icon').value.trim() || '',
          title: document.getElementById('ann_title').value.trim(),
          desc: document.getElementById('ann_desc').value.trim(),
          type: document.getElementById('ann_type').value,
          target: document.getElementById('ann_target_activity').value
        }
      };

      const adminId = currentAdminId;
      const activitySnapshot = appActivities.map((original, index) => {
        const act = structuredClone(original);
        if (!String(act.title || '').trim()) throw new Error('กรุณาระบุชื่อกิจกรรมที่ ' + (index + 1));
        if (act.endDate && !Number.isFinite(new Date(act.endDate).getTime())) throw new Error('วันหมดเวลากิจกรรมไม่ถูกต้อง');
        if (act.type === 'link' && !DE06.safeUrl(act.targetUrl)) throw new Error('กรุณาระบุลิงก์ที่ถูกต้องสำหรับ ' + act.title);
        if (act.actionUrl && !DE06.safeUrl(act.actionUrl)) throw new Error('ลิงก์เพิ่มเติมไม่ถูกต้องสำหรับ ' + act.title);
        if (act.type === 'poll' && (!Array.isArray(act.pollOptions) || act.pollOptions.length < 2 || act.pollOptions.some(option => !String(option).trim()))) throw new Error('กิจกรรมโหวตต้องมีตัวเลือกอย่างน้อยสองข้อและไม่เว้นว่าง');
        if (act.type === 'form' && (!Array.isArray(act.formQuestions) || !act.formQuestions.length || act.formQuestions.some(q => !String(q.label || '').trim()) || new Set(act.formQuestions.map(q => q.label.trim())).size !== act.formQuestions.length)) throw new Error('แบบฟอร์มต้องมีคำถามที่ไม่ว่างและชื่อคำถามไม่ซ้ำกัน');
        const id = String(act.id || 'act-' + (index + 1));
        if (!id || id.includes('/')) throw new Error('รหัสกิจกรรมไม่ถูกต้อง');
        let action = "goToSection('dynamic-" + id.replace(/[^a-zA-Z0-9_-]/g, '-') + "')";
        if (act.type === 'booking') action = "goToSection('booking-section')";
        else if (act.type === 'link') action = '';
        return { ...act, id, order: index + 1, action, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
      });
      const currentIds = new Set(activitySnapshot.map(act => act.id));
      if (currentIds.size !== activitySnapshot.length) throw new Error('รหัสกิจกรรมซ้ำ กรุณาดึงข้อมูลล่าสุด');
      const deletedIds = Array.from(loadedActivityDocuments.keys()).filter(id => !currentIds.has(id));
      if (activitySnapshot.length + deletedIds.length + 1 > 500) throw new Error('รายการเกินขีดจำกัดการบันทึกครั้งเดียว กรุณาติดต่อผู้ดูแลระบบ');
      const managedIds = Array.from(new Set([...loadedActivityDocuments.keys(), ...currentIds]));
      const configRef = db.collection('config').doc('main');
      await db.runTransaction(async transaction => {
        const remoteConfig = await transaction.get(configRef);
        const remoteActivities = await Promise.all(managedIds.map(id => transaction.get(db.collection('activities').doc(id))));
        if (!isAdminAuthenticated || adminId !== currentAdminId) throw new Error('บัญชีผู้ดูแลเปลี่ยนแล้ว');
        if (currentAdminRole !== 'master' && !(remoteConfig.exists && Array.isArray(remoteConfig.data().ADMIN_STUDENTS) && remoteConfig.data().ADMIN_STUDENTS.some(admin => String(admin.studentId) === adminId))) throw new Error('สิทธิ์ผู้ดูแลถูกยกเลิกแล้ว');
        if (loadedConfigDocument && DE06.fingerprint(remoteConfig.exists ? remoteConfig.data() : {}) !== loadedConfigDocument) throw new Error('การตั้งค่าถูกเปลี่ยนจากอีกเซสชัน กรุณาดึงข้อมูลล่าสุดก่อนบันทึก');
        remoteActivities.forEach((doc, index) => {
          const expected = loadedActivityDocuments.get(managedIds[index]);
          if (expected !== (doc.exists ? DE06.fingerprint(doc.data()) : undefined)) throw new Error('กิจกรรมถูกเปลี่ยนจากอีกเซสชัน กรุณาดึงข้อมูลล่าสุดก่อนบันทึก');
        });
        transaction.set(configRef, newConfig, { merge: true });
        deletedIds.forEach(id => transaction.delete(db.collection('activities').doc(id)));
        activitySnapshot.forEach(act => transaction.set(db.collection('activities').doc(act.id), act, { merge: true }));
      });
      appConfig = { ...appConfig, ...newConfig };
      loadedConfigDocument = DE06.fingerprint(appConfig);
      // Fetch committed timestamps before allowing another save.
      const saved = await db.collection('activities').orderBy('order').get();
      loadedActivityDocuments = new Map(); saved.forEach(doc => { if (currentIds.has(doc.id)) loadedActivityDocuments.set(doc.id, DE06.fingerprint(doc.data())); });
      await recordAuditLog('บันทึกการตั้งค่าระบบและกิจกรรม', 'บันทึกการตั้งค่าและกิจกรรมทั้งหมด ' + appActivities.length + ' รายการ');

      showGlobalToast('บันทึกการตั้งค่าและกิจกรรมทั้งหมดสำเร็จเรียบร้อย!', 'success');
      document.getElementById('activitySaveStatus').textContent = 'บันทึกกิจกรรมเรียบร้อยแล้ว';
      populateActivityDropdowns();

    } catch (err) {
      console.error(err);
      showGlobalToast(' เกิดข้อผิดพลาดในการบันทึก: ' + err.message, 'error');
    }
  }

  // =============================================
  //  Helpers
  // =============================================
  function showGlobalToast(msg, type) {
    const el = document.getElementById('globalMsg');
    el.innerHTML = `<div class="msg-box msg-${type}">${escapeHtml(msg)}</div>`;
    if (type === 'success') {
      setTimeout(() => { el.innerHTML = ''; }, 4000);
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // =============================================
  // ️ Admin Access Tracking & Logs (Permission-Safe)
  // =============================================
  function getDeviceInfo() {
    const ua = navigator.userAgent;
    let os = "Desktop / PC";
    let deviceModel = "";
    let browser = "Web Browser";

    if (/iPhone/i.test(ua)) {
      os = "iOS";
      deviceModel = "iPhone";
    } else if (/iPad/i.test(ua)) {
      os = "iPadOS";
      deviceModel = "iPad";
    } else if (/Android/i.test(ua)) {
      os = "Android";
      const modelMatch = ua.match(/Android\s+([\d.]+);\s*([^;)]+)\s*Build/i) || ua.match(/Android\s+([\d.]+);\s*([^;)]+)\)/i);
      if (modelMatch && modelMatch[2]) {
        deviceModel = modelMatch[2].trim();
      } else {
        deviceModel = "Android Device";
      }
    } else if (/Windows NT 10.0/i.test(ua)) {
      os = "Windows 10/11";
      deviceModel = "PC / Laptop";
    } else if (/Windows NT 6.3/i.test(ua)) {
      os = "Windows 8.1";
      deviceModel = "PC / Laptop";
    } else if (/Windows NT 6.1/i.test(ua)) {
      os = "Windows 7";
      deviceModel = "PC / Laptop";
    } else if (/Macintosh|Mac OS X/i.test(ua)) {
      os = "macOS";
      deviceModel = "Mac / MacBook";
    } else if (/Linux/i.test(ua)) {
      os = "Linux";
      deviceModel = "Linux Machine";
    }

    if (/Edg\//i.test(ua)) browser = "Microsoft Edge";
    else if (/Chrome\//i.test(ua) && !/Chromium|Edg/i.test(ua)) browser = "Google Chrome";
    else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Apple Safari";
    else if (/Firefox\//i.test(ua)) browser = "Mozilla Firefox";
    else if (/OPR\/|Opera\//i.test(ua)) browser = "Opera";

    if (deviceModel && os) {
      return `${deviceModel} (${os} • ${browser})`;
    }
    return `${os} (${browser})`;
  }

  async function fetchClientIP() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && data.ip) return data.ip;
      }
    } catch (e) {}

    try {
      const res2 = await fetch('https://api64.ipify.org?format=json');
      if (res2.ok) {
        const data2 = await res2.json();
        if (data2 && data2.ip) return data2.ip;
      }
    } catch (e2) {}

    return 'ไม่สามารถระบุ IP ได้ (บล็อก/ออฟไลน์)';
  }

  async function recordAdminAccessLog(status = 'success') {
    try {
      const device = getDeviceInfo();
      const ip = await fetchClientIP();
      const now = new Date();
      const formattedTime = now.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
      const newLog = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        ip: ip,
        device: device,
        userAgent: navigator.userAgent,
        status: status,
        formattedTime: formattedTime,
        timestampMs: Date.now()
      };

      // 1. Save to LocalStorage for instant local cache
      try {
        let localLogs = JSON.parse(DE06.storage.getItem('de06_admin_logs') || '[]');
        if (!Array.isArray(localLogs)) localLogs = [];
        localLogs.unshift(newLog);
        if (localLogs.length > 80) localLogs = localLogs.slice(0, 80);
        DE06.storage.setItem('de06_admin_logs', JSON.stringify(localLogs));
      } catch (e) {}

      // 2. Primary cloud storage: in config/admin_logs (100% permitted by Firebase Security Rules)
      try {
        const logDocRef = db.collection('config').doc('admin_logs');
        const docSnap = await logDocRef.get();
        let existingLogs = [];
        if (docSnap.exists && Array.isArray(docSnap.data().logs)) {
          existingLogs = docSnap.data().logs;
        }
        existingLogs.unshift(newLog);
        if (existingLogs.length > 80) existingLogs = existingLogs.slice(0, 80);
        await logDocRef.set({
          logs: existingLogs,
          lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } catch (errConfig) {
        console.warn('Config admin_logs update notice:', errConfig.message);
      }

      // 3. Fallback try to collection admin_logs (if ever permitted)
      try {
        await db.collection('admin_logs').add({
          ...newLog,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (errColl) {
        // Silently ignored if collection permissions are not set
      }

    } catch (e) {
      console.warn('Failed to record admin access log:', e);
    }
  }

  // =============================================
  //  Inquiries Management
  // =============================================
  let allInquiriesList = [];

  async function loadInquiriesData() {
    if (!isAdminAuthenticated) return;
    const identity = currentAdminId;
    return DE06.request('admin:loadInquiriesData:' + identity, () => { if (isAdminAuthenticated && identity === currentAdminId) return read_loadInquiriesData(); }, 30000);
  }
  async function read_loadInquiriesData() {
    if (!isAdminAuthenticated) return;
    const identity = currentAdminId; const epoch = initialGeneration;
    const container = document.getElementById('inquiriesContainer');
    if (!container) return;
    if (!isAdminAuthenticated || identity !== currentAdminId || epoch !== initialGeneration) return;
    container.innerHTML = '<div style="text-align:center; padding:1.875rem; color:#64748b;"><div class="loading-spinner" style="margin:0 auto 0.625rem auto; width:1.75rem; height:1.75rem; border-width:0.1875rem;"></div>กำลังโหลดข้อความสอบถาม...</div>';

    try {
      let inqList = [];
      try {
        const snap = await DE06.allDocuments(db.collection('inquiries').orderBy('createdAt', 'desc'), 200, true);
        if (!isAdminAuthenticated || identity !== currentAdminId || epoch !== initialGeneration) return;
        snap.forEach(doc => {
          inqList.push({ id: doc.id, sourceColl: 'inquiries', ...doc.data() });
        });
      } catch (errInq) {
        console.warn('Inquiries direct collection notice:', errInq.message);
      }

      // Fallback read from dynamic_submissions (activityId == 'inquiries')
      try {
        const fbSnap = await DE06.allDocuments(db.collection('dynamic_submissions').where('activityId', '==', 'inquiries'));
        if (!isAdminAuthenticated || identity !== currentAdminId || epoch !== initialGeneration) return;
        fbSnap.forEach(doc => {
          if (!inqList.some(item => item.id === doc.id)) {
            inqList.push({ id: doc.id, sourceColl: 'dynamic_submissions', ...doc.data() });
          }
        });
      } catch (errFb) {
        console.warn('Inquiries dynamic_submissions notice:', errFb.message);
      }

      // Sort by createdAt descending
      inqList.sort((a, b) => {
        const timeA = a.createdAtMs || (a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0);
        const timeB = b.createdAtMs || (b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0);
        return timeB - timeA;
      });

      allInquiriesList = inqList;

      if (allInquiriesList.length === 0) {
        if (!isAdminAuthenticated || identity !== currentAdminId || epoch !== initialGeneration) return;
        container.innerHTML = '<div style="text-align:center; padding:2.25rem; color:#64748b; background:#f8fafc; border-radius:0.75rem; border:1px dashed #cbd5e1;">ยังไม่มีข้อความสอบถามจากนักศึกษา</div>';
        return;
      }

      let rows = '';
      allInquiriesList.forEach((inq, idx) => {
        const timeStr = inq.createdAtStr || (inq.createdAt ? (inq.createdAt.toDate ? inq.createdAt.toDate().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : inq.createdAt) : '-');
        const isResolved = inq.status === 'resolved';
        const statusBadge = isResolved ?
          '<span style="background:#dcfce7; color:#15803d; padding:0.1875rem 0.5rem; border-radius:0.375rem; font-size:0.75rem; font-weight: 400;">ตอบแล้ว</span>' :
          '<span style="background:#fef3c7; color:#b45309; padding:0.1875rem 0.5rem; border-radius:0.375rem; font-size:0.75rem; font-weight: 400;">รอดำเนินการ</span>';

        const toggleBtn = isResolved ?
          `<button class="btn-secondary btn-sm" onclick="setInquiryStatus(${DE06.arg(inq.id)}, 'pending')" style="padding:0.1875rem 0.5rem; font-size:0.6875rem;">ตั้งเป็นรอดำเนินการ</button>` :
          `<button class="btn-success btn-sm" onclick="setInquiryStatus(${DE06.arg(inq.id)}, 'resolved')" style="padding:0.1875rem 0.5rem; font-size:0.6875rem;">ทำเครื่องหมายว่าตอบแล้ว</button>`;

        rows += `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 0.75rem 0.875rem; text-align: center; color: #64748b;">${idx + 1}</td>
            <td style="padding: 0.75rem 0.875rem; font-weight: 400; color: #1e293b; white-space: nowrap;">${escapeHtml(timeStr)}</td>
            <td style="padding: 0.75rem 0.875rem; white-space: nowrap;">
              <div style="font-weight:700; color:var(--main-blue);">${escapeHtml(inq.studentName || 'นักศึกษา')}</div>
              <div style="font-size:0.75rem; color:#64748b;">${escapeHtml(inq.studentId || '-')}</div>
            </td>
            <td style="padding: 0.75rem 0.875rem; font-weight: 400; color: #334155;">${escapeHtml(inq.topic || 'สอบถามทั่วไป')}</td>
            <td style="padding: 0.75rem 0.875rem; color: #1e293b; max-width: 20rem; line-height: 1.6; background: #fafafa; border-radius: 0.5rem;">
              ${escapeHtml(inq.message || '')}
              ${inq.contact ? `<div style="font-size:0.75rem; color:#64748b; margin-top:0.25rem;"><b>ติดต่อ:</b> ${escapeHtml(inq.contact)}</div>` : ''}
            </td>
            <td style="padding: 0.75rem 0.875rem; text-align: center;">${statusBadge}</td>
            <td style="padding: 0.75rem 0.875rem; text-align: center; white-space: nowrap;">
              <div style="display:flex; flex-direction:column; gap:0.25rem; align-items:center;">
                ${toggleBtn}
                <button class="btn-danger btn-sm" onclick="deleteInquiry(${DE06.arg(inq.id)})" style="padding:0.1875rem 0.5rem; font-size:0.6875rem;">ลบ</button>
              </div>
            </td>
          </tr>
        `;
      });

      if (!isAdminAuthenticated || identity !== currentAdminId || epoch !== initialGeneration) return;

      container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.875rem; background: white; border-radius: 0.75rem; overflow: hidden; border: 1px solid #e2e8f0;">
          <thead>
            <tr style="background: #f8fafc; color: #475569; font-weight: 700; border-bottom: 0.125rem solid #e2e8f0;">
              <th style="padding: 0.75rem 0.875rem; text-align: center; width: 2.5rem;">ลำดับ</th>
              <th style="padding: 0.75rem 0.875rem; width: 8.75rem;">วัน-เวลา</th>
              <th style="padding: 0.75rem 0.875rem; width: 10rem;">ผู้สอบถาม</th>
              <th style="padding: 0.75rem 0.875rem; width: 9.375rem;">หัวข้อ</th>
              <th style="padding: 0.75rem 0.875rem;">ข้อความสอบถาม</th>
              <th style="padding: 0.75rem 0.875rem; text-align: center; width: 8.75rem;">สถานะ</th>
              <th style="padding: 0.75rem 0.875rem; text-align: center; width: 8.125rem;">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
      DE06.paginate(container);
    } catch(err) {
      console.error(err);
      if (!isAdminAuthenticated || identity !== currentAdminId || epoch !== initialGeneration) return;
      container.innerHTML = '<div class="msg-box msg-error">เกิดข้อผิดพลาดในการดึงข้อความ: ' + err.message + '</div>';
    }
  }

  async function setInquiryStatus(...args) {
    if (args[0] && typeof args[0].preventDefault === 'function') args[0].preventDefault();
    const identity = currentAdminId;
    if (!isAdminAuthenticated) return;
    if (!navigator.onLine) return alert('ไม่มีการเชื่อมต่ออินเทอร์เน็ต กรุณาลองใหม่เมื่อออนไลน์');
    const key = 'admin:write:setInquiryStatus:' + identity + ':' + args.filter(a => typeof a === 'string').join(':');
    if (!DE06.lock(key)) return;
    try { return await perform_setInquiryStatus(...args); } finally { DE06.unlock(key); DE06.invalidate('admin:'); }
  }
  async function perform_setInquiryStatus(docId, newStatus) {
    if (!isAdminAuthenticated) return alert('กรุณาเข้าสู่ระบบก่อนทำรายการ');
    try {
      const inq = allInquiriesList.find(x => x.id === docId);
      const collName = (inq && inq.sourceColl) ? inq.sourceColl : 'inquiries';
      try {
        await db.collection(collName).doc(docId).update({
          status: newStatus,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (errUp) {
        const altColl = collName === 'inquiries' ? 'dynamic_submissions' : 'inquiries';
        await db.collection(altColl).doc(docId).update({
          status: newStatus,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      showGlobalToast('อัปเดตสถานะข้อความเรียบร้อย', 'success');
      recordAuditLog('เปลี่ยนสถานะข้อความสอบถาม', 'เปลี่ยนสถานะข้อความสอบถาม #' + docId + ' เป็น ' + (newStatus === 'resolved' ? 'ตอบกลับแล้ว' : 'รอดำเนินการ'));
      loadInquiriesData();
    } catch(e) {
      alert('ไม่สามารถอัปเดตสถานะได้: ' + e.message);
    }
  }

  async function deleteInquiry(...args) {
    if (args[0] && typeof args[0].preventDefault === 'function') args[0].preventDefault();
    const identity = currentAdminId;
    if (!isAdminAuthenticated) return;
    if (!navigator.onLine) return alert('ไม่มีการเชื่อมต่ออินเทอร์เน็ต กรุณาลองใหม่เมื่อออนไลน์');
    const key = 'admin:write:deleteInquiry:' + identity + ':' + args.filter(a => typeof a === 'string').join(':');
    if (!DE06.lock(key)) return;
    try { return await perform_deleteInquiry(...args); } finally { DE06.unlock(key); DE06.invalidate('admin:'); }
  }
  async function perform_deleteInquiry(docId) {
    if (!isAdminAuthenticated) return alert('กรุณาเข้าสู่ระบบก่อนทำรายการ');
    if (!confirm('ยืนยันที่จะลบข้อความสอบถามนี้ใช่หรือไม่?')) return;
    try {
      const inq = allInquiriesList.find(x => x.id === docId);
      const collName = (inq && inq.sourceColl) ? inq.sourceColl : 'inquiries';
      try {
        await db.collection(collName).doc(docId).delete();
      } catch (errDel) {
        const altColl = collName === 'inquiries' ? 'dynamic_submissions' : 'inquiries';
        await db.collection(altColl).doc(docId).delete();
      }
      showGlobalToast('ลบข้อความสอบถามเรียบร้อย', 'success');
      recordAuditLog('ลบข้อความสอบถาม', 'ลบข้อความสอบถาม #' + docId);
      loadInquiriesData();
    } catch(e) {
      alert('เกิดข้อผิดพลาดในการลบ: ' + e.message);
    }
  }

  // =============================================
  //  Multi-Admin Student Management & Action Audit Logging
  // =============================================
  async function recordAuditLog(action, details) {
    const logEntry = {
      action: action,
      details: details,
      adminId: currentAdminId || 'master',
      adminName: currentAdminName || 'แอดมินหลัก',
      role: currentAdminRole || 'master',
      timestampMs: Date.now(),
      formattedTime: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })
    };

    try {
      const localLogs = JSON.parse(DE06.storage.getItem('de06_audit_logs') || '[]');
      localLogs.unshift(logEntry);
      if (localLogs.length > 200) localLogs.pop();
      DE06.storage.setItem('de06_audit_logs', JSON.stringify(localLogs));
    } catch (e) {}

    try {
      await db.collection('admin_audit_logs').add({
        ...logEntry,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (errColl) {
      console.warn('Audit log collection write notice:', errColl.message);
    }

    try {
      const docRef = db.collection('config').doc('audit_logs');
      const docSnap = await docRef.get();
      let existing = [];
      if (docSnap.exists && Array.isArray(docSnap.data().logs)) {
        existing = docSnap.data().logs;
      }
      existing.unshift(logEntry);
      if (existing.length > 100) existing = existing.slice(0, 100);
      await docRef.set({ logs: existing }, { merge: true });
    } catch (errDoc) {
      console.warn('Audit log doc write notice:', errDoc.message);
    }
  }

  async function lookupStudentNameForAdmin(studentId) {
    const cleanId = (studentId || '').trim();
    const nameInput = document.getElementById('newAdminStudentName');
    const msgEl = document.getElementById('newAdminLookupMsg');
    if (!cleanId) {
      if (msgEl) msgEl.innerText = '';
      return;
    }
    if (cleanId.length < 5) return;

    if (msgEl) msgEl.innerText = 'กำลังค้นหารายชื่อ...';

    const cached = DE06.storage.getItem('de06_student_' + cleanId);
    if (cached) {
      try {
        const c = JSON.parse(cached);
        if (c.name) {
          if (nameInput) nameInput.value = c.name;
          if (msgEl) msgEl.innerHTML = '<span style="color:#15803d;">พบชื่อ: ' + escapeHtml(c.name) + '</span>';
          return;
        }
      } catch (e) {}
    }

    try {
      const snap = await db.collection('students').doc(cleanId).get();
      if (snap.exists && snap.data().name) {
        const name = snap.data().name;
        if (nameInput) nameInput.value = name;
        if (msgEl) msgEl.innerHTML = '<span style="color:#15803d;">พบข้อมูล: ' + escapeHtml(name) + '</span>';
      } else {
        if (msgEl) msgEl.innerHTML = '<span style="color:#64748b;">ไม่พบในรายชื่อนักศึกษา สามารถระบุชื่อเองได้</span>';
      }
    } catch (err) {
      if (msgEl) msgEl.innerHTML = '<span style="color:#64748b;">สามารถกรอกชื่อ-สกุลด้วยตนเองได้</span>';
    }
  }

  async function addStudentAdmin(...args) {
    if (args[0] && typeof args[0].preventDefault === 'function') args[0].preventDefault();
    const identity = currentAdminId;
    if (!isAdminAuthenticated) return;
    if (!navigator.onLine) return alert('ไม่มีการเชื่อมต่ออินเทอร์เน็ต กรุณาลองใหม่เมื่อออนไลน์');
    const key = 'admin:write:addStudentAdmin:' + identity + ':' + args.filter(a => typeof a === 'string').join(':');
    if (!DE06.lock(key)) return;
    try { return await perform_addStudentAdmin(...args); } finally { DE06.unlock(key); DE06.invalidate('admin:'); }
  }
  async function perform_addStudentAdmin() {
    if (currentAdminRole !== 'master') {
      alert('เฉพาะแอดมินหลักเดิมเท่านั้นที่สามารถเพิ่มแอดมินได้');
      return;
    }

    const studentId = document.getElementById('newAdminStudentId').value.trim();
    const studentName = document.getElementById('newAdminStudentName').value.trim();

    if (!studentId) {
      alert('กรุณากรอกรหัสนักศึกษา');
      return;
    }
    if (!studentName) {
      alert('กรุณากรอกชื่อ-สกุลนักศึกษา');
      return;
    }

    if (!appConfig.ADMIN_STUDENTS) appConfig.ADMIN_STUDENTS = [];

    const exists = appConfig.ADMIN_STUDENTS.some(a => a.studentId === studentId);
    if (exists) {
      alert('รหัสนักศึกษานี้มีสิทธิ์เป็นแอดมินอยู่แล้ว');
      return;
    }

    const newAdmin = {
      studentId: studentId,
      name: studentName,
      addedAt: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
      addedBy: currentAdminName || 'แอดมินหลัก'
    };



    showGlobalToast('กำลังบันทึกแอดมินใหม่...', 'loading');
    try {
      const configRef = db.collection('config').doc('main');
      await db.runTransaction(async transaction => {
        const doc = await transaction.get(configRef);
        if (!isAdminAuthenticated || currentAdminRole !== 'master') throw new Error('สิทธิ์ผู้ดูแลเปลี่ยนแล้ว');
        const config = doc.exists ? doc.data() : {};
        const admins = Array.isArray(config.ADMIN_STUDENTS) ? config.ADMIN_STUDENTS : [];
        if (admins.some(admin => admin.studentId === studentId)) throw new Error('นักศึกษานี้เป็นผู้ดูแลอยู่แล้ว กรุณาดึงข้อมูลล่าสุด');
        transaction.set(configRef, { ADMIN_STUDENTS: admins.concat(newAdmin) }, { merge: true });
      });
      const savedConfig = await configRef.get(); appConfig = savedConfig.data() || appConfig; loadedConfigDocument = DE06.fingerprint(appConfig);

      await recordAuditLog('เพิ่มผู้ดูแลระบบ', 'เพิ่มนักศึกษา ' + studentId + ' (' + studentName + ') เป็นแอดมินร่วม');

      showGlobalToast('เพิ่มนักศึกษาเป็นแอดมินเรียบร้อย', 'success');
      document.getElementById('newAdminStudentId').value = '';
      document.getElementById('newAdminStudentName').value = '';
      document.getElementById('newAdminLookupMsg').innerText = '';
      renderStudentAdminsList();
    } catch (e) {
      alert('เกิดข้อผิดพลาด: ' + e.message);
    }
  }

  async function removeStudentAdmin(...args) {
    if (args[0] && typeof args[0].preventDefault === 'function') args[0].preventDefault();
    const identity = currentAdminId;
    if (!isAdminAuthenticated) return;
    if (!navigator.onLine) return alert('ไม่มีการเชื่อมต่ออินเทอร์เน็ต กรุณาลองใหม่เมื่อออนไลน์');
    const key = 'admin:write:removeStudentAdmin:' + identity + ':' + args.filter(a => typeof a === 'string').join(':');
    if (!DE06.lock(key)) return;
    try { return await perform_removeStudentAdmin(...args); } finally { DE06.unlock(key); DE06.invalidate('admin:'); }
  }
  async function perform_removeStudentAdmin(studentId) {
    if (currentAdminRole !== 'master') {
      alert('เฉพาะแอดมินหลักเดิมเท่านั้นที่สามารถลบแอดมินได้');
      return;
    }

    const targetAdmin = (appConfig.ADMIN_STUDENTS || []).find(a => a.studentId === studentId);
    const targetName = targetAdmin ? targetAdmin.name : studentId;

    if (!confirm('ยืนยันที่จะยกเลิกสิทธิ์แอดมินของ ' + studentId + ' (' + targetName + ') ใช่หรือไม่?')) {
      return;
    }



    showGlobalToast('กำลังยกเลิกสิทธิ์แอดมิน...', 'loading');
    try {
      const configRef = db.collection('config').doc('main');
      await db.runTransaction(async transaction => {
        const doc = await transaction.get(configRef);
        if (!isAdminAuthenticated || currentAdminRole !== 'master') throw new Error('สิทธิ์ผู้ดูแลเปลี่ยนแล้ว');
        const config = doc.exists ? doc.data() : {};
        const admins = Array.isArray(config.ADMIN_STUDENTS) ? config.ADMIN_STUDENTS : [];
        transaction.set(configRef, { ADMIN_STUDENTS: admins.filter(admin => admin.studentId !== studentId) }, { merge: true });
      });
      const savedConfig = await configRef.get(); appConfig = savedConfig.data() || appConfig; loadedConfigDocument = DE06.fingerprint(appConfig);

      await recordAuditLog('ลบผู้ดูแลระบบ', 'ยกเลิกสิทธิ์แอดมินของนักศึกษา ' + studentId + ' (' + targetName + ')');

      showGlobalToast('ยกเลิกสิทธิ์แอดมินเรียบร้อย', 'success');
      renderStudentAdminsList();
    } catch (e) {
      alert('เกิดข้อผิดพลาด: ' + e.message);
    }
  }

  function renderStudentAdminsList() {
    const container = document.getElementById('studentAdminsTableContainer');
    if (!container) return;

    const list = appConfig.ADMIN_STUDENTS || [];
    if (list.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:1.875rem; color:#64748b; background:#f8fafc; border-radius:0.75rem; border:1px dashed #cbd5e1;">ยังไม่มีนักศึกษาที่ได้รับสิทธิ์เป็นแอดมิน สามารถเพิ่มได้จากแบบฟอร์มด้านบน</div>';
      return;
    }

    let rows = '';
    list.forEach((admin, idx) => {
      rows += `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 0.75rem 0.875rem; text-align: center; color: #64748b;">${idx + 1}</td>
          <td style="padding: 0.75rem 0.875rem; font-weight: 700; color: var(--main-blue); white-space: nowrap;">${escapeHtml(admin.studentId)}</td>
          <td style="padding: 0.75rem 0.875rem; font-weight: 400; color: #1e293b;">${escapeHtml(admin.name)}</td>
          <td style="padding: 0.75rem 0.875rem; color: #64748b; font-size: 0.8125rem; white-space: nowrap;">${escapeHtml(admin.addedAt || '-')}</td>
          <td style="padding: 0.75rem 0.875rem; color: #64748b; font-size: 0.8125rem;">${escapeHtml(admin.addedBy || 'แอดมินหลัก')}</td>
          <td style="padding: 0.75rem 0.875rem; text-align: center;">
            <button class="btn-danger btn-sm" onclick="removeStudentAdmin(${DE06.arg(admin.studentId)})">ยกเลิกสิทธิ์</button>
          </td>
        </tr>
      `;
    });

    container.innerHTML = `
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.875rem; background: white; border-radius: 0.75rem; overflow: hidden; border: 1px solid #e2e8f0;">
          <thead>
            <tr style="background: #f8fafc; color: #475569; font-weight: 700; border-bottom: 0.125rem solid #e2e8f0;">
              <th style="padding: 0.75rem 0.875rem; text-align: center; width: 3.125rem;">ลำดับ</th>
              <th style="padding: 0.75rem 0.875rem; width: 10rem;">รหัสนักศึกษา</th>
              <th style="padding: 0.75rem 0.875rem;">ชื่อ-สกุล</th>
              <th style="padding: 0.75rem 0.875rem; width: 10.625rem;">วันที่เพิ่มสิทธิ์</th>
              <th style="padding: 0.75rem 0.875rem; width: 8.75rem;">ผู้เพิ่มสิทธิ์</th>
              <th style="padding: 0.75rem 0.875rem; text-align: center; width: 6.875rem;">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  async function loadAdminAuditLogs() {
    if (!isAdminAuthenticated) return;
    const identity = currentAdminId;
    return DE06.request('admin:loadAdminAuditLogs:' + identity, () => { if (isAdminAuthenticated && identity === currentAdminId) return read_loadAdminAuditLogs(); }, 30000);
  }
  async function read_loadAdminAuditLogs() {
    if (!isAdminAuthenticated || currentAdminRole !== 'master') return;
    const identity = currentAdminId; const epoch = initialGeneration;
    const container = document.getElementById('adminAuditLogsContainer');
    if (!container) return;
    if (!isAdminAuthenticated || identity !== currentAdminId || epoch !== initialGeneration) return;
    container.innerHTML = '<div style="text-align:center; padding:1.875rem; color:#64748b;"><div class="loading-spinner" style="margin:0 auto 0.625rem auto; width:1.75rem; height:1.75rem; border-width:0.1875rem;"></div>กำลังดึงข้อมูลประวัติการแก้ไข...</div>';

    let allLogs = [];

    try {
      const docSnap = await db.collection('config').doc('audit_logs').get();
        if (!isAdminAuthenticated || identity !== currentAdminId || epoch !== initialGeneration) return;
      if (docSnap.exists && Array.isArray(docSnap.data().logs)) {
        allLogs = docSnap.data().logs;
      }
    } catch (errConfig) {
      console.warn('Load audit logs from config doc:', errConfig.message);
    }

    if (allLogs.length === 0) {
      try {
        const snap = await db.collection('admin_audit_logs').orderBy('timestamp', 'desc').limit(100).get();
        if (!isAdminAuthenticated || identity !== currentAdminId || epoch !== initialGeneration) return;
        snap.forEach(doc => {
          const d = doc.data();
          const timeStr = d.formattedTime || (d.timestamp ? d.timestamp.toDate().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : '-');
          allLogs.push({
            id: doc.id,
            action: d.action || 'แก้ไขข้อมูล',
            details: d.details || '-',
            adminId: d.adminId || 'ไม่ระบุ',
            adminName: d.adminName || 'ไม่ระบุ',
            role: d.role || 'subadmin',
            formattedTime: timeStr,
            timestampMs: d.timestampMs || (d.timestamp ? d.timestamp.toMillis() : Date.now())
          });
        });
      } catch (errColl) {
        console.warn('Load audit logs from collection notice:', errColl.message);
      }
    }

    try {
      const localLogs = JSON.parse(DE06.storage.getItem('de06_audit_logs') || '[]');
      if (Array.isArray(localLogs) && localLogs.length > 0) {
        const existingKeys = new Set(allLogs.map(l => (l.formattedTime || '') + '_' + (l.action || '') + '_' + (l.adminId || '')));
        localLogs.forEach(l => {
          const key = (l.formattedTime || '') + '_' + (l.action || '') + '_' + (l.adminId || '');
          if (!existingKeys.has(key)) {
            allLogs.push(l);
          }
        });
      }
    } catch (e) {}

    allLogs.sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0));
    allLogs = allLogs.slice(0, 100);

    if (allLogs.length === 0) {
      if (!isAdminAuthenticated || identity !== currentAdminId || epoch !== initialGeneration) return;
      container.innerHTML = '<div style="text-align:center; padding:1.875rem; color:#64748b; background:#f8fafc; border-radius:0.75rem; border:1px dashed #cbd5e1;">ยังไม่มีประวัติการแก้ไขในระบบ</div>';
      return;
    }

    let rows = '';
    allLogs.forEach((log, idx) => {
      const roleBadge = log.role === 'master' ?
        '<span style="background:#eff6ff; color:#1d4ed8; padding:0.1875rem 0.5rem; border-radius:0.375rem; font-size:0.75rem; font-weight:700;">แอดมินหลัก</span>' :
        '<span style="background:#f0fdf4; color:#15803d; padding:0.1875rem 0.5rem; border-radius:0.375rem; font-size:0.75rem; font-weight:700;">นักศึกษาผู้ดูแล</span>';

      rows += `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 0.75rem 0.875rem; text-align: center; color: #64748b;">${idx + 1}</td>
          <td style="padding: 0.75rem 0.875rem; font-weight: 400; color: #1e293b; white-space: nowrap;">${escapeHtml(log.formattedTime || '-')}</td>
          <td style="padding: 0.75rem 0.875rem;">
            <div style="font-weight:700; color:var(--main-blue);">${escapeHtml(log.adminName || 'ไม่ระบุ')}</div>
            <div style="font-size:0.75rem; color:#64748b;">${escapeHtml(log.adminId || '')}</div>
          </td>
          <td style="padding: 0.75rem 0.875rem; text-align: center;">${roleBadge}</td>
          <td style="padding: 0.75rem 0.875rem; font-weight: 400; color: #0f172a; white-space: nowrap;">${escapeHtml(log.action || '-')}</td>
          <td style="padding: 0.75rem 0.875rem; color: #334155; font-size: 0.8125rem;">${escapeHtml(log.details || '-')}</td>
        </tr>
      `;
    });

    if (!isAdminAuthenticated || identity !== currentAdminId || epoch !== initialGeneration) return;

    container.innerHTML = `
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.875rem; background: white; border-radius: 0.75rem; overflow: hidden; border: 1px solid #e2e8f0;">
          <thead>
            <tr style="background: #f8fafc; color: #475569; font-weight: 700; border-bottom: 0.125rem solid #e2e8f0;">
              <th style="padding: 0.75rem 0.875rem; text-align: center; width: 3.125rem;">ลำดับ</th>
              <th style="padding: 0.75rem 0.875rem; width: 10.625rem;">วัน-เวลา</th>
              <th style="padding: 0.75rem 0.875rem; width: 11.25rem;">ผู้ทำรายการ</th>
              <th style="padding: 0.75rem 0.875rem; text-align: center; width: 7.5rem;">สิทธิ์</th>
              <th style="padding: 0.75rem 0.875rem; width: 11.25rem;">กิจกรรมที่ทำ</th>
              <th style="padding: 0.75rem 0.875rem;">รายละเอียด</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
      DE06.paginate(container);
  }

  async function loadAdminLogs() {
    if (!isAdminAuthenticated) return;
    const identity = currentAdminId;
    return DE06.request('admin:loadAdminLogs:' + identity, () => { if (isAdminAuthenticated && identity === currentAdminId) return read_loadAdminLogs(); }, 30000);
  }
  async function read_loadAdminLogs() {
    if (!isAdminAuthenticated) return;
    const identity = currentAdminId; const epoch = initialGeneration;
    const container = document.getElementById('adminLogsContainer');
    if (!container) return;
    if (!isAdminAuthenticated || identity !== currentAdminId || epoch !== initialGeneration) return;
    container.innerHTML = '<div style="text-align:center; padding:1.875rem; color:#64748b;"><div class="loading-spinner" style="margin:0 auto 0.625rem auto; width:1.75rem; height:1.75rem; border-width:0.1875rem;"></div>กำลังดึงข้อมูลประวัติ...</div>';

    let allLogs = [];

    // 1. Read from config/admin_logs doc (Safe & Always permitted)
    try {
      const docSnap = await db.collection('config').doc('admin_logs').get();
        if (!isAdminAuthenticated || identity !== currentAdminId || epoch !== initialGeneration) return;
      if (docSnap.exists && Array.isArray(docSnap.data().logs)) {
        allLogs = docSnap.data().logs;
      }
    } catch (errConfig) {
      console.warn('Load logs from config doc:', errConfig.message);
    }

    // 2. Read from admin_logs collection if available
    if (allLogs.length === 0) {
      try {
        const snap = await db.collection('admin_logs').orderBy('timestamp', 'desc').limit(50).get();
        if (!isAdminAuthenticated || identity !== currentAdminId || epoch !== initialGeneration) return;
        snap.forEach(doc => {
          const d = doc.data();
          const timeStr = d.formattedTime || (d.timestamp ? d.timestamp.toDate().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : '-');
          allLogs.push({
            id: doc.id,
            ip: d.ip || 'ไม่ระบุ',
            device: d.device || d.userAgent || 'ไม่ระบุ',
            status: d.status || 'success',
            formattedTime: timeStr,
            timestampMs: d.timestampMs || (d.timestamp ? d.timestamp.toMillis() : Date.now())
          });
        });
      } catch (errColl) {
        // Silently ignore collection permission error and fallback to localStorage
      }
    }

    // 3. Merge with local storage logs
    try {
      const localLogs = JSON.parse(DE06.storage.getItem('de06_admin_logs') || '[]');
      if (Array.isArray(localLogs) && localLogs.length > 0) {
        const existingKeys = new Set(allLogs.map(l => (l.formattedTime || '') + '_' + (l.ip || '')));
        localLogs.forEach(l => {
          const key = (l.formattedTime || '') + '_' + (l.ip || '');
          if (!existingKeys.has(key)) {
            allLogs.push(l);
          }
        });
      }
    } catch (e) {}

    // Sort by timestamp descending
    allLogs.sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0));
    allLogs = allLogs.slice(0, 50);

    if (allLogs.length === 0) {
      if (!isAdminAuthenticated || identity !== currentAdminId || epoch !== initialGeneration) return;
      container.innerHTML = '<div style="text-align:center; padding:1.875rem; color:#64748b; background:#f8fafc; border-radius:0.75rem; border:1px dashed #cbd5e1;">ยังไม่มีประวัติการเข้าใช้งานในระบบ</div>';
      return;
    }

    let rows = '';
    let count = 1;
    allLogs.forEach(d => {
      const timeStr = d.formattedTime || '-';
      const ipStr = d.ip || 'ไม่ระบุ';
      const deviceStr = d.device || d.userAgent || 'ไม่ระบุ';
      const statusBadge = d.status === 'success' ?
        '<span style="background:#dcfce7; color:#15803d; padding:0.1875rem 0.5rem; border-radius:0.375rem; font-size:0.75rem; font-weight: 400;">เข้าสู่ระบบสำเร็จ</span>' :
        '<span style="background:#fee2e2; color:#b91c1c; padding:0.1875rem 0.5rem; border-radius:0.375rem; font-size:0.75rem; font-weight: 400;">รหัสผ่านไม่ถูกต้อง</span>';

      rows += `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 0.75rem 0.875rem; text-align: center; color: #64748b;">${count++}</td>
          <td style="padding: 0.75rem 0.875rem; font-weight: 400; color: #1e293b; white-space: nowrap;">${escapeHtml(timeStr)}</td>
          <td style="padding: 0.75rem 0.875rem; font-family: monospace; font-size: 0.8125rem; color: var(--main-blue); font-weight: 400; white-space: nowrap;">${escapeHtml(ipStr)}</td>
          <td style="padding: 0.75rem 0.875rem; color: #334155; font-size: 0.8125rem;">${escapeHtml(deviceStr)}</td>
          <td style="padding: 0.75rem 0.875rem; text-align: center;">${statusBadge}</td>
        </tr>
      `;
    });

    if (!isAdminAuthenticated || identity !== currentAdminId || epoch !== initialGeneration) return;

    container.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.875rem; background: white; border-radius: 0.75rem; overflow: hidden; border: 1px solid #e2e8f0;">
        <thead>
          <tr style="background: #f8fafc; color: #475569; font-weight: 700; border-bottom: 0.125rem solid #e2e8f0;">
            <th style="padding: 0.75rem 0.875rem; text-align: center; width: 3.125rem;">ลำดับ</th>
            <th style="padding: 0.75rem 0.875rem; width: 11.25rem;">วัน-เวลา</th>
            <th style="padding: 0.75rem 0.875rem; width: 9.375rem;">IP Address</th>
            <th style="padding: 0.75rem 0.875rem;">ชื่อรุ่น / ชื่อเครื่อง / อุปกรณ์</th>
            <th style="padding: 0.75rem 0.875rem; text-align: center; width: 8.125rem;">สถานะ</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
      DE06.paginate(container);
  }

  DE06.bindDialog(document.getElementById('imagePreviewModal'), closeImageModal);
