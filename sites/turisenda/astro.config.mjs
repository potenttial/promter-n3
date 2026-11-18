import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
export default defineConfig({
  site: process.env.SITE || 'https://www.turisenda.com',
  base: process.env.BASE || '/',
  trailingSlash: 'always',
  integrations: [sitemap({ i18n: { defaultLocale: 'es', locales: { es: 'es-MX', en: 'en-US' } } })],
});
