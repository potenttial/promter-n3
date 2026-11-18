import { getCollection } from 'astro:content';
// Versión Markdown de cada artículo para agentes de IA
export async function getStaticPaths() {
  const all = await getCollection('articulos', (e) => e.data.lang === 'en' && !e.data.draft && e.data.date <= new Date());
  return all.map((entry) => ({ params: { slug: entry.id.split('/').pop() }, props: { entry } }));
}
export function GET({ props }) {
  const d = props.entry.data;
  const faq = d.faq.length ? '\n\n## FAQ\n' + d.faq.map((f) => `\n**${f.q}**\n${f.a}\n`).join('') : '';
  const md = `# ${d.title}\n\n> ${d.description}\n\nAutor/Author: ${d.author} · ${d.date.toISOString().slice(0,10)} · Turisenda\n\n${props.entry.body}${faq}\n`;
  return new Response(md, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
}
