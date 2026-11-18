import { articles, slugOf } from '../data/content.js';
import { SITE, CATS, paths } from '../data/site.js';
// llms.txt: mapa del sitio para agentes de IA (https://llmstxt.org)
export async function GET({ site }) {
  const s = new URL(import.meta.env.BASE_URL, site).href;
  const line = (l) => async () => (await articles(l)).map((a) => `- [${a.data.title}](${s}${paths.article(l, slugOf(a)).replace(/\/$/, '')}.md): ${a.data.description}`).join('\n');
  const body = `# ${SITE.name}\n\n> ${SITE.description.es} / ${SITE.description.en}\n\nRevista de viaje bilingüe (español primero, inglés 24 h después). Publica martes y viernes a las 13:00 (hora de CDMX).\n\n## Secciones\n${CATS.map((c) => `- ${c.es} / ${c.en}: ${s}${paths.section('es', c.slug)}`).join('\n')}\n\n## Artículos (ES)\n${await line('es')()}\n\n## Articles (EN)\n${await line('en')()}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
