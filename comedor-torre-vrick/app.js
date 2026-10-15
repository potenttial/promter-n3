/* Comedor Torre Vrick — App (mobile first)
   Desarrollado por N3 Labs · Thinktech IA Laboratory */
(function () {
  const C = window.Core, CFG = window.COMEDOR_CONFIG || {};
  const REMOTE = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
  const LS = 'tv_comedor_kv_v1', LS_USER = 'tv_comedor_user';
  const TEL_CHEF = CFG.TEL_CHEF || '525524962677', TEL_DIR = CFG.TEL_DIRECTOR || '525554054868';
  const TAGS = ['Sin picante', 'Vegetariano', 'Sin cebolla', 'Porción chica', 'Sin gluten', 'Sin lácteos'];
  const CATS = ['Sopa', 'Plato fuerte', 'Guarnición', 'Bebida', 'Postre', 'Acompañamiento'];
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
      const r = await fetch(`${CFG.SUPABASE_URL}/rest/v1/kv?select=key,value&order=key`, { headers: { ...H(), Range: `${from}-${from + 999}` } });
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
        <p class="menu">${m.length ? m.map(x => esc(x.name)).join(' · ') : '<span class="muted">Menú por publicar</span>'}</p>
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
    const tabs = [['hoy', 'Hoy'], ['menu', 'Menú'], ['compras', 'Compras'], ['recetas', 'Platillos'], ['insumos', 'Costos']];
    const body = { hoy: chefHoy, menu: chefMenu, compras: chefCompras, recetas: chefRecetas, insumos: chefInsumos, ajustes: chefAjustes }[UI.chefTab]();
    return `${header('Chef Jorge', `<button class="icon" data-a="ctab" data-v="ajustes" aria-label="Ajustes">⚙︎</button>`)}
      <main class="wrap pb">${body}</main>
      <nav class="bottom">${tabs.map(([k, l]) => `<button class="${UI.chefTab === k ? 'on' : ''}" data-a="ctab" data-v="${k}">${l}</button>`).join('')}</nav>
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
    return `<h2 class="sec">Comensales</h2>${dayPicker(d, 'cday')}
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
    const rs = S.recipes;
    const days = C.weekDays(mon).map(d => {
      const m = S.menu[d] || [];
      return `<article class="card mday"><div class="day-h"><b>${C.label(d)}</b><span class="small muted">${C.money2(C.menuCost(S, d))}/plato · ${C.day(S, d).si} conf.</span></div>
        <div class="chips">${m.map(id => { const r = C.recById(S, id); return r ? `<span class="chip on static">${esc(r.name)} <button class="x" data-a="mdel" data-d="${d}" data-v="${id}" aria-label="Quitar">×</button></span>` : ''; }).join('') || '<span class="muted small">Sin platillos</span>'}</div>
        <select data-c="madd" data-d="${d}"><option value="">+ Agregar platillo…</option>${CATS.map(c => { const g = rs.filter(r => r.cat === c && !m.includes(r.id)); return g.length ? `<optgroup label="${c}">${g.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}</optgroup>` : ''; }).join('')}</select>
      </article>`;
    }).join('');
    return `<h2 class="sec">Menú semanal</h2>
      <div class="weeknav"><button class="icon" data-a="mweek" data-v="-1">‹</button><b>${C.short(mon)} – ${C.short(C.addDays(mon, 4))}</b><button class="icon" data-a="mweek" data-v="1">›</button></div>
      <button class="btn ghost full" data-a="mcopy" data-v="${mon}">Copiar menú de la semana anterior</button>
      ${days}`;
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
      <section class="card"><h3>Registrar compra (inversión)</h3>
        <div class="grid2">
          <label>Fecha<input type="date" id="pDate" value="${today()}"></label>
          <label>Insumo<select id="pIng">${S.ingredients.map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join('')}</select></label>
          <label>Cantidad<input type="number" step="0.01" id="pQty" placeholder="kg / l / pza"></label>
          <label>Total pagado $<input type="number" step="0.01" id="pTot" placeholder="0.00"></label>
        </div>
        <label>Proveedor / nota<input id="pNote" placeholder="Ej. Central de Abasto"></label>
        <button class="btn full" data-a="buy">Guardar compra</button></section>
      <section class="card"><h3>Compras recientes</h3>
        <ul class="plain">${purch.map(([id, p]) => { const i = C.ingById(S, p.ing); return `<li><span>${esc(i?.name || p.ing)}<small>${C.short(p.date)} · ${p.qty} ${p.unit || i?.unit || ''} ${p.note ? '· ' + esc(p.note) : ''}</small></span><em>${C.money(p.total)} <button class="x" data-a="pdel" data-v="${id}" aria-label="Eliminar">×</button></em></li>`; }).join('') || '<li class="muted">Sin compras registradas</li>'}</ul></section>`;
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
      ${CATS.map(c => { const g = S.recipes.filter(r => r.cat === c); return g.length ? `<section class="card"><h3>${c}</h3><ul class="plain">${g.map(r => `<li class="tap" data-a="redit" data-v="${r.id}"><span>${esc(r.name)}<small>${r.items.map(it => esc(C.ingById(S, it.ing)?.name || '')).filter(Boolean).slice(0, 4).join(', ')}${r.items.length > 4 ? '…' : ''}</small></span><em>${C.money2(C.recipeCost(S, r))}</em></li>`).join('')}</ul></section>` : ''; }).join('')}`;
  }
  function recEditor() {
    const r = UI.editRec; const cost = C.recipeCost(S, r); const ni = UI.ni || (UI.ni = { unit: 'kg' });
    return `<h2 class="sec">${S.recipes.find(x => x.id === r.id) ? 'Editar' : 'Nuevo'} platillo</h2>
      <section class="card">
        <label>Nombre del platillo<input data-c="rname" value="${esc(r.name)}" placeholder="Ej. Pollo al perejil"></label>
        <label>Categoría<select data-c="rcat">${CATS.map(c => `<option ${c === r.cat ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
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
    return `<h2 class="sec">Ingredientes y condimentos</h2>
      <p class="small muted">Tu lista crece sola cada vez que agregas un ingrediente nuevo a un platillo. Costo por kilo, litro, pieza o porción.</p>
      <input class="search" id="ingQ" placeholder="Buscar ingrediente…" value="${esc(UI.ingQ || '')}">
      <section class="card">${rows.map(([x, i]) => `<div class="ingr"><input data-c="iname" data-i="${i}" value="${esc(x.name)}">
        <select data-c="iunit" data-i="${i}">${UNITS.map(([u, l]) => `<option value="${u}" ${u === x.unit ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <label class="money"><span>$</span><input type="number" step="0.01" data-c="icost" data-i="${i}" value="${x.cost}"></label></div>`).join('') || '<p class="muted small">Sin resultados.</p>'}
        <button class="btn ghost full" data-a="iadd">+ Agregar ingrediente</button></section>`;
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
    const y = window.scrollY; $app.innerHTML = view() + installSheet(); window.scrollTo(0, y);
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
    ctab(el) { UI.chefTab = el.dataset.v; UI.editRec = null; window.scrollTo(0, 0); render(); },
    cday(el) { UI.chefDay = el.dataset.v; render(); },
    toggleList() { UI.showList = !UI.showList; render(); },
    mweek(el) { UI.menuWeek += +el.dataset.v; render(); },
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
    rcancel() { UI.editRec = null; render(); },
    async rsave() {
      const r = UI.editRec; if (!r.name.trim()) return toast('Ponle nombre al platillo');
      const list = S.recipes.filter(x => x.id !== r.id); const idx = S.recipes.findIndex(x => x.id === r.id);
      idx >= 0 ? list.splice(idx, 0, r) : list.push(r);
      await kvSet('recipes', list); UI.editRec = null; render(); toast('Platillo guardado');
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
  document.addEventListener('change', e => { const el = e.target.closest('[data-c]'); if (el && CHG[el.dataset.c]) CHG[el.dataset.c](el, e); });
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'acIn') { if (UI.ni) { UI.ni.name = t.value; UI.ni.ing = null; } acRender(t.value); }
    else if (t.id === 'ingQ') { UI.ingQ = t.value; const p = t.selectionStart; render(); const n = document.getElementById('ingQ'); n.focus(); n.setSelectionRange(p, p); }
    else if (t.dataset.c === 'rname') UI.editRec.name = t.value;
  });
  document.addEventListener('focusin', e => { if (e.target.id === 'acIn') acRender(e.target.value); });
  document.addEventListener('click', e => { const l = document.getElementById('acList'); if (l && !e.target.closest('.ac')) l.hidden = true; });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'acIn') { e.preventDefault(); const f = document.querySelector('#acList button'); f ? f.click() : null; return; }
    if (e.key === 'Enter' && e.target.id === 'niQty') { e.preventDefault(); ACT.niadd(); return; } if (e.key === 'Enter' && e.target.id === 'pin') document.querySelector('[data-a="pin"]')?.click(); });

  // "Tiempo real": otros pestañas del mismo equipo / sondeo al servidor cada 20 s
  window.addEventListener('storage', e => { if (e.key === LS) { KV = JSON.parse(e.newValue || '{}'); S = C.stateFromKV(KV); render(); } });
  setInterval(async () => {
    const active = document.activeElement; if (active && /INPUT|SELECT|TEXTAREA/.test(active.tagName)) return;
    if (REMOTE) { try { KV = await remoteAll(); S = C.stateFromKV(KV); } catch (e) { } }
    if (!UI.editRec) render();
  }, 20000);

  load().then(render).catch(err => { $app.innerHTML = `<main class="wrap"><section class="card"><h2>No se pudo conectar</h2><p class="muted">${esc(err.message)}</p></section></main>`; });
})();
