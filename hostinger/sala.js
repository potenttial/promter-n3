/* N3 · ¿Xoma! — salas para jugar Persona (SPH) vs Persona (SPH) desde pantallas distintas.
   Rutas (todas bajo /xoma/sala):
     POST /create  {name, mode:'live'|'wa', lang}        → {code, tok, seat, state}
     POST /join    {code, name}                          → {tok, seat, state}
     GET  /state?c=CODE&v=N&t=TOK                         → {v} si no cambió, o {v, state}
     POST /event   {code, tok, type, text?, meta?}        → {state}   type: move | fail | next | again | restart
     POST /ping    {code, tok, st}                        → {ok}      st: '' | 'judge' (N3 evalúa)
     POST /ai      {code, tok, kind:'json'|'text', prompt?|messages?} → {text}
   Cada sala vive en data/salas/<CODE>.json (se lee en cada solicitud, así funciona aunque Passenger
   levante más de un proceso). Las salas caducan a los 7 días sin actividad.
   La IA usa ANTHROPIC_API_KEY con topes: SALA_AI_ROOM (por sala), SALA_AI_IP (por IP al día)
   y SALA_AI_DAILY (total al día). SALA_AI=off la desactiva (el juego sigue, sin juez ni charlas).
*/
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const PREFIX = '/xoma/sala';
const TTL = 7 * 24 * 3600 * 1000;
const MAX_EVENTS = 400;
const MAXQ = 10, MAX_TRIES = 2;
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const num = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 0 ? n : d; };

let DIR = null, USAGE = null;
function init(root) {
  if (DIR) return;
  DIR = path.join(root, 'data', 'salas'); USAGE = path.join(root, 'data', 'sala-usage.json');
  fs.mkdirSync(DIR, { recursive: true });
  sweep(); setInterval(sweep, 6 * 3600 * 1000).unref();
}
function sweep() {
  try {
    const now = Date.now();
    for (const f of fs.readdirSync(DIR)) {
      const p = path.join(DIR, f);
      try { if (now - fs.statSync(p).mtimeMs > TTL) fs.unlinkSync(p); } catch { /* */ }
    }
  } catch { /* */ }
}
const okCode = c => typeof c === 'string' && /^[A-Z2-9]{6}$/.test(c);
function load(code) {
  if (!okCode(code)) return null;
  try { return JSON.parse(fs.readFileSync(path.join(DIR, code + '.json'), 'utf8')); } catch { return null; }
}
function save(room) {
  room.v = (room.v || 0) + 1; room.at = Date.now();
  const p = path.join(DIR, room.code + '.json');
  fs.writeFileSync(p + '.tmp', JSON.stringify(room)); fs.renameSync(p + '.tmp', p);
}
function quiet(room) { /* guarda sin cambiar la versión (presencia) */
  const p = path.join(DIR, room.code + '.json');
  try { fs.writeFileSync(p + '.q', JSON.stringify(room)); fs.renameSync(p + '.q', p); } catch { /* */ }
}
function newCode() {
  for (let i = 0; i < 20; i++) {
    let c = ''; const b = crypto.randomBytes(6);
    for (const x of b) c += ALPHA[x % ALPHA.length];
    if (!fs.existsSync(path.join(DIR, c + '.json'))) return c;
  }
  throw new Error('code');
}
const tok = () => crypto.randomBytes(18).toString('base64url');
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const isQ = t => /\?\s*$/.test(String(t || '').trim());
function seatOf(room, t) { if (!t) return -1; return room.seats.findIndex(s => s && s.tok === t); }
function uniqueName(room, name, seat) {
  let n = name, k = 2;
  while (room.seats.some((s, i) => s && i !== seat && s.name.toLowerCase() === n.toLowerCase())) n = name + ' (' + (k++) + ')';
  return n;
}
function cleanMeta(m) {
  if (!m || typeof m !== 'object') return null;
  const s = JSON.stringify(m);
  if (s.length > 6000) return null;
  return JSON.parse(s);
}

