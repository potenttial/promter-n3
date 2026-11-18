import rss from '@astrojs/rss';
import { articles, slugOf } from '../../data/content.js';
import { SITE, paths } from '../../data/site.js';
export async function GET(ctx) {
  const list = await articles('en');
  return rss({ title: SITE.name, description: SITE.description.en, site: ctx.site,
    items: list.map((a) => ({ title: a.data.title, description: a.data.description, pubDate: a.data.date, link: paths.article('en', slugOf(a)) })) });
}
