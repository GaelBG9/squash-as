-- Tarea 0.4: borrar la tabla de prueba de la tarea 0.1 (0001_prueba_conexion.sql).
-- Ejecutar una vez en el SQL Editor, después de 0003_perfil_automatico.sql.
--
-- Ya no hace falta: el login (0.3) funciona y la página de inicio lee el perfil del
-- jugador en `jugadores`. Borrar la tabla también borra sus permisos y su política RLS.

drop table if exists public.prueba_conexion;

-- Comprobación: debe mostrar `true` (la tabla ya no existe).
select to_regclass('public.prueba_conexion') is null as prueba_conexion_borrada;