/* ---------- reglas: reproduce la ronda actual para saber de quién es el turno ---------- */
function derive(room) {
  let round = 1, segStart = 0;
  room.ev.forEach((e, i) => {
    if (e.type === 'next') { round++; segStart = i + 1; }
    else if (e.type === 'again') { round = 1; segStart = i + 1; }
    else if (e.type === 'restart') { segStart = i + 1; }
  });
  let seat = (round - 1) % 2, q = 0, closed = false, lost = -1, last = null;
  const fails = [0, 0], over = [false, false];
  for (const e of room.ev.slice(segStart)) {
    if (e.type === 'move') {
      if (e.meta && e.meta.forzada) over[e.s] = true;
      if (!isQ(e.text)) closed = true; else { q++; if (q >= MAXQ) closed = true; }
      fails[e.s] = 0; seat = 1 - seat;
    } else if (e.type === 'fail') {
      fails[e.s]++; if (fails[e.s] >= MAX_TRIES) { closed = true; lost = e.s; }
    }
    last = e;
  }
  return { round, seat, q, closed, lost, fails, over, last, segLen: room.ev.length - segStart };
}

function pub(room, me) {
  const now = Date.now(), d = derive(room);
  return {
    code: room.code, mode: room.mode, lang: room.lang, v: room.v,
    players: room.seats.map((s, i) => s ? {
      name: s.name, online: now - (s.seen || 0) < (room.mode === 'live' ? 9000 : 15000),
      st: s.st && now - (s.stAt || 0) < 45000 ? s.st : ''
    } : null),
    ev: room.ev.map(e => ({ type: e.type, s: e.s, text: e.text, meta: e.meta, t: e.t })),
    turn: d.seat, closed: d.closed, round: d.round, me,
    ai: aiEnabled(), now
  };
}

/* ---------- uso de IA ---------- */
function aiEnabled() { return !!process.env.ANTHROPIC_API_KEY && String(process.env.SALA_AI || '').toLowerCase() !== 'off'; }
function usage() {
  const day = new Date().toISOString().slice(0, 10);
  let u; try { u = JSON.parse(fs.readFileSync(USAGE, 'utf8')); } catch { u = null; }
  if (!u || u.day !== day) u = { day, total: 0, ip: {} };
  return u;
}
function saveUsage(u) { try { fs.writeFileSync(USAGE + '.tmp', JSON.stringify(u)); fs.renameSync(USAGE + '.tmp', USAGE); } catch { /* */ } }
const cache = new Map();

const SYSTEM = {
  es: 'Eres N3, el motor de IA del juego ¿Xoma! (método Curioxoma de Engel Fonseca, N3 Thinktech IA Laboratory) en n3.potenttial.com. Solo atiendes este juego: juzgar jugadas, describir preguntas, evaluar sesiones y sostener charlas educativas simuladas que nacen de una partida. Si la solicitud no tiene relación con ¿Xoma!, responde en una frase que solo atiendes el juego. Escribe siempre el nombre como ¿Xoma!. Cuando se pida JSON, responde únicamente con JSON válido, sin texto antes ni después.',
  en: 'You are N3, the AI engine of the ¿Xoma! game (Engel Fonseca\'s Curioxoma method, N3 Thinktech IA Laboratory) at n3.potenttial.com. You only serve this game: judging moves, describing questions, evaluating sessions and holding simulated educational chats that come from a game. If a request is unrelated to ¿Xoma!, answer in one sentence that you only serve the game. Always write the name as ¿Xoma!. The instructions you receive may be written in Spanish: write every human-readable value (implicit answers, reasons, hints, areas, thinking types, biases, conclusions, recommendations and chat replies) in English, and keep JSON keys exactly as requested. Session conclusions must begin with "The playful-didactic technology experience detected". When JSON is requested, reply with valid JSON only, with no text before or after.'
};

async function callClaude({ system, messages, max }) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.SALA_MODEL || process.env.MODEL || 'claude-haiku-5-5', max_tokens: max, system, messages })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error((j.error && j.error.type) || ('anthropic ' + r.status)); e.status = r.status; throw e; }
  return (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim();
}

