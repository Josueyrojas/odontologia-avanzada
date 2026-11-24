-- =====================================================================
-- Odonty · esquema para Supabase
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

-- ---------- Licencias de Odonty ----------
-- Se agregan sin tocar datos: las clínicas que ya existían quedan ACTIVAS y sin vencimiento.
alter table public.clinicas add column if not exists estado text not null default 'activa';
alter table public.clinicas add column if not exists plan text not null default 'prueba';
alter table public.clinicas add column if not exists vence_el date;
do $$ begin
  alter table public.clinicas add constraint clinicas_estado_chk check (estado in ('pendiente', 'activa', 'suspendida'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.clinicas add constraint clinicas_plan_chk check (plan in ('prueba', 'contado', 'mensualidades', 'renta', 'cortesia'));
exception when duplicate_object then null; end $$;
-- A partir de ahora, cada clínica nueva nace pendiente hasta que el administrador la active
alter table public.clinicas alter column estado set default 'pendiente';

-- Administradores de Odonty (tú). Sin políticas: nadie la lee ni la modifica desde la API.
create table if not exists public.administradores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.administradores enable row level security;

-- Notas internas del administrador por clínica (pagos, acuerdos). El doctor NO las ve: sin políticas.
create table if not exists public.clinicas_admin (
  clinica_id uuid primary key references public.clinicas(id) on delete cascade,
  notas text,
  updated_at timestamptz not null default now()
);
alter table public.clinicas_admin enable row level security;

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

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from administradores where user_id = auth.uid())
$$;

-- Licencia vigente: activa y sin vencer (con 5 días de gracia después de la fecha de vencimiento)
create or replace function public.clinica_activa() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from clinicas
    where id = mi_clinica() and estado = 'activa' and (vence_el is null or current_date <= vence_el + 5)
  )
$$;

-- Panel de administración: datos de cada clínica SIN acceso a expedientes (solo conteos)
create or replace function public.admin_clinicas()
returns table (
  id uuid, nombre text, codigo text, estado text, plan text, vence_el date, notas text, created_at timestamptz,
  doctor text, email text, usuarios bigint, pacientes bigint, ultima_actividad timestamptz
)
language sql stable security definer set search_path = public as $$
  select c.id, c.nombre, c.codigo, c.estado, c.plan, c.vence_el,
    (select a.notas from clinicas_admin a where a.clinica_id = c.id), c.created_at,
    (select p.nombre from perfiles p where p.clinica_id = c.id and p.rol = 'doctor' order by p.created_at limit 1),
    (select p.email from perfiles p where p.clinica_id = c.id and p.rol = 'doctor' order by p.created_at limit 1),
    (select count(*) from perfiles p where p.clinica_id = c.id),
    (select count(*) from registros r where r.clinica_id = c.id and r.coleccion = 'patients'),
    (select max(r.updated_at) from registros r where r.clinica_id = c.id)
  from clinicas c
  where es_admin()
  order by c.created_at desc
$$;

