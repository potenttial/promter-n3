# n3.potenttial.com · archivos de la app de Hostinger (Node.js)

Copia de los archivos que cambian en `hbuilds/current/nodejs/` de Hostinger:

- `server.js`: monta las salas de ¿Xoma! en `/xoma/sala/*` y sirve `.webmanifest`.
- `sala.js`: salas SPH vs SPH a distancia (computadora en vivo o por turnos con WhatsApp). Guarda cada sala en `data/salas/`.
- `public/xoma/` (ES, EN, admin): modo **SPH vs SPH a distancia** + favicon.
- `public/favicon.*`, `apple-touch-icon.png`, `icon-192/512.png`, `site.webmanifest`: favicon del sitio.

Variables opcionales: `SALA_AI=off` (apaga el juez y las charlas en salas), `SALA_AI_ROOM` (80 llamadas por sala),
`SALA_AI_IP` (150 por IP al día), `SALA_AI_DAILY` (1200 al día), `SALA_MODEL` (por defecto `MODEL` o `claude-haiku-5-5`).
`worker.js` (API del desafío VS SPA) no cambia y no está en esta rama.
