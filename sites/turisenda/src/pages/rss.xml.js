import rss from '@astrojs/rss';
import { articles, slugOf } from '../data/content.js';
import { SITE, paths } from '../data/site.js';
export async function GET(ctx) {
  const list = await articles('es');
  return rss({ title: SITE.name, description: SITE.description.es, site: ctx.site,
    items: list.map((a) => ({ title: a.data.title, description: a.data.description, pubDate: a.data.date, link: paths.article('es', slugOf(a)) })) });
}
