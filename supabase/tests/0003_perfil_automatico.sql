-- Tests del perfil automático (tarea 0.3).
-- Ejecutar en el SQL Editor DESPUÉS de supabase/sql/0003_perfil_automatico.sql.
-- Crea 2 cuentas DE PRUEBA, comprueba su perfil y las borra al final.
-- Si todo va bien, la última consulta muestra "TODOS LOS TESTS OK".

do $$
declare
	id_con_nombre constant uuid := '00000000-0000-4000-8000-0000000000c1';
	id_sin_nombre constant uuid := '00000000-0000-4000-8000-0000000000c2';
	j public.jugadores;
begin
	-- Simula el alta que hace Supabase al primer login con Google.
	insert into auth.users (id, email, raw_user_meta_data) values
		(id_con_nombre, 'con.nombre@ejemplo.test', '{"full_name": "Jugadora Prueba"}'),
		(id_sin_nombre, 'sin.nombre@ejemplo.test', '{}');

	-- Test 1: se crea el perfil con el nombre de Google y rol jugador
	select * into j from public.jugadores where id = id_con_nombre;
	if not found then
		raise exception 'FALLO test 1: no se ha creado el perfil';
	end if;
	if j.nombre <> 'Jugadora Prueba' then
		raise exception 'FALLO test 1: nombre esperado "Jugadora Prueba", obtenido "%"', j.nombre;
	end if;
	if j.rol <> 'jugador' then
		raise exception 'FALLO test 1: rol esperado "jugador", obtenido "%"', j.rol;
	end if;
	if j.email <> 'con.nombre@ejemplo.test' then
		raise exception 'FALLO test 1: email incorrecto "%"', j.email;
	end if;

	-- Test 2: sin nombre de Google se usa la parte del email antes de la @
	select * into j from public.jugadores where id = id_sin_nombre;
	if not found or j.nombre <> 'sin.nombre' then
		raise exception 'FALLO test 2: nombre esperado "sin.nombre", obtenido "%"', j.nombre;
	end if;

	-- Test 3: el perfil nuevo empieza sin grupo y con los valores de Glicko-2
	if j.grupo is not null or j.rating <> 1500 or j.rd <> 350 or j.volatilidad <> 0.06 then
		raise exception 'FALLO test 3: valores iniciales incorrectos (grupo %, rating %, rd %, vol %)',
			j.grupo, j.rating, j.rd, j.volatilidad;
	end if;

	-- Limpieza: borrar las cuentas borra también sus perfiles
	delete from auth.users where id in (id_con_nombre, id_sin_nombre);
	if exists (select 1 from public.jugadores where id in (id_con_nombre, id_sin_nombre)) then
		raise exception 'FALLO limpieza: quedan perfiles de prueba';
	end if;
end;
$$;

select 'TODOS LOS TESTS OK' as resultado;
