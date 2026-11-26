-- Tarea 0.8: el email de un jugador solo lo ven él mismo y el admin (regla R11).
-- Ejecutar una vez en el SQL Editor, después de 0002, 0003 y 0004.
--
-- Por qué una tabla aparte: RLS decide QUÉ FILAS ve cada usuario, no qué columnas.
-- Como todos los conectados ven todas las filas de `jugadores` (R10), el email se
-- muda a `jugadores_privado`, donde cada uno solo ve su fila y el admin todas.

begin;

-- 1. Tabla privada ------------------------------------------------------------

create table if not exists public.jugadores_privado (
	-- Una fila por jugador; si se borra el jugador, se borran sus datos privados.
	id uuid primary key references public.jugadores (id) on delete cascade,
	email text not null unique
);

-- Solo lectura desde la app: el email viene de Google y nadie lo cambia a mano.
revoke all on public.jugadores_privado from anon, authenticated;
grant select on public.jugadores_privado to authenticated;

alter table public.jugadores_privado enable row level security;

drop policy if exists "cada uno su email, el admin todos" on public.jugadores_privado;
create policy "cada uno su email, el admin todos"
	on public.jugadores_privado
	for select
	to authenticated
	using (id = auth.uid() or public.es_admin());

-- 2. Copiar los emails que ya existen -------------------------------------------
-- Solo si `jugadores` aún tiene la columna (así el script se puede repetir).

do $$
begin
	if exists (
		select 1 from information_schema.columns
		where table_schema = 'public' and table_name = 'jugadores' and column_name = 'email'
	) then
		insert into public.jugadores_privado (id, email)
		select id, email from public.jugadores
		on conflict (id) do nothing;
	end if;
end;
$$;

-- 3. Perfil automático: ahora crea las dos filas (sustituye a la versión de 0003) --

create or replace function public.crear_perfil_jugador()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	nombre_google text := nullif(trim(coalesce(
		new.raw_user_meta_data ->> 'full_name',
		new.raw_user_meta_data ->> 'name'
	)), '');
begin
	insert into public.jugadores (id, nombre)
	values (
		new.id,
		-- Sin nombre de Google, se usa la parte del email antes de la @.
		coalesce(nombre_google, split_part(new.email, '@', 1))
	)
	on conflict (id) do nothing;

	insert into public.jugadores_privado (id, email)
	values (new.id, new.email)
	on conflict (id) do nothing;

	return new;
end;
$$;

revoke all on function public.crear_perfil_jugador() from public, anon, authenticated;

-- 4. Columnas protegidas: quitar `email` (sustituye a la versión de 0002) --------
-- Hay que hacerlo ANTES de borrar la columna: la versión antigua la usa.

create or replace function public.proteger_campos_jugador()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	if current_user in ('authenticated', 'anon') and not public.es_admin() then
		if new.id is distinct from old.id
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

-- 5. Borrar el email de la tabla pública ------------------------------------------

alter table public.jugadores drop column if exists email;

commit;

-- Dar el rol admin (NO se guarda en el repo: el email es un dato personal).
-- Desde esta tarea el email está en `jugadores_privado`. Tras tu primer login:
--   update public.jugadores set rol = 'admin'
--   where id = (select id from public.jugadores_privado where email = 'TU_EMAIL_DE_GOOGLE');
