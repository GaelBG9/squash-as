-- Tests de confirmar o rechazar un partido (tarea 1.2, reglas R1, R2 y R13).
-- Ejecutar en el SQL Editor DESPUÉS de supabase/sql/0007_responder_partido.sql.
--
-- Crea 3 cuentas DE PRUEBA (A, B y C). A registra partidos contra B; B responde.
-- Si un test falla, el bloque se para con "FALLO: ..." y Postgres deshace todo.
-- Si todo va bien, la última consulta muestra "TODOS LOS TESTS OK".

do $$
declare
	id_a constant uuid := '00000000-0000-4000-8000-0000000012a1';
	id_b constant uuid := '00000000-0000-4000-8000-0000000012b1';
	id_c constant uuid := '00000000-0000-4000-8000-0000000012c1';
	p_confirmar bigint;
	p_rechazar bigint;
	p_ajeno bigint;
	filas integer;
	fila_partido public.partidos;
	caso jsonb;
	respuesta text;
	fallo_esperado boolean;
	ratings_antes jsonb;
begin
	-- Preparación (como dueño de la base de datos) ---------------------------
	insert into auth.users (id, email, raw_user_meta_data) values
		(id_a, 'responder.a@ejemplo.test', '{"full_name": "Jugador A"}'),
		(id_b, 'responder.b@ejemplo.test', '{"full_name": "Jugador B"}'),
		(id_c, 'responder.c@ejemplo.test', '{"full_name": "Jugador C"}');

	-- A conectado registra tres partidos contra B
	perform set_config('role', 'authenticated', true);
	perform set_config('request.jwt.claims',
		json_build_object('sub', id_a, 'role', 'authenticated')::text, true);
	p_confirmar := public.registrar_partido(id_b, current_date, 'mejor_de_5',
		'[{"a": 11, "b": 7}, {"a": 9, "b": 11}, {"a": 11, "b": 5}, {"a": 11, "b": 8}]');
	p_rechazar := public.registrar_partido(id_b, current_date, 'libre', '[{"a": 11, "b": 9}]');
	p_ajeno := public.registrar_partido(id_b, current_date, 'libre', '[{"a": 7, "b": 11}]');

	-- Test 1: un partido recién registrado no tiene respuesta
	if (select respondido_en from public.partidos where id = p_confirmar) is not null then
		raise exception 'FALLO test 1: un partido pendiente no debería tener fecha de respuesta';
	end if;

	-- Test 2 (R2): quien registró no puede confirmar ni rechazar su partido
	foreach respuesta in array array['confirmado', 'rechazado'] loop
		begin
			perform public.responder_partido(p_confirmar, respuesta);
			fallo_esperado := false;
		exception when insufficient_privilege then
			fallo_esperado := true;
		end;
		if not fallo_esperado then
			raise exception 'FALLO test 2: A ha respondido "%" a su propio partido', respuesta;
		end if;
	end loop;

	-- C conectado (no juega el partido) -----------------------------------------
	perform set_config('request.jwt.claims',
		json_build_object('sub', id_c, 'role', 'authenticated')::text, true);

	-- Test 3: alguien que no juega el partido no puede responder
	begin
		perform public.responder_partido(p_ajeno, 'confirmado');
		fallo_esperado := false;
	exception when insufficient_privilege then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 3: C ha confirmado un partido entre A y B';
	end if;

	-- B conectado (el rival) -----------------------------------------------------
	perform set_config('request.jwt.claims',
		json_build_object('sub', id_b, 'role', 'authenticated')::text, true);

	-- Test 4 (criterio de la 1.2): B confirma -> "confirmado", con fecha de respuesta
	perform public.responder_partido(p_confirmar, 'confirmado');
	select * into fila_partido from public.partidos where id = p_confirmar;
	if fila_partido.estado <> 'confirmado' or fila_partido.respondido_en is null then
		raise exception 'FALLO test 4: estado "%" tras confirmar', fila_partido.estado;
	end if;

	-- Valores tras la confirmación (desde la tarea 1.3, confirmar aplica Glicko-2;
	-- el cálculo se prueba en supabase/tests/0008_glicko2.sql).
	select jsonb_agg(jsonb_build_array(rating, rd, volatilidad) order by id) into ratings_antes
	from public.jugadores where id in (id_a, id_b);

	-- Test 5 (criterio de la 1.2): B rechaza -> "rechazado"
	perform public.responder_partido(p_rechazar, 'rechazado');
	select * into fila_partido from public.partidos where id = p_rechazar;
	if fila_partido.estado <> 'rechazado' or fila_partido.respondido_en is null then
		raise exception 'FALLO test 5: estado "%" tras rechazar', fila_partido.estado;
	end if;

	-- Test 6: rechazar no cambia ningún rating
	if (select jsonb_agg(jsonb_build_array(rating, rd, volatilidad) order by id)
		from public.jugadores where id in (id_a, id_b)) is distinct from ratings_antes then
		raise exception 'FALLO test 6: un rating ha cambiado al rechazar';
	end if;

	-- Test 7: no se puede responder dos veces (ni cambiar de opinión)
	for caso in select value from jsonb_array_elements(jsonb_build_array(
		jsonb_build_object('partido', p_confirmar, 'respuesta', 'confirmado'),
		jsonb_build_object('partido', p_confirmar, 'respuesta', 'rechazado'),
		jsonb_build_object('partido', p_rechazar, 'respuesta', 'confirmado')
	))
	loop
		begin
			perform public.responder_partido((caso ->> 'partido')::bigint, caso ->> 'respuesta');
			fallo_esperado := false;
		exception when invalid_parameter_value then
			fallo_esperado := true;
		end;
		if not fallo_esperado then
			raise exception 'FALLO test 7: se ha vuelto a responder %', caso;
		end if;
	end loop;
	if (select estado from public.partidos where id = p_rechazar) <> 'rechazado' then
		raise exception 'FALLO test 7: un partido rechazado ha cambiado de estado';
	end if;

	-- Test 8: respuesta desconocida, vacía o partido que no existe -> error
	for caso in select value from jsonb_array_elements(jsonb_build_array(
		jsonb_build_object('nombre', 'respuesta "pendiente"', 'partido', p_ajeno, 'respuesta', 'pendiente'),
		jsonb_build_object('nombre', 'respuesta inventada', 'partido', p_ajeno, 'respuesta', 'ok'),
		jsonb_build_object('nombre', 'sin respuesta', 'partido', p_ajeno, 'respuesta', null),
		jsonb_build_object('nombre', 'partido inexistente', 'partido', -1, 'respuesta', 'confirmado'),
		jsonb_build_object('nombre', 'sin partido', 'partido', null, 'respuesta', 'confirmado')
	))
	loop
		begin
			perform public.responder_partido((caso ->> 'partido')::bigint, caso ->> 'respuesta');
			fallo_esperado := false;
		exception when invalid_parameter_value then
			fallo_esperado := true;
		end;
		if not fallo_esperado then
			raise exception 'FALLO test 8: se ha aceptado "%"', caso ->> 'nombre';
		end if;
	end loop;
	if (select estado from public.partidos where id = p_ajeno) <> 'pendiente' then
		raise exception 'FALLO test 8: un intento fallido ha cambiado el partido';
	end if;

	-- Test 9: B tampoco puede cambiar el estado directamente (solo con la función)
	begin
		update public.partidos set estado = 'confirmado', respondido_en = now() where id = p_ajeno;
		fallo_esperado := false;
	exception when insufficient_privilege then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 9: B ha cambiado el estado directamente';
	end if;

	-- Sin sesión -------------------------------------------------------------------
	perform set_config('role', 'anon', true);
	perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

	-- Test 10: sin sesión no se puede responder
	begin
		perform public.responder_partido(p_ajeno, 'confirmado');
		fallo_esperado := false;
	exception when insufficient_privilege then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 10: alguien sin sesión ha confirmado un partido';
	end if;

	-- Limpieza (otra vez como dueño) --------------------------------------------
	perform set_config('role', 'none', true);
	delete from public.historial_rating where jugador in (id_a, id_b);
	delete from public.partidos where id_a in (jugador_a, jugador_b);
	delete from auth.users where id in (id_a, id_b, id_c);
	if exists (select 1 from public.jugadores where id in (id_a, id_b, id_c)) then
		raise exception 'FALLO limpieza: quedan jugadores de prueba';
	end if;
end;
$$;

select 'TODOS LOS TESTS OK' as resultado,
	(select count(*) from public.jugadores_privado where email like 'responder.%@ejemplo.test')
		as datos_de_prueba_restantes;
