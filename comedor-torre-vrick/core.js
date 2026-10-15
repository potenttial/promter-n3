/* Comedor Torre Vrick — núcleo de cálculo (compartido por la app y por el envío automático de WhatsApp)
   Desarrollado por N3 Labs · Thinktech IA Laboratory */
(function (g) {
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const dow = s => parse(s).getDay(); // 0 dom … 6 sáb
  const isWeekday = s => { const w = dow(s); return w >= 1 && w <= 5; };
  const monday = s => { const d = parse(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };
  const weekDays = mon => [0, 1, 2, 3, 4].map(i => addDays(mon, i));
  const nextWeekday = s => { let x = addDays(s, 1); while (!isWeekday(x)) x = addDays(x, 1); return x; };
  const prevWeekday = s => { let x = addDays(s, -1); while (!isWeekday(x)) x = addDays(x, -1); return x; };
  const range = (a, b) => { const out = []; for (let x = a; x <= b; x = addDays(x, 1)) out.push(x); return out; };
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const label = s => { const d = parse(s); return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`; };
  const short = s => { const d = parse(s); return `${DIAS[d.getDay()].slice(0, 3)} ${d.getDate()}`; };
  const money = n => '$' + (Math.round(n || 0)).toLocaleString('es-MX');
  const money2 = n => '$' + (n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* ---------- Estado a partir de pares clave/valor ---------- */
  function emptyState() {
    return { people: {}, purchases: {}, att: {}, menu: {}, served: {}, pub: {}, tickets: {}, ingredients: [], recipes: [], settings: {} };
  }
  function applyKV(S, key, value) {
    const p = key.split(':');
    const del = value === null || value === undefined;
    if (p[0] === 'person') { del ? delete S.people[p[1]] : S.people[p[1]] = value; }
    else if (p[0] === 'purchase') { del ? delete S.purchases[p[1]] : S.purchases[p[1]] = value; }
    else if (p[0] === 'att') { S.att[p[1]] = S.att[p[1]] || {}; del ? delete S.att[p[1]][p[2]] : S.att[p[1]][p[2]] = value; }
    else if (p[0] === 'menu') { del ? delete S.menu[p[1]] : S.menu[p[1]] = value; }
    else if (p[0] === 'ticket') { del ? delete S.tickets[p[1]] : S.tickets[p[1]] = value; }
    else if (p[0] === 'ticketimg') { /* las fotos se leen aparte */ }
    else if (p[0] === 'pub') { del ? delete S.pub[p[1]] : S.pub[p[1]] = value; }
    else if (p[0] === 'served') { del ? delete S.served[p[1]] : S.served[p[1]] = value; }
    else if (['ingredients', 'recipes', 'settings'].includes(key)) S[key] = del ? (key === 'settings' ? {} : []) : value;
    return S;
  }
  function stateFromKV(kv) { const S = emptyState(); for (const k in kv) applyKV(S, k, kv[k]); return S; }

  const DEFAULT_SETTINGS = { precio: 95, merma: 5, corte: '17:00', pinChef: '1234', pinDir: '2468' };
  const set = S => Object.assign({}, DEFAULT_SETTINGS, S.settings || {});

  /* ---------- Cálculos ---------- */
  const ingById = (S, id) => S.ingredients.find(i => i.id === id);
  const recById = (S, id) => S.recipes.find(r => r.id === id);
  // qty por porción: g (kg), ml (l) o piezas (pza)
  const isCount = u => u === 'pza' || u === 'porcion';
  const UNIT = { kg: { buy: 'kilo', use: 'g' }, l: { buy: 'litro', use: 'ml' }, pza: { buy: 'pieza', use: 'pza' }, porcion: { buy: 'porción', use: 'porc.' } };
  const lineCost = (ing, qty) => !ing ? 0 : (isCount(ing.unit) ? qty * ing.cost : qty / 1000 * ing.cost);
  const recipeCost = (S, r) => (r?.items || []).reduce((a, it) => a + lineCost(ingById(S, it.ing), it.qty), 0);
  const menuOf = (S, d) => (S.menu[d] || []).map(id => recById(S, id)).filter(Boolean);
  const isPublished = (S, d) => !!S.pub?.[monday(d)];
  const menuCost = (S, d) => menuOf(S, d).reduce((a, r) => a + recipeCost(S, r), 0);

  function day(S, d) {
    const a = S.att[d] || {};
    const out = { si: 0, no: 0, don: 0, list: [], notes: {}, comments: [] };
    for (const uid in a) {
      const r = a[uid]; const p = S.people[uid]; if (!p) continue;
      if (r.s === 'si') {
        out.si++; if (r.d) out.don++;
        out.list.push({ uid, name: p.name, area: p.area, d: !!r.d, tags: r.tags || [], n: r.n || '' });
        (r.tags || []).forEach(t => out.notes[t] = (out.notes[t] || 0) + 1);
        if (r.n) out.comments.push({ name: p.name, n: r.n });
      } else if (r.s === 'no') out.no++;
    }
    out.list.sort((x, y) => x.name.localeCompare(y.name));
    return out;
  }
  const portions = (S, d) => { const c = day(S, d).si; return c ? Math.ceil(c * (1 + set(S).merma / 100)) : 0; };
  const served = (S, d) => (S.served[d] != null ? S.served[d] : day(S, d).si);

  // Insumos necesarios para un conjunto de días
  function needs(S, dates) {
    const tot = {};
    dates.forEach(d => {
      const n = portions(S, d); if (!n) return;
      menuOf(S, d).forEach(r => r.items.forEach(it => { tot[it.ing] = (tot[it.ing] || 0) + it.qty * n; }));
    });
    return Object.keys(tot).map(id => {
      const ing = ingById(S, id); if (!ing) return null;
      const qty = isCount(ing.unit) ? tot[id] : tot[id] / 1000;
      return { id, name: ing.name, unit: ing.unit, qty, cost: qty * ing.cost };
    }).filter(Boolean).sort((a, b) => b.cost - a.cost);
  }

  // Balance del negocio en un rango [a, b] (solo días hábiles hasta hoy para consumo)
  function balance(S, a, b, today) {
    const st = set(S);
    const days = range(a, b).filter(isWeekday);
    const past = days.filter(d => d <= today);
    let comidas = 0, consumo = 0, don = 0, confirm = 0, resp = 0;
    const daily = past.map(d => {
      const k = day(S, d); const sv = served(S, d); const mc = menuCost(S, d);
      comidas += sv; consumo += sv * mc; don += k.don; confirm += k.si; resp += k.si + k.no;
      return { d, n: sv, cost: sv * mc, mc };
    });
    const inRange = p => p.date >= a && p.date <= b;
    const inversion = Object.values(S.purchases).filter(inRange).reduce((x, p) => x + (+p.total || 0), 0)
      + Object.values(S.tickets || {}).filter(inRange).reduce((x, t) => x + (+t.total || 0), 0);
    const ingresos = comidas * st.precio;
    const rent = ingresos - inversion;
    // recurrencia por persona
    const people = Object.entries(S.people).map(([uid, p]) => {
      const n = past.filter(d => S.att[d]?.[uid]?.s === 'si').length;
      return { uid, name: p.name, area: p.area || '', n, pct: past.length ? n / past.length : 0 };
    }).sort((x, y) => y.n - x.n || x.name.localeCompare(y.name));
    // platillos más servidos
    const dish = {};
    daily.forEach(x => menuOf(S, x.d).forEach(r => { dish[r.name] = (dish[r.name] || 0) + x.n; }));
    const dishes = Object.entries(dish).sort((x, y) => y[1] - x[1]).slice(0, 6);
    const tags = {};
    past.forEach(d => { const k = day(S, d); for (const t in k.notes) tags[t] = (tags[t] || 0) + k.notes[t]; });
    const activos = people.filter(p => p.n > 0).length;
    return {
      days: past.length, daily, comidas, consumo, inversion, ingresos, rent,
      margen: ingresos ? rent / ingresos : 0, merma: inversion - consumo,
      costoPlato: comidas ? consumo / comidas : 0, don, people, dishes, tags,
      activos, promDia: past.length ? comidas / past.length : 0,
      recurrencia: activos ? people.filter(p => p.n > 0).reduce((x, p) => x + p.pct, 0) / activos : 0,
      tasaConf: resp ? confirm / resp : 0, precio: st.precio
    };
  }

  /* ---------- Mensajes de WhatsApp ---------- */
  function msgChef(S, d) {
    const k = day(S, d); const st = set(S); const n = portions(S, d); const nd = needs(S, [d]);
    const tags = Object.entries(k.notes).sort((a, b) => b[1] - a[1]).map(([t, c]) => `${t} ×${c}`).join(', ');
    const L = [];
    L.push(`*Comedor Torre Vrick* · Resumen para el Chef Jorge`);
    L.push(`📅 ${label(d)}`);
    L.push(`✅ Confirmados: *${k.si}*${k.don ? ` (incluye ${k.don} donada${k.don > 1 ? 's' : ''})` : ''}`);
    L.push(`🍽 Porciones a preparar (+${st.merma}% merma): *${n}*`);
    const m = menuOf(S, d); if (m.length) L.push(`📋 Menú: ${m.map(r => r.name).join(' · ')}`);
    if (tags) L.push(`📝 Indicaciones: ${tags}`);
    if (k.comments.length) L.push(`💬 Sugerencias: ` + k.comments.slice(0, 5).map(c => `${c.name.split(' ')[0]}: "${c.n}"`).join(' | '));
    if (nd.length) {
      L.push(``, `*Insumos a provisionar:*`);
      nd.forEach(x => L.push(`• ${x.name}: ${fmtQty(x.qty, x.unit)} (~${money(x.cost)})`));
      L.push(`Costo estimado: *${money(nd.reduce((a, x) => a + x.cost, 0))}*`);
    } else L.push(``, `Sin menú o sin confirmados aún para este día.`);
    L.push(``, `— Sistema de comedor · N3 Labs`);
    return L.join('\n');
  }
  function msgDirector(S, mon, today) {
    const fri = addDays(mon, 4); const b = balance(S, mon, fri, today);
    const L = [];
    L.push(`*Comedor Torre Vrick* · Balance semanal`);
    L.push(`Lic. Villarreal, semana ${short(mon)} – ${short(fri)}:`);
    L.push(``, `🍽 Comidas servidas: *${b.comidas}* (prom. ${b.promDia.toFixed(1)}/día)`);
    L.push(`💰 Ingresos (a ${money(b.precio)}/comida): *${money(b.ingresos)}*`);
    L.push(`🛒 Inversión en insumos: *${money(b.inversion)}*`);
    L.push(`🥘 Consumo de insumos: ${money(b.consumo)} · costo/plato ${money2(b.costoPlato)}`);
    L.push(`📦 Diferencia compra vs. consumo (inventario/merma): ${money(b.merma)}`);
    L.push(`📈 Rentabilidad: *${money(b.rent)}* (margen ${(b.margen * 100).toFixed(1)}%)`);
    L.push(`👥 Comensales activos: ${b.activos} · recurrencia prom. ${(b.recurrencia * 100).toFixed(0)}%`);
    if (b.don) L.push(`🤝 Comidas donadas: ${b.don}`);
    if (b.dishes.length) L.push(`⭐ Más servido: ${b.dishes[0][0]}`);
    L.push(``, `— Sistema de comedor · N3 Labs`);
    return L.join('\n');
  }
  function fmtQty(q, u) {
    if (u === 'pza') return `${Math.ceil(q)} pza`;
    if (u === 'porcion') return `${Math.ceil(q)} porc.`;
    if (q < 1) return `${Math.round(q * 1000)} ${u === 'l' ? 'ml' : 'g'}`;
    return `${q.toFixed(2)} ${u}`;
  }

  const Core = {
    pad, iso, parse, addDays, dow, isWeekday, monday, weekDays, nextWeekday, prevWeekday, range, label, short,
    DIAS, MESES, money, money2, fmtQty, emptyState, applyKV, stateFromKV, DEFAULT_SETTINGS, set,
    ingById, recById, isCount, UNIT, lineCost, recipeCost, menuOf, isPublished, menuCost, day, portions, served, needs, balance, msgChef, msgDirector
  };
  g.Core = Core;
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
})(typeof window !== 'undefined' ? window : globalThis);
