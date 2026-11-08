/* CURAQ · Test Próstata 2027 — API de votos en vivo (n3.potenttial.com/curaq/api.php)
   GET  /curaq/api.php?ev=EVENTO          -> todos los votos del evento (JSON)
   POST /curaq/api.php?ev=EVENTO&id=UID   -> guarda/actualiza las respuestas de un participante
   Se guarda en data/curaq/EVENTO.json. Memoria + escritura diferida (máx. 1 vez por segundo). */
import fs from 'node:fs';
import path from 'node:path';

const ALLOWED = ['perfil', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'];
const MAX_PER_EVENT = 5000;
const cache = new Map();   // ev -> objeto de votos
const timers = new Map();

function dirFor(root) { const d = path.join(root, 'data', 'curaq'); fs.mkdirSync(d, { recursive: true }); return d; }
function load(root, ev) {
  if (cache.has(ev)) return cache.get(ev);
  let data = {};
  try { data = JSON.parse(fs.readFileSync(path.join(dirFor(root), ev + '.json'), 'utf8')) || {}; } catch { data = {}; }
  cache.set(ev, data);
  return data;
}
function persist(root, ev) {
  if (timers.has(ev)) return;
  timers.set(ev, setTimeout(() => {
    timers.delete(ev);
    const file = path.join(dirFor(root), ev + '.json');
    fs.writeFile(file + '.tmp', JSON.stringify(cache.get(ev) || {}), err => {
      if (err) return console.error('[curaq] write', err);
      fs.rename(file + '.tmp', file, e => e && console.error('[curaq] rename', e));
    });
  }, 1000));
}
function clean(v) {
  if (Number.isInteger(v) && v >= 0 && v < 10) return v;
  if (Array.isArray(v) && v.length <= 10) return [...new Set(v.filter(x => Number.isInteger(x) && x >= 0 && x < 10))].sort((a, b) => a - b);
  return undefined;
}

export async function handleCuraq(req, res, search, root) {
  const h = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*',
              'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
  if (req.method === 'OPTIONS') { res.writeHead(204, h).end(); return; }
  const q = new URLSearchParams(search || '');
  const ev = (q.get('ev') || 'conferencia-2026').replace(/[^a-z0-9_-]/gi, '').slice(0, 60) || 'conferencia-2026';
  const data = load(root, ev);

  if (req.method === 'GET' || req.method === 'HEAD') { res.writeHead(200, h).end(JSON.stringify(data)); return; }
  if (req.method !== 'POST') { res.writeHead(405, h).end('{"error":"metodo"}'); return; }

  const id = (q.get('id') || '').replace(/[^a-z0-9]/gi, '').slice(0, 40);
  if (!id) { res.writeHead(400, h).end('{"error":"id"}'); return; }
  let body = '';
  for await (const c of req) { body += c; if (body.length > 4096) break; }
  let input; try { input = JSON.parse(body); } catch { input = null; }
  if (!input || typeof input !== 'object') { res.writeHead(400, h).end('{"error":"json"}'); return; }

  const patch = {};
  for (const k of ALLOWED) if (k in input) { const v = clean(input[k]); if (v !== undefined) patch[k] = v; }
  if (!Object.keys(patch).length) { res.writeHead(400, h).end('{"error":"vacio"}'); return; }
  if (!data[id] && Object.keys(data).length >= MAX_PER_EVENT) { res.writeHead(429, h).end('{"error":"limite"}'); return; }
  patch.t = Date.now();
  data[id] = Object.assign(data[id] || {}, patch);
  persist(root, ev);
  res.writeHead(200, h).end('{"ok":true}');
}