create or replace function public.admin_actualizar_clinica(p_id uuid, p_estado text, p_plan text, p_vence_el date, p_notas text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'No autorizado'; end if;
  update clinicas set estado = p_estado, plan = p_plan, vence_el = p_vence_el where id = p_id;
  insert into clinicas_admin (clinica_id, notas, updated_at) values (p_id, p_notas, now())
  on conflict (clinica_id) do update set notas = excluded.notas, updated_at = now();
end $$;

-- Elimina una clínica con todos sus datos. Exige escribir el nombre exacto como confirmación.
create or replace function public.admin_eliminar_clinica(p_id uuid, p_confirmacion text) returns void
language plpgsql security definer set search_path = public as $$
declare nom text;
begin
  if not es_admin() then raise exception 'No autorizado'; end if;
  select nombre into nom from clinicas where id = p_id;
  if nom is null then raise exception 'La clínica no existe'; end if;
  if lower(trim(nom)) <> lower(trim(p_confirmacion)) then raise exception 'El nombre no coincide'; end if;
  delete from clinicas where id = p_id;
end $$;
revoke all on function public.admin_eliminar_clinica(uuid, text) from public, anon;
grant execute on function public.admin_eliminar_clinica(uuid, text) to authenticated;

revoke all on function public.admin_clinicas() from public, anon;
revoke all on function public.admin_actualizar_clinica(uuid, text, text, date, text) from public, anon;
revoke all on function public.es_admin() from anon;
grant execute on function public.admin_clinicas() to authenticated;
grant execute on function public.admin_actualizar_clinica(uuid, text, text, date, text) to authenticated;
grant execute on function public.es_admin() to authenticated;

-- ---------- Seguridad a nivel de fila ----------
alter table public.clinicas enable row level security;
alter table public.perfiles enable row level security;
alter table public.registros enable row level security;

drop policy if exists "ver mi clínica" on public.clinicas;
create policy "ver mi clínica" on public.clinicas for select to authenticated using (id = mi_clinica());
-- Nadie edita la clínica directamente: el código se renueva con renovar_codigo() y la licencia la maneja el administrador
drop policy if exists "doctor edita clínica" on public.clinicas;

drop policy if exists "ver equipo" on public.perfiles;
create policy "ver equipo" on public.perfiles for select to authenticated using (clinica_id = mi_clinica());
drop policy if exists "doctor cambia roles" on public.perfiles;
create policy "doctor cambia roles" on public.perfiles for update to authenticated
  using (clinica_id = mi_clinica() and mi_rol() = 'doctor') with check (clinica_id = mi_clinica());
drop policy if exists "doctor quita miembros" on public.perfiles;
create policy "doctor quita miembros" on public.perfiles for delete to authenticated
  using (clinica_id = mi_clinica() and mi_rol() = 'doctor' and user_id <> auth.uid());

-- Solo con licencia vigente (clinica_activa). Si se suspende, los datos se conservan pero no se accede a ellos.
-- Todos en la clínica leen y capturan. La configuración y el catálogo de tratamientos solo los cambia el doctor.
-- Solo el doctor borra registros (excepto citas, que recepción también puede eliminar).
drop policy if exists "leer registros" on public.registros;
create policy "leer registros" on public.registros for select to authenticated using (clinica_id = mi_clinica() and clinica_activa());
drop policy if exists "crear registros" on public.registros;
create policy "crear registros" on public.registros for insert to authenticated
  with check (clinica_id = mi_clinica() and clinica_activa() and (coleccion not in ('settings', 'procedures') or mi_rol() = 'doctor'));
drop policy if exists "editar registros" on public.registros;
create policy "editar registros" on public.registros for update to authenticated
  using (clinica_id = mi_clinica() and clinica_activa())
  with check (clinica_id = mi_clinica() and clinica_activa() and (coleccion not in ('settings', 'procedures') or mi_rol() = 'doctor'));
drop policy if exists "borrar registros" on public.registros;
create policy "borrar registros" on public.registros for delete to authenticated
  using (clinica_id = mi_clinica() and clinica_activa() and (mi_rol() = 'doctor' or coleccion = 'appointments'));

-- ---------- Guardado por campos ----------
-- La app envía solo los campos que cambiaron ("parcial"): si dos personas editan campos distintos del mismo
-- registro al mismo tiempo, se conservan ambos cambios. Corre con los permisos del usuario (aplica RLS).
create or replace function public.guardar_registros(filas jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare f jsonb; n int;
begin
  for f in select * from jsonb_array_elements(filas) loop
    if coalesce((f->>'parcial')::boolean, false) then
      update registros
         set data = jsonb_strip_nulls(data || (f->'data')), updated_at = now(), updated_by = auth.uid()
       where clinica_id = (f->>'clinica_id')::uuid and coleccion = f->>'coleccion' and id = f->>'id';
      get diagnostics n = row_count;
      if n > 0 then continue; end if;
      -- El registro aún no existía en la nube: se guarda completo
    end if;
    insert into registros (clinica_id, coleccion, id, data, updated_at, updated_by)
    values ((f->>'clinica_id')::uuid, f->>'coleccion', f->>'id', coalesce(f->'completo', f->'data'), now(), auth.uid())
    on conflict (clinica_id, coleccion, id) do update set data = excluded.data, updated_at = now(), updated_by = auth.uid();
  end loop;
end $$;
revoke all on function public.guardar_registros(jsonb) from public, anon;
grant execute on function public.guardar_registros(jsonb) to authenticated;

-- ---------- Bitácora del expediente ----------
-- Registra automáticamente quién creó, cambió o borró cada registro, y qué había antes.
-- Nadie puede modificarla ni borrarla desde la app (sin políticas de escritura). Solo el doctor la consulta.
create table if not exists public.bitacora (
  id bigserial primary key,
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  coleccion text not null,
  registro_id text not null,
  accion text not null check (accion in ('crear', 'editar', 'eliminar')),
  usuario uuid,
  usuario_nombre text,
  fecha timestamptz not null default now(),
  campos text[],   -- campos que cambiaron
  antes jsonb      -- valores anteriores de esos campos (o el registro completo si se eliminó)
);
create index if not exists bitacora_clinica_fecha_idx on public.bitacora (clinica_id, fecha desc);
create index if not exists bitacora_registro_idx on public.bitacora (clinica_id, coleccion, registro_id);
alter table public.bitacora enable row level security;
drop policy if exists "doctor consulta bitácora" on public.bitacora;
create policy "doctor consulta bitácora" on public.bitacora for select to authenticated
  using (clinica_id = mi_clinica() and mi_rol() = 'doctor');

create or replace function public.fn_bitacora() returns trigger
language plpgsql security definer set search_path = public as $$
declare cambios text[]; previos jsonb; nombre text;
begin
  select p.nombre into nombre from perfiles p where p.user_id = auth.uid();
  if tg_op = 'INSERT' then
    insert into bitacora (clinica_id, coleccion, registro_id, accion, usuario, usuario_nombre)
    values (new.clinica_id, new.coleccion, new.id, 'crear', auth.uid(), nombre);
    return new;
  elsif tg_op = 'UPDATE' then
    if new.data = old.data then return new; end if;
    select array_agg(k), jsonb_object_agg(k, old.data -> k) into cambios, previos
    from (
      select n.key as k from jsonb_each(new.data) n where n.value is distinct from old.data -> n.key
      union
      select o.key from jsonb_each(old.data) o where not (new.data ? o.key)
    ) x;
    insert into bitacora (clinica_id, coleccion, registro_id, accion, usuario, usuario_nombre, campos, antes)
    values (new.clinica_id, new.coleccion, new.id, 'editar', auth.uid(), nombre, cambios, jsonb_strip_nulls(previos));
    return new;
  else
    -- Si se está borrando la clínica completa (desde el panel de administración) no hay nada que registrar
    if not exists (select 1 from clinicas where id = old.clinica_id) then return old; end if;
    insert into bitacora (clinica_id, coleccion, registro_id, accion, usuario, usuario_nombre, antes)
    values (old.clinica_id, old.coleccion, old.id, 'eliminar', auth.uid(), nombre, old.data);
    return old;
  end if;
end $$;

drop trigger if exists trg_bitacora on public.registros;
create trigger trg_bitacora after insert or update or delete on public.registros
for each row execute function public.fn_bitacora();

-- ---------- Tiempo real (doctor y recepción ven los cambios al instante) ----------
do $$ begin
  alter publication supabase_realtime add table public.registros;
exception when duplicate_object then null; end $$;

-- ---------- Administrador de Odonty ----------
-- Tu cuenta (debe existir: crea primero tu usuario en la app). Si usas otro correo, cámbialo aquí.
insert into public.administradores (user_id)
select id from auth.users where email = 'josueyrojas@gmail.com'
on conflict do nothing;
