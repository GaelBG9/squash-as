-- Tests de permisos de la tabla `jugadores` (tarea 0.2).
-- Ejecutar en el SQL Editor DESPUÉS de supabase/sql/0002_jugadores.sql.
--
-- Cómo funciona: un único bloque `do` crea 3 cuentas DE PRUEBA, simula que cada
-- una está conectada y comprueba qué puede hacer. Al final borra sus datos.
-- Si un test falla, el bloque se para con "FALLO: ..." y Postgres deshace todo.
-- Si todo va bien, la última consulta muestra "TODOS LOS TESTS OK".

do $$
declare
	id_a constant uuid := '00000000-0000-4000-8000-00000000000a';
	id_b constant uuid := '00000000-0000-4000-8000-00000000000b';
	id_admin constant uuid := '00000000-0000-4000-8000-0000000000ad';
	filas integer;
	fallo_esperado boolean;
begin
	-- Preparación (como dueño de la base de datos) ---------------------------
	insert into auth.users (id, email) values
		(id_a, 'jugador.a@ejemplo.test'),
		(id_b, 'jugador.b@ejemplo.test'),
		(id_admin, 'admin@ejemplo.test');
	insert into public.jugadores (id, nombre, email, grupo, rol) values
		(id_a, 'Jugador A', 'jugador.a@ejemplo.test', 1, 'jugador'),
		(id_b, 'Jugador B', 'jugador.b@ejemplo.test', 2, 'jugador'),
		(id_admin, 'Admin Prueba', 'admin@ejemplo.test', 1, 'admin');

	-- Simular al jugador A conectado ------------------------------------------
	perform set_config('role', 'authenticated', true);
	perform set_config('request.jwt.claims',
		json_build_object('sub', id_a, 'role', 'authenticated')::text, true);

	-- Test 1: A ve la lista de jugadores
	select count(*) into filas from public.jugadores;
	if filas <> 3 then
		raise exception 'FALLO test 1: A debería ver 3 jugadores y ve %', filas;
	end if;

	-- Test 2: A cambia su propio nombre
	update public.jugadores set nombre = 'A renombrado' where id = id_a;
	get diagnostics filas = row_count;
	if filas <> 1 then
		raise exception 'FALLO test 2: A no ha podido cambiar su nombre';
	end if;

	-- Test 3: A intenta cambiar el nombre de B -> 0 filas cambiadas
	update public.jugadores set nombre = 'B hackeado' where id = id_b;
	get diagnostics filas = row_count;
	if filas <> 0 then
		raise exception 'FALLO test 3: A ha cambiado el perfil de B';
	end if;

	-- Test 4: A intenta hacerse admin -> error
	begin
		update public.jugadores set rol = 'admin' where id = id_a;
		fallo_esperado := false;
	exception when insufficient_privilege then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 4: A ha podido ponerse rol admin';
	end if;

	-- Test 5: A intenta cambiar su grupo -> error
	begin
		update public.jugadores set grupo = 2 where id = id_a;
		fallo_esperado := false;
	exception when insufficient_privilege then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 5: A ha podido cambiar su grupo';
	end if;

	-- Test 6: A intenta subirse el rating -> error
	begin
		update public.jugadores set rating = 3000 where id = id_a;
		fallo_esperado := false;
	exception when insufficient_privilege then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 6: A ha podido cambiar su rating';
	end if;

	-- Test 7: A no puede crear jugadores (eso llega en 0.3)
	begin
		insert into public.jugadores (id, nombre, email) values (id_b, 'Falso', 'falso@ejemplo.test');
		fallo_esperado := false;
	exception when insufficient_privilege then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 7: A ha podido crear un jugador';
	end if;

	-- Simular al admin conectado ----------------------------------------------
	perform set_config('request.jwt.claims',
		json_build_object('sub', id_admin, 'role', 'authenticated')::text, true);

	-- Test 8: el admin cambia nombre, grupo y rol de B
	update public.jugadores set nombre = 'B por admin', grupo = 1, rol = 'admin' where id = id_b;
	get diagnostics filas = row_count;
	if filas <> 1 then
		raise exception 'FALLO test 8: el admin no ha podido modificar a B';
	end if;

	-- Test 9: grupo 3 no existe -> error
	begin
		update public.jugadores set grupo = 3 where id = id_a;
		fallo_esperado := false;
	exception when check_violation then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 9: se ha aceptado el grupo 3';
	end if;

	-- Simular a alguien sin sesión ---------------------------------------------
	perform set_config('role', 'anon', true);
	perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

	-- Test 10: sin sesión no se ve ningún jugador
	begin
		select count(*) into filas from public.jugadores;
	exception when insufficient_privilege then
		filas := 0;
	end;
	if filas <> 0 then
		raise exception 'FALLO test 10: alguien sin sesión ve % jugadores', filas;
	end if;

	-- Limpieza (otra vez como dueño) --------------------------------------------
	perform set_config('role', 'none', true);
	delete from auth.users where id in (id_a, id_b, id_admin); -- borra también sus jugadores
end;
$$;

select 'TODOS LOS TESTS OK' as resultado,
	(select count(*) from public.jugadores where email like '%@ejemplo.test') as datos_de_prueba_restantes;
