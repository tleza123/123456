/* Shared, dependency-free browser utilities. No private data is persisted here. */
(function (global) {
  'use strict';
  const pending = new Map();
  const cached = new Map();
  const locks = new Set();
  function storage(name) {
    const memory = new Map();
    return {
      getItem(key) { try { return global[name].getItem(key) ?? memory.get(key) ?? null; } catch { return memory.get(key) ?? null; } },
      setItem(key, value) { memory.set(key, String(value)); try { global[name].setItem(key, value); } catch {} },
      removeItem(key) { memory.delete(key); try { global[name].removeItem(key); } catch {} }
    };
  }
  const runtime = {
    scrollTop: 0,
    storage: storage('localStorage'), session: storage('sessionStorage'),
    fingerprint(value) { return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item); },
    stripEmojis(value) { return String(value ?? '').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, ''); },
    read(key, validate) {
      try { const value = JSON.parse(localStorage.getItem(key)); return validate(value) ? value : null; } catch { return null; }
    },
    write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage can be unavailable or full. */ } },
    request(key, work, ttl = 0, force = false) {
      if (pending.has(key)) return pending.get(key);
      const previous = cached.get(key);
      if (!force && previous && Date.now() - previous.time < ttl) return Promise.resolve(previous.value);
      const promise = Promise.resolve().then(work).then(value => { if (ttl && pending.get(key) === promise) cached.set(key, { value, time: Date.now() }); return value; }).finally(() => { if (pending.get(key) === promise) pending.delete(key); });
      pending.set(key, promise); return promise;
    },
    invalidate(prefix) { for (const map of [cached, pending]) for (const key of map.keys()) if (key.startsWith(prefix)) map.delete(key); },
    lock(key) { if (locks.has(key)) return false; locks.add(key); return true; },
    unlock(key) { locks.delete(key); },
    async allDocuments(collection, pageSize = 200, alreadyOrdered = false, requireServer = false) {
      let cursor = null; const docs = []; let fromCache = false;
      for (;;) {
        let query = (alreadyOrdered ? collection : collection.orderBy(firebase.firestore.FieldPath.documentId())).limit(pageSize);
        if (cursor) query = query.startAfter(cursor);
        const page = await query.get(requireServer ? { source: 'server' } : undefined);
        fromCache = fromCache || !!page.metadata?.fromCache;
        docs.push(...page.docs);
        if (page.size < pageSize) break;
        cursor = page.docs[page.docs.length - 1];
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      return { docs, size: docs.length, fromCache, forEach: callback => docs.forEach(callback) };
    },
    skeleton(count = 3) {
      return '<div class="data-skeleton" aria-hidden="true">' + Array.from({ length: count }, () => '<div class="skeleton-card"><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div></div>').join('') + '</div>';
    },
    safeUrl(value, image = false) {
      if (typeof value !== 'string' || !value.trim()) return '';
      if (image && /^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(value)) return value;
      try { const url = new URL(value, location.href); return ['http:', 'https:'].includes(url.protocol) || (image && url.protocol === 'blob:' && url.origin === location.origin) ? url.href : ''; } catch { return ''; }
    },
    escape(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); },
    arg(value) { return runtime.escape(JSON.stringify(String(value ?? ''))); },
    image(value) { return runtime.escape(runtime.safeUrl(value, true)); },
    dimensions(width, height) { return Number.isFinite(Number(width)) && Number.isFinite(Number(height)) && Number(width) > 0 && Number(height) > 0 ? ' width="' + Math.round(Number(width)) + '" height="' + Math.round(Number(height)) + '"' : ''; },
    bindDialog(element, close) {
      if (!element) return;
      element.setAttribute('role', 'dialog'); element.setAttribute('aria-modal', 'true'); element.tabIndex = -1;
      let open = false, previous;
      const focusable = () => Array.from(element.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]')).filter(node => node.getClientRects().length && !node.disabled);
      new MutationObserver(() => {
        const visible = element.style.display === 'flex';
        if (visible === open) return;
        open = visible;
        if (open) { previous = document.activeElement; (focusable()[0] || element).focus({ preventScroll: true }); }
        else if (previous?.isConnected) previous.focus({ preventScroll: true });
      }).observe(element, { attributes: true, attributeFilter: ['style'] });
      element.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); close(); }
        if (event.key !== 'Tab') return;
        const nodes = focusable(); const first = nodes[0] || element; const last = nodes[nodes.length - 1] || element;
        if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === element)) { event.preventDefault(); first.focus(); }
      });
    },
    async compress(file, maxDimension = 1600, quality = .85) {
      if (!file || !/^image\/(jpeg|png|webp|gif)$/.test(file.type) || file.size > 12 * 1024 * 1024) throw new Error('กรุณาเลือกภาพขนาดไม่เกิน 12 MB');
      const url = URL.createObjectURL(file); const image = new Image();
      try {
        await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('ไฟล์ภาพไม่ถูกต้อง')); image.src = url; });
        if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 50000000) throw new Error('ภาพมีขนาดใหญ่เกินไป');
        const ratio = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio)); canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
        const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return { dataUrl: canvas.toDataURL('image/jpeg', quality), width: canvas.width, height: canvas.height, mimeType: 'image/jpeg' };
      } finally { URL.revokeObjectURL(url); }
    },
    paginate(container, size = 50) {
      const body = container?.querySelector('tbody');
      if (!body || body.children.length <= size) return;
      const rows = Array.from(body.children); let page = 0;
      const pager = document.createElement('div'); pager.className = 'pager';
      const previous = document.createElement('button'); previous.textContent = 'ก่อนหน้า'; previous.type = 'button'; previous.className = 'btn-secondary';
      const next = document.createElement('button'); next.textContent = 'ถัดไป'; next.type = 'button'; next.className = 'btn-secondary';
      const label = document.createElement('span');
      function render() { body.replaceChildren(...rows.slice(page * size, (page + 1) * size)); previous.disabled = page === 0; next.disabled = (page + 1) * size >= rows.length; label.textContent = 'หน้า ' + (page + 1) + ' / ' + Math.ceil(rows.length / size); }
      previous.onclick = () => { page--; render(); }; next.onclick = () => { page++; render(); };
      pager.append(previous, label, next); container.appendChild(pager); render();
    },
    async api(url, action, payload = {}, retries = 0) {
      for (let attempt = 0; ; attempt++) {
        const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 20000);
        try {
          const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, ...payload }), signal: controller.signal });
          if (!response.ok) throw new Error('การเชื่อมต่อล้มเหลว');
          let result;
          try { result = await response.json(); } catch { throw new Error('ยังยืนยันผลการส่งข้อมูลไม่ได้'); }
          if (!result || result.success !== true) throw new Error(result?.message || 'ระบบปลายทางยังไม่ยืนยันผลสำเร็จ');
          return result;
        } catch (error) {
          if (attempt >= retries) throw error;
          await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
        } finally { clearTimeout(timeout); }
      }
    }
  };
  global.DE06 = runtime;
  global.addEventListener('scroll', () => { runtime.scrollTop = global.scrollY; }, { passive: true });
  document.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('img[role="button"], .poll-option-card[role="button"]')) { event.preventDefault(); event.target.click(); }
  });
})(window);

