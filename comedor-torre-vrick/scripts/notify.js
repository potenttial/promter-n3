/* Envío automático por WhatsApp — Comedor Torre Vrick (N3 Labs)
   L–V 18:00 (CDMX): resumen de confirmados + insumos al Chef Jorge.
   Viernes 18:00: balance semanal al Lic. Villarreal.
   Variables (GitHub → Settings → Secrets and variables → Actions):
     SUPABASE_URL, SUPABASE_KEY            → base de datos del comedor
     WA_PROVIDER = "meta" | "callmebot"
     meta:      WA_TOKEN, WA_PHONE_ID      (WhatsApp Cloud API de Meta)
     callmebot: CALLMEBOT_KEY_CHEF, CALLMEBOT_KEY_DIR
     TEL_CHEF (def. 525524962677), TEL_DIRECTOR (def. 525554054868)
     MODE = auto | chef | director | both  (para pruebas manuales) */
const Core = require('../core.js');
const E = process.env;
const TEL_CHEF = E.TEL_CHEF || '525524962677', TEL_DIR = E.TEL_DIRECTOR || '525554054868';

async function loadState() {
  if (!E.SUPABASE_URL || !E.SUPABASE_KEY) throw new Error('Falta SUPABASE_URL / SUPABASE_KEY: el sistema está en modo demo.');
  const kv = {}; let from = 0;
  for (;;) {
    const r = await fetch(`${E.SUPABASE_URL}/rest/v1/kv?select=key,value&order=key`, {
      headers: { apikey: E.SUPABASE_KEY, Authorization: 'Bearer ' + E.SUPABASE_KEY, Range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error('Supabase ' + r.status + ' ' + await r.text());
    const rows = await r.json(); rows.forEach(x => kv[x.key] = x.value);
    if (rows.length < 1000) break; from += 1000;
  }
  return Core.stateFromKV(kv);
}

async function send(to, body, who) {
  const p = (E.WA_PROVIDER || 'meta').toLowerCase();
  if (p === 'callmebot') {
    const key = who === 'chef' ? E.CALLMEBOT_KEY_CHEF : E.CALLMEBOT_KEY_DIR;
    const r = await fetch(`https://api.callmebot.com/whatsapp.php?phone=%2B${to}&text=${encodeURIComponent(body)}&apikey=${key}`);
    if (!r.ok) throw new Error('CallMeBot ' + r.status);
  } else {
    // Nota: fuera de la ventana de 24 h, Meta exige una plantilla aprobada (WA_TEMPLATE).
    const msg = E.WA_TEMPLATE
      ? { type: 'template', template: { name: E.WA_TEMPLATE, language: { code: 'es_MX' }, components: [{ type: 'body', parameters: [{ type: 'text', text: body.replace(/\n+/g, ' · ').slice(0, 1000) }] }] } }
      : { type: 'text', text: { body } };
    const r = await fetch(`https://graph.facebook.com/v21.0/${E.WA_PHONE_ID}/messages`, {
      method: 'POST', headers: { Authorization: 'Bearer ' + E.WA_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, ...msg }) });
    if (!r.ok) throw new Error('Meta ' + r.status + ' ' + await r.text());
  }
  console.log(`✓ Enviado a ${who} (+${to})`);
}

(async () => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
  const S = await loadState();
  const mode = E.MODE || 'auto';
  const doChef = mode === 'chef' || mode === 'both' || (mode === 'auto' && Core.isWeekday(today));
  const doDir = mode === 'director' || mode === 'both' || (mode === 'auto' && Core.dow(today) === 5);
  if (doChef) { const msg = Core.msgChef(S, Core.nextWeekday(today)); console.log(msg); await send(TEL_CHEF, msg, 'chef'); }
  if (doDir) { const msg = Core.msgDirector(S, Core.monday(today), today); console.log(msg); await send(TEL_DIR, msg, 'director'); }
})().catch(e => { console.error(e.message); process.exit(1); });
