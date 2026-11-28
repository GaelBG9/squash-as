-- Tests del cuadro principal (tarea 2.2, reglas R16, R17 y R18).
-- Ejecutar en el SQL Editor DESPUÉS de supabase/sql/0011_cuadros.sql.
--
-- Crea 1 administrador y 16 jugadores DE PRUEBA. Si un test falla, el bloque se
-- para con "FALLO: ..." y Postgres deshace todo. Si todo va bien, la última consulta
-- muestra "TODOS LOS TESTS OK".
--
-- Ratings de prueba: los jugadores 1 a 12 tienen ratings distintos (el 1 el más
-- alto), así que el jugador i es el cabeza i. Los jugadores 13 a 16 empatan a
-- 1000: el 13 tiene el RD más bajo; el 14 y el 15 empatan también en RD, así que
-- los ordena el nombre ("Jugador Prueba 14" antes que "Jugador Prueba 15").

do $$
declare
	id_admin constant uuid := '00000000-0000-4000-8000-000000003000';
	orden constant integer[] := array[1, 16, 8, 9, 5, 12, 4, 13, 3, 14, 6, 11, 7, 10, 2, 15];
	ids uuid[];
	t16 bigint;
	t12 bigint;
	t2 bigint;
	t1 bigint;
	id_partido bigint;
	filas integer;
	fallo_esperado boolean;
	i integer;
	k integer;