// Product orders retain their own price snapshot; legacy shirt calculations remain independent.
DE06.productOptions = value => [...new Set((Array.isArray(value) ? value : String(value || '').split(',')).map(x => String(x).trim()).filter(Boolean))].slice(0, 50);
DE06.productQuote = (product, selection, quantity, requireSelection = true) => {
  const price = Number(product.price), extra = Number(product.customSizePrice || 0);
  const sale = product.salePrice === '' || product.salePrice == null ? null : Number(product.salePrice);
  const maximum = Number(product.maxQuantity || 99);
  if (!Number.isFinite(price) || price < 0 || !Number.isFinite(extra) || extra < 0 || (sale !== null && (!Number.isFinite(sale) || sale < 0 || sale > price)) || !Number.isInteger(maximum) || maximum < 1 || maximum > 999) throw new Error('กรุณาตรวจสอบราคาและจำนวนสูงสุดของสินค้า');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > maximum) throw new Error('จำนวนสินค้าไม่ถูกต้อง');
  if (requireSelection) ['designs', 'colors', 'sizes'].forEach(key => {
    const options = DE06.productOptions(product[key]);
    if (key === 'sizes' && product.hasCustomSize) options.push('ไซส์พิเศษ');
    if (options.length && !options.includes(selection[key])) throw new Error('กรุณาเลือกแบบ สี และไซส์ให้ครบ');
  });
  const unitPrice = Math.round(((sale ?? price) + (selection.sizes === 'ไซส์พิเศษ' && product.hasCustomSize ? extra : 0)) * 100) / 100;
  return { unitPrice, totalPrice: Math.round(unitPrice * quantity * 100) / 100, quantity };
};
