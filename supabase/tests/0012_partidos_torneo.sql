-- Tests de los partidos de torneo (tarea 2.3, reglas R3 y R19).
-- Ejecutar en el SQL Editor DESPUÉS de supabase/sql/0012_partidos_torneo.sql.
--
-- Crea 1 administrador y 4 jugadores DE PRUEBA y un torneo de 4 inscritos. Si un
-- test falla, el bloque se para con "FALLO: ..." y Postgres deshace todo. Si todo va
-- bien, la última consulta muestra "TODOS LOS TESTS OK".
--
-- Con 4 inscritos (cabezas 1 a 4 por rating), los exentos llevan a los cuatro a las
-- semifinales (ronda 3): cruce 1 = cabeza 1 contra cabeza 4, cruce 2 = cabeza 3
-- contra cabeza 2. La final es la ronda 4 y el campeón ocupa la ronda 5.
--
-- Ojo: el test 9 llama a `validar_partidos_vencidos()` con la hora actual. Si hay
-- partidos reales con más de 15 días sin respuesta, también se validan (es lo mismo
-- que haría el despertador de pg_cron en la siguiente hora en punto).

do $$
declare
	id_admin constant uuid := '00000000-0000-4000-8000-000000004000';
	ids uuid[];
	t bigint;
	p_libre bigint;
	p_semi1 bigint;
	p_rechazado bigint;
	p_semi2 bigint;
	p_final bigint;
	p_entreno bigint;
	v_partido public.partidos;
	filas integer;
	fallo_esperado boolean;
	i integer;