begin
	-- Preparación (como dueño de la base de datos) ---------------------------
	insert into auth.users (id, email, raw_user_meta_data)
	values (id_admin, 'cuadros.admin@ejemplo.test', '{"full_name": "Admin Prueba"}');
	for i in 1..16 loop
		ids[i] := format('00000000-0000-4000-8000-0000000030%s', lpad(to_hex(i), 2, '0'))::uuid;
		insert into auth.users (id, email, raw_user_meta_data)
		values (ids[i], format('cuadros.j%s@ejemplo.test', i),
			json_build_object('full_name', format('Jugador Prueba %s', i)));
	end loop;
	-- Como dueño, el trigger de 0002 deja cambiar el rol y los ratings.
	update public.jugadores set rol = 'admin' where id = id_admin;
	for i in 1..12 loop
		update public.jugadores set rating = 2000 - 10 * i, rd = 100 where id = ids[i];
	end loop;
	update public.jugadores set rating = 1000, rd = 100 where id = ids[13];
	update public.jugadores set rating = 1000, rd = 200 where id in (ids[14], ids[15]);
	update public.jugadores set rating = 1000, rd = 300 where id = ids[16];

	-- Torneos creados como admin -------------------------------------------------
	perform set_config('role', 'authenticated', true);
	perform set_config('request.jwt.claims',
		json_build_object('sub', id_admin, 'role', 'authenticated')::text, true);

	t16 := public.crear_torneo('Cuadro prueba 16', '2027-03-15');
	t12 := public.crear_torneo('Cuadro prueba 12', '2027-03-15');
	t2 := public.crear_torneo('Cuadro prueba 2', '2027-03-15');
	t1 := public.crear_torneo('Cuadro prueba 1', '2027-03-15');
	for i in 1..16 loop
		perform public.inscribir_jugador(t16, ids[i]);
	end loop;
	for i in 1..12 loop
		perform public.inscribir_jugador(t12, ids[i]);
	end loop;
	perform public.inscribir_jugador(t2, ids[1]);
	perform public.inscribir_jugador(t2, ids[2]);
	perform public.inscribir_jugador(t1, ids[1]);

	-- Simular al jugador 1 conectado (no es admin) -----------------------------
	perform set_config('request.jwt.claims',
		json_build_object('sub', ids[1], 'role', 'authenticated')::text, true);

	-- Test 1: un jugador no puede generar el cuadro
	begin
		perform public.generar_cuadro(t16);
		fallo_esperado := false;
	exception when insufficient_privilege then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 1: un jugador ha generado un cuadro';
	end if;

	-- Test 2: tampoco puede escribir directamente en la tabla
	begin
		insert into public.cuadros (torneo, ronda, posicion, jugador) values (t16, 1, 1, ids[1]);
		fallo_esperado := false;
	exception when insufficient_privilege then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 2: un jugador ha escrito en cuadros';
	end if;

	-- Simular al administrador conectado ---------------------------------------
	perform set_config('request.jwt.claims',
		json_build_object('sub', id_admin, 'role', 'authenticated')::text, true);

	-- Test 3: 16 inscritos → 16 plazas en la 1.ª ronda, todas ocupadas, y nadie
	-- pasa solo a la 2.ª: 8 partidos en primera ronda (historia 5)
	perform public.generar_cuadro(t16);
	select count(*) into filas from public.cuadros
	where torneo = t16 and ronda = 1 and jugador is not null;
	if filas <> 16 then
		raise exception 'FALLO test 3: % plazas ocupadas en 1.ª ronda en vez de 16', filas;
	end if;
	select count(*) into filas from public.cuadros where torneo = t16 and ronda > 1;
	if filas <> 0 then
		raise exception 'FALLO test 3: % plazas decididas después de la 1.ª ronda', filas;
	end if;

	-- Test 4: cada cabeza k está en su posición del orden clásico; el 1 arriba
	-- (posición 1) y el 2 abajo (posición 15): solo se cruzan en la final.
	-- Incluye el desempate: 13 (RD 100), 14 y 15 (RD 200, por nombre), 16 (RD 300)
	for k in 1..16 loop
		if not exists (
			select 1 from public.cuadros
			where torneo = t16 and ronda = 1 and posicion = array_position(orden, k)
				and jugador = ids[k]
		) then
			raise exception 'FALLO test 4: el cabeza % no está en la posición %', k,
				array_position(orden, k);
		end if;
	end loop;

	-- Test 5: generar dos veces da error
	begin
		perform public.generar_cuadro(t16);
		fallo_esperado := false;
	exception when invalid_parameter_value then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 5: se ha generado el cuadro dos veces';
	end if;

	-- Test 6: con el cuadro generado no se inscribe ni se desinscribe (R17)
	begin
		perform public.desinscribir_jugador(t16, ids[16]);
		fallo_esperado := false;
	exception when invalid_parameter_value then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 6: se ha desinscrito a alguien con el cuadro generado';
	end if;
	perform public.generar_cuadro(t2);
	begin
		perform public.inscribir_jugador(t2, ids[3]);
		fallo_esperado := false;
	exception when invalid_parameter_value then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 6: se ha inscrito a alguien con el cuadro generado';
	end if;

	-- Test 7: 12 inscritos → los cabezas 1 a 4 pasan solos a la 2.ª ronda y quedan
	-- 4 partidos en la 1.ª (historia 5, R18)
	perform public.generar_cuadro(t12);
	select count(*) into filas from public.cuadros
	where torneo = t12 and ronda = 1 and jugador is null;
	if filas <> 4 then
		raise exception 'FALLO test 7: % plazas vacías en 1.ª ronda en vez de 4', filas;
	end if;
	select count(*) into filas from public.cuadros where torneo = t12 and ronda = 2;
	if filas <> 4 then
		raise exception 'FALLO test 7: % plazas decididas en 2.ª ronda en vez de 4', filas;
	end if;
	-- El ganador del cruce de las posiciones 2p-1 y 2p va a la posición p:
	-- cabeza 1 (posiciones 1-2) → 1; cabeza 4 (7-8) → 4; cabeza 3 (9-10) → 5;
	-- cabeza 2 (15-16) → 8.
	if not exists (select 1 from public.cuadros where torneo = t12 and ronda = 2 and posicion = 1 and jugador = ids[1])
		or not exists (select 1 from public.cuadros where torneo = t12 and ronda = 2 and posicion = 4 and jugador = ids[4])
		or not exists (select 1 from public.cuadros where torneo = t12 and ronda = 2 and posicion = 5 and jugador = ids[3])
		or not exists (select 1 from public.cuadros where torneo = t12 and ronda = 2 and posicion = 8 and jugador = ids[2])
	then
		raise exception 'FALLO test 7: los cabezas 1 a 4 no están en su plaza de 2.ª ronda';
	end if;
	select count(*) into filas
	from generate_series(1, 8) as p
	where (select count(jugador) from public.cuadros
		where torneo = t12 and ronda = 1 and posicion in (2 * p - 1, 2 * p)) = 2;
	if filas <> 4 then
		raise exception 'FALLO test 7: % partidos en 1.ª ronda en vez de 4', filas;
	end if;

	-- Test 8: 2 inscritos → pasan solos hasta la final, uno contra otro
	if not exists (select 1 from public.cuadros where torneo = t2 and ronda = 4 and posicion = 1 and jugador = ids[1])
		or not exists (select 1 from public.cuadros where torneo = t2 and ronda = 4 and posicion = 2 and jugador = ids[2])
	then
		raise exception 'FALLO test 8: con 2 inscritos la final no es 1 contra 2';
	end if;
	select count(*) into filas from public.cuadros where torneo = t2;
	if filas <> 16 + 8 + 4 + 2 then
		raise exception 'FALLO test 8: % plazas en vez de 30', filas;
	end if;

	-- Test 9: con 1 inscrito no se genera
	begin
		perform public.generar_cuadro(t1);
		fallo_esperado := false;
	exception when invalid_parameter_value then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 9: se ha generado un cuadro con 1 inscrito';
	end if;

	-- Test 10: el admin borra un cuadro sin partidos; las inscripciones se reabren
	perform public.borrar_cuadro(t16);
	select count(*) into filas from public.cuadros where torneo = t16;
	if filas <> 0 then
		raise exception 'FALLO test 10: quedan % plazas tras borrar el cuadro', filas;
	end if;
	perform public.desinscribir_jugador(t16, ids[16]);
	perform public.inscribir_jugador(t16, ids[16]);
	perform public.generar_cuadro(t16);

	-- Test 11: borrar un cuadro que no existe da error
	begin
		perform public.borrar_cuadro(t1);
		fallo_esperado := false;
	exception when invalid_parameter_value then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 11: se ha borrado un cuadro que no existía';
	end if;

	-- Test 12: con un partido de torneo registrado, el cuadro ya no se borra.
	-- La 2.3 traerá la función para registrarlo; aquí se inserta como dueño.
	perform set_config('role', 'none', true);
	insert into public.partidos
		(fecha, tipo, torneo, formato, jugador_a, jugador_b, ganador, registrado_por)
	values ('2027-03-15', 'torneo', t16, 'mejor_de_3', ids[8], ids[9], ids[8], ids[8])
	returning id into id_partido;
	perform set_config('role', 'authenticated', true);
	begin
		perform public.borrar_cuadro(t16);
		fallo_esperado := false;
	exception when invalid_parameter_value then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 12: se ha borrado un cuadro con partidos';
	end if;

	-- Test 13: un partido de entrenamiento no puede llevar torneo, ni uno de
	-- torneo quedarse sin él
	perform set_config('role', 'none', true);
	begin
		insert into public.partidos
			(fecha, tipo, torneo, formato, jugador_a, jugador_b, ganador, registrado_por)
		values ('2027-03-15', 'entrenamiento', t16, 'mejor_de_3', ids[8], ids[9], ids[8], ids[8]);
		fallo_esperado := false;
	exception when check_violation then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 13: entrenamiento guardado con torneo';
	end if;
	begin
		insert into public.partidos
			(fecha, tipo, formato, jugador_a, jugador_b, ganador, registrado_por)
		values ('2027-03-15', 'torneo', 'mejor_de_3', ids[8], ids[9], ids[8], ids[8]);
		fallo_esperado := false;
	exception when check_violation then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 13: partido de torneo guardado sin torneo';
	end if;
	perform set_config('role', 'authenticated', true);

	-- Volver al jugador 1 (no admin) ---------------------------------------------
	perform set_config('request.jwt.claims',
		json_build_object('sub', ids[1], 'role', 'authenticated')::text, true);

	-- Test 14: un jugador ve el cuadro pero no puede borrarlo
	select count(*) into filas from public.cuadros where torneo = t12;
	if filas <> 16 + 4 then
		raise exception 'FALLO test 14: un jugador ve % plazas en vez de 20', filas;
	end if;
	begin
		perform public.borrar_cuadro(t12);
		fallo_esperado := false;
	exception when insufficient_privilege then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 14: un jugador ha borrado un cuadro';
	end if;

	-- Limpieza (otra vez como dueño) --------------------------------------------
	perform set_config('role', 'none', true);
	delete from public.partidos where id = id_partido;
	-- Borra también sus inscripciones y sus cuadros.
	delete from public.torneos where id in (t16, t12, t2, t1);
	delete from auth.users where id = id_admin or id = any (ids);
	if exists (select 1 from public.jugadores where id = id_admin or id = any (ids)) then
		raise exception 'FALLO limpieza: quedan jugadores de prueba';
	end if;
end;
$$;

select 'TODOS LOS TESTS OK' as resultado,
	(select count(*) from public.jugadores_privado where email like 'cuadros.%@ejemplo.test')
		as datos_de_prueba_restantes;
