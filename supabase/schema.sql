-- =====================================================================
-- Odontología Avanzada · esquema para Supabase
-- Ejecútalo completo en Supabase › SQL Editor › New query › Run.
-- Es idempotente: puedes volver a ejecutarlo sin perder datos.
-- =====================================================================
--
-- Modelo:
--   clinicas   → un consultorio. Tiene un código para invitar a recepción.
--   perfiles   → cada usuario (Supabase Auth) pertenece a una clínica con rol doctor o recepcion.
--   registros  → cada elemento de la app (paciente, cita, pago, receta…) es una fila JSON,
--                identificada por (clinica_id, coleccion, id). La app sincroniza cambio por cambio
--                y recibe en tiempo real lo que capturan otros usuarios de la misma clínica.
-- La seguridad la aplica Postgres con RLS: nadie puede leer ni escribir datos de otra clínica.

create extension if not exists pgcrypto;

-- ---------- Tablas ----------
create table if not exists public.clinicas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  codigo text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6)),
  created_at timestamptz not null default now()
);

create table if not exists public.perfiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  nombre text not null,
  email text,
  rol text not null default 'recepcion' check (rol in ('doctor', 'recepcion')),
  created_at timestamptz not null default now()
);
create index if not exists perfiles_clinica_idx on public.perfiles (clinica_id);

create table if not exists public.registros (
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  coleccion text not null check (coleccion in (
    'settings', 'patients', 'procedures', 'appointments', 'budgets',
    'payments', 'materials', 'expenses', 'prescriptions', 'consents'
  )),
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (clinica_id, coleccion, id)
);

-- ---------- Funciones auxiliares (security definer para evitar recursión en RLS) ----------
create or replace function public.mi_clinica() returns uuid
language sql stable security definer set search_path = public as $$
  select clinica_id from perfiles where user_id = auth.uid()
$$;

create or replace function public.mi_rol() returns text
language sql stable security definer set search_path = public as $$
  select rol from perfiles where user_id = auth.uid()
$$;

-- El primer usuario crea la clínica y queda como doctor
create or replace function public.crear_clinica(nombre_clinica text, nombre_usuario text) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  if exists (select 1 from perfiles where user_id = auth.uid()) then raise exception 'Tu cuenta ya pertenece a una clínica'; end if;
  insert into clinicas (nombre) values (nombre_clinica) returning id into cid;
  insert into perfiles (user_id, clinica_id, nombre, email, rol)
    values (auth.uid(), cid, nombre_usuario, (select email from auth.users where id = auth.uid()), 'doctor');
  return cid;
end $$;

-- Recepción (u otro doctor) se une con el código que comparte el doctor
create or replace function public.unirse_clinica(codigo_clinica text, nombre_usuario text) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  if exists (select 1 from perfiles where user_id = auth.uid()) then raise exception 'Tu cuenta ya pertenece a una clínica'; end if;
  select id into cid from clinicas where codigo = upper(trim(codigo_clinica));
  if cid is null then raise exception 'Código de clínica no válido'; end if;
  insert into perfiles (user_id, clinica_id, nombre, email, rol)
    values (auth.uid(), cid, nombre_usuario, (select email from auth.users where id = auth.uid()), 'recepcion');
  return cid;
end $$;

-- El doctor genera un código nuevo (por ejemplo, si salió alguien del equipo)
create or replace function public.renovar_codigo() returns text
language plpgsql security definer set search_path = public as $$
declare nuevo text := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6));
begin
  if mi_rol() <> 'doctor' then raise exception 'Solo el doctor puede renovar el código'; end if;
  update clinicas set codigo = nuevo where id = mi_clinica();
  return nuevo;
end $$;

revoke all on function public.crear_clinica(text, text) from public, anon;
revoke all on function public.unirse_clinica(text, text) from public, anon;
revoke all on function public.renovar_codigo() from public, anon;
grant execute on function public.crear_clinica(text, text) to authenticated;
grant execute on function public.unirse_clinica(text, text) to authenticated;
grant execute on function public.renovar_codigo() to authenticated;

-- ---------- Seguridad a nivel de fila ----------
alter table public.clinicas enable row level security;
alter table public.perfiles enable row level security;
alter table public.registros enable row level security;

drop policy if exists "ver mi clínica" on public.clinicas;
create policy "ver mi clínica" on public.clinicas for select to authenticated using (id = mi_clinica());
drop policy if exists "doctor edita clínica" on public.clinicas;
create policy "doctor edita clínica" on public.clinicas for update to authenticated
  using (id = mi_clinica() and mi_rol() = 'doctor') with check (id = mi_clinica());

drop policy if exists "ver equipo" on public.perfiles;
create policy "ver equipo" on public.perfiles for select to authenticated using (clinica_id = mi_clinica());
drop policy if exists "doctor cambia roles" on public.perfiles;
create policy "doctor cambia roles" on public.perfiles for update to authenticated
  using (clinica_id = mi_clinica() and mi_rol() = 'doctor') with check (clinica_id = mi_clinica());
drop policy if exists "doctor quita miembros" on public.perfiles;
create policy "doctor quita miembros" on public.perfiles for delete to authenticated
  using (clinica_id = mi_clinica() and mi_rol() = 'doctor' and user_id <> auth.uid());

-- Todos en la clínica leen y capturan. La configuración y el catálogo de tratamientos solo los cambia el doctor.
-- Solo el doctor borra registros (excepto citas, que recepción también puede eliminar).
drop policy if exists "leer registros" on public.registros;
create policy "leer registros" on public.registros for select to authenticated using (clinica_id = mi_clinica());
drop policy if exists "crear registros" on public.registros;
create policy "crear registros" on public.registros for insert to authenticated
  with check (clinica_id = mi_clinica() and (coleccion not in ('settings', 'procedures') or mi_rol() = 'doctor'));
drop policy if exists "editar registros" on public.registros;
create policy "editar registros" on public.registros for update to authenticated
  using (clinica_id = mi_clinica())
  with check (clinica_id = mi_clinica() and (coleccion not in ('settings', 'procedures') or mi_rol() = 'doctor'));
drop policy if exists "borrar registros" on public.registros;
create policy "borrar registros" on public.registros for delete to authenticated
  using (clinica_id = mi_clinica() and (mi_rol() = 'doctor' or coleccion = 'appointments'));

-- ---------- Tiempo real (doctor y recepción ven los cambios al instante) ----------
do $$ begin
  alter publication supabase_realtime add table public.registros;
exception when duplicate_object then null; end $$;
