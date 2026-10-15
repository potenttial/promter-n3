-- Comedor Torre Vrick · N3 Labs — esquema mínimo (Supabase / Postgres)
create table if not exists public.kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.kv enable row level security;
-- Piloto: lectura/escritura con la clave pública "anon".
-- Producción: restringir escritura de catálogo/compras a usuarios autenticados (chef/dirección).
create policy "kv_read"   on public.kv for select using (true);
create policy "kv_insert" on public.kv for insert with check (true);
create policy "kv_update" on public.kv for update using (true);
create policy "kv_delete" on public.kv for delete using (true);
