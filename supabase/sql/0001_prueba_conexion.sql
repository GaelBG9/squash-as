-- Tarea 0.1: tabla de prueba para comprobar que la app se conecta a Supabase.
-- Ejecutar una vez en el SQL Editor del panel de Supabase.
-- Se borrará cuando la tabla `jugadores` (tarea 0.2) tenga datos reales.

create table if not exists public.prueba_conexion (
	id bigint generated always as identity primary key,
	mensaje text not null
);

-- Nivel 1, GRANT: qué roles pueden usar la tabla. Supabase ya no lo da por defecto
-- a las tablas nuevas; sin esto la app recibe "permission denied for table".
grant select on public.prueba_conexion to anon, authenticated;

-- Nivel 2, RLS (Row Level Security): qué filas puede ver cada uno.
-- Sin políticas, nadie puede leer ni escribir.
alter table public.prueba_conexion enable row level security;

-- Única política: cualquiera puede LEER. Nadie puede escribir desde la app.
drop policy if exists "lectura publica" on public.prueba_conexion;
create policy "lectura publica"
	on public.prueba_conexion
	for select
	to anon, authenticated
	using (true);

insert into public.prueba_conexion (mensaje)
select 'Hola desde Supabase'
where not exists (select 1 from public.prueba_conexion);
