export const SITE = {
  name: 'Turisenda',
  tagline: { es: 'Revista de viaje · México, EE.UU. y Canadá', en: 'Travel magazine · Mexico, US & Canada' },
  description: {
    es: 'Escapadas, primeras visitas y rutas por México, EE.UU. y Canadá. Sede del Observatorio Latinoamericano de Sargazo.',
    en: 'Getaways, first visits and road trips across Mexico, the US and Canada. Home of the Latin American Sargassum Observatory.',
  },
  timing: { es: 'Martes y viernes, 13:00', en: 'Tuesdays & Fridays, 1 pm' },
};
// Secciones de turismo (núcleo) y subcanales. slug es igual en ES y EN.
export const CATS = [
  { slug: 'escapadas', core: true, es: 'Escapadas', en: 'Getaways' },
  { slug: 'primera-vez', core: true, es: 'Primera vez en…', en: 'First time in…' },
  { slug: 'rutas', core: true, es: 'Rutas', en: 'Routes' },
  { slug: 'hoteles', core: true, es: 'Hoteles con historia', en: 'Hotels with history' },
  { slug: 'sargazo', core: true, es: 'Observatorio de Sargazo', en: 'Sargassum Observatory' },
  { slug: 'dinero', es: 'Viajar con tu dinero', en: 'Travel money' },
  { slug: 'seguros', es: 'Viaja protegido', en: 'Travel safe' },
  { slug: 'sabores', es: 'Sabores del camino', en: 'Flavors on the road' },
  { slug: 'compras', es: 'Maleta y compras', en: 'Packing & shopping' },
  { slug: 'conectados', es: 'Conectados en ruta', en: 'Connected on the road' },
  { slug: 'bienestar', es: 'Bienestar y spa', en: 'Wellness & spa' },
  { slug: 'aprender', es: 'Aprender viajando', en: 'Learn by traveling' },
  { slug: 'carretera', es: 'Carretera y road trips', en: 'Road trips' },
  { slug: 'estilo', es: 'Vivir viajando', en: 'Travel lifestyle' },
  { slug: 'eventos', es: 'Agenda y festivales', en: 'Festivals & events' },
];
export const catName = (slug, lang) => (CATS.find((c) => c.slug === slug) || { [lang]: slug })[lang];
export const T = {
  es: { read: 'Leer', minutes: 'min de lectura', by: 'Por', sections: 'Secciones', more: 'Más secciones', latest: 'Lo más reciente', faq: 'Preguntas frecuentes', cover: 'Historia de portada', all: 'Ver todo', newsletter: 'Newsletter: sábados 8:30', sargazo: 'Ver el mapa de sargazo en vivo' },
  en: { read: 'Read', minutes: 'min read', by: 'By', sections: 'Sections', more: 'More sections', latest: 'Latest', faq: 'FAQ', cover: 'Cover story', all: 'See all', newsletter: 'Newsletter: Saturdays 8:30 am', sargazo: 'See the live sargassum map' },
};
export const paths = {
  home: (l) => (l === 'es' ? '' : 'en/'),
  article: (l, slug) => (l === 'es' ? `articulos/${slug}/` : `en/articles/${slug}/`),
  section: (l, cat) => (l === 'es' ? `seccion/${cat}/` : `en/section/${cat}/`),
};