begin
	-- Preparación (como dueño de la base de datos) ---------------------------
	insert into auth.users (id, email, raw_user_meta_data)
	values (id_admin, 'ptorneo.admin@ejemplo.test', '{"full_name": "Admin Prueba"}');
	for i in 1..4 loop
		ids[i] := format('00000000-0000-4000-8000-0000000040%s', lpad(to_hex(i), 2, '0'))::uuid;
		insert into auth.users (id, email, raw_user_meta_data)
		values (ids[i], format('ptorneo.j%s@ejemplo.test', i),
			json_build_object('full_name', format('Jugador Prueba %s', i)));
	end loop;
	update public.jugadores set rol = 'admin' where id = id_admin;
	-- El jugador i es el cabeza i.
	for i in 1..4 loop
		update public.jugadores set rating = 2000 - 100 * i, rd = 100 where id = ids[i];
	end loop;

	-- El admin crea el torneo, inscribe a los 4 y genera el cuadro ------------------
	perform set_config('role', 'authenticated', true);
	perform set_config('request.jwt.claims',
		json_build_object('sub', id_admin, 'role', 'authenticated')::text, true);
	t := public.crear_torneo('Partidos de torneo prueba', '2026-11-01');
	for i in 1..4 loop
		perform public.inscribir_jugador(t, ids[i]);
	end loop;
	perform public.generar_cuadro(t);

	if not exists (select 1 from public.cuadros
			where torneo = t and ronda = 3 and posicion = 1 and jugador = ids[1])
		or not exists (select 1 from public.cuadros
			where torneo = t and ronda = 3 and posicion = 2 and jugador = ids[4]) then
		raise exception 'FALLO preparación: la semifinal 1 no es cabeza 1 contra cabeza 4';
	end if;

	-- Jugador 1 conectado ----------------------------------------------------------
	perform set_config('request.jwt.claims',
		json_build_object('sub', ids[1], 'role', 'authenticated')::text, true);

	-- Test 1: un partido de torneo no puede ser en formato libre (R19)
	begin
		p_libre := public.registrar_partido(ids[4], '2026-11-01', 'libre',
			'[{"a": 11, "b": 5}]', t);
		fallo_esperado := false;
	exception when invalid_parameter_value then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 1: partido de torneo en formato libre';
	end if;

	-- Test 2: solo entre dos jugadores que se enfrentan en el cuadro (1 y 2 no)
	begin
		perform public.registrar_partido(ids[2], '2026-11-01', 'mejor_de_3',
			'[{"a": 11, "b": 5}, {"a": 11, "b": 5}]', t);
		fallo_esperado := false;
	exception when invalid_parameter_value then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 2: partido entre dos jugadores que no se enfrentan';
	end if;

	-- Test 3: el partido de la semifinal 1 se registra "pendiente", de tipo torneo, y
	-- nadie avanza todavía
	p_rechazado := public.registrar_partido(ids[4], '2026-11-01', 'mejor_de_3',
		'[{"a": 11, "b": 5}, {"a": 11, "b": 7}]', t);
	select * into v_partido from public.partidos where id = p_rechazado;
	if v_partido.tipo <> 'torneo' or v_partido.torneo <> t or v_partido.estado <> 'pendiente' then
		raise exception 'FALLO test 3: partido de torneo mal guardado (%, %, %)',
			v_partido.tipo, v_partido.torneo, v_partido.estado;
	end if;
	if exists (select 1 from public.cuadros where torneo = t and ronda = 4) then
		raise exception 'FALLO test 3: alguien ha avanzado con el partido pendiente';
	end if;

	-- Test 4: con un partido pendiente, ese cruce no se puede volver a registrar,
	-- ni por el mismo jugador ni por su rival
	begin
		perform public.registrar_partido(ids[4], '2026-11-01', 'mejor_de_3',
			'[{"a": 11, "b": 5}, {"a": 11, "b": 7}]', t);
		fallo_esperado := false;
	exception when invalid_parameter_value then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 4: el mismo cruce registrado dos veces';
	end if;
	perform set_config('request.jwt.claims',
		json_build_object('sub', ids[4], 'role', 'authenticated')::text, true);
	begin
		perform public.registrar_partido(ids[1], '2026-11-01', 'mejor_de_3',
			'[{"a": 11, "b": 5}, {"a": 11, "b": 7}]', t);
		fallo_esperado := false;
	exception when invalid_parameter_value then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 4: el rival ha registrado el mismo cruce';
	end if;

	-- Test 5: el jugador 4 rechaza → nadie avanza, y el cruce se puede volver a
	-- registrar
	perform public.responder_partido(p_rechazado, 'rechazado');
	if exists (select 1 from public.cuadros where torneo = t and ronda = 4) then
		raise exception 'FALLO test 5: alguien ha avanzado con un partido rechazado';
	end if;
	perform set_config('request.jwt.claims',
		json_build_object('sub', ids[1], 'role', 'authenticated')::text, true);
	-- 2-1 para el jugador 1, al mejor de 3.
	p_semi1 := public.registrar_partido(ids[4], '2026-11-01', 'mejor_de_3',
		'[{"a": 11, "b": 5}, {"a": 8, "b": 11}, {"a": 11, "b": 9}]', t);

	-- Test 6: el jugador 4 confirma → el jugador 1 pasa a la final (ronda 4,
	-- posición 1) y los ratings cambian (R3)
	perform set_config('request.jwt.claims',
		json_build_object('sub', ids[4], 'role', 'authenticated')::text, true);
	perform public.responder_partido(p_semi1, 'confirmado');
	if not exists (select 1 from public.cuadros
			where torneo = t and ronda = 4 and posicion = 1 and jugador = ids[1]) then
		raise exception 'FALLO test 6: el ganador de la semifinal 1 no está en la final';
	end if;
	select count(*) into filas from public.historial_rating where partido = p_semi1;
	if filas <> 2 then
		raise exception 'FALLO test 6: % filas de historial en vez de 2 (Glicko-2)', filas;
	end if;

	-- Test 7: un cruce ya jugado no se vuelve a registrar
	begin
		perform public.registrar_partido(ids[1], '2026-11-02', 'mejor_de_3',
			'[{"a": 11, "b": 5}, {"a": 11, "b": 7}]', t);
		fallo_esperado := false;
	exception when invalid_parameter_value then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 7: un cruce jugado se ha registrado otra vez';
	end if;

	-- Test 8: el jugador 4, eliminado, no puede jugar la final contra nadie
	begin
		perform public.registrar_partido(ids[2], '2026-11-02', 'mejor_de_3',
			'[{"a": 11, "b": 5}, {"a": 11, "b": 7}]', t);
		fallo_esperado := false;
	exception when invalid_parameter_value then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 8: un eliminado ha registrado un partido';
	end if;

	-- Test 9: semifinal 2 al mejor de 5, 3-0 para el jugador 3, validada sola a los
	-- 15 días → el jugador 3 pasa a la final (ronda 4, posición 2)
	perform set_config('request.jwt.claims',
		json_build_object('sub', ids[3], 'role', 'authenticated')::text, true);
	p_semi2 := public.registrar_partido(ids[2], '2026-11-01', 'mejor_de_5',
		'[{"a": 11, "b": 5}, {"a": 11, "b": 7}, {"a": 11, "b": 9}]', t);
	perform set_config('role', 'none', true);
	update public.partidos set registrado_en = now() - interval '16 days' where id = p_semi2;
	perform public.validar_partidos_vencidos();
	select * into v_partido from public.partidos where id = p_semi2;
	if v_partido.estado <> 'confirmado' or not v_partido.validado_automaticamente then
		raise exception 'FALLO test 9: la semifinal 2 no se ha validado sola';
	end if;
	if not exists (select 1 from public.cuadros
			where torneo = t and ronda = 4 and posicion = 2 and jugador = ids[3]) then
		raise exception 'FALLO test 9: el ganador de la semifinal 2 no está en la final';
	end if;
	perform set_config('role', 'authenticated', true);

	-- Test 10: final, 2-0 para el jugador 3 → es el campeón (ronda 5, posición 1)
	p_final := public.registrar_partido(ids[1], '2026-11-03', 'mejor_de_3',
		'[{"a": 11, "b": 5}, {"a": 11, "b": 7}]', t);
	perform set_config('request.jwt.claims',
		json_build_object('sub', ids[1], 'role', 'authenticated')::text, true);
	perform public.responder_partido(p_final, 'confirmado');
	if not exists (select 1 from public.cuadros
			where torneo = t and ronda = 5 and posicion = 1 and jugador = ids[3]) then
		raise exception 'FALLO test 10: el ganador de la final no es el campeón';
	end if;
	select count(*) into filas from public.cuadros where torneo = t and ronda = 5;
	if filas <> 1 then
		raise exception 'FALLO test 10: % campeones en vez de 1', filas;
	end if;

	-- Test 11: los entrenamientos siguen igual (sin torneo, formato libre)
	p_entreno := public.registrar_partido(ids[2], '2026-11-03', 'libre', '[{"a": 11, "b": 5}]');
	select * into v_partido from public.partidos where id = p_entreno;
	if v_partido.tipo <> 'entrenamiento' or v_partido.torneo is not null then
		raise exception 'FALLO test 11: el entrenamiento se ha guardado como %', v_partido.tipo;
	end if;

	-- Test 12: la tabla rechaza un partido de torneo en formato libre aunque se
	-- escriba sin la función (como dueño)
	perform set_config('role', 'none', true);
	begin
		insert into public.partidos
			(fecha, tipo, torneo, formato, jugador_a, jugador_b, ganador, registrado_por)
		values ('2026-11-01', 'torneo', t, 'libre', ids[1], ids[2], ids[1], ids[1]);
		fallo_esperado := false;
	exception when check_violation then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 12: partido de torneo libre guardado en la tabla';
	end if;

	-- Limpieza (como dueño) -----------------------------------------------------
	delete from public.historial_rating where jugador = any (ids);
	delete from public.partidos where jugador_a = any (ids) or jugador_b = any (ids);
	-- Borra también sus inscripciones y su cuadro.
	delete from public.torneos where id = t;
	delete from auth.users where id = id_admin or id = any (ids);
	if exists (select 1 from public.jugadores where id = id_admin or id = any (ids)) then
		raise exception 'FALLO limpieza: quedan jugadores de prueba';
	end if;
end;
$$;

select 'TODOS LOS TESTS OK' as resultado,
	(select count(*) from public.jugadores_privado where email like 'ptorneo.%@ejemplo.test')
		as datos_de_prueba_restantes;
