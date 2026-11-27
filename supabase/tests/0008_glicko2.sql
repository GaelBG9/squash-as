-- Tests del cálculo Glicko-2 (tarea 1.3, reglas R1 y R3).
-- Ejecutar en el SQL Editor DESPUÉS de supabase/sql/0008_glicko2.sql.
--
-- Primero prueba las funciones de cálculo con el ejemplo del artículo de Glickman;
-- después crea 3 cuentas DE PRUEBA (A, B y C) y comprueba qué pasa al confirmar.
-- Si un test falla, el bloque se para con "FALLO: ..." y Postgres deshace todo.
-- Si todo va bien, la última consulta muestra "TODOS LOS TESTS OK".

do $$
declare
	id_a constant uuid := '00000000-0000-4000-8000-0000000013a1';
	id_b constant uuid := '00000000-0000-4000-8000-0000000013b1';
	id_c constant uuid := '00000000-0000-4000-8000-0000000013c1';
	r record;
	j_a public.jugadores;
	j_b public.jugadores;
	p_victoria bigint;
	p_rechazar bigint;
	p_empate bigint;
	id_partido bigint;
	filas integer;
	fallo_esperado boolean;
begin
	-- Funciones de cálculo (como dueño de la base de datos) ---------------------

	-- Test 1: el ejemplo del artículo de Glickman. Un jugador 1500 / 200 / 0,06 gana a
	-- 1400 / 30 y pierde contra 1550 / 100 y 1700 / 300 -> 1464,06 / 151,52 / 0,05999.
	select * into r from public.glicko2(1500, 200, 0.06,
		'[{"rating": 1400, "rd": 30, "resultado": 1},
		  {"rating": 1550, "rd": 100, "resultado": 0},
		  {"rating": 1700, "rd": 300, "resultado": 0}]');
	if abs(r.rating - 1464.06) > 0.01 or abs(r.rd - 151.52) > 0.01
		or abs(r.volatilidad - 0.05999) > 0.00001 then
		raise exception 'FALLO test 1: ejemplo de Glickman -> % / % / %', r.rating, r.rd, r.volatilidad;
	end if;

	-- Test 2: sin partidos solo crece el RD, y nunca pasa de 350
	select * into r from public.glicko2(1500, 200, 0.06, '[]');
	if r.rating <> 1500 or abs(r.rd - 200.27) > 0.01 or r.volatilidad <> 0.06 then
		raise exception 'FALLO test 2: periodo sin partidos -> % / %', r.rating, r.rd;
	end if;
	select * into r from public.glicko2(1500, 350, 0.06, '[]');
	if r.rd <> 350 then
		raise exception 'FALLO test 2: el RD ha pasado de 350 (%)', r.rd;
	end if;

	-- Test 3: un resultado que no es 0, 0.5 ni 1 -> error
	begin
		perform public.glicko2(1500, 350, 0.06, '[{"rating": 1500, "rd": 350, "resultado": 2}]');
		fallo_esperado := false;
	exception when invalid_parameter_value then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 3: se ha aceptado un resultado 2';
	end if;

	-- Test 4: el RD crece con las semanas sin jugar (una semana = un periodo)
	if public.rd_tras_inactividad(50, 0.06, null, current_date) <> 50 then
		raise exception 'FALLO test 4: un jugador sin partidos previos ha cambiado de RD';
	end if;
	if public.rd_tras_inactividad(50, 0.06, current_date - 7, current_date) <> 50 then
		raise exception 'FALLO test 4: jugar cada semana no debería aumentar el RD';
	end if;
	-- 371 días = 53 semanas, de las que 52 vacías: 50 -> 90,27
	if abs(public.rd_tras_inactividad(50, 0.06, current_date - 371, current_date) - 90.27) > 0.01 then
		raise exception 'FALLO test 4: RD tras un año sin jugar = %',
			public.rd_tras_inactividad(50, 0.06, current_date - 371, current_date);
	end if;
	if public.rd_tras_inactividad(340, 0.06, current_date - 371, current_date) <> 350 then
		raise exception 'FALLO test 4: el RD ha pasado de 350 por inactividad';
	end if;
	-- Un partido con fecha anterior al último contado no reduce el RD
	if public.rd_tras_inactividad(50, 0.06, current_date, current_date - 30) <> 50 then
		raise exception 'FALLO test 4: una fecha anterior ha cambiado el RD';
	end if;

	-- Preparación de las cuentas ----------------------------------------------------
	insert into auth.users (id, email, raw_user_meta_data) values
		(id_a, 'glicko.a@ejemplo.test', '{"full_name": "Jugador A"}'),
		(id_b, 'glicko.b@ejemplo.test', '{"full_name": "Jugador B"}'),
		(id_c, 'glicko.c@ejemplo.test', '{"full_name": "Jugador C"}');

	-- A conectado registra: una victoria hace 70 días, un partido que B rechazará y,
	-- hoy, un empate (formato libre 1-1).
	perform set_config('role', 'authenticated', true);
	perform set_config('request.jwt.claims',
		json_build_object('sub', id_a, 'role', 'authenticated')::text, true);
	p_victoria := public.registrar_partido(id_b, current_date - 70, 'mejor_de_5',
		'[{"a": 11, "b": 7}, {"a": 9, "b": 11}, {"a": 11, "b": 5}, {"a": 11, "b": 8}]');
	p_rechazar := public.registrar_partido(id_b, current_date - 70, 'libre', '[{"a": 11, "b": 9}]');
	p_empate := public.registrar_partido(id_b, current_date, 'libre',
		'[{"a": 11, "b": 9}, {"a": 6, "b": 11}]');

	-- Test 5: la app no puede llamar a las funciones de cálculo
	begin
		perform public.aplicar_glicko2(p_victoria);
		fallo_esperado := false;
	exception when insufficient_privilege then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 5: un jugador ha llamado a aplicar_glicko2';
	end if;
	begin
		perform public.glicko2(1500, 350, 0.06, '[]');
		fallo_esperado := false;
	exception when insufficient_privilege then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 5: un jugador ha llamado a glicko2';
	end if;

	-- B conectado (el rival) -----------------------------------------------------------
	perform set_config('request.jwt.claims',
		json_build_object('sub', id_b, 'role', 'authenticated')::text, true);

	-- Test 6 (criterio de la 1.3): al confirmar cambian los dos ratings.
	-- Dos jugadores nuevos (1500 / 350 / 0,06), gana A: 1662,31 y 1337,69, RD 290,32.
	perform public.responder_partido(p_victoria, 'confirmado');
	select * into j_a from public.jugadores where id = id_a;
	select * into j_b from public.jugadores where id = id_b;
	if abs(j_a.rating - 1662.31) > 0.01 or abs(j_b.rating - 1337.69) > 0.01
		or abs(j_a.rd - 290.32) > 0.01 or abs(j_b.rd - 290.32) > 0.01 then
		raise exception 'FALLO test 6: A % / %, B % / %', j_a.rating, j_a.rd, j_b.rating, j_b.rd;
	end if;

	-- Test 7 (criterio de la 1.3): se guarda el historial, una fila por jugador,
	-- con la fecha del partido y los valores nuevos. B lo puede leer.
	select count(*) into filas from public.historial_rating h
	join public.jugadores j on j.id = h.jugador
	where h.partido = p_victoria and h.fecha = current_date - 70
		and h.rating = j.rating and h.rd = j.rd and h.volatilidad = j.volatilidad;
	if filas <> 2 then
		raise exception 'FALLO test 7: % filas de historial correctas en lugar de 2', filas;
	end if;

	-- Test 8: rechazar no cambia los ratings ni escribe en el historial
	perform public.responder_partido(p_rechazar, 'rechazado');
	if (select rating from public.jugadores where id = id_a) <> j_a.rating
		or (select rating from public.jugadores where id = id_b) <> j_b.rating then
		raise exception 'FALLO test 8: un rating ha cambiado al rechazar';
	end if;
	if exists (select 1 from public.historial_rating where partido = p_rechazar) then
		raise exception 'FALLO test 8: un partido rechazado está en el historial';
	end if;

	-- Test 9: empate tras 10 semanas sin jugar. Medio punto para cada uno: sube el de
	-- peor rating, baja el otro. El RD de partida crece de 290,32 a 292,00, y por eso
	-- el RD final es 261,78 (sería 260,49 jugando cada semana).
	perform public.responder_partido(p_empate, 'confirmado');
	select * into j_a from public.jugadores where id = id_a;
	select * into j_b from public.jugadores where id = id_b;
	if abs(j_a.rating - 1576.24) > 0.01 or abs(j_b.rating - 1423.76) > 0.01
		or abs(j_a.rd - 261.78) > 0.01 or abs(j_b.rd - 261.78) > 0.01 then
		raise exception 'FALLO test 9: A % / %, B % / %', j_a.rating, j_a.rd, j_b.rating, j_b.rd;
	end if;

	-- Test 10: la app no puede escribir en el historial ni cambiar su propio rating
	begin
		insert into public.historial_rating (jugador, partido, fecha, rating, rd, volatilidad)
		values (id_b, p_victoria, current_date, 3000, 30, 0.06);
		fallo_esperado := false;
	exception when insufficient_privilege then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 10: B ha escrito en el historial';
	end if;
	begin
		update public.jugadores set rating = 3000 where id = id_b;
		fallo_esperado := false;
	exception when insufficient_privilege then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 10: B ha cambiado su rating directamente';
	end if;

	-- Sin sesión ----------------------------------------------------------------------
	perform set_config('role', 'anon', true);
	perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

	-- Test 11: sin sesión no se lee el historial
	begin
		perform 1 from public.historial_rating;
		fallo_esperado := false;
	exception when insufficient_privilege then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 11: alguien sin sesión ha leído el historial';
	end if;

	-- Otra vez como dueño ---------------------------------------------------------------
	perform set_config('role', 'none', true);

	-- Test 12: un partido no se cuenta dos veces, y uno no confirmado no se cuenta
	foreach id_partido in array array[p_victoria, p_rechazar] loop
		begin
			perform public.aplicar_glicko2(id_partido);
			fallo_esperado := false;
		exception when invalid_parameter_value then
			fallo_esperado := true;
		end;
		if not fallo_esperado then
			raise exception 'FALLO test 12: se ha contado el partido %', id_partido;
		end if;
	end loop;
	if (select count(*) from public.historial_rating where jugador in (id_a, id_b)) <> 4 then
		raise exception 'FALLO test 12: el historial no tiene 4 filas';
	end if;

	-- Test 13: C no ha jugado, sus valores no cambian
	if not exists (select 1 from public.jugadores
		where id = id_c and rating = 1500 and rd = 350 and volatilidad = 0.06) then
		raise exception 'FALLO test 13: el rating de C ha cambiado';
	end if;

	-- Limpieza ------------------------------------------------------------------------
	delete from public.historial_rating where jugador in (id_a, id_b);
	delete from public.partidos where id_a in (jugador_a, jugador_b);
	delete from auth.users where id in (id_a, id_b, id_c);
	if exists (select 1 from public.jugadores where id in (id_a, id_b, id_c)) then
		raise exception 'FALLO limpieza: quedan jugadores de prueba';
	end if;
end;
$$;

select 'TODOS LOS TESTS OK' as resultado,
	(select count(*) from public.jugadores_privado where email like 'glicko.%@ejemplo.test')
		as datos_de_prueba_restantes;
