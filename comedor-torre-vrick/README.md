# Comedor Torre Vrick · N3 Labs

Sistema **mobile-first** para el comedor (roof) de Torre Vrick. Desarrollado por **N3 Labs · Thinktech IA Laboratory** (Potenttial Group).

**Demo:** https://potenttial.github.io/promter-n3/comedor-torre-vrick/ · Guía: `Guia-Comedor-Torre-Vrick-N3Labs.pdf`

## Accesos
| Ruta | Para | Qué hace |
|---|---|---|
| `#/comensal` | Colaboradores | Registro con nombre la 1ª vez (sesión recordada), confirma L–V, donar comida, indicaciones (sin picante, etc.) |
| `#/chef` (PIN 1234) | Chef Jorge | Confirmados, porciones +merma, menú semanal, lista de compra, registro de compras, recetas con gramaje, costos de insumos |
| `#/director` (PIN 2468) | Lic. Villarreal | Inversión, consumo, rentabilidad, costo por plato, recurrencia por persona, platillos e indicaciones |

## Modo demo vs. producción
- **Demo (actual):** sin backend; los datos de ejemplo viven en el `localStorage` de cada celular.
- **Producción (datos compartidos):** crear proyecto en Supabase → ejecutar `supabase/schema.sql` → poner `SUPABASE_URL` y `SUPABASE_ANON_KEY` en `config.js`. La app sincroniza cada 20 s.

## WhatsApp automático
`scripts/notify.js` + `.github/workflows/whatsapp.yml` (17:55 CDMX, L–V):
- Chef (+52 55 2496 2677): confirmados del día siguiente + insumos a provisionar.
- Viernes, Lic. Villarreal (+52 55 5405 4868): balance semanal.

Secrets: `SUPABASE_URL`, `SUPABASE_KEY`, `WA_PROVIDER` (`meta` o `callmebot`) y sus llaves (`WA_TOKEN`, `WA_PHONE_ID`, `WA_TEMPLATE` / `CALLMEBOT_KEY_CHEF`, `CALLMEBOT_KEY_DIR`).
> GitHub solo ejecuta workflows en la raíz de un repo: para activarlo, mover esta carpeta a su propio repositorio.

## Nota de seguridad
Los PIN son control de acceso ligero para el piloto. En producción: Supabase Auth + RLS por rol.
