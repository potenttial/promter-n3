/* N3 · n3.potenttial.com — servidor Node.js para Hostinger (Business Web Hosting → Node.js Apps)
   - Sirve las herramientas de /public (antes en potenttial.github.io/promter-n3):
       /c-level.html · /mapa-sph/ · /xoma/ · casos .xlsx · etc.
   - Expone la API de ¿Xoma! en /xoma/api/* ejecutando worker.js (el Worker original de Cloudflare, sin cambios)
     con un KV en archivo (data/kv.json) en lugar del KV de Cloudflare.
   - Salas de ¿Xoma! en /xoma/sala/* (sala.js): Persona vs Persona desde pantallas distintas.
   Sin dependencias externas. Requiere Node.js 20 o superior.
*/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from './worker.js';
import { handleSala } from './sala.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const API_PREFIX = '/xoma/api';

/* ---------- .env opcional (las variables del panel de Hostinger tienen prioridad) ---------- */
try {
  for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
} catch { /* sin .env */ }

/* ---------- KV compatible con Cloudflare (get / put con expirationTtl / delete) ---------- */
class FileKV {
  constructor(file) {
    this.file = file; this.map = new Map(); this.timer = null;
    try { for (const [k, e] of Object.entries(JSON.parse(fs.readFileSync(file, 'utf8')))) this.map.set(k, e); } catch { /* vacío */ }
  }
  #live(k) {
    const e = this.map.get(k);
    if (!e) return null;
    if (e.exp && e.exp < Date.now()) { this.map.delete(k); return null; }
    return e;
  }
  async get(k) { const e = this.#live(k); return e ? e.v : null; }
  async put(k, v, opts = {}) {
    this.map.set(k, { v: String(v), exp: opts.expirationTtl ? Date.now() + opts.expirationTtl * 1000 : 0 });
    this.#save();
  }
  async delete(k) { this.map.delete(k); this.#save(); }
  #save() { clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 150); }
  flush() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const now = Date.now(), out = {};
      for (const [k, e] of this.map) if (!e.exp || e.exp > now) out[k] = e;
      fs.writeFileSync(this.file + '.tmp', JSON.stringify(out));
      fs.renameSync(this.file + '.tmp', this.file);
    } catch (err) { console.error('[kv] no se pudo guardar:', err.message); }
  }
}

const kv = new FileKV(path.join(ROOT, 'data', 'kv.json'));
const env = {
  ...process.env,
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || 'https://n3.potenttial.com,https://potenttial.github.io',
  XOMA: kv
};

if (!env.ANTHROPIC_API_KEY) console.warn('[n3] Falta ANTHROPIC_API_KEY: el juez de ¿Xoma! no funcionará.');
if (!env.PLAY_KEY) console.warn('[n3] PLAY_KEY no definida: ¿Xoma! usa la contraseña por defecto del código.');
if (!env.ADMIN_KEY) console.warn('[n3] ADMIN_KEY no definida: el panel /xoma/admin.html queda deshabilitado.');

/* ---------- archivos estáticos ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.pdf': 'application/pdf', '.zip': 'application/zip', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp4': 'video/mp4',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.webmanifest': 'application/manifest+json'
};

function sendStatic(req, res, urlPath) {
  let rel;
  try { rel = decodeURIComponent(urlPath); } catch { res.writeHead(400).end(); return; }
  const file = path.normalize(path.join(PUBLIC, rel));
  if (file !== PUBLIC && !file.startsWith(PUBLIC + path.sep)) { res.writeHead(403).end(); return; }

  let target = file, stat;
  try { stat = fs.statSync(target); } catch { stat = null; }
  if (stat && stat.isDirectory()) {
    if (!urlPath.endsWith('/')) { res.writeHead(301, { Location: urlPath + '/' }).end(); return; }
    target = path.join(target, 'index.html');
    try { stat = fs.statSync(target); } catch { stat = null; }
  }
  if (!stat || !stat.isFile()) {
    const nf = path.join(PUBLIC, '404.html');
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    res.end(fs.existsSync(nf) ? fs.readFileSync(nf) : '<h1>404</h1><p><a href="/">N3</a></p>');
    return;
  }
  const ext = path.extname(target).toLowerCase();
  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'content-length': stat.size,
    'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    'x-content-type-options': 'nosniff'
  });
  if (req.method === 'HEAD') { res.end(); return; }
  fs.createReadStream(target).pipe(res);
}

/* ---------- API de ¿Xoma! (puente Node ⇄ Request/Response del worker) ---------- */
const MAX_BODY = 64 * 1024;

async function sendApi(req, res, urlPath, search) {
  const chunks = []; let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) { res.writeHead(413).end(); return; }
    chunks.push(c);
  }
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'x';
  headers.set('CF-Connecting-IP', ip);

  const workerPath = urlPath.slice(API_PREFIX.length) || '/';
  const hasBody = !['GET', 'HEAD'].includes(req.method) && chunks.length;
  const request = new Request(`http://${req.headers.host || 'localhost'}${workerPath}${search}`, {
    method: req.method, headers, body: hasBody ? Buffer.concat(chunks) : undefined
  });
  const response = await worker.fetch(request, env);
  const out = {};
  response.headers.forEach((v, k) => { out[k] = v; });
  res.writeHead(response.status, out);
  res.end(Buffer.from(await response.arrayBuffer()));
}

/* ---------- servidor ---------- */
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    if (p === API_PREFIX || p.startsWith(API_PREFIX + '/')) return await sendApi(req, res, p, url.search);
    if (p === '/xoma/sala' || p.startsWith('/xoma/sala/')) return await handleSala(req, res, p, url.search, ROOT);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { allow: 'GET, HEAD' }).end(); return; }
    sendStatic(req, res, p);
  } catch (err) {
    console.error('[n3] error:', err);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'server' }));
  }
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => console.log(`[n3] escuchando en el puerto ${PORT}`));

for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { kv.flush(); server.close(() => process.exit(0)); });
