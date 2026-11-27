-- Tests del registro de partidos (tarea 1.1, reglas R1, R6, R12 y R13).
-- Ejecutar en el SQL Editor DESPUÉS de supabase/sql/0006_partidos.sql.
--
-- Crea 2 cuentas DE PRUEBA (A y B), simula que A está conectado y registra
-- partidos con la función `registrar_partido`. Si un test falla, el bloque se para
-- con "FALLO: ..." y Postgres deshace todo. Si todo va bien, la última consulta
-- muestra "TODOS LOS TESTS OK".

do $$
declare
	id_a constant uuid := '00000000-0000-4000-8000-0000000011a1';
	id_b constant uuid := '00000000-0000-4000-8000-0000000011b1';
	id_nadie constant uuid := '00000000-0000-4000-8000-0000000011ff';
	id_partido bigint;
	otro_id bigint;
	filas integer;
	fila_partido public.partidos;
	caso jsonb;
	fallo_esperado boolean;
begin
	-- Preparación (como dueño de la base de datos) ---------------------------
	-- El trigger de alta crea el perfil de cada cuenta (rating 1500, RD 350, volatilidad 0.06).
	insert into auth.users (id, email, raw_user_meta_data) values
		(id_a, 'partidos.a@ejemplo.test', '{"full_name": "Jugador A"}'),
		(id_b, 'partidos.b@ejemplo.test', '{"full_name": "Jugador B"}');

	-- Simular al jugador A conectado ------------------------------------------
	perform set_config('role', 'authenticated', true);
	perform set_config('request.jwt.claims',
		json_build_object('sub', id_a, 'role', 'authenticated')::text, true);

	-- Test 1 (criterio de la 1.1): A registra 3-1 (11-7, 9-11, 11-5, 11-8) -> pendiente
	id_partido := public.registrar_partido(id_b, current_date, 'mejor_de_5',
		'[{"a": 11, "b": 7}, {"a": 9, "b": 11}, {"a": 11, "b": 5}, {"a": 11, "b": 8}]');
	select * into fila_partido from public.partidos where id = id_partido;
	if fila_partido.estado <> 'pendiente' then
		raise exception 'FALLO test 1: el estado es "%"', fila_partido.estado;
	end if;
	if fila_partido.jugador_a <> id_a or fila_partido.jugador_b <> id_b or fila_partido.registrado_por <> id_a
		or fila_partido.ganador is distinct from id_a or fila_partido.tipo <> 'entrenamiento' then
		raise exception 'FALLO test 1: datos del partido incorrectos';
	end if;
	select count(*) into filas from public.juegos where partido = id_partido;
	if filas <> 4 then
		raise exception 'FALLO test 1: el partido debería tener 4 juegos y tiene %', filas;
	end if;
	select count(*) into filas from public.juegos
	where partido = id_partido and numero = 2 and puntos_a = 9 and puntos_b = 11;
	if filas <> 1 then
		raise exception 'FALLO test 1: el juego 2 no es 9-11';
	end if;

	-- Test 2 (criterio de la 1.1): ningún rating cambia
	select count(*) into filas from public.jugadores
	where id in (id_a, id_b) and rating = 1500 and rd = 350 and volatilidad = 0.06;
	if filas <> 2 then
		raise exception 'FALLO test 2: un rating ha cambiado al registrar el partido';
	end if;

	-- Test 3: formato libre 1-1 -> empate (sin ganador)
	otro_id := public.registrar_partido(id_b, current_date, 'libre',
		'[{"a": 11, "b": 9}, {"a": 4, "b": 11}]');
	if (select ganador from public.partidos where id = otro_id) is not null then
		raise exception 'FALLO test 3: un 1-1 en libre debería ser empate';
	end if;

	-- Test 4: marcador libre (no se juega siempre a 11): un juego 7-9 lo gana B
	otro_id := public.registrar_partido(id_b, current_date, 'libre', '[{"a": 7, "b": 9}]');
	if (select ganador from public.partidos where id = otro_id) is distinct from id_b then
		raise exception 'FALLO test 4: el 7-9 debería ganarlo B';
	end if;

	-- Test 5: al mejor de 3, 2-0 es un partido terminado
	otro_id := public.registrar_partido(id_b, current_date, 'mejor_de_3',
		'[{"a": 11, "b": 3}, {"a": 15, "b": 13}]');
	if (select ganador from public.partidos where id = otro_id) is distinct from id_a then
		raise exception 'FALLO test 5: el 2-0 al mejor de 3 debería ganarlo A';
	end if;

	-- Test 6: marcadores no válidos -> error, y no se guarda nada
	select count(*) into filas from public.partidos where registrado_por = id_a;
	for caso in select value from jsonb_array_elements('[
		{"nombre": "juego empatado 7-7", "formato": "libre", "juegos": [{"a": 7, "b": 7}]},
		{"nombre": "libre con 3 juegos", "formato": "libre",
			"juegos": [{"a": 11, "b": 1}, {"a": 11, "b": 2}, {"a": 11, "b": 3}]},
		{"nombre": "sin juegos", "formato": "libre", "juegos": []},
		{"nombre": "mejor de 3 sin terminar (1-1)", "formato": "mejor_de_3",
			"juegos": [{"a": 11, "b": 1}, {"a": 1, "b": 11}]},
		{"nombre": "mejor de 5 con un juego de más (3-0 y otro)", "formato": "mejor_de_5",
			"juegos": [{"a": 11, "b": 1}, {"a": 11, "b": 2}, {"a": 11, "b": 3}, {"a": 11, "b": 4}]},
		{"nombre": "mejor de 5 con 6 juegos", "formato": "mejor_de_5",
			"juegos": [{"a": 11, "b": 1}, {"a": 1, "b": 11}, {"a": 11, "b": 1}, {"a": 1, "b": 11},
				{"a": 11, "b": 1}, {"a": 11, "b": 1}]},
		{"nombre": "puntos negativos", "formato": "libre", "juegos": [{"a": -1, "b": 11}]},
		{"nombre": "puntos con decimales", "formato": "libre", "juegos": [{"a": 7.5, "b": 11}]},
		{"nombre": "puntos en texto", "formato": "libre", "juegos": [{"a": "11", "b": 7}]},
		{"nombre": "100 puntos", "formato": "libre", "juegos": [{"a": 100, "b": 98}]},
		{"nombre": "formato desconocido", "formato": "mejor_de_7", "juegos": [{"a": 11, "b": 7}]}
	]')
	loop
		begin
			perform public.registrar_partido(id_b, current_date, caso ->> 'formato', caso -> 'juegos');
			fallo_esperado := false;
		exception when invalid_parameter_value then
			fallo_esperado := true;
		end;
		if not fallo_esperado then
			raise exception 'FALLO test 6: se ha aceptado "%"', caso ->> 'nombre';
		end if;
	end loop;

	-- Test 7: rival no válido o fecha futura -> error
	for caso in select value from jsonb_array_elements(jsonb_build_array(
		jsonb_build_object('nombre', 'contra uno mismo', 'rival', id_a, 'fecha', current_date),
		jsonb_build_object('nombre', 'rival que no existe', 'rival', id_nadie, 'fecha', current_date),
		jsonb_build_object('nombre', 'sin rival', 'rival', null, 'fecha', current_date),
		jsonb_build_object('nombre', 'fecha futura', 'rival', id_b, 'fecha', current_date + 2)
	))
	loop
		begin
			perform public.registrar_partido((caso ->> 'rival')::uuid, (caso ->> 'fecha')::date,
				'libre', '[{"a": 11, "b": 7}]');
			fallo_esperado := false;
		exception when invalid_parameter_value then
			fallo_esperado := true;
		end;
		if not fallo_esperado then
			raise exception 'FALLO test 7: se ha aceptado "%"', caso ->> 'nombre';
		end if;
	end loop;

	-- Test 8: los intentos fallidos no han guardado nada (4 partidos válidos: tests 1, 3, 4 y 5)
	select count(*) into filas from public.partidos where registrado_por = id_a;
	if filas <> 4 then
		raise exception 'FALLO test 8: A debería tener 4 partidos y tiene %', filas;
	end if;

	-- Test 9: A no puede escribir directamente en las tablas (solo con la función)
	begin
		insert into public.partidos (fecha, formato, jugador_a, jugador_b, ganador, estado, registrado_por)
		values (current_date, 'libre', id_a, id_b, id_a, 'confirmado', id_a);
		fallo_esperado := false;
	exception when insufficient_privilege then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 9: A ha insertado un partido "confirmado" directamente';
	end if;

	begin
		update public.partidos set estado = 'confirmado' where id = id_partido;
		fallo_esperado := false;
	exception when insufficient_privilege then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 9: A ha confirmado su propio partido directamente (R2)';
	end if;

	begin
		update public.juegos set puntos_b = 0 where partido = id_partido;
		fallo_esperado := false;
	exception when insufficient_privilege then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 9: A ha cambiado un marcador directamente';
	end if;

	begin
		delete from public.partidos where id = id_partido;
		fallo_esperado := false;
	exception when insufficient_privilege then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 9: A ha borrado un partido directamente';
	end if;

	-- Simular al jugador B conectado ------------------------------------------
	perform set_config('request.jwt.claims',
		json_build_object('sub', id_b, 'role', 'authenticated')::text, true);

	-- Test 10: B ve el partido que A ha registrado contra él, con sus juegos
	select count(*) into filas from public.partidos where id = id_partido and jugador_b = id_b;
	if filas <> 1 then
		raise exception 'FALLO test 10: B no ve el partido';
	end if;
	select count(*) into filas from public.juegos where partido = id_partido;
	if filas <> 4 then
		raise exception 'FALLO test 10: B debería ver 4 juegos y ve %', filas;
	end if;

	-- Simular a alguien sin sesión ---------------------------------------------
	perform set_config('role', 'anon', true);
	perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

	-- Test 11: sin sesión no se ve ningún partido
	begin
		select count(*) into filas from public.partidos;
	exception when insufficient_privilege then
		filas := 0;
	end;
	if filas <> 0 then
		raise exception 'FALLO test 11: alguien sin sesión ve % partidos', filas;
	end if;

	-- Test 12: sin sesión no se puede registrar un partido
	begin
		perform public.registrar_partido(id_b, current_date, 'libre', '[{"a": 11, "b": 7}]');
		fallo_esperado := false;
	exception when insufficient_privilege then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 12: alguien sin sesión ha registrado un partido';
	end if;

	-- Limpieza (otra vez como dueño) --------------------------------------------
	perform set_config('role', 'none', true);
	delete from public.partidos where id_a in (jugador_a, jugador_b); -- borra también sus juegos
	delete from auth.users where id in (id_a, id_b); -- borra perfil y fila privada
	if exists (select 1 from public.jugadores where id in (id_a, id_b)) then
		raise exception 'FALLO limpieza: quedan jugadores de prueba';
	end if;
end;
$$;

select 'TODOS LOS TESTS OK' as resultado,
	(select count(*) from public.jugadores_privado where email like 'partidos.%@ejemplo.test')
		as datos_de_prueba_restantes;
