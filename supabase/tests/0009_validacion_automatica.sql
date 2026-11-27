-- Tests de la validación automática a los 15 días (tarea 1.4, regla R8).
-- Ejecutar en el SQL Editor DESPUÉS de supabase/sql/0009_validacion_automatica.sql.
--
-- Crea 3 cuentas DE PRUEBA (A, B y C) y partidos "registrados" en marzo de 2026, y
-- llama a `validar_partidos_vencidos` con una fecha fija en vez de esperar 15 días.
-- Si un test falla, el bloque se para con "FALLO: ..." y Postgres deshace todo.
-- Si todo va bien, la última consulta muestra "TODOS LOS TESTS OK".

do $$
declare
	id_a constant uuid := '00000000-0000-4000-8000-0000000014a1';
	id_b constant uuid := '00000000-0000-4000-8000-0000000014b1';
	id_c constant uuid := '00000000-0000-4000-8000-0000000014c1';
	-- El criterio: registrado el 1 de marzo (hora de París).
	registro constant timestamptz := '2026-03-01 10:00:00 Europe/Paris';
	j_a public.jugadores;
	j_b public.jugadores;
	p_criterio bigint;
	p_rechazado bigint;
	p_confirmado bigint;
	p_reciente bigint;
	p_tarde bigint;
	v_partido public.partidos;
	validados integer;
	fallo_esperado boolean;
