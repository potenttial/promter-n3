/* Comedor Torre Vrick — App (mobile first)
   Desarrollado por N3 Labs · Thinktech IA Laboratory */
(function () {
  const C = window.Core, CFG = window.COMEDOR_CONFIG || {};
  const REMOTE = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
  const LS = 'tv_comedor_kv_v3', LS_USER = 'tv_comedor_user';
  const TEL_CHEF = CFG.TEL_CHEF || '525524962677', TEL_DIR = CFG.TEL_DIRECTOR || '525554054868';
  const TAGS = ['Sin picante', 'Vegetariano', 'Sin cebolla', 'Porción chica', 'Sin gluten', 'Sin lácteos'];
  const CATS = ['Sopa', 'Plato fuerte', 'Guarnición', 'Bebida', 'Postre', 'Acompañamiento'];
  const CATL = { 'Sopa': 'Sopa / entrada', 'Plato fuerte': 'Guisado del día', 'Guarnición': 'Guarnición', 'Bebida': 'Agua del día', 'Postre': 'Postre', 'Acompañamiento': 'Acompañamiento' };
  const catL = c => CATL[c] || c;
  let KV = {}, S = C.emptyState();
  const UI = { week: 0, chefTab: 'hoy', chefDay: null, menuWeek: 0, buyRange: 'man', editRec: null, dirPeriod: 'sem', showList: false };
  const $app = document.getElementById('app');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = () => C.iso(new Date());
  const uidGen = () => Math.random().toString(36).slice(2, 10);
  const st = () => C.set(S);

  /* ---------------- Almacenamiento ---------------- */
  const H = () => ({ apikey: CFG.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + CFG.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' });
  async function remoteAll() {
    const out = {}; let from = 0;
    for (;;) {
      const r = await fetch(`${CFG.SUPABASE_URL}/rest/v1/kv?select=key,value&order=key&key=not.like.ticketimg*`, { headers: { ...H(), Range: `${from}-${from + 999}` } });
      if (!r.ok) throw new Error('Supabase ' + r.status);
      const rows = await r.json(); rows.forEach(x => out[x.key] = x.value);
      if (rows.length < 1000) break; from += 1000;
    }
    return out;
  }
  async function kvSet(k, v) {
    if (v === null) delete KV[k]; else KV[k] = v;
    C.applyKV(S, k, v);
    if (REMOTE) {
      try {
        if (v === null) await fetch(`${CFG.SUPABASE_URL}/rest/v1/kv?key=eq.${encodeURIComponent(k)}`, { method: 'DELETE', headers: H() });
        else await fetch(`${CFG.SUPABASE_URL}/rest/v1/kv`, { method: 'POST', headers: { ...H(), Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ key: k, value: v }) });
      } catch (e) { toast('Sin conexión: el cambio no se guardó'); }
    } else localStorage.setItem(LS, JSON.stringify(KV));
  }
  /* Fotos de tickets: IndexedDB en este equipo, o Supabase en modo compartido */
  const IDB = () => new Promise((ok, ko) => { const r = indexedDB.open('tv_comedor_img', 1); r.onupgradeneeded = () => r.result.createObjectStore('img'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
  async function imgPut(id, data) {
    if (REMOTE) return fetch(`${CFG.SUPABASE_URL}/rest/v1/kv`, { method: 'POST', headers: { ...H(), Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ key: 'ticketimg:' + id, value: data }) });
    const db = await IDB(); return new Promise(ok => { const t = db.transaction('img', 'readwrite'); t.objectStore('img').put(data, id); t.oncomplete = ok; });
  }
  const imgCache = {};
  async function imgGet(id) {
    if (imgCache[id]) return imgCache[id];
    try {
      if (REMOTE) { const r = await fetch(`${CFG.SUPABASE_URL}/rest/v1/kv?select=value&key=eq.ticketimg:${id}`, { headers: H() }); const j = await r.json(); return imgCache[id] = j[0]?.value || null; }
      const db = await IDB(); return imgCache[id] = await new Promise(ok => { const q = db.transaction('img').objectStore('img').get(id); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null); });
    } catch (e) { return null; }
  }
  async function imgDel(id) {
    delete imgCache[id];
    if (REMOTE) return fetch(`${CFG.SUPABASE_URL}/rest/v1/kv?key=eq.ticketimg:${id}`, { method: 'DELETE', headers: H() });
    const db = await IDB(); db.transaction('img', 'readwrite').objectStore('img').delete(id);
  }
  function hydrateImgs() { document.querySelectorAll('img[data-img]').forEach(async el => { const d = await imgGet(el.dataset.img); if (d) { el.src = d; el.classList.add('ok'); } }); }
  // Reduce la foto (máx. 1200 px, JPEG) para que se guarde rápido
  const shrink = file => new Promise((ok, ko) => {
    const im = new Image(); const url = URL.createObjectURL(file);
    im.onload = () => { const k = Math.min(1, 1200 / Math.max(im.width, im.height)); const cv = document.createElement('canvas'); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url); ok(cv.toDataURL('image/jpeg', 0.7)); };
    im.onerror = ko; im.src = url;
  });

  /* Lectura automática del ticket (OCR en el celular, sin enviar la foto a terceros) */
  let tessP = null;
  const loadTess = () => tessP || (tessP = new Promise((ok, ko) => { const sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'; sc.onload = () => ok(window.Tesseract); sc.onerror = () => { tessP = null; ko(new Error('sin conexión')); }; document.head.appendChild(sc); }));
  function parseTicket(text) {
    const lines = text.split(/\n+/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const num = t => { const m = [...t.matchAll(/\$?\s?(\d{1,3}(?:[,.]\d{3})*(?:[.,]\d{2})|\d+[.,]\d{2})(?!\d)/g)].map(x => parseFloat(x[1].replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'))); return m; };
    let total = null;
    for (const l of lines) { if (/total/i.test(l) && !/sub\s*-?\s*total/i.test(l)) { const n = num(l); if (n.length) total = n[n.length - 1]; } }
    if (total == null) { const all = lines.flatMap(num); if (all.length) total = Math.max(...all); }
    let date = null; const dm = text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (dm) { let [, d, m, y] = dm; if (y.length === 2) y = '20' + y; if (+m >= 1 && +m <= 12 && +d >= 1 && +d <= 31) date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
    const vendor = (lines.find(l => /[a-záéíóúñ]{4,}/i.test(l) && !/ticket|fecha|rfc|folio|caja/i.test(l)) || '').slice(0, 40);
    const items = [];
    for (const l of lines) {
      if (/total|cambio|efectivo|iva|tarjeta/i.test(l)) continue;
      const ing = S.ingredients.find(x => { const w = norm(x.name).split(/[ /]/).filter(t => t.length >= 4); return w.length && w.some(t => norm(l).includes(t)); });
      const n = num(l); if (!ing || !n.length) continue;
      const q = l.match(/(\d+(?:[.,]\d+)?)\s*(kg|kgs|kilo|k\b|lt|lts|l\b|pz|pza|pzas)/i);
      items.push({ name: ing.name, unit: ing.unit, qty: q ? parseFloat(q[1].replace(',', '.')) : '', amount: n[n.length - 1] });
    }
    return { total, date, vendor, items };
  }

  async function load() {
    if (REMOTE) {
      KV = await remoteAll();
      if (!KV.recipes) { const seed = Seed.seedCatalog(today()); for (const k in seed) await kvSet(k, seed[k]); }
    } else {
      try { KV = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { KV = null; }
      if (!KV) { KV = Seed.seedDemo(today()); localStorage.setItem(LS, JSON.stringify(KV)); }
    }
    S = C.stateFromKV(KV);
  }

  /* ---------------- Utilidades UI ---------------- */
  function toast(t) {
    const el = document.getElementById('toast'); el.textContent = t; el.classList.add('on');
    clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('on'), 2200);
  }
  const wa = (tel, msg) => `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`;
  function deadline(d) {
    const [h, m] = (st().corte || '17:00').split(':').map(Number);
    const x = C.parse(C.prevWeekday(d)); x.setHours(h, m, 0, 0); return x;
  }
  const locked = d => new Date() > deadline(d);
  const serviceDay = () => { const t = today(); return C.isWeekday(t) && new Date().getHours() < 16 ? t : C.nextWeekday(t); };
  const curMon = () => { const t = today(); return C.isWeekday(t) ? C.monday(t) : C.monday(C.nextWeekday(t)); };
  const user = () => { try { return JSON.parse(localStorage.getItem(LS_USER) || 'null'); } catch (e) { return null; } };

  /* ---------------- Web app instalable (PWA) ---------------- */
  let deferredPrompt = null;
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const inAppBrowser = () => /FBAN|FBAV|Instagram|WhatsApp|Line\/|wv\)/i.test(navigator.userAgent);
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; render(); });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; UI.showInstall = false; toast('App instalada en tu pantalla de inicio'); render(); });
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  const installBtn = () => isStandalone() ? '' : `<button class="inst" data-a="install" aria-label="Instalar la app"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M5 20h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>Instalar</button>`;
  function installSheet() {
    if (!UI.showInstall) return '';
    const ios = isIOS();
    const steps = inAppBrowser()
      ? `<li>Estás dentro de WhatsApp u otra app. Toca <b>⋯</b> o <b>⋮</b> y elige <b>Abrir en el navegador</b> (${ios ? 'Safari' : 'Chrome'}).</li><li>Después toca otra vez <b>Instalar</b>.</li>`
      : ios
        ? `<li>Toca el botón <b>Compartir</b> <span class="ico">⬆︎</span> en la barra de ${/CriOS/.test(navigator.userAgent) ? 'Chrome' : 'Safari'}.</li><li>Desliza y elige <b>Agregar a pantalla de inicio</b>.</li><li>Toca <b>Agregar</b>. El ícono «Comedor TV» aparecerá con tus apps.</li>`
        : `<li>Toca el menú <b>⋮</b> del navegador (arriba a la derecha).</li><li>Elige <b>Instalar app</b> o <b>Agregar a pantalla principal</b>.</li><li>Confirma con <b>Instalar</b>.</li>`;
    return `<div class="sheet-bg" data-a="closeInstall"></div>
      <section class="sheet" role="dialog" aria-modal="true" aria-label="Instalar la app">
        <div class="sheet-h"><img src="assets/icon-192.png" alt=""><div><b>Comedor Torre Vrick</b><span>Ábrela como app, sin buscar el enlace</span></div></div>
        <ol>${steps}</ol>
        <button class="btn full" data-a="closeInstall">Entendido</button>
      </section>`;
  }

  const header = (role, extra = '') => `
    <header class="top">
      <a href="#/" class="brand" aria-label="Inicio"><img src="assets/torre-vrick.png" alt="Torre Vrick"></a>
      <div class="top-r">${installBtn()}${role ? `<span class="pill">${role}</span>` : ''}${extra}</div>
    </header>
    ${REMOTE ? '' : `<div class="demo">Modo demostración · datos de ejemplo guardados en este dispositivo</div>`}`;
  const footer = () => `
    <footer class="n3">
      <img src="assets/n3-labs.png" alt="N3 Labs · Thinktech IA Laboratory">
      <p>Desarrollado por <b>N3 Labs</b> · Thinktech IA Laboratory<br><span>Potenttial Group · Sistema de Comedor v1.0</span><br><a class="guide" href="Guia-Comedor-Torre-Vrick-N3Labs.pdf" target="_blank" rel="noopener">Guía de uso (PDF)</a></p>
    </footer>`;
  const kpi = (v, l, cls = '') => `<div class="kpi ${cls}"><b>${v}</b><span>${l}</span></div>`;

  // Menú del día tal como lo ven los comensales
  function menuBlock(d, big) {
    const m = C.menuOf(S, d);
    if (!m.length || !C.isPublished(S, d)) return `<p class="menu muted">Menú por publicar</p>`;
    const by = c => m.filter(r => r.cat === c).map(r => esc(r.name));
    const g = by('Plato fuerte'), agua = by('Bebida');
    const rest = [...by('Sopa'), ...by('Guarnición'), ...by('Postre'), ...by('Acompañamiento')];
    return `<div class="mb ${big ? 'big' : ''}">
      ${g.length ? `<p class="mb-g"><small>Guisado del día</small>${g.join(' <i>o</i> ')}</p>` : ''}
      ${rest.length ? `<p class="mb-r">${rest.join(' · ')}</p>` : ''}
      ${agua.length ? `<p class="mb-a"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z" fill="currentColor"/></svg>${agua.join(' · ')}</p>` : ''}
    </div>`;
  }

  /* ---------------- Inicio ---------------- */
  function vHome() {
    const t = serviceDay(); const k = C.day(S, t);
    return `${header('')}
    <main class="wrap">
      <section class="hero">
        <p class="eyebrow">Comedor · Roof Torre Vrick</p>
        <h1>¿Quién come hoy<br>en el roof?</h1>
        <p class="lead">Confirma tu comida, el Chef Jorge planea insumos exactos y Dirección ve el balance en tiempo real.</p>
        <div class="today"><span>${C.label(t)}</span><b>${k.si}</b><em>confirmados</em></div>
        <div class="todaymenu"><p class="eyebrow">Menú · ${C.label(t)}</p>${menuBlock(t, true)}<a href="#/comensal" class="link">Ver menú de la semana y confirmar →</a></div>
      </section>
      <nav class="roles">
        <a href="#/comensal" class="role r1"><i>01</i><div><b>Soy comensal</b><span>Confirma tus días, dona tu comida, deja indicaciones</span></div><u>→</u></a>
        <a href="#/chef" class="role r2"><i>02</i><div><b>Chef Jorge</b><span>Comensales, menú, porciones, compras y costos</span></div><u>→</u></a>
        <a href="#/director" class="role r3"><i>03</i><div><b>Lic. Villarreal</b><span>Inversión, consumo, rentabilidad y recurrencia</span></div><u>→</u></a>
      </nav>
      ${isStandalone() ? '' : `<button class="installcard" data-a="install"><img src="assets/icon-192.png" alt=""><div><b>Instala el comedor en tu celular</b><span>Un toque desde tu pantalla de inicio, como cualquier app</span></div><u>Instalar</u></button>`}
    </main>${footer()}`;
  }

  /* ---------------- Comensal ---------------- */
  function vComensal() {
    const u = user();
    if (!u || !S.people[u.id]) return `${header('Comensal')}
      <main class="wrap">
        <section class="card welcome">
          <h2>Bienvenido al comedor</h2>
          <p class="muted">Solo la primera vez: escribe tu nombre. Después te reconoceremos automáticamente en este celular.</p>
          <label>Nombre completo<input id="fName" autocomplete="name" placeholder="Ej. Ana López"></label>
          <label>Área (opcional)<input id="fArea" placeholder="Ej. Ventas"></label>
          ${Object.keys(S.people).length ? `<details class="muted small"><summary>¿Ya te registraste en otro equipo?</summary>
            <select id="fExisting"><option value="">Selecciona tu nombre…</option>${Object.entries(S.people).sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([id, p]) => `<option value="${id}">${esc(p.name)}</option>`).join('')}</select>
            <button class="btn ghost" data-a="claim">Soy yo</button></details>` : ''}
          <button class="btn" data-a="register">Entrar</button>
        </section>
      </main>${footer()}`;

    const p = S.people[u.id];
    const mon = C.addDays(curMon(), UI.week * 7);
    const days = C.weekDays(mon);
    const monthStart = today().slice(0, 8) + '01';
    const comidasMes = C.range(monthStart, today()).filter(d => S.att[d]?.[u.id]?.s === 'si').length;
    const cards = days.map(d => {
      const r = S.att[d]?.[u.id] || {}; const lk = locked(d); const m = C.menuOf(S, d);
      const tags = r.tags || [];
      return `<article class="day ${r.s === 'si' ? 'yes' : r.s === 'no' ? 'no' : ''} ${lk ? 'locked' : ''}">
        <div class="day-h"><div><b>${C.label(d)}</b>${d === today() ? '<em class="tag-today">Hoy</em>' : ''}</div>
          ${lk ? '<span class="lock">Cerrado</span>' : `<span class="small muted">Cierra ${C.short(C.prevWeekday(d))} ${esc(st().corte)}</span>`}</div>
        ${menuBlock(d)}
        <div class="seg">
          <button class="${r.s === 'si' ? 'on' : ''}" data-a="att" data-d="${d}" data-v="si" ${lk ? 'disabled' : ''}>Sí como en el roof</button>
          <button class="${r.s === 'no' ? 'on' : ''}" data-a="att" data-d="${d}" data-v="no" ${lk ? 'disabled' : ''}>No como</button>
        </div>
        ${r.s === 'si' ? `
          <label class="don"><input type="checkbox" data-c="donate" data-d="${d}" ${r.d ? 'checked' : ''} ${lk ? 'disabled' : ''}>
            <span><b>Donar mi comida</b><small>No podré comerla: el chef la destinará a donación.</small></span></label>
          <div class="chips">${TAGS.map(t => `<button class="chip ${tags.includes(t) ? 'on' : ''}" data-a="tag" data-d="${d}" data-t="${t}" ${lk ? 'disabled' : ''}>${t}</button>`).join('')}</div>
          <input class="note" data-c="note" data-d="${d}" value="${esc(r.n || '')}" placeholder="Sugerencia para el chef (ej. salsa aparte)" ${lk ? 'disabled' : ''}>` : ''}
      </article>`;
    }).join('');
    return `${header('Comensal', `<button class="link" data-a="logout">Salir</button>`)}
    <main class="wrap">
      <section class="hello"><p class="eyebrow">Hola,</p><h2>${esc(p.name)}</h2>
        <p class="muted small">${comidasMes} comida${comidasMes === 1 ? '' : 's'} en el roof este mes</p></section>
      <div class="tabs"><button class="${UI.week === 0 ? 'on' : ''}" data-a="week" data-v="0">Esta semana</button><button class="${UI.week === 1 ? 'on' : ''}" data-a="week" data-v="1">Próxima semana</button></div>
      <button class="btn ghost full" data-a="allweek" data-v="${mon}">Confirmar todos los días abiertos</button>
      ${cards}
      <p class="small muted center">Puedes cambiar tu respuesta hasta las ${esc(st().corte)} h del día hábil anterior.</p>
    </main>${footer()}`;
  }

  /* ---------------- Acceso con PIN ---------------- */
  function gate(role, title) {
    if (sessionStorage.getItem('tv_' + role)) return null;
    return `${header(title)}
    <main class="wrap"><section class="card pin">
      <h2>Acceso ${esc(title)}</h2><p class="muted small">Ingresa tu PIN de 4 dígitos.${REMOTE ? '' : ' (Demo: Chef 1234 · Dirección 2468)'}</p>
      <input id="pin" inputmode="numeric" maxlength="6" type="password" placeholder="••••" autofocus>
      <button class="btn" data-a="pin" data-r="${role}">Entrar</button>
    </section></main>${footer()}`;
  }

  /* ---------------- Chef ---------------- */
  function vChef() {
    const g = gate('chef', 'Chef'); if (g) return g;
    const I = p => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
    const tabs = [['hoy', 'Hoy', I('<path d="M4 20V10l8-6 8 6v10z"/><path d="M10 20v-6h4v6"/>')], ['menu', 'Menú', I('<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 2v4M16 2v4M4 10h16"/>')],
      ['recetas', 'Platillos', I('<path d="M3 13h18a9 9 0 0 1-18 0z"/><path d="M8 9c0-2 2-2 2-4M13 9c0-2 2-2 2-4"/>')], ['gastos', 'Tickets', I('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>')],
      ['compras', 'Compras', I('<path d="M3 4h2l2.4 11h11L21 7H6.2"/><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/>')]];
    const body = { hoy: chefHoy, menu: chefMenu, compras: chefCompras, recetas: chefRecetas, gastos: chefGastos, insumos: chefInsumos, ajustes: chefAjustes }[UI.chefTab]();
    return `${header('Chef Jorge', `<button class="icon" data-a="ctab" data-v="ajustes" aria-label="Ajustes">⚙︎</button>`)}
      <main class="wrap pb">${body}</main>
      <nav class="bottom">${tabs.map(([k, l, ic]) => `<button class="${UI.chefTab === k || (k === 'gastos' && UI.chefTab === 'insumos') ? 'on' : ''}" data-a="ctab" data-v="${k}">${ic}<span>${l}</span></button>`).join('')}</nav>
      ${footer()}`;
  }
  function dayPicker(sel, act) {
    const mon = curMon(); const ds = [...C.weekDays(mon), ...C.weekDays(C.addDays(mon, 7))];
    return `<div class="dpick">${ds.map(d => `<button class="${d === sel ? 'on' : ''} ${d === today() ? 'is-today' : ''}" data-a="${act}" data-v="${d}"><small>${C.DIAS[C.dow(d)].slice(0, 3)}</small><b>${C.parse(d).getDate()}</b><i>${C.day(S, d).si}</i></button>`).join('')}</div>`;
  }
  function chefHoy() {
    const d = UI.chefDay || serviceDay(); const k = C.day(S, d); const n = C.portions(S, d);
    const total = Object.keys(S.people).length; const sin = Math.max(0, total - k.si - k.no);
    const m = C.menuOf(S, d); const mc = C.menuCost(S, d);
    const tags = Object.entries(k.notes).sort((a, b) => b[1] - a[1]);
    return `<div class="quick">
        <button data-a="qrec"><b>Platillos y porciones</b><span>Crea platillos con ingredientes, gramos y costo</span></button>
        <label class="qcam"><input type="file" accept="image/*" capture="environment" data-c="tkphoto" hidden><b>Foto del ticket</b><span>Documenta tus compras y costos</span></label>
        <button data-a="ctab" data-v="menu"><b>Menú de la semana</b><span>Guisado y agua del día; publícalo</span></button>
        <button class="qvox" data-a="vnew"><b>Dictar compra</b><span>Precios por voz, se suman solos</span></button>
      </div>
      <h2 class="sec">Comensales</h2>${dayPicker(d, 'cday')}
      <section class="card big">
        <p class="eyebrow">${C.label(d)}${locked(d) ? ' · lista cerrada' : ' · aún pueden cambiar'}</p>
        <div class="bign"><b>${k.si}</b><span>confirmados<br>para comer</span></div>
        <div class="kpis k3">${kpi(n, `porciones (+${st().merma}% merma)`, 'acc')}${kpi(k.don, 'donadas')}${kpi(k.no + ' / ' + sin, 'no comen / sin resp.')}</div>
      </section>
      <section class="card"><h3>Menú del día <span class="muted small">· ${C.money2(mc)} por comensal</span></h3>
        ${m.length ? `<ul class="plain">${m.map(r => `<li><span>${esc(r.name)}</span><em>${C.money2(C.recipeCost(S, r))}</em></li>`).join('')}</ul>` : `<p class="muted">Sin menú. <button class="link" data-a="ctab" data-v="menu">Publicar menú →</button></p>`}
        <p class="small muted">Costo de insumos del día: <b>${C.money(mc * n)}</b></p></section>
      <section class="card"><h3>Indicaciones de comensales</h3>
        ${tags.length ? `<div class="chips">${tags.map(([t, c]) => `<span class="chip on static">${esc(t)} <b>×${c}</b></span>`).join('')}</div>` : '<p class="muted small">Sin indicaciones especiales.</p>'}
        ${k.comments.map(c => `<p class="cmt"><b>${esc(c.name)}:</b> ${esc(c.n)}</p>`).join('')}</section>
      <section class="card"><button class="row-btn" data-a="toggleList"><h3>Lista de comensales (${k.si})</h3><span>${UI.showList ? '−' : '+'}</span></button>
        ${UI.showList ? `<ul class="people">${k.list.map(x => `<li><span>${esc(x.name)}<small>${esc(x.area || '')}</small></span><em>${x.d ? '<i class="b-don">Donada</i>' : ''}${x.tags.map(t => `<i>${esc(t)}</i>`).join('')}</em></li>`).join('')}</ul>` : ''}</section>
      <section class="card"><h3>Porciones servidas reales</h3><p class="small muted">Opcional, al cierre del servicio. Si lo dejas vacío se usa el número de confirmados.</p>
        <div class="inline"><input type="number" min="0" data-c="served" data-d="${d}" value="${S.served[d] ?? ''}" placeholder="${k.si}"><span class="muted small">porciones</span></div></section>
      <a class="btn wa full" target="_blank" rel="noopener" href="${wa(TEL_CHEF, C.msgChef(S, d))}">Enviar resumen + insumos a WhatsApp</a>
      <p class="small muted center">Automático: lunes a viernes a las 18:00 h al +52 55 2496 2677</p>`;
  }
  function chefMenu() {
    const mon = C.addDays(curMon(), UI.menuWeek * 7);
    const pub = S.pub[mon]; const filled = C.weekDays(mon).filter(d => (S.menu[d] || []).length).length;
    const days = C.weekDays(mon).map(d => {
      const m = S.menu[d] || [];
      return `<article class="card mday"><div class="day-h"><b>${C.label(d)}</b><span class="small muted">${C.money2(C.menuCost(S, d))}/plato · ${C.day(S, d).si} conf.</span></div>
        ${CATS.map(cat => {
          const here = m.map(id => C.recById(S, id)).filter(r => r && r.cat === cat);
          const open = !here.length || UI.slotOpen === d + '|' + cat;
          return `<div class="slot ${cat === 'Plato fuerte' ? 'main' : ''}"><span class="slot-l">${catL(cat)}</span><div class="slot-v">
            ${here.map(r => `<span class="chip on static">${esc(r.name)} <button class="x" data-a="mdel" data-d="${d}" data-v="${r.id}" aria-label="Quitar">×</button></span>`).join('')}
            ${open ? `<div class="ac"><input class="slot-in" data-d="${d}" data-cat="${cat}" autocomplete="off" placeholder="${here.length ? 'Otra opción…' : 'Elegir o escribir…'}"><div class="ac-list" hidden></div></div>` : `<button class="plus" data-a="slotopen" data-v="${d}|${cat}" aria-label="Agregar otra opción">+</button>`}
          </div></div>`;
        }).join('')}
      </article>`;
    }).join('');
    const share = `🍽 *Menú del roof · Torre Vrick*\nSemana ${C.short(mon)} – ${C.short(C.addDays(mon, 4))}\n\n` + C.weekDays(mon).map(d => {
      const m = C.menuOf(S, d); const f = c => m.filter(r => r.cat === c).map(r => r.name).join(' o ');
      return `*${C.label(d)}*\n` + [f('Plato fuerte') && `• Guisado: ${f('Plato fuerte')}`, f('Sopa') && `• ${f('Sopa')}`, f('Guarnición') && `• ${f('Guarnición')}`, f('Postre') && `• Postre: ${f('Postre')}`, f('Bebida') && `💧 Agua de hoy: ${f('Bebida').replace(/^Agua (de |fresca de )?/i, '')}`].filter(Boolean).join('\n');
    }).join('\n\n') + `\n\nConfirma si comes aquí 👉 ${location.origin + location.pathname}#/comensal`;
    return `<h2 class="sec">Menú semanal</h2>
      <div class="weeknav"><button class="icon" data-a="mweek" data-v="-1">‹</button><b>${C.short(mon)} – ${C.short(C.addDays(mon, 4))}</b><button class="icon" data-a="mweek" data-v="1">›</button></div>
      <section class="card pubbox ${pub ? 'on' : ''}">
        ${pub ? `<p><b>Publicado</b> · los comensales ya ven este menú. Los cambios se reflejan al instante.</p>
          <a class="btn wa full" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(share)}">Compartir menú en el grupo de WhatsApp</a>
          <button class="link" data-a="unpub" data-v="${mon}">Ocultar a comensales</button>`
        : `<p><b>Borrador</b> · ${filled}/5 días con menú. Los comensales aún no lo ven.</p>
          <button class="btn full" data-a="pub" data-v="${mon}">Publicar menú de la semana</button>`}
      </section>
      <button class="btn ghost full" data-a="mcopy" data-v="${mon}">Copiar menú de la semana anterior</button>
      ${days}`;
  }
  function slotRender(inp) {
    const list = inp.parentElement.querySelector('.ac-list'); const cat = inp.dataset.cat, d = inp.dataset.d;
    const n = norm(inp.value); const m = S.menu[d] || [];
    const rs = S.recipes.filter(r => r.cat === cat && !m.includes(r.id) && (!n || norm(r.name).includes(n))).sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const exact = S.recipes.some(r => norm(r.name) === n);
    list.innerHTML = (n && !exact ? `<button class="ac-new" data-a="slotnew" data-d="${d}" data-cat="${cat}">+ Crear «${esc(inp.value.trim())}» con ingredientes</button>` : '') +
      rs.slice(0, 30).map(r => `<button data-a="slotpick" data-d="${d}" data-v="${r.id}"><span>${esc(r.name)}</span><em>${C.money2(C.recipeCost(S, r))}</em></button>`).join('') +
      (!n ? `<button class="ac-new" data-a="slotnew" data-d="${d}" data-cat="${cat}">+ Nuevo ${catL(cat).toLowerCase()}…</button>` : '');
    document.querySelectorAll('.ac-list').forEach(l => { if (l !== list) l.hidden = true; });
    list.hidden = false;
  }
  function buyDates() {
    const t = today(); const mon = curMon();
    if (UI.buyRange === 'man') return [C.nextWeekday(t)];
    if (UI.buyRange === 'hoy') return [C.isWeekday(t) ? t : C.nextWeekday(t)];
    if (UI.buyRange === 'sem') return C.weekDays(mon).filter(d => d >= t);
    return C.weekDays(C.addDays(mon, 7));
  }
  function chefCompras() {
    const ds = buyDates(); const nd = C.needs(S, ds); const tot = nd.reduce((a, x) => a + x.cost, 0);
    const ports = ds.reduce((a, d) => a + C.portions(S, d), 0);
    const purch = Object.entries(S.purchases).sort((a, b) => b[1].date.localeCompare(a[1].date)).slice(0, 15);
    const rng = [['hoy', 'Hoy'], ['man', 'Mañana'], ['sem', 'Resto semana'], ['prox', 'Próx. semana']];
    const msg = ds.length === 1 ? C.msgChef(S, ds[0]) : `*Comedor Torre Vrick* · Lista de compra ${C.short(ds[0])} – ${C.short(ds[ds.length - 1])}\nPorciones: ${ports}\n\n` + nd.map(x => `• ${x.name}: ${C.fmtQty(x.qty, x.unit)} (~${C.money(x.cost)})`).join('\n') + `\n\nTotal estimado: *${C.money(tot)}*\n— N3 Labs`;
    return `<h2 class="sec">Lista de compra</h2>
      <div class="tabs four">${rng.map(([k, l]) => `<button class="${UI.buyRange === k ? 'on' : ''}" data-a="brange" data-v="${k}">${l}</button>`).join('')}</div>
      <section class="card"><p class="eyebrow">${ds.length ? ds.map(C.short).join(' · ') : 'Sin días hábiles'}</p>
        <div class="kpis k2">${kpi(ports, 'porciones totales', 'acc')}${kpi(C.money(tot), 'costo estimado')}</div>
        ${nd.length ? `<table class="tbl"><thead><tr><th>Insumo</th><th>Cantidad</th><th>Costo</th></tr></thead><tbody>${nd.map(x => `<tr><td>${esc(x.name)}</td><td>${C.fmtQty(x.qty, x.unit)}</td><td>${C.money(x.cost)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Aún no hay confirmados o menú para estos días.</p>'}
        <a class="btn wa full" target="_blank" rel="noopener" href="${wa(TEL_CHEF, msg)}">Mandar lista a mi WhatsApp</a></section>
      <button class="btn ghost full" data-a="ctab" data-v="gastos">Registrar lo que compré (foto del ticket) →</button>`;
  }
  const UNITS = [['kg', 'Kilo'], ['l', 'Litro'], ['pza', 'Pieza'], ['porcion', 'Porción']];
  const uBuy = u => (C.UNIT[u] || C.UNIT.kg).buy, uUse = u => (C.UNIT[u] || C.UNIT.kg).use;
  const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const qtyLabel = u => ({ kg: 'Gramos por platillo', l: 'Mililitros por platillo', pza: 'Piezas por platillo', porcion: 'Porciones por platillo' }[u] || 'Cantidad por platillo');
  function chefRecetas() {
    if (UI.editRec) return recEditor();
    return `<h2 class="sec">Platillos</h2>
      <p class="small muted">Escribe el platillo, sus ingredientes y condimentos con su proporción y costo. Cada ingrediente nuevo queda guardado para elegirlo después de la lista.</p>
      <button class="btn full" data-a="rnew">+ Nuevo platillo</button>
      ${CATS.map(c => { const g = S.recipes.filter(r => r.cat === c); return g.length ? `<section class="card"><h3>${catL(c)}</h3><ul class="plain">${g.map(r => `<li class="tap" data-a="redit" data-v="${r.id}"><span>${esc(r.name)}<small>${r.items.map(it => esc(C.ingById(S, it.ing)?.name || '')).filter(Boolean).slice(0, 4).join(', ')}${r.items.length > 4 ? '…' : ''}</small></span><em>${C.money2(C.recipeCost(S, r))}</em></li>`).join('')}</ul></section>` : ''; }).join('')}`;
  }
  function recEditor() {
    const r = UI.editRec; const cost = C.recipeCost(S, r); const ni = UI.ni || (UI.ni = { unit: 'kg' });
    return `<h2 class="sec">${S.recipes.find(x => x.id === r.id) ? 'Editar' : 'Nuevo'} platillo</h2>${UI.retMenu ? `<p class="small muted">Al guardar se agregará al menú del ${C.label(UI.retMenu.d)}.</p>` : ''}
      <section class="card">
        <label>Nombre del platillo<input data-c="rname" value="${esc(r.name)}" placeholder="Ej. Pollo al perejil"></label>
        <label>Tipo<select data-c="rcat">${CATS.map(c => `<option value="${c}" ${c === r.cat ? 'selected' : ''}>${catL(c)}</option>`).join('')}</select></label>
      </section>
      <section class="card">
        <h3>Ingredientes y proporciones <span class="muted small">· por platillo</span></h3>
        ${r.items.length ? r.items.map((it, i) => { const ing = C.ingById(S, it.ing); return `<div class="ri2">
          <div class="ri2-h"><b>${esc(ing?.name || '—')}</b><em>${C.money2(C.lineCost(ing, it.qty))}</em><button class="x" data-a="ridel" data-v="${i}" aria-label="Quitar">×</button></div>
          <div class="ri2-b"><label class="mini"><input type="number" step="0.01" min="0" data-c="riqty" data-i="${i}" value="${it.qty}"><span>${uUse(ing?.unit)}</span></label>
          <label class="mini money"><span>$</span><input type="number" step="0.01" min="0" data-c="ricost" data-v="${ing?.id}" value="${ing?.cost ?? 0}"><i>/ ${uBuy(ing?.unit)}</i></label></div>
        </div>`; }).join('') : '<p class="muted small">Aún no hay ingredientes. Agrega el primero abajo.</p>'}
        <div class="total"><span>Costo por platillo</span><b>${C.money2(cost)}</b></div>
      </section>
      <section class="card addbox">
        <h3>Agregar ingrediente o condimento</h3>
        <label>Ingrediente
          <div class="ac"><input id="acIn" autocomplete="off" autocapitalize="sentences" placeholder="Escribe: perejil, sal, pollo…" value="${esc(ni.name || '')}"><div class="ac-list" id="acList" hidden></div></div></label>
        <div class="grid2">
          <label>Se compra por<select id="niUnit" data-c="niunit">${UNITS.map(([u, l]) => `<option value="${u}" ${u === ni.unit ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label><span id="niCostL">Costo por ${uBuy(ni.unit)}</span><div class="money"><span>$</span><input id="niCost" type="number" step="0.01" min="0" value="${ni.cost ?? ''}" placeholder="0.00"></div></label>
        </div>
        <label><span id="niQtyL">${qtyLabel(ni.unit)}</span><input id="niQty" type="number" step="0.01" min="0" value="${ni.qty ?? ''}" placeholder="Ej. 15"></label>
        <p class="small muted" id="niHint">${ni.ing ? 'Ingrediente de tu lista: puedes ajustar su costo.' : 'Si es nuevo, se agregará a tu lista de ingredientes.'}</p>
        <button class="btn full" data-a="niadd">+ Agregar al platillo</button>
      </section>
      <div class="grid2"><button class="btn ghost" data-a="rcancel">Cancelar</button><button class="btn" data-a="rsave">Guardar platillo</button></div>
      ${S.recipes.find(x => x.id === r.id) ? `<button class="link danger" data-a="rdelete">Eliminar platillo</button>` : ''}`;
  }
  // Lista en cascada: se filtra mientras escribes, sin recargar la pantalla
  function acRender(q) {
    const list = document.getElementById('acList'); if (!list) return;
    const n = norm(q);
    const used = new Set((UI.editRec?.items || []).map(i => i.ing));
    const m = S.ingredients.filter(x => !n || norm(x.name).includes(n))
      .sort((a, b) => (norm(a.name).startsWith(n) ? 0 : 1) - (norm(b.name).startsWith(n) ? 0 : 1) || a.name.localeCompare(b.name, 'es'));
    const exact = S.ingredients.some(x => norm(x.name) === n);
    list.innerHTML = (n && !exact ? `<button class="ac-new" data-a="acnew">+ Nuevo: <b>${esc(q.trim())}</b></button>` : '') +
      m.slice(0, 40).map(x => `<button data-a="acpick" data-v="${x.id}"><span>${esc(x.name)}${used.has(x.id) ? ' <i>en el platillo</i>' : ''}</span><em>${C.money2(x.cost)} / ${uBuy(x.unit)}</em></button>`).join('') ||
      '';
    list.hidden = !list.innerHTML;
  }
  function niLabels(u) {
    const a = document.getElementById('niCostL'), b = document.getElementById('niQtyL');
    if (a) a.textContent = 'Costo por ' + uBuy(u); if (b) b.textContent = qtyLabel(u);
  }
  function chefInsumos() {
    const q = norm(UI.ingQ || '');
    const rows = S.ingredients.map((x, i) => [x, i]).filter(([x]) => !q || norm(x.name).includes(q)).sort((a, b) => a[0].name.localeCompare(b[0].name, 'es'));
    return `<h2 class="sec">Gastos y costos</h2><div class="tabs"><button data-a="ctab" data-v="gastos">Tickets de compra</button><button class="on" data-a="ctab" data-v="insumos">Precios por kilo / porción</button></div>
      <p class="small muted">Tu lista crece sola cada vez que agregas un ingrediente nuevo a un platillo. Costo por kilo, litro, pieza o porción.</p>
      <input class="search" id="ingQ" placeholder="Buscar ingrediente…" value="${esc(UI.ingQ || '')}">
      <section class="card">${rows.map(([x, i]) => `<div class="ingr"><input data-c="iname" data-i="${i}" value="${esc(x.name)}">
        <select data-c="iunit" data-i="${i}">${UNITS.map(([u, l]) => `<option value="${u}" ${u === x.unit ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <label class="money"><span>$</span><input type="number" step="0.01" data-c="icost" data-i="${i}" value="${x.cost}"></label></div>`).join('') || '<p class="muted small">Sin resultados.</p>'}
        <button class="btn ghost full" data-a="iadd">+ Agregar ingrediente</button></section>`;
  }
  function chefGastos() {
    const sub = `<div class="tabs"><button class="${UI.chefTab === 'gastos' ? 'on' : ''}" data-a="ctab" data-v="gastos">Tickets de compra</button><button class="${UI.chefTab === 'insumos' ? 'on' : ''}" data-a="ctab" data-v="insumos">Precios por kilo / porción</button></div>`;
    if (UI.tk) return sub + ticketForm();
    const t = today(); const mon = C.monday(t); const ms = t.slice(0, 8) + '01';
    const all = [...Object.entries(S.tickets).map(([id, x]) => ({ id, kind: 't', ...x })), ...Object.entries(S.purchases).map(([id, p]) => ({ id, kind: 'p', date: p.date, total: p.total, vendor: p.note, lines: [{ name: C.ingById(S, p.ing)?.name || p.ing, qty: p.qty, unit: p.unit }] }))]
      .sort((a, b) => b.date.localeCompare(a.date) || (b.at || 0) - (a.at || 0));
    const sum = f => all.filter(f).reduce((x, y) => x + (+y.total || 0), 0);
    return `<h2 class="sec">Gastos y costos</h2>${sub}
      <div class="capt">
      <label class="cam"><input type="file" accept="image/*" capture="environment" data-c="tkphoto" hidden>
        <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>
        <b>Foto del ticket</b><span>Lee total y fecha</span></label>
      <button class="cam vox" data-a="vnew"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg><b>Dictar compra</b><span>Di producto, cantidad y precio; se suma solo</span></button>
      </div>
      <button class="btn ghost full" data-a="tknew">Capturar a mano</button>
      <div class="kpis k2 loose">${kpi(C.money(sum(x => x.date >= mon)), 'gastado esta semana', 'acc')}${kpi(C.money(sum(x => x.date >= ms)), 'gastado este mes')}</div>
      <section class="card"><h3>Historial de compras</h3>
        <ul class="tlist">${all.slice(0, 40).map(x => `<li>${x.kind === 't' && x.img ? `<img data-img="${x.id}" alt="Ticket" data-a="tkview" data-v="${x.id}">` : `<i class="noimg">${x.kind === 't' ? '🧾' : '·'}</i>`}
          <span><b>${esc(x.vendor || 'Compra')}</b><small>${C.short(x.date)}${x.lines?.length ? ' · ' + x.lines.map(l => esc(l.name)).slice(0, 3).join(', ') + (x.lines.length > 3 ? '…' : '') : ''}</small></span>
          <em>${C.money(x.total)}<button class="x" data-a="${x.kind === 't' ? 'tkdel' : 'pdel'}" data-v="${x.id}" aria-label="Eliminar">×</button></em></li>`).join('') || '<li class="muted">Aún no hay tickets.</li>'}</ul></section>
      ${UI.tkView ? `<div class="sheet-bg" data-a="tkclose"></div><section class="sheet photo"><img data-img="${UI.tkView}" alt="Ticket"><button class="btn full" data-a="tkclose">Cerrar</button></section>` : ''}`;
  }
  function ticketForm() {
    const k = UI.tk;
    return `<section class="card">
      <h3>${k.img ? 'Ticket fotografiado' : 'Nuevo gasto'}</h3>
      ${k.img ? `<img class="tkprev" src="${k.img}" alt="Foto del ticket">
        <div class="ocr">${k.ocr === 'run' ? `<span class="spin"></span> Leyendo ticket… ${k.pct || 0}%` : k.ocr === 'ok' ? '✓ Leído automáticamente: revisa los datos' : k.ocr === 'err' ? 'No se pudo leer automáticamente; captura el total a mano.' : `<button class="btn ghost full" data-a="tkocr">Leer ticket automáticamente</button>`}</div>` : ''}
      ${voiceBlock()}
      <div class="grid2"><label>Fecha<input type="date" data-k="date" class="tkf" value="${k.date || today()}"></label>
        <label>Total pagado${k.autoTotal ? ' <small class="auto">· auto</small>' : ''}<div class="money"><span>$</span><input type="number" step="0.01" data-k="total" class="tkf" value="${k.total ?? ''}" placeholder="0.00"></div></label></div>
      <label>Proveedor<input data-k="vendor" class="tkf" value="${esc(k.vendor || '')}" placeholder="Ej. Central de Abasto, Costco"></label>
      <h3 class="mt">Detalle ${(k.lines || []).length ? `<span class="muted small">· ${(k.lines || []).length} renglón(es)</span>` : '(opcional)'}</h3>
      <p class="small muted">Con cantidad e importe, el costo por kilo o porción del ingrediente se actualiza solo.</p>
      ${(k.lines || []).map((l, i) => `<div class="tl"><input list="ingNames" data-i="${i}" data-k="name" class="tkl" value="${esc(l.name || '')}" placeholder="Ingrediente">
        <input type="number" step="0.01" data-i="${i}" data-k="qty" class="tkl" value="${l.qty ?? ''}" placeholder="Cant.">
        <select data-i="${i}" data-k="unit" class="tkl">${UNITS.map(([u, n]) => `<option value="${u}" ${u === (l.unit || 'kg') ? 'selected' : ''}>${u === 'porcion' ? 'porc.' : u}</option>`).join('')}</select>
        <div class="money"><span>$</span><input type="number" step="0.01" data-i="${i}" data-k="amount" class="tkl" value="${l.amount ?? ''}" placeholder="0"></div>
        <button class="x" data-a="tkldel" data-v="${i}" aria-label="Quitar">×</button>${l.voz && !l.known ? '<small class="newi">Nuevo ingrediente</small>' : ''}</div>`).join('')}
      <datalist id="ingNames">${S.ingredients.map(x => `<option value="${esc(x.name)}">`).join('')}</datalist>
      <button class="btn ghost full" data-a="tkladd">+ Agregar renglón</button>
      ${(k.lines || []).length ? `<div class="total"><span>Suma de la compra</span><b id="tkSum">${C.money2(lineSum())}</b></div>` : ''}
      <div class="grid2"><button class="btn ghost" data-a="tkcancel">Cancelar</button><button class="btn" data-a="tksave">Guardar ticket</button></div>
    </section>`;
  }
  /* ---------- Dictado por voz ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  const lineSum = () => (UI.tk?.lines || []).reduce((a, l) => a + (+l.amount || 0), 0);
  function syncTotal() {
    if (!UI.tk?.autoTotal) return;
    UI.tk.total = Math.round(lineSum() * 100) / 100 || '';
    const t = document.querySelector('.tkf[data-k="total"]'); if (t) t.value = UI.tk.total;
    const s = document.getElementById('tkSum'); if (s) s.textContent = C.money2(lineSum());
  }
  function voiceBlock() {
    const on = !!UI.listening;
    return `<div class="voice ${on ? 'on' : ''}">
      <button class="mic" data-a="vtoggle">${on ? '<span class="pulse"></span>' : '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>'}
        <span>${on ? 'Escuchando… toca para terminar' : 'Dictar compras'}</span></button>
      <p class="vlive" id="vlive">${esc(UI.vLast || '')}</p>
      ${UI.vMsg ? `<p class="vmsg">${esc(UI.vMsg)}</p>` : `<p class="vhint">Di, por ejemplo: «pollo, tres kilos, cuatrocientos treinta y ocho pesos… jitomate, dos kilos y medio, ochenta». Para corregir: «borra el último».</p>`}
      <div class="vtype"><input id="vtext" autocomplete="off" placeholder="…o escribe: cebolla 1 kilo 30"><button data-a="vtext" aria-label="Agregar">Agregar</button></div>
    </div>`;
  }
  function vApply(text) {
    if (!UI.tk) UI.tk = { date: today(), lines: [], autoTotal: true };
    const r = Dictado.parse(text, S.ingredients); const k = UI.tk; k.lines = k.lines || [];
    UI.vLast = '«' + text.trim() + '»';
    let msg = [];
    if (r.clear) { k.lines = []; msg.push('Detalle borrado'); }
    for (let i = 0; i < r.undo; i++) { const x = k.lines.pop(); if (x) msg.push('Quitado: ' + x.name); }
    r.items.forEach(x => k.lines.push({ ...x, voz: true }));
    if (r.items.length) msg.push(r.items.map(x => `${x.name}${x.qty ? ' ' + x.qty + ' ' + (x.unit === 'porcion' ? 'porc.' : x.unit) : ''}${x.amount !== '' ? ' ' + C.money2(+x.amount) : ''}`).join(' · '));
    if (r.total != null) { k.total = r.total; k.autoTotal = false; msg.push('Total ' + C.money2(r.total)); }
    if (!msg.length) { UI.vMsg = 'No entendí un producto con precio. Intenta: «cebolla un kilo treinta pesos».'; render(); return; }
    UI.vMsg = '';
    syncTotal(); navigator.vibrate && navigator.vibrate(25);
    render(); toast(msg.join(' · ') + (k.lines.length ? ` · Suma ${C.money2(lineSum())}` : ''));
  }
  function vStart() {
    if (!SR) { UI.vMsg = 'Este navegador no permite dictado directo. Toca el campo de abajo y usa el micrófono de tu teclado.'; render(); setTimeout(() => document.getElementById('vtext')?.focus(), 50); return; }
    try { rec && rec.abort(); } catch (e) { }
    rec = new SR(); rec.lang = 'es-MX'; rec.continuous = false; rec.interimResults = true; rec.maxAlternatives = 1;
    rec.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) { const x = e.results[i]; if (x.isFinal) vApply(x[0].transcript); else interim += x[0].transcript; }
      if (interim) { const el = document.getElementById('vlive'); if (el) el.textContent = interim + '…'; }
    };
    rec.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
        UI.listening = false; UI.vMsg = 'No hay permiso de micrófono. Actívalo en el navegador, o usa el micrófono del teclado en el campo de abajo.'; render();
      }
    };
    rec.onend = () => { if (UI.listening) { try { rec.start(); } catch (e) { UI.listening = false; render(); } } };
    UI.listening = true; UI.vMsg = '';
    try { rec.start(); } catch (e) { }
    render();
  }
  function vStop() { UI.listening = false; try { rec && rec.stop(); } catch (e) { } render(); }

  async function runOCR() {
    const k = UI.tk; if (!k?.img) return;
    k.ocr = 'run'; k.pct = 0; render();
    try {
      const T = await loadTess();
      const r = await T.recognize(k.img, 'spa', { logger: m => { if (m.status === 'recognizing text' && UI.tk) { UI.tk.pct = Math.round(m.progress * 100); const o = document.querySelector('.ocr'); if (o) o.innerHTML = `<span class="spin"></span> Leyendo ticket… ${UI.tk.pct}%`; } } });
      if (!UI.tk) return;
      const p = parseTicket(r.data.text || '');
      if (p.total != null && !k.total) k.total = p.total;
      if (p.date) k.date = p.date;
      if (p.vendor && !k.vendor) k.vendor = p.vendor;
      if (p.items.length && !(k.lines || []).length) k.lines = p.items;
      k.ocr = 'ok';
    } catch (e) { if (UI.tk) UI.tk.ocr = 'err'; }
    render();
  }
  function chefAjustes() {
    const s = st();
    return `<h2 class="sec">Ajustes del comedor</h2>
      <section class="card">
        <label>Precio / valor por comida ($)<input type="number" data-c="set" data-k="precio" value="${s.precio}"></label>
        <label>Margen de merma para porciones (%)<input type="number" data-c="set" data-k="merma" value="${s.merma}"></label>
        <label>Hora de cierre de confirmación (día hábil anterior)<input type="time" data-c="set" data-k="corte" value="${s.corte}"></label>
        <div class="grid2"><label>PIN Chef<input data-c="set" data-k="pinChef" value="${esc(s.pinChef)}"></label><label>PIN Dirección<input data-c="set" data-k="pinDir" value="${esc(s.pinDir)}"></label></div>
      </section>
      <section class="card"><h3>Enlace para comensales</h3><p class="small muted">Compártelo en el grupo de WhatsApp de la oficina.</p>
        <input readonly value="${location.origin + location.pathname}#/comensal" onclick="this.select()">
        <a class="btn ghost full" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent('Confirma si comes en el roof esta semana 🍽 ' + location.origin + location.pathname + '#/comensal')}">Compartir por WhatsApp</a></section>
      <section class="card"><h3>Datos</h3>
        <button class="btn ghost full" data-a="export">Descargar respaldo (JSON)</button>
        ${REMOTE ? '' : `<button class="btn ghost full" data-a="reset">Reiniciar datos de demostración</button>`}
        <button class="link" data-a="lock" data-r="chef">Cerrar sesión de chef</button></section>`;
  }

  /* ---------------- Dirección ---------------- */
  function period() {
    const t = today(), mon = C.monday(t);
    switch (UI.dirPeriod) {
      case 'prev': return [C.addDays(mon, -7), C.addDays(mon, -3), 'Semana pasada'];
      case 'mes': return [t.slice(0, 8) + '01', t, 'Mes en curso'];
      case '4s': return [C.addDays(mon, -21), C.addDays(mon, 4), 'Últimas 4 semanas'];
      default: return [mon, C.addDays(mon, 4), 'Semana en curso'];
    }
  }
  function bars(data, h = 140) {
    if (!data.length) return '<p class="muted small">Sin datos en el periodo.</p>';
    const max = Math.max(...data.map(x => x.v), 1); const w = 100 / Math.max(data.length, 5);
    return `<svg class="bars" viewBox="0 0 100 ${h / 2}" preserveAspectRatio="none" role="img" aria-label="Comidas por día">${data.map((x, i) => { const bh = (x.v / max) * (h / 2 - 12); return `<rect x="${i * w + w * 0.15}" y="${h / 2 - 10 - bh}" width="${w * 0.7}" height="${bh}" rx="0.8"><title>${x.l}: ${x.v}</title></rect>`; }).join('')}</svg>
      <div class="blabels" style="width:${Math.min(100, data.length / Math.max(data.length, 5) * 100)}%">${data.map(x => `<span><b>${x.v}</b>${x.l}</span>`).join('')}</div>`;
  }
  function vDirector() {
    const g = gate('dir', 'Dirección'); if (g) return g;
    const [a, b, name] = period(); const B = C.balance(S, a, b, today());
    const pct = x => (x * 100).toFixed(0) + '%';
    // inversión vs consumo, últimas 4 semanas
    const mon = C.monday(today());
    const wk = [-3, -2, -1, 0].map(i => { const m = C.addDays(mon, i * 7); const x = C.balance(S, m, C.addDays(m, 4), today()); return { l: C.short(m), inv: x.inversion, con: x.consumo, ing: x.ingresos }; });
    const wmax = Math.max(...wk.flatMap(x => [x.inv, x.con, x.ing]), 1);
    const periods = [['sem', 'Semana'], ['prev', 'Anterior'], ['mes', 'Mes'], ['4s', '4 sem.']];
    const msgW = C.msgDirector(S, UI.dirPeriod === 'prev' ? C.addDays(mon, -7) : mon, today());
    return `${header('Lic. Villarreal', `<button class="icon" data-a="lock" data-r="dir" aria-label="Salir">⎋</button>`)}
    <main class="wrap">
      <section class="hello"><p class="eyebrow">Balance del comedor · <span class="live">● en vivo</span></p><h2>${name}</h2><p class="small muted">${C.short(a)} – ${C.short(b)} · ${B.days} días de servicio · act. ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p></section>
      <div class="tabs four">${periods.map(([k, l]) => `<button class="${UI.dirPeriod === k ? 'on' : ''}" data-a="dper" data-v="${k}">${l}</button>`).join('')}</div>
      <section class="card hl"><p class="eyebrow">Rentabilidad</p><div class="bign"><b class="${B.rent < 0 ? 'neg' : ''}">${C.money(B.rent)}</b><span>margen<br>${(B.margen * 100).toFixed(1)}%</span></div>
        <div class="kpis k2">${kpi(C.money(B.ingresos), `ingresos (${C.money(B.precio)}/comida)`)}${kpi(C.money(B.inversion), 'inversión en insumos', 'acc')}</div></section>
      <div class="kpis k2 loose">
        ${kpi(C.money(B.consumo), 'consumo de insumos')}${kpi(C.money2(B.costoPlato), 'costo por plato')}
        ${kpi(B.comidas, 'comidas servidas')}${kpi(B.promDia.toFixed(1), 'promedio por día')}
        ${kpi(C.money(B.merma), 'compra − consumo (inventario/merma)')}${kpi(B.don, 'comidas donadas')}
        ${kpi(B.activos, 'comensales activos')}${kpi(pct(B.recurrencia), 'recurrencia promedio')}
      </div>
      <section class="card"><h3>Comidas por día</h3>${bars(B.daily.slice(-10).map(x => ({ v: x.n, l: C.short(x.d) })))}</section>
      <section class="card"><h3>Inversión vs. consumo vs. ingresos</h3><p class="small muted">Últimas 4 semanas</p>
        <div class="wk">${wk.map(x => `<div class="wkc"><div class="wkb"><i class="i1" style="height:${x.inv / wmax * 100}%" title="Inversión ${C.money(x.inv)}"></i><i class="i2" style="height:${x.con / wmax * 100}%" title="Consumo ${C.money(x.con)}"></i><i class="i3" style="height:${x.ing / wmax * 100}%" title="Ingresos ${C.money(x.ing)}"></i></div><span>${x.l}</span></div>`).join('')}</div>
        <div class="legend"><span><i class="i1"></i>Inversión</span><span><i class="i2"></i>Consumo</span><span><i class="i3"></i>Ingresos</span></div></section>
      <section class="card"><h3>Recurrencia por persona</h3><p class="small muted">Días que comió en el roof / días de servicio del periodo</p>
        <ul class="rec">${B.people.map(p => `<li><span>${esc(p.name)}<small>${esc(p.area)}</small></span><div class="meter"><i style="width:${p.pct * 100}%"></i></div><em>${p.n}/${B.days}</em></li>`).join('')}</ul></section>
      <section class="card"><h3>Platillos más servidos</h3><ul class="plain">${B.dishes.map(([n, c]) => `<li><span>${esc(n)}</span><em>${c}</em></li>`).join('') || '<li class="muted">—</li>'}</ul></section>
      <section class="card"><h3>Indicaciones más pedidas</h3><div class="chips">${Object.entries(B.tags).sort((a, b) => b[1] - a[1]).map(([t, c]) => `<span class="chip on static">${esc(t)} <b>×${c}</b></span>`).join('') || '<span class="muted small">—</span>'}</div></section>
      <a class="btn wa full" target="_blank" rel="noopener" href="${wa(TEL_DIR, msgW)}">Enviar balance semanal a WhatsApp</a>
      <p class="small muted center">Automático: viernes 18:00 h al +52 55 5405 4868</p>
    </main>${footer()}`;
  }

  /* ---------------- Router ---------------- */
  function render() {
    const r = (location.hash || '#/').slice(2);
    const view = r.startsWith('comensal') ? vComensal : r.startsWith('chef') ? vChef : r.startsWith('director') ? vDirector : vHome;
    const y = window.scrollY; $app.innerHTML = view() + installSheet(); window.scrollTo(0, y); hydrateImgs();
  }
  window.addEventListener('hashchange', () => { window.scrollTo(0, 0); render(); });

  /* ---------------- Acciones ---------------- */
  const ACT = {
    async install() {
      if (deferredPrompt) { deferredPrompt.prompt(); const r = await deferredPrompt.userChoice; deferredPrompt = null; if (r.outcome !== 'accepted') toast('Puedes instalarla cuando quieras'); render(); return; }
      UI.showInstall = true; render();
    },
    closeInstall() { UI.showInstall = false; render(); },
    async register() {
      const n = document.getElementById('fName').value.trim(); if (n.length < 3) return toast('Escribe tu nombre completo');
      const area = document.getElementById('fArea').value.trim();
      const ex = Object.entries(S.people).find(([, p]) => p.name.toLowerCase() === n.toLowerCase());
      const id = ex ? ex[0] : 'u' + uidGen();
      if (!ex) await kvSet('person:' + id, { name: n, area, created: today() });
      localStorage.setItem(LS_USER, JSON.stringify({ id, name: n })); render(); toast('¡Listo! Ya te reconocemos en este celular');
    },
    claim() { const id = document.getElementById('fExisting').value; if (!id) return; localStorage.setItem(LS_USER, JSON.stringify({ id, name: S.people[id].name })); render(); },
    logout() { if (confirm('¿Cerrar tu sesión en este celular?')) { localStorage.removeItem(LS_USER); render(); } },
    week(el) { UI.week = +el.dataset.v; render(); },
    async att(el) {
      const u = user(), d = el.dataset.d; if (locked(d)) return toast('Este día ya cerró');
      const cur = S.att[d]?.[u.id] || {};
      await kvSet(`att:${d}:${u.id}`, { ...cur, s: el.dataset.v, t: Date.now(), ...(el.dataset.v === 'no' ? { d: false } : {}) });
      render(); toast(el.dataset.v === 'si' ? 'Confirmado: comes en el roof' : 'Registrado: no comes ese día');
    },
    async tag(el) {
      const u = user(), d = el.dataset.d, t = el.dataset.t; const cur = S.att[d]?.[u.id] || {};
      const tags = new Set(cur.tags || []); tags.has(t) ? tags.delete(t) : tags.add(t);
      await kvSet(`att:${d}:${u.id}`, { ...cur, tags: [...tags], t: Date.now() }); render();
    },
    async allweek(el) {
      const u = user(); let n = 0;
      for (const d of C.weekDays(el.dataset.v)) { if (locked(d)) continue; const cur = S.att[d]?.[u.id] || {}; await kvSet(`att:${d}:${u.id}`, { ...cur, s: 'si', t: Date.now() }); n++; }
      render(); toast(n ? `Confirmaste ${n} día${n > 1 ? 's' : ''}` : 'No hay días abiertos');
    },
    async pin(el) {
      const v = document.getElementById('pin').value; const role = el.dataset.r;
      if (v === (role === 'chef' ? st().pinChef : st().pinDir)) { sessionStorage.setItem('tv_' + role, '1'); render(); } else toast('PIN incorrecto');
    },
    lock(el) { sessionStorage.removeItem('tv_' + el.dataset.r); location.hash = '#/'; },
    ctab(el) { if (UI.listening) vStop(); UI.chefTab = el.dataset.v; UI.editRec = null; UI.retMenu = null; UI.tk = null; window.scrollTo(0, 0); render(); },
    cday(el) { UI.chefDay = el.dataset.v; render(); },
    toggleList() { UI.showList = !UI.showList; render(); },
    mweek(el) { UI.menuWeek += +el.dataset.v; render(); },
    qrec() { UI.chefTab = 'recetas'; UI.ni = null; UI.editRec = { id: 'r' + uidGen(), name: '', cat: 'Plato fuerte', items: [] }; window.scrollTo(0, 0); render(); },
    tknew() { UI.tk = { date: today(), lines: [], autoTotal: true }; render(); },
    vnew() { UI.chefTab = 'gastos'; UI.vLast = ''; UI.vMsg = ''; UI.tk = { date: today(), lines: [], autoTotal: true }; window.scrollTo(0, 0); vStart(); },
    vtoggle() { UI.listening ? vStop() : vStart(); },
    vtext() { const i = document.getElementById('vtext'); const v = i?.value.trim(); if (!v) return; vApply(v); const n = document.getElementById('vtext'); if (n) { n.value = ''; n.focus(); } },
    tkocr() { runOCR(); },
    tkladd() { UI.tk.lines = [...(UI.tk.lines || []), { unit: 'kg' }]; render(); },
    tkldel(el) { UI.tk.lines.splice(+el.dataset.v, 1); syncTotal(); render(); },
    tkcancel() { if (UI.listening) vStop(); UI.tk = null; render(); },
    tkview(el) { UI.tkView = el.dataset.v; render(); },
    tkclose() { UI.tkView = null; render(); },
    async tkdel(el) { if (!confirm('¿Eliminar este ticket?')) return; const t = S.tickets[el.dataset.v]; await kvSet('ticket:' + el.dataset.v, null); if (t?.img) imgDel(el.dataset.v); render(); },
    async tksave() {
      const k = UI.tk; const total = +k.total;
      if (!total) return toast('Captura el total pagado');
      const id = uidGen(); const lines = (k.lines || []).filter(l => (l.name || '').trim());
      let list = [...S.ingredients]; let upd = 0;
      for (const l of lines) {
        let ing = list.find(x => norm(x.name) === norm(l.name));
        if (!ing) { ing = { id: 'i' + uidGen(), name: l.name.trim().charAt(0).toUpperCase() + l.name.trim().slice(1), unit: l.unit || 'kg', cost: 0 }; list.push(ing); }
        if (+l.qty > 0 && +l.amount > 0 && (!ing.cost || (l.unit || 'kg') === ing.unit)) { const i = list.findIndex(x => x.id === ing.id); list[i] = { ...list[i], unit: list[i].cost ? list[i].unit : (l.unit || list[i].unit), cost: Math.round(+l.amount / +l.qty * 100) / 100 }; upd++; }
        l.ing = ing.id;
      }
      if (lines.length) await kvSet('ingredients', list);
      if (k.img) await imgPut(id, k.img);
      await kvSet('ticket:' + id, { date: k.date || today(), total, vendor: (k.vendor || '').trim(), lines: lines.map(l => ({ ing: l.ing, name: l.name, qty: +l.qty || 0, unit: l.unit || 'kg', amount: +l.amount || 0 })), img: !!k.img, at: Date.now() });
      if (k.img) imgCache[id] = k.img;
      if (UI.listening) vStop(); UI.tk = null; UI.chefTab = 'gastos'; render(); toast(upd ? `Ticket guardado · ${upd} precio(s) actualizado(s)` : 'Ticket guardado');
    },
    slotopen(el) { UI.slotOpen = el.dataset.v; render(); const i = document.querySelector(`.slot-in[data-d="${el.dataset.v.split('|')[0]}"][data-cat="${el.dataset.v.split('|')[1]}"]`); i && i.focus(); },
    async slotpick(el) { const d = el.dataset.d; await kvSet('menu:' + d, [...(S.menu[d] || []), el.dataset.v]); UI.slotOpen = null; render(); toast('Agregado al menú'); },
    slotnew(el) {
      const inp = el.closest('.ac').querySelector('.slot-in'); const name = inp.value.trim();
      UI.ni = null; UI.retMenu = { d: el.dataset.d };
      UI.editRec = { id: 'r' + uidGen(), name: name ? name.charAt(0).toUpperCase() + name.slice(1) : '', cat: el.dataset.cat, items: [] };
      UI.chefTab = 'recetas'; window.scrollTo(0, 0); render();
    },
    async pub(el) {
      const mon = el.dataset.v; const empty = C.weekDays(mon).filter(d => !(S.menu[d] || []).length);
      if (empty.length && !confirm(`${empty.length} día(s) sin menú. ¿Publicar de todos modos?`)) return;
      await kvSet('pub:' + mon, { at: Date.now() }); render(); toast('Menú publicado: ya lo ven los comensales');
    },
    async unpub(el) { await kvSet('pub:' + el.dataset.v, null); render(); toast('Menú oculto'); },
    async mdel(el) { const d = el.dataset.d; await kvSet('menu:' + d, (S.menu[d] || []).filter(x => x !== el.dataset.v)); render(); },
    async mcopy(el) { for (const d of C.weekDays(el.dataset.v)) { const prev = S.menu[C.addDays(d, -7)]; if (prev) await kvSet('menu:' + d, [...prev]); } render(); toast('Menú copiado'); },
    brange(el) { UI.buyRange = el.dataset.v; render(); },
    async buy() {
      const ing = document.getElementById('pIng').value, qty = +document.getElementById('pQty').value, tot = +document.getElementById('pTot').value;
      if (!qty || !tot) return toast('Captura cantidad y total');
      const i = C.ingById(S, ing);
      await kvSet('purchase:' + uidGen(), { date: document.getElementById('pDate').value || today(), ing, qty, unit: i.unit, total: tot, note: document.getElementById('pNote').value.trim() });
      // actualiza el costo unitario con la última compra
      const list = S.ingredients.map(x => x.id === ing ? { ...x, cost: Math.round(tot / qty * 100) / 100 } : x);
      await kvSet('ingredients', list); render(); toast('Compra registrada y costo actualizado');
    },
    async pdel(el) { if (confirm('¿Eliminar esta compra?')) { await kvSet('purchase:' + el.dataset.v, null); render(); } },
    rnew() { UI.ni = null; UI.editRec = { id: 'r' + uidGen(), name: '', cat: 'Plato fuerte', items: [] }; render(); },
    redit(el) { UI.ni = null; const r = C.recById(S, el.dataset.v); UI.editRec = JSON.parse(JSON.stringify(r)); render(); },
    acpick(el) {
      const x = C.ingById(S, el.dataset.v); if (!x) return;
      UI.ni = { name: x.name, ing: x.id, unit: x.unit, cost: x.cost, qty: document.getElementById('niQty')?.value || '' };
      render(); const q = document.getElementById('niQty'); q && q.focus();
    },
    acnew() {
      const name = document.getElementById('acIn').value.trim(); const name2 = name.charAt(0).toUpperCase() + name.slice(1);
      UI.ni = { name: name2, ing: null, unit: document.getElementById('niUnit').value, cost: '', qty: document.getElementById('niQty')?.value || '' };
      render(); const c = document.getElementById('niCost'); c && c.focus();
    },
    async niadd() {
      const name = document.getElementById('acIn').value.trim();
      const unit = document.getElementById('niUnit').value;
      const cost = document.getElementById('niCost').value; const qty = +document.getElementById('niQty').value;
      if (!name) return toast('Escribe el ingrediente');
      if (!qty) return toast('Indica la cantidad por platillo');
      let ing = S.ingredients.find(x => norm(x.name) === norm(name));
      const list = [...S.ingredients];
      if (ing) {
        const upd = { ...ing, unit, cost: cost === '' ? ing.cost : +cost };
        if (upd.unit !== ing.unit || upd.cost !== ing.cost) { list[list.findIndex(x => x.id === ing.id)] = upd; await kvSet('ingredients', list); }
      } else {
        if (cost === '') return toast('Agrega el costo por ' + uBuy(unit));
        ing = { id: 'i' + uidGen(), name: name.charAt(0).toUpperCase() + name.slice(1), unit, cost: +cost };
        list.push(ing); await kvSet('ingredients', list);
      }
      const ex = UI.editRec.items.find(it => it.ing === ing.id);
      if (ex) ex.qty = qty; else UI.editRec.items.push({ ing: ing.id, qty });
      UI.ni = { unit }; render(); toast(`${ing.name} agregado`);
      const a = document.getElementById('acIn'); a && a.focus();
    },
    ridel(el) { UI.editRec.items.splice(+el.dataset.v, 1); render(); },
    rcancel() { UI.editRec = null; if (UI.retMenu) { UI.retMenu = null; UI.chefTab = 'menu'; } render(); },
    async rsave() {
      const r = UI.editRec; if (!r.name.trim()) return toast('Ponle nombre al platillo');
      const list = S.recipes.filter(x => x.id !== r.id); const idx = S.recipes.findIndex(x => x.id === r.id);
      idx >= 0 ? list.splice(idx, 0, r) : list.push(r);
      await kvSet('recipes', list); UI.editRec = null;
      if (UI.retMenu) { const d = UI.retMenu.d; if (!(S.menu[d] || []).includes(r.id)) await kvSet('menu:' + d, [...(S.menu[d] || []), r.id]); UI.retMenu = null; UI.chefTab = 'menu'; render(); toast('Platillo guardado y agregado al menú'); return; }
      render(); toast('Platillo guardado');
    },
    async rdelete() { if (!confirm('¿Eliminar platillo?')) return; await kvSet('recipes', S.recipes.filter(x => x.id !== UI.editRec.id)); UI.editRec = null; render(); },
    async iadd() { await kvSet('ingredients', [...S.ingredients, { id: 'i' + uidGen(), name: 'Nuevo insumo', unit: 'kg', cost: 0 }]); render(); },
    dper(el) { UI.dirPeriod = el.dataset.v; render(); },
    export() {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(KV, null, 1)], { type: 'application/json' }));
      a.download = `comedor-torre-vrick-${today()}.json`; a.click();
    },
    reset() { if (confirm('¿Reiniciar todos los datos de demostración?')) { localStorage.removeItem(LS); localStorage.removeItem(LS_USER); location.reload(); } }
  };
  const CHG = {
    async tkphoto(el) {
      const f = el.files?.[0]; if (!f) return;
      try { const img = await shrink(f); UI.tk = { img, date: today(), lines: [] }; UI.chefTab = 'gastos'; window.scrollTo(0, 0); render(); runOCR(); }
      catch (e) { toast('No se pudo abrir la foto'); }
    },
    async donate(el) { const u = user(), d = el.dataset.d; const cur = S.att[d]?.[u.id] || {}; await kvSet(`att:${d}:${u.id}`, { ...cur, d: el.checked, t: Date.now() }); render(); toast(el.checked ? 'Gracias: tu comida se donará' : 'Donación cancelada'); },
    async note(el) { const u = user(), d = el.dataset.d; const cur = S.att[d]?.[u.id] || {}; await kvSet(`att:${d}:${u.id}`, { ...cur, n: el.value.trim().slice(0, 140), t: Date.now() }); toast('Sugerencia enviada al chef'); },
    async served(el) { await kvSet('served:' + el.dataset.d, el.value === '' ? null : +el.value); toast('Guardado'); },
    async madd(el) { if (!el.value) return; const d = el.dataset.d; await kvSet('menu:' + d, [...(S.menu[d] || []), el.value]); render(); },
    rname(el) { UI.editRec.name = el.value; },
    rcat(el) { UI.editRec.cat = el.value; },
    niunit(el) { niLabels(el.value); },
    async ricost(el) { const l = S.ingredients.map(x => x.id === el.dataset.v ? { ...x, cost: +el.value || 0 } : x); await kvSet('ingredients', l); render(); toast('Costo actualizado'); },
    riqty(el) { UI.editRec.items[+el.dataset.i].qty = +el.value || 0; render(); },
    async iname(el) { const l = [...S.ingredients]; l[+el.dataset.i] = { ...l[+el.dataset.i], name: el.value }; await kvSet('ingredients', l); },
    async iunit(el) { const l = [...S.ingredients]; l[+el.dataset.i] = { ...l[+el.dataset.i], unit: el.value }; await kvSet('ingredients', l); },
    async icost(el) { const l = [...S.ingredients]; l[+el.dataset.i] = { ...l[+el.dataset.i], cost: +el.value || 0 }; await kvSet('ingredients', l); toast('Costo actualizado'); },
    async set(el) { const s = { ...st(), [el.dataset.k]: el.type === 'number' ? +el.value : el.value }; await kvSet('settings', s); toast('Ajuste guardado'); }
  };
  document.addEventListener('click', e => { const el = e.target.closest('[data-a]'); if (el && ACT[el.dataset.a]) { e.preventDefault(); ACT[el.dataset.a](el, e); } });
  document.addEventListener('change', e => { const t = e.target; if (t.classList?.contains('tkl') && t.tagName === 'SELECT' && UI.tk) UI.tk.lines[+t.dataset.i].unit = t.value; });
  document.addEventListener('change', e => { const el = e.target.closest('[data-c]'); if (el && CHG[el.dataset.c]) CHG[el.dataset.c](el, e); });
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.classList.contains('slot-in')) { slotRender(t); return; }
    if (t.classList.contains('tkf') && UI.tk) { UI.tk[t.dataset.k] = t.value; if (t.dataset.k === 'total') UI.tk.autoTotal = false; return; }
    if (t.classList.contains('tkl') && UI.tk) { const l = UI.tk.lines[+t.dataset.i]; l[t.dataset.k] = t.value; if (t.dataset.k === 'name') { const g = S.ingredients.find(x => norm(x.name) === norm(t.value)); if (g) { l.unit = g.unit; const sel = t.parentElement.querySelector('select'); if (sel) sel.value = g.unit; } } if (t.dataset.k === 'amount') syncTotal(); return; }
    if (t.id === 'acIn') { if (UI.ni) { UI.ni.name = t.value; UI.ni.ing = null; } acRender(t.value); }
    else if (t.id === 'ingQ') { UI.ingQ = t.value; const p = t.selectionStart; render(); const n = document.getElementById('ingQ'); n.focus(); n.setSelectionRange(p, p); }
    else if (t.dataset.c === 'rname') UI.editRec.name = t.value;
  });
  document.addEventListener('focusin', e => { if (e.target.id === 'acIn') acRender(e.target.value); else if (e.target.classList.contains('slot-in')) slotRender(e.target); });
  document.addEventListener('click', e => { if (!e.target.closest('.ac')) document.querySelectorAll('.ac-list').forEach(l => l.hidden = true); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'vtext') { e.preventDefault(); ACT.vtext(); return; }
    if (e.key === 'Enter' && e.target.classList.contains('slot-in')) { e.preventDefault(); e.target.parentElement.querySelector('.ac-list button')?.click(); return; }
    if (e.key === 'Enter' && e.target.id === 'acIn') { e.preventDefault(); const f = document.querySelector('#acList button'); f ? f.click() : null; return; }
    if (e.key === 'Enter' && e.target.id === 'niQty') { e.preventDefault(); ACT.niadd(); return; } if (e.key === 'Enter' && e.target.id === 'pin') document.querySelector('[data-a="pin"]')?.click(); });

  // "Tiempo real": otros pestañas del mismo equipo / sondeo al servidor cada 20 s
  window.addEventListener('storage', e => { if (e.key === LS) { KV = JSON.parse(e.newValue || '{}'); S = C.stateFromKV(KV); render(); } });
  setInterval(async () => {
    const active = document.activeElement; if (active && /INPUT|SELECT|TEXTAREA/.test(active.tagName)) return;
    if (REMOTE) { try { KV = await remoteAll(); S = C.stateFromKV(KV); } catch (e) { } }
    if (!UI.editRec && !UI.tk) render();
  }, 20000);

  load().then(render).catch(err => { $app.innerHTML = `<main class="wrap"><section class="card"><h2>No se pudo conectar</h2><p class="muted">${esc(err.message)}</p></section></main>`; });
})();
