-- Tarea 0.3: crear automáticamente el perfil de jugador al primer login (regla R7).
-- Ejecutar una vez en el SQL Editor, después de 0002_jugadores.sql.
--
-- Cuando alguien se conecta con Google por primera vez, Supabase crea su cuenta en
-- `auth.users`. Este trigger crea en ese momento su fila en `jugadores`, con rol
-- `jugador` (valor por defecto de la tabla) y sin grupo (lo asigna el admin, R9).

create or replace function public.crear_perfil_jugador()
returns trigger
language plpgsql
-- `security definer`: se ejecuta como dueño de la tabla, porque la app no tiene
-- permiso para crear jugadores (tarea 0.2).
security definer
set search_path = ''
as $$
declare
	nombre_google text := nullif(trim(coalesce(
		new.raw_user_meta_data ->> 'full_name',
		new.raw_user_meta_data ->> 'name'
	)), '');
begin
	insert into public.jugadores (id, email, nombre)
	values (
		new.id,
		new.email,
		-- Sin nombre de Google, se usa la parte del email antes de la @.
		coalesce(nombre_google, split_part(new.email, '@', 1))
	)
	on conflict (id) do nothing;
	return new;
end;
$$;

revoke all on function public.crear_perfil_jugador() from public, anon, authenticated;

drop trigger if exists crear_perfil_jugador on auth.users;
create trigger crear_perfil_jugador
	after insert on auth.users
	for each row
	execute function public.crear_perfil_jugador();

-- Dar el rol admin (NO se guarda en el repo: el email es un dato personal).
-- Tras tu primer login, ejecuta a mano en el SQL Editor, poniendo tu email:
--   update public.jugadores set rol = 'admin' where email = 'TU_EMAIL_DE_GOOGLE';
