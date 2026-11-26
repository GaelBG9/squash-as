-- Tarea 0.2: tabla `jugadores` con permisos por filas.
-- Ejecutar una vez en el SQL Editor del panel de Supabase.
-- Reglas: R9 (solo el admin cambia grupo y rol) y R10 (solo los conectados ven la lista).

-- 1. Tabla ------------------------------------------------------------------

create table if not exists public.jugadores (
	-- Mismo id que la cuenta de login: cada perfil pertenece a una cuenta Google.
	id uuid primary key references auth.users (id) on delete cascade,
	nombre text not null check (length(trim(nombre)) > 0),
	email text not null unique,
	-- Vacío hasta que el admin asigne el grupo.
	grupo smallint check (grupo in (1, 2)),
	rol text not null default 'jugador' check (rol in ('jugador', 'admin')),
	-- Valores iniciales de Glicko-2 (Glickman): rating 1500, RD 350, volatilidad 0.06.
	rating double precision not null default 1500,
	rd double precision not null default 350,
	volatilidad double precision not null default 0.06,
	creado_en timestamptz not null default now()
);

-- 2. GRANT: qué roles pueden usar la tabla -----------------------------------
-- `anon` (sin sesión) no recibe nada: no puede ni leer.
-- Crear y borrar jugadores no se hace desde la app por ahora (0.3 y 2.5).

revoke all on public.jugadores from anon, authenticated;
grant select, update on public.jugadores to authenticated;

-- 3. ¿Es admin el usuario conectado? ------------------------------------------
-- `security definer`: se ejecuta con los permisos del dueño de la tabla, así puede
-- leer `jugadores` sin quedar bloqueada por las propias políticas RLS.

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
		select 1 from public.jugadores
		where id = auth.uid() and rol = 'admin'
	);
$$;

revoke all on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;

-- 4. RLS: qué filas puede ver y cambiar cada uno -------------------------------

alter table public.jugadores enable row level security;

drop policy if exists "conectados leen jugadores" on public.jugadores;
create policy "conectados leen jugadores"
	on public.jugadores
	for select
	to authenticated
	using (true);

drop policy if exists "cada uno su perfil, el admin todos" on public.jugadores;
create policy "cada uno su perfil, el admin todos"
	on public.jugadores
	for update
	to authenticated
	using (id = auth.uid() or public.es_admin())
	with check (id = auth.uid() or public.es_admin());

-- 5. Trigger: qué columnas puede cambiar un jugador normal ---------------------
-- RLS decide QUÉ FILAS; este trigger decide QUÉ COLUMNAS. Un jugador normal
-- solo puede cambiar su nombre. Solo se aplica a peticiones de la app
-- (roles `authenticated`/`anon`): las funciones internas de confianza, como el
-- futuro cálculo Glicko-2 (tarea 1.3), se ejecutan con otro rol y no se bloquean.

create or replace function public.proteger_campos_jugador()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	if current_user in ('authenticated', 'anon') and not public.es_admin() then
		if new.id is distinct from old.id
			or new.email is distinct from old.email
			or new.grupo is distinct from old.grupo
			or new.rol is distinct from old.rol
			or new.rating is distinct from old.rating
			or new.rd is distinct from old.rd
			or new.volatilidad is distinct from old.volatilidad
			or new.creado_en is distinct from old.creado_en
		then
			raise exception 'Solo el administrador puede cambiar estos datos; tú solo puedes cambiar tu nombre.'
				using errcode = '42501';
		end if;
	end if;
	return new;
end;
$$;

drop trigger if exists proteger_campos_jugador on public.jugadores;
create trigger proteger_campos_jugador
	before update on public.jugadores
	for each row
	execute function public.proteger_campos_jugador();
