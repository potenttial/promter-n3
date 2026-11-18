import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
const articulos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articulos' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    lang: z.enum(['es', 'en']),
    key: z.string(),            // une la versión ES con la EN
    category: z.string(),
    author: z.string(),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  }),
});
export const collections = { articulos };
