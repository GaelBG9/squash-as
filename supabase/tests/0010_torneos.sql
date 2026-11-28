-- Tests de torneos e inscripciones (tarea 2.1, reglas R5, R17 y R25).
-- Ejecutar en el SQL Editor DESPUÉS de supabase/sql/0010_torneos.sql.
--
-- Crea 1 administrador y 17 jugadores DE PRUEBA. Si un test falla, el bloque se
-- para con "FALLO: ..." y Postgres deshace todo. Si todo va bien, la última consulta
-- muestra "TODOS LOS TESTS OK".

do $$
declare
	id_admin constant uuid := '00000000-0000-4000-8000-000000002000';
	-- Jugador i (1 a 17): ...-0000000020XX, con XX = i en hexadecimal.
	ids uuid[];
	id_torneo bigint;
	otro_torneo bigint;
	filas integer;
	fila public.torneos;
	fallo_esperado boolean;
	i integer;
begin
	-- Preparación (como dueño de la base de datos) ---------------------------
	insert into auth.users (id, email, raw_user_meta_data)
	values (id_admin, 'torneos.admin@ejemplo.test', '{"full_name": "Admin Prueba"}');
	for i in 1..17 loop
		ids[i] := format('00000000-0000-4000-8000-0000000020%s', lpad(to_hex(i), 2, '0'))::uuid;
		insert into auth.users (id, email, raw_user_meta_data)
		values (ids[i], format('torneos.j%s@ejemplo.test', i),
			json_build_object('full_name', format('Jugador Prueba %s', i)));
	end loop;
	-- Como dueño, el trigger de 0002 deja cambiar el rol.
	update public.jugadores set rol = 'admin' where id = id_admin;

	-- Simular al jugador 1 conectado (no es admin) -----------------------------
	perform set_config('role', 'authenticated', true);
	perform set_config('request.jwt.claims',
		json_build_object('sub', ids[1], 'role', 'authenticated')::text, true);

	-- Test 1: un jugador no puede crear un torneo
	begin
		perform public.crear_torneo('Torneo trampa', '2027-03-15');
		fallo_esperado := false;
	exception when insufficient_privilege then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 1: un jugador ha creado un torneo';
	end if;

	-- Test 2: tampoco puede escribir directamente en la tabla
	begin
		insert into public.torneos (nombre, fecha) values ('Torneo trampa', '2027-03-15');
		fallo_esperado := false;
	exception when insufficient_privilege then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 2: un jugador ha escrito en torneos';
	end if;

	-- Simular al administrador conectado ---------------------------------------
	perform set_config('request.jwt.claims',
		json_build_object('sub', id_admin, 'role', 'authenticated')::text, true);

	-- Test 3: el admin crea "Open de printemps"; temporada 2026-2027 (R25)
	id_torneo := public.crear_torneo('  Open de printemps  ', '2027-03-15');
	select * into fila from public.torneos where id = id_torneo;
	if fila.nombre <> 'Open de printemps' or fila.temporada <> '2026-2027' then
		raise exception 'FALLO test 3: torneo guardado como % / %', fila.nombre, fila.temporada;
	end if;

	-- Test 4: fechas límite de la temporada (31 de agosto y 1 de septiembre)
	otro_torneo := public.crear_torneo('Fin de saison', '2027-08-31');
	if (select temporada from public.torneos where id = otro_torneo) <> '2026-2027' then
		raise exception 'FALLO test 4: el 31 de agosto no es de la temporada 2026-2027';
	end if;
	otro_torneo := public.crear_torneo('Rentrée', '2027-09-01');
	if (select temporada from public.torneos where id = otro_torneo) <> '2027-2028' then
		raise exception 'FALLO test 4: el 1 de septiembre no empieza la temporada 2027-2028';
	end if;

	-- Test 5: nombre vacío rechazado
	begin
		perform public.crear_torneo('   ', '2027-03-15');
		fallo_esperado := false;
	exception when invalid_parameter_value then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 5: se ha creado un torneo sin nombre';
	end if;

	-- Test 6: el admin inscribe a 16 jugadores
	for i in 1..16 loop
		perform public.inscribir_jugador(id_torneo, ids[i]);
	end loop;
	select count(*) into filas from public.inscripciones where torneo = id_torneo;
	if filas <> 16 then
		raise exception 'FALLO test 6: % inscritos en vez de 16', filas;
	end if;

	-- Test 7: el 17.º jugador es rechazado (R5, R17)
	begin
		perform public.inscribir_jugador(id_torneo, ids[17]);
		fallo_esperado := false;
	exception when invalid_parameter_value then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 7: se ha inscrito a un 17.º jugador';
	end if;

	-- Test 8: inscribir dos veces al mismo jugador es rechazado (R17)
	perform public.desinscribir_jugador(id_torneo, ids[16]);
	begin
		perform public.inscribir_jugador(id_torneo, ids[1]);
		fallo_esperado := false;
	exception when unique_violation then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 8: el mismo jugador se ha inscrito dos veces';
	end if;

	-- Test 9: desinscribir libera la plaza: el 17.º ya cabe
	perform public.inscribir_jugador(id_torneo, ids[17]);
	select count(*) into filas from public.inscripciones where torneo = id_torneo;
	if filas <> 16 then
		raise exception 'FALLO test 9: % inscritos tras desinscribir e inscribir', filas;
	end if;

	-- Test 10: desinscribir a alguien que no está inscrito da error
	begin
		perform public.desinscribir_jugador(id_torneo, ids[16]);
		fallo_esperado := false;
	exception when invalid_parameter_value then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 10: se ha desinscrito a alguien que no estaba inscrito';
	end if;

	-- Test 11: inscribir en un torneo que no existe da error
	begin
		perform public.inscribir_jugador(-1, ids[16]);
		fallo_esperado := false;
	exception when invalid_parameter_value then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 11: inscripción en un torneo que no existe';
	end if;

	-- Volver al jugador 1 (no admin) ---------------------------------------------
	perform set_config('request.jwt.claims',
		json_build_object('sub', ids[1], 'role', 'authenticated')::text, true);

	-- Test 12: un jugador ve los torneos y los inscritos
	select count(*) into filas from public.inscripciones where torneo = id_torneo;
	if filas <> 16 or not exists (select 1 from public.torneos where id = id_torneo) then
		raise exception 'FALLO test 12: un jugador no ve el torneo o sus % inscritos', filas;
	end if;

	-- Test 13: un jugador no puede inscribir ni desinscribir
	begin
		perform public.desinscribir_jugador(id_torneo, ids[1]);
		fallo_esperado := false;
	exception when insufficient_privilege then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 13: un jugador ha desinscrito a alguien';
	end if;
	begin
		insert into public.inscripciones (torneo, jugador) values (otro_torneo, ids[1]);
		fallo_esperado := false;
	exception when insufficient_privilege then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 13: un jugador ha escrito en inscripciones';
	end if;

	-- Simular a alguien sin sesión ---------------------------------------------
	perform set_config('role', 'anon', true);
	perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

	-- Test 14: sin sesión no se ven torneos
	begin
		select count(*) into filas from public.torneos;
	exception when insufficient_privilege then
		filas := 0;
	end;
	if filas <> 0 then
		raise exception 'FALLO test 14: alguien sin sesión ve % torneos', filas;
	end if;

	-- Limpieza (otra vez como dueño) --------------------------------------------
	perform set_config('role', 'none', true);
	delete from public.torneos
	where nombre in ('Open de printemps', 'Fin de saison', 'Rentrée')
		and id >= id_torneo; -- borra también sus inscripciones
	delete from auth.users where id = id_admin or id = any (ids);
	if exists (select 1 from public.jugadores where id = id_admin or id = any (ids)) then
		raise exception 'FALLO limpieza: quedan jugadores de prueba';
	end if;
end;
$$;

select 'TODOS LOS TESTS OK' as resultado,
	(select count(*) from public.jugadores_privado where email like 'torneos.%@ejemplo.test')
		as datos_de_prueba_restantes;
