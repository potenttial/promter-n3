import { getCollection } from 'astro:content';
export async function articles(lang) {
  const all = await getCollection('articulos', (e) => e.data.lang === lang && !e.data.draft && e.data.date <= new Date());
  return all.sort((a, b) => b.data.date - a.data.date);
}
export async function counterpart(entry) {
  const other = entry.data.lang === 'es' ? 'en' : 'es';
  const all = await getCollection('articulos', (e) => e.data.lang === other && e.data.key === entry.data.key && !e.data.draft);
  return all[0];
}
export const slugOf = (e) => e.id.split('/').pop();
export const minutes = (body) => Math.max(1, Math.round((body || '').split(/\s+/).length / 220));
