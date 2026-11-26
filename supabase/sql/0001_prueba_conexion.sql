-- Tarea 0.1: tabla de prueba para comprobar que la app se conecta a Supabase.
-- Ejecutar una vez en el SQL Editor del panel de Supabase.
-- Se borrará cuando la tabla `jugadores` (tarea 0.2) tenga datos reales.

create table if not exists public.prueba_conexion (
	id bigint generated always as identity primary key,
	mensaje text not null
);

-- RLS (Row Level Security): sin políticas, nadie puede leer ni escribir.
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