begin
	-- Preparación ---------------------------------------------------------------------
	insert into auth.users (id, email, raw_user_meta_data) values
		(id_a, 'auto.a@ejemplo.test', '{"full_name": "Jugador A"}'),
		(id_b, 'auto.b@ejemplo.test', '{"full_name": "Jugador B"}'),
		(id_c, 'auto.c@ejemplo.test', '{"full_name": "Jugador C"}');

	-- A conectado registra 4 partidos contra B y C (los dos jugadores nuevos, 1500).
	perform set_config('role', 'authenticated', true);
	perform set_config('request.jwt.claims',
		json_build_object('sub', id_a, 'role', 'authenticated')::text, true);
	p_criterio := public.registrar_partido(id_b, current_date, 'mejor_de_5',
		'[{"a": 11, "b": 7}, {"a": 9, "b": 11}, {"a": 11, "b": 5}, {"a": 11, "b": 8}]');
	p_rechazado := public.registrar_partido(id_b, current_date, 'libre', '[{"a": 11, "b": 9}]');
	p_confirmado := public.registrar_partido(id_b, current_date, 'libre', '[{"a": 11, "b": 9}]');
	p_reciente := public.registrar_partido(id_c, current_date, 'libre', '[{"a": 11, "b": 9}]');

	-- Test 1: la app no puede llamar a la validación automática
	begin
		perform public.validar_partidos_vencidos();
		fallo_esperado := false;
	exception when insufficient_privilege then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 1: un jugador ha llamado a validar_partidos_vencidos';
	end if;

	-- Test 2: la app no puede marcarse un partido como validado automáticamente
	begin
		update public.partidos set validado_automaticamente = true where id = p_criterio;
		fallo_esperado := false;
	exception when insufficient_privilege then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 2: un jugador ha cambiado validado_automaticamente';
	end if;

	-- B conectado rechaza uno y confirma otro, como en la 1.2.
	perform set_config('request.jwt.claims',
		json_build_object('sub', id_b, 'role', 'authenticated')::text, true);
	perform public.responder_partido(p_rechazado, 'rechazado');
	perform public.responder_partido(p_confirmado, 'confirmado');

	-- Como dueño: los partidos pasan a estar registrados en marzo ----------------------
	perform set_config('role', 'none', true);
	update public.partidos set fecha = '2026-03-01', registrado_en = registro
	where id in (p_criterio, p_rechazado, p_confirmado);
	-- Un partido registrado el 10 de marzo todavía no ha vencido el 16.
	update public.partidos set fecha = '2026-03-10', registrado_en = registro + interval '9 days'
	where id = p_reciente;
	select * into j_a from public.jugadores where id = id_a;
	select * into j_b from public.jugadores where id = id_b;

	-- Test 3: el 16 de marzo a las 9:59 todavía no han pasado 15 días
	validados := public.validar_partidos_vencidos(registro + interval '15 days' - interval '1 minute');
	select * into v_partido from public.partidos where id = p_criterio;
	if v_partido.estado <> 'pendiente' or validados <> 0 then
		raise exception 'FALLO test 3: validado antes de tiempo (% partidos)', validados;
	end if;

	-- Test 4 (criterio de la 1.4): el 16 de marzo, sin respuesta, pasa a "confirmado",
	-- marcado como validación automática y con la fecha de la validación.
	validados := public.validar_partidos_vencidos(registro + interval '15 days');
	select * into v_partido from public.partidos where id = p_criterio;
	if v_partido.estado <> 'confirmado' or not v_partido.validado_automaticamente
		or v_partido.respondido_en <> registro + interval '15 days' then
		raise exception 'FALLO test 4: estado %, automático %, respondido %',
			v_partido.estado, v_partido.validado_automaticamente, v_partido.respondido_en;
	end if;

	-- Test 5 (criterio de la 1.4): los ratings de los dos jugadores cambian (gana A)
	-- y el partido está en el historial.
	if (select rating from public.jugadores where id = id_a) <= j_a.rating
		or (select rating from public.jugadores where id = id_b) >= j_b.rating then
		raise exception 'FALLO test 5: los ratings no han cambiado como se esperaba';
	end if;
	if (select count(*) from public.historial_rating where partido = p_criterio) <> 2 then
		raise exception 'FALLO test 5: el partido no está en el historial';
	end if;

	-- Test 6: solo se valida ese partido. El rechazado sigue rechazado, el confirmado por
	-- B no se marca como automático, y el del 10 de marzo sigue pendiente.
	if validados <> 1 then
		raise exception 'FALLO test 6: % partidos validados en lugar de 1', validados;
	end if;
	if (select estado from public.partidos where id = p_rechazado) <> 'rechazado' then
		raise exception 'FALLO test 6: el partido rechazado ha cambiado';
	end if;
	if (select validado_automaticamente from public.partidos where id = p_confirmado) then
		raise exception 'FALLO test 6: una confirmación del rival se ha marcado como automática';
	end if;
	if (select estado from public.partidos where id = p_reciente) <> 'pendiente' then
		raise exception 'FALLO test 6: el partido del 10 de marzo se ha validado antes de tiempo';
	end if;

	-- Test 7: volver a pasar no cuenta nada dos veces
	select * into j_a from public.jugadores where id = id_a;
	validados := public.validar_partidos_vencidos(registro + interval '15 days');
	if validados <> 0 or (select rating from public.jugadores where id = id_a) <> j_a.rating then
		raise exception 'FALLO test 7: segunda pasada, % partidos validados', validados;
	end if;

	-- Test 8: tras la validación, el rival ya no puede responder
	perform set_config('role', 'authenticated', true);
	perform set_config('request.jwt.claims',
		json_build_object('sub', id_b, 'role', 'authenticated')::text, true);
	begin
		perform public.responder_partido(p_criterio, 'rechazado');
		fallo_esperado := false;
	exception when invalid_parameter_value then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 8: B ha rechazado un partido ya validado';
	end if;
	perform set_config('role', 'none', true);

	-- Test 9: varios partidos vencidos se validan del más antiguo al más reciente
	-- (el del 10 de marzo y uno nuevo del 5 de marzo, ambos vencidos el 1 de abril).
	insert into public.partidos (fecha, formato, jugador_a, jugador_b, ganador, registrado_por,
		registrado_en)
	values ('2026-03-05', 'libre', id_a, id_c, id_c, id_a, registro + interval '4 days')
	returning id into p_tarde;
	insert into public.juegos (partido, numero, puntos_a, puntos_b) values (p_tarde, 1, 5, 11);
	validados := public.validar_partidos_vencidos('2026-04-01 12:00:00 Europe/Paris');
	if validados <> 2 then
		raise exception 'FALLO test 9: % partidos validados en lugar de 2', validados;
	end if;
	if (select min(id) from public.historial_rating where partido = p_tarde)
		> (select min(id) from public.historial_rating where partido = p_reciente) then
		raise exception 'FALLO test 9: el partido del 5 de marzo se ha contado después';
	end if;

	-- Test 10: un partido validado automáticamente tiene que estar confirmado
	begin
		update public.partidos set estado = 'rechazado' where id = p_criterio;
		fallo_esperado := false;
	exception when check_violation then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 10: un partido automático ha pasado a rechazado';
	end if;

	-- Test 11: el despertador está programado cada hora
	if not exists (select 1 from cron.job
		where jobname = 'validar-partidos-vencidos' and schedule = '0 * * * *' and active) then
		raise exception 'FALLO test 11: no hay tarea pg_cron activa cada hora';
	end if;

	-- Limpieza ------------------------------------------------------------------------
	delete from public.historial_rating where jugador in (id_a, id_b, id_c);
	delete from public.partidos where id_a in (jugador_a, jugador_b);
	delete from auth.users where id in (id_a, id_b, id_c);
	if exists (select 1 from public.jugadores where id in (id_a, id_b, id_c)) then
		raise exception 'FALLO limpieza: quedan jugadores de prueba';
	end if;
end;
$$;

select 'TODOS LOS TESTS OK' as resultado,
	(select count(*) from public.jugadores_privado where email like 'auto.%@ejemplo.test')
		as datos_de_prueba_restantes;