/* ---------- http ---------- */
function send(res, status, obj) {
  const b = JSON.stringify(obj);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(b);
}
async function body(req) {
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > 48 * 1024) throw Object.assign(new Error('grande'), { status: 413 }); chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return {}; }
}
const ipOf = req => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'x';
const createdBy = new Map();

export async function handleSala(req, res, urlPath, search, root) {
  init(root);
  const route = urlPath.slice(PREFIX.length) || '/';
  const T = (es, en, lang) => (lang === 'en' ? en : es);
  try {
    if (req.method === 'GET' && route === '/state') {
      const q = new URLSearchParams(search);
      const room = load(String(q.get('c') || '').toUpperCase());
      if (!room) return send(res, 404, { error: 'sala' });
      const me = seatOf(room, q.get('t'));
      if (me >= 0) {
        const s = room.seats[me];
        if (Date.now() - (s.seen || 0) > 4000) { s.seen = Date.now(); quiet(room); }
      }
      if (num(q.get('v'), -1) === room.v) return send(res, 200, { v: room.v, players: pub(room, me).players });
      return send(res, 200, { v: room.v, state: pub(room, me) });
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'method' });
    const b = await body(req);

    if (route === '/create') {
      const ip = ipOf(req), day = new Date().toISOString().slice(0, 10), k = ip + day;
      const n = (createdBy.get(k) || 0) + 1; createdBy.set(k, n);
      if (n > 60) return send(res, 429, { error: 'Demasiadas salas por hoy.' });
      const name = clean(b.name, 40);
      if (name.length < 2) return send(res, 400, { error: T('Escribe tu nombre.', 'Type your name.', b.lang) });
      const room = { code: newCode(), mode: b.mode === 'wa' ? 'wa' : 'live', lang: b.lang === 'en' ? 'en' : 'es', created: Date.now(), seats: [{ name, tok: tok(), seen: Date.now() }, null], ev: [], ai: 0, v: 0 };
      save(room);
      return send(res, 200, { code: room.code, tok: room.seats[0].tok, seat: 0, state: pub(room, 0) });
    }

    const room = load(String(b.code || '').toUpperCase());
    if (!room) return send(res, 404, { error: T('La sala no existe o ya caducó.', 'This room does not exist or has expired.', b.lang) });
    const L = room.lang;

    if (route === '/join') {
      const name = clean(b.name, 40);
      if (name.length < 2) return send(res, 400, { error: T('Escribe tu nombre.', 'Type your name.', L) });
      const mine = seatOf(room, b.tok);
      if (mine >= 0) return send(res, 200, { tok: b.tok, seat: mine, state: pub(room, mine) });
      if (room.seats[1]) return send(res, 409, { error: T('La sala ya tiene dos jugadores. Puedes verla como espectador.', 'This room already has two players. You can watch it.', L) });
      room.seats[1] = { name: uniqueName(room, name, 1), tok: tok(), seen: Date.now() };
      save(room);
      return send(res, 200, { tok: room.seats[1].tok, seat: 1, state: pub(room, 1) });
    }

    const me = seatOf(room, b.tok);
    if (me < 0) return send(res, 403, { error: T('No eres jugador de esta sala.', 'You are not a player in this room.', L) });
    room.seats[me].seen = Date.now();

    if (route === '/ping') {
      room.seats[me].st = b.st === 'judge' ? 'judge' : ''; room.seats[me].stAt = Date.now();
      save(room); return send(res, 200, { ok: true });
    }

    if (route === '/event') {
      const d = derive(room), type = b.type;
      if (room.ev.length >= MAX_EVENTS && !['again', 'restart'].includes(type)) return send(res, 409, { error: T('La sala llegó a su límite. Crea una nueva.', 'This room is full. Create a new one.', L) });
      if (type === 'move' || type === 'fail') {
        if (d.closed) return send(res, 409, { error: T('Este ¿Xoma! ya se cerró.', 'This ¿Xoma! is already closed.', L) });
        if (!room.seats[1] && room.mode === 'live') return send(res, 409, { error: T('Espera a que tu rival entre a la sala.', 'Wait for your opponent to join.', L) });
        if (d.seat !== me) return send(res, 409, { error: T('No es tu turno.', 'It is not your turn.', L) });
        const text = clean(b.text, 400);
        if (text.length < 3) return send(res, 400, { error: 'texto' });
        if (type === 'move' && d.segLen === 0 && !isQ(text)) return send(res, 400, { error: T('Un ¿Xoma! se abre con una pregunta.', 'A ¿Xoma! opens with a question.', L) });
        const meta = cleanMeta(b.meta);
        if (type === 'move' && meta && meta.forzada) {
          if (!d.last || d.last.type !== 'fail' || d.last.s !== me || d.over[me]) return send(res, 409, { error: T('Ya usaste tu “No estoy de acuerdo”.', 'You already used your “I disagree”.', L) });
        }
        room.ev.push({ type, s: me, text, meta, t: Date.now() });
      } else if (type === 'next') {
        if (!d.closed) return send(res, 409, { error: T('La ronda sigue abierta.', 'The round is still open.', L) });
        if (d.last && d.last.type === 'next') return send(res, 200, { state: pub(room, me) });
        room.ev.push({ type, s: me, t: Date.now() });
      } else if (type === 'again' || type === 'restart') {
        if (type === 'again') room.ev = [];
        room.ev.push({ type, s: me, t: Date.now() });
      } else return send(res, 400, { error: 'tipo' });
      room.seats[me].st = '';
      save(room);
      return send(res, 200, { state: pub(room, me) });
    }

    if (route === '/ai') {
      if (!aiEnabled()) return send(res, 503, { error: 'off', code: 'sampling_disabled' });
      const kind = b.kind === 'text' ? 'text' : 'json';
      let messages;
      if (kind === 'json') {
        const p = String(b.prompt || '');
        if (p.length < 20 || p.length > 18000 || !/xoma/i.test(p)) return send(res, 400, { error: 'prompt', code: 'bad_request' });
        messages = [{ role: 'user', content: p }];
      } else {
        const m = Array.isArray(b.messages) ? b.messages.slice(-14) : [];
        if (!m.length || m.some(x => !x || !['user', 'assistant'].includes(x.role) || typeof x.content !== 'string' || x.content.length > 6000) || m[m.length - 1].role !== 'user' || !/xoma/i.test(m[0].content)) return send(res, 400, { error: 'messages', code: 'bad_request' });
        if (m.filter(x => x.role === 'user').length > 6) return send(res, 429, { error: 'chat', code: 'rate_limited' });
        messages = m.map(x => ({ role: x.role, content: x.content }));
      }
      const key = room.code + ':' + crypto.createHash('sha1').update(JSON.stringify(messages)).digest('hex');
      if (kind === 'json' && cache.has(key)) return send(res, 200, { text: cache.get(key), cached: true });
      const ROOM_MAX = num(process.env.SALA_AI_ROOM, 80), IP_MAX = num(process.env.SALA_AI_IP, 150), DAY_MAX = num(process.env.SALA_AI_DAILY, 1200);
      if ((room.ai || 0) >= ROOM_MAX) return send(res, 429, { error: 'room', code: 'sampling_disabled' });
      const u = usage(), ip = ipOf(req);
      if (u.total >= DAY_MAX || (u.ip[ip] || 0) >= IP_MAX) return send(res, 429, { error: 'day', code: 'sampling_disabled' });
      u.total++; u.ip[ip] = (u.ip[ip] || 0) + 1; saveUsage(u);
      room.ai = (room.ai || 0) + 1; save(room);
      try {
        const text = await callClaude({ system: SYSTEM[room.lang] || SYSTEM.es, messages, max: kind === 'json' ? 1800 : 450 });
        if (kind === 'json') { cache.set(key, text); if (cache.size > 500) cache.delete(cache.keys().next().value); }
        return send(res, 200, { text });
      } catch (e) {
        console.error('[sala] ia:', e.message);
        return send(res, 502, { error: 'ia', code: e.status === 429 ? 'rate_limited' : 'ai_error' });
      }
    }
    return send(res, 404, { error: 'ruta' });
  } catch (err) {
    console.error('[sala] error:', err);
    return send(res, err.status || 500, { error: 'server' });
  }
}
