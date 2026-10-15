/* Dictado de compras por voz — Comedor Torre Vrick (N3 Labs)
   Convierte frases como «pollo tres kilos cuatrocientos treinta y ocho pesos, jitomate dos kilos y medio ochenta»
   en renglones { name, qty, unit, amount }. Funciona igual con texto escrito. */
(function (g) {
  const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const NUMW = { cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300, cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900 };
  const UNITW = { kilo: 'kg', kilos: 'kg', kg: 'kg', kgs: 'kg', k: 'kg', kilogramo: 'kg', kilogramos: 'kg', gramo: 'g', gramos: 'g', gr: 'g', grs: 'g', g: 'g',
    litro: 'l', litros: 'l', lt: 'l', lts: 'l', l: 'l', mililitro: 'ml', mililitros: 'ml', ml: 'ml', pieza: 'pza', piezas: 'pza', pza: 'pza', pzas: 'pza', pz: 'pza',
    manojo: 'pza', manojos: 'pza', paquete: 'pza', paquetes: 'pza', bolsa: 'pza', bolsas: 'pza', caja: 'pza', cajas: 'pza', lata: 'pza', latas: 'pza', docena: 'doc', docenas: 'doc',
    porcion: 'porcion', porciones: 'porcion' };
  const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'a', 'en', 'por', 'son', 'pesos', 'peso', 'con', 'me', 'costo', 'salio', 'fue', 'fueron', 'compre', 'mas', 'e', 'al', 'cada', 'uno', 'una', 'precio', 'cuesta', 'vale', 'dame', 'agrega', 'anota', 'pon']);

  function wordsToNum(text) {
    const t = text.split(/\s+/).filter(Boolean); const out = []; let i = 0;
    while (i < t.length) {
      if (t[i] in NUMW || t[i] === 'mil') {
        let total = 0, cur = 0, j = i, used = false;
        while (j < t.length) {
          const w = t[j];
          if (w in NUMW) {
            const v = NUMW[w];
            if (used && v >= 100 && cur !== 0) break;
            if (used && v >= 10 && v < 100 && cur % 100 !== 0) break;
            if (used && v < 10 && cur % 10 !== 0) break;
            if (used && v < 10 && cur % 100 > 0 && cur % 100 < 30) break;
            cur += v; used = true; j++;
          } else if (w === 'mil') { total += (cur || 1) * 1000; cur = 0; used = true; j++; }
          else if (w === 'y' && used && t[j + 1] in NUMW && NUMW[t[j + 1]] < 10 && NUMW[t[j + 1]] > 0 && cur % 100 >= 30 && cur % 10 === 0) j++;
          else break;
        }
        out.push(String(total + cur)); i = j;
      } else { out.push(t[i]); i++; }
    }
    return out.join(' ');
  }

  function normalize(raw) {
    let s = norm(raw);
    s = s.replace(/(\d),(\d{3})(?!\d)/g, '$1$2').replace(/(\d),(\d{1,2})(?!\d)/g, '$1.$2'); // 1,200 · 438,75
    s = s.replace(/\$\s?(\d+(?:\.\d+)?)/g, ' $1 pesos ');
    s = s.replace(/[.](?!\d)/g, ' , ').replace(/[:!?¿¡"]/g, ' ');
    s = s.replace(/(\d)([a-z])/g, '$1 $2');
    s = wordsToNum(s);
    s = s.replace(/(\d+) (?:punto|coma) (\d+)/g, '$1.$2');
    s = s.replace(/(\d+) pesos? con (\d{1,2})(?: centavos?)?/g, (_, a, b) => `${a}.${b.padStart(2, '0')} pesos`);
    s = s.replace(/(\d+(?:\.\d+)?) (kilos?|kg|litros?|lts?) y medio/g, (_, a, u) => `${+a + 0.5} ${u}`);
    s = s.replace(/(\d+(?:\.\d+)?) (kilos?|kg|litros?|lts?) y (?:1 )?cuarto/g, (_, a, u) => `${+a + 0.25} ${u}`);
    s = s.replace(/(\d+(?:\.\d+)?) (kilos?|kg|litros?|lts?) y 3 cuartos/g, (_, a, u) => `${+a + 0.75} ${u}`);
    s = s.replace(/(\d+) y medio/g, (_, a) => `${+a + 0.5}`).replace(/(\d+) y 3 cuartos/g, (_, a) => `${+a + 0.75}`).replace(/(\d+) y (?:1 )?cuarto/g, (_, a) => `${+a + 0.25}`);
    s = s.replace(/\b(?:1 )?medio (kilo|litro)/g, '0.5 $1').replace(/\b3 cuartos (?:de )?(kilo|litro)/g, '0.75 $1').replace(/\b(?:1 )?cuarto (?:de )?(kilo|litro)/g, '0.25 $1');
    return s.replace(/\s+/g, ' ').trim();
  }

  const isNum = w => /^\d+(?:\.\d+)?$/.test(w);
  const stem = w => w.replace(/(es|s)$/, '');

  function matchIng(name, ingredients) {
    const n = norm(name); if (!n) return null;
    const exact = ingredients.find(x => norm(x.name) === n); if (exact) return exact;
    const ws = n.split(' ').filter(w => w.length >= 3).map(stem);
    let best = null, score = 0;
    ingredients.forEach(x => {
      const xs = norm(x.name).split(/[ /]/).filter(w => w.length >= 3).map(stem);
      const sc = ws.filter(w => xs.some(y => y === w || (w.length >= 4 && (y.startsWith(w) || w.startsWith(y))))).length;
      if (sc > score) { score = sc; best = x; }
    });
    return best;
  }

  function parse(raw, ingredients = []) {
    const s = normalize(raw);
    const res = { items: [], undo: 0, total: null, clear: false, text: s };
    const chunks = s.split(/\s*,\s*|\s*;\s*|\b(?:y luego|luego|despues|siguiente|otro|otra)\b/).flatMap(c => c.split(/(?<=\bpesos?\b)/)).map(c => c.trim()).filter(Boolean);
    for (const ch of chunks) {
      if (/\b(borra|borrar|quita|quitar|elimina|eliminar|cancela)\b.*\b(ultim[oa]|anterior)\b/.test(ch)) { res.undo++; continue; }
      if (/\b(borra|borrar|limpia|limpiar)\b.*\b(todo)\b/.test(ch)) { res.clear = true; continue; }
      const t = ch.split(' ');
      let it = { words: [], qty: null, unit: null, amount: null };
      const flush = () => { if (it.words.length || it.amount != null) res.items.push(it); it = { words: [], qty: null, unit: null, amount: null }; };
      for (let i = 0; i < t.length; i++) {
        const w = t[i];
        if (w === 'total' && isNum(t[i + 1] || '')) { res.total = +t[i + 1]; i++; continue; }
        if (isNum(w)) {
          const u = UNITW[t[i + 1]];
          if (u) {
            if (it.qty != null && it.amount != null) flush();
            let q = +w, un = u;
            if (u === 'g') { q /= 1000; un = 'kg'; } else if (u === 'ml') { q /= 1000; un = 'l'; } else if (u === 'doc') { q *= 12; un = 'pza'; }
            it.qty = q; it.unit = un; i++;
            continue;
          }
          if (it.amount != null) flush();
          it.amount = +w;
          if (/^pesos?$/.test(t[i + 1] || '')) i++;
          // tras el importe, lo siguiente que no sea cantidad empieza otro artículo
          const nx = t[i + 1];
          if (nx && !(isNum(nx) && UNITW[t[i + 2]]) && !STOP.has(nx)) flush();
          continue;
        }
        if (UNITW[w] && it.qty == null && w.length > 2) { const u = UNITW[w]; it.qty = u === 'doc' ? 12 : 1; it.unit = u === 'doc' ? 'pza' : (u === 'g' || u === 'ml') ? null : u; continue; }
        if (STOP.has(w) || UNITW[w]) continue;
        if (it.amount != null && it.words.length) flush();
        it.words.push(w);
      }
      flush();
    }
    // une artículos partidos («pollo 438 pesos 3 kilos»)
    const out = []; let pend = null;
    for (const x of res.items) {
      if (pend && x.words.length && x.amount == null) { x.amount = pend.amount; if (x.qty == null && pend.qty != null) { x.qty = pend.qty; x.unit = pend.unit; } pend = null; out.push(x); continue; }
      const prev = out[out.length - 1];
      if (!x.words.length && x.amount != null && (!prev || prev.amount != null)) { pend = x; continue; }
      if (!x.words.length && prev && prev.qty == null && x.qty != null && x.amount == null) { prev.qty = x.qty; prev.unit = x.unit; continue; }
      if (!x.words.length && prev && prev.amount == null && x.amount != null) { prev.amount = x.amount; if (x.qty != null && prev.qty == null) { prev.qty = x.qty; prev.unit = x.unit; } continue; }
      out.push(x);
    }
    res.items = out.filter(x => x.words.length).map(x => {
      const spoken = x.words.join(' ');
      const ing = matchIng(spoken, ingredients);
      const name = ing ? ing.name : spoken.charAt(0).toUpperCase() + spoken.slice(1);
      return { name, qty: x.qty ?? '', unit: x.unit || ing?.unit || 'kg', amount: x.amount ?? '', known: !!ing };
    });
    return res;
  }
  const Dictado = { parse, normalize, wordsToNum, matchIng };
  g.Dictado = Dictado;
  if (typeof module !== 'undefined' && module.exports) module.exports = Dictado;
})(typeof window !== 'undefined' ? window : globalThis);
