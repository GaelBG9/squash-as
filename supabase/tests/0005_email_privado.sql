-- Tests del email privado (tarea 0.8, regla R11).
-- Ejecutar en el SQL Editor DESPUÉS de supabase/sql/0005_email_privado.sql.
--
-- Crea 3 cuentas DE PRUEBA (A, B y un admin), simula que cada una está conectada
-- y comprueba qué emails ve. Si un test falla, el bloque se para con "FALLO: ..."
-- y Postgres deshace todo. Si todo va bien, la última consulta muestra "TODOS LOS TESTS OK".

do $$
declare
	id_a constant uuid := '00000000-0000-4000-8000-0000000008a1';
	id_b constant uuid := '00000000-0000-4000-8000-0000000008b1';
	id_admin constant uuid := '00000000-0000-4000-8000-0000000008ad';
	filas integer;
	email_visto text;
	fallo_esperado boolean;
begin
	-- Preparación (como dueño de la base de datos) ---------------------------
	-- El trigger de alta crea el perfil y la fila privada de cada cuenta.
	insert into auth.users (id, email, raw_user_meta_data) values
		(id_a, 'privado.a@ejemplo.test', '{"full_name": "Jugador A"}'),
		(id_b, 'privado.b@ejemplo.test', '{"full_name": "Jugador B"}'),
		(id_admin, 'privado.admin@ejemplo.test', '{"full_name": "Admin Prueba"}');
	update public.jugadores set grupo = 1 where id = id_a;
	update public.jugadores set grupo = 2 where id = id_b;
	update public.jugadores set rol = 'admin' where id = id_admin;

	-- Test 1: el alta guarda el email en la tabla privada
	select email into email_visto from public.jugadores_privado where id = id_a;
	if email_visto is distinct from 'privado.a@ejemplo.test' then
		raise exception 'FALLO test 1: email guardado "%"', email_visto;
	end if;

	-- Test 2: la tabla pública ya no tiene columna email
	if exists (
		select 1 from information_schema.columns
		where table_schema = 'public' and table_name = 'jugadores' and column_name = 'email'
	) then
		raise exception 'FALLO test 2: jugadores todavía tiene la columna email';
	end if;

	-- Simular al jugador A conectado ------------------------------------------
	perform set_config('role', 'authenticated', true);
	perform set_config('request.jwt.claims',
		json_build_object('sub', id_a, 'role', 'authenticated')::text, true);

	-- Test 3: A ve el nombre, el grupo y el nivel de los demás
	select count(*) into filas from public.jugadores
	where id in (id_a, id_b, id_admin) and nombre is not null and rating = 1500;
	if filas <> 3 then
		raise exception 'FALLO test 3: A debería ver 3 perfiles y ve %', filas;
	end if;
	select count(*) into filas from public.jugadores where id = id_b and grupo = 2;
	if filas <> 1 then
		raise exception 'FALLO test 3: A no ve el grupo de B';
	end if;

	-- Test 4: A solo ve un email, el suyo
	select count(*) into filas from public.jugadores_privado;
	if filas <> 1 then
		raise exception 'FALLO test 4: A debería ver 1 email y ve %', filas;
	end if;
	select email into email_visto from public.jugadores_privado;
	if email_visto <> 'privado.a@ejemplo.test' then
		raise exception 'FALLO test 4: A ve el email "%"', email_visto;
	end if;

	-- Test 5: A busca el email de B directamente -> no lo encuentra
	select count(*) into filas from public.jugadores_privado where id = id_b;
	if filas <> 0 then
		raise exception 'FALLO test 5: A ve el email de B';
	end if;

	-- Test 6: A intenta cambiar su email -> error
	begin
		update public.jugadores_privado set email = 'otro@ejemplo.test' where id = id_a;
		fallo_esperado := false;
	exception when insufficient_privilege then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 6: A ha podido cambiar su email';
	end if;

	-- Test 7: A intenta crear una fila privada -> error
	begin
		insert into public.jugadores_privado (id, email) values (id_b, 'falso@ejemplo.test');
		fallo_esperado := false;
	exception when insufficient_privilege then
		fallo_esperado := true;
	end;
	if not fallo_esperado then
		raise exception 'FALLO test 7: A ha podido crear una fila privada';
	end if;

	-- Test 8: A sigue pudiendo cambiar su nombre (el trigger nuevo no lo bloquea)
	update public.jugadores set nombre = 'A renombrado' where id = id_a;
	get diagnostics filas = row_count;
	if filas <> 1 then
		raise exception 'FALLO test 8: A no ha podido cambiar su nombre';
	end if;

	-- Simular al admin conectado ----------------------------------------------
	perform set_config('request.jwt.claims',
		json_build_object('sub', id_admin, 'role', 'authenticated')::text, true);

	-- Test 9: el admin ve los emails de todos
	select count(*) into filas from public.jugadores_privado where id in (id_a, id_b, id_admin);
	if filas <> 3 then
		raise exception 'FALLO test 9: el admin debería ver 3 emails y ve %', filas;
	end if;

	-- Simular a alguien sin sesión ---------------------------------------------
	perform set_config('role', 'anon', true);
	perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

	-- Test 10: sin sesión no se ve ningún email
	begin
		select count(*) into filas from public.jugadores_privado;
	exception when insufficient_privilege then
		filas := 0;
	end;
	if filas <> 0 then
		raise exception 'FALLO test 10: alguien sin sesión ve % emails', filas;
	end if;

	-- Limpieza (otra vez como dueño) --------------------------------------------
	perform set_config('role', 'none', true);
	delete from auth.users where id in (id_a, id_b, id_admin); -- borra perfil y fila privada
	if exists (select 1 from public.jugadores_privado where id in (id_a, id_b, id_admin)) then
		raise exception 'FALLO limpieza: quedan emails de prueba';
	end if;
end;
$$;

select 'TODOS LOS TESTS OK' as resultado,
	(select count(*) from public.jugadores_privado where email like '%@ejemplo.test') as datos_de_prueba_restantes;
