-- Tarea 2.3: registrar partidos de torneo y avanzar en el cuadro (reglas R3 y R19).
-- Ejecutar una vez en el SQL Editor, después de 0011_cuadros.sql.
--
-- - `registrar_partido` acepta un torneo: entonces el partido es de tipo "torneo",
--   al mejor de 3 o de 5, y solo entre dos jugadores que se enfrentan en el cuadro.
-- - Cuando un partido de torneo pasa a "confirmado" (lo confirme el rival o se
--   valide solo a los 15 días), un trigger coloca al ganador en su plaza de la
--   ronda siguiente.
-- - El campeón ocupa la única plaza de la "ronda 5": quien gana la final pasa ahí,
--   con la misma regla que en el resto del cuadro.
-- - Glicko-2 no cambia: `aplicar_glicko2` ya cuenta cualquier partido confirmado (R3).

begin;

-- 1. La ronda 5 es la plaza del campeón -----------------------------------------------
-- `posicion_valida` (0011) ya da 1 sola plaza en la ronda 5: 16 >> 4 = 1.

alter table public.cuadros drop constraint if exists cuadros_ronda_check;
alter table public.cuadros add constraint cuadros_ronda_check check (ronda between 1 and 5);

-- 2. Un partido de torneo nunca es en formato libre (R19) --------------------------------
-- `registrar_partido` ya lo comprueba; la restricción protege la tabla aunque algún
-- día otra función escriba en ella.

alter table public.partidos drop constraint if exists torneo_no_libre;
alter table public.partidos
	add constraint torneo_no_libre check (tipo <> 'torneo' or formato <> 'libre');

-- 3. ¿Dónde se enfrentan dos jugadores en el cuadro? -------------------------------------
-- Devuelve la ronda y el número de cruce `p` (las posiciones 2p-1 y 2p) en que
-- `p_uno` y `p_otro` se enfrentan en el cuadro principal, o nada si no se enfrentan.
-- En eliminación directa dos jugadores se cruzan como mucho una vez, así que no hace
-- falta guardar la ronda en el partido: se deduce de las plazas.
-- (posicion + 1) / 2 es una división entera: las posiciones 1 y 2 dan 1, 3 y 4 dan 2...
-- Interna: la app no la llama.

create or replace function public.cruce_en_cuadro(p_torneo bigint, p_uno uuid, p_otro uuid)
returns table (ronda smallint, cruce integer)
language sql
stable
security definer
set search_path = ''
as $$
	select c1.ronda, (c1.posicion + 1) / 2
	from public.cuadros c1
	join public.cuadros c2
		on c2.torneo = c1.torneo and c2.cuadro = c1.cuadro and c2.ronda = c1.ronda
		and c2.posicion <> c1.posicion
		and (c2.posicion + 1) / 2 = (c1.posicion + 1) / 2
	where c1.torneo = p_torneo and c1.cuadro = 'principal' and c1.ronda <= 4
		and c1.jugador = p_uno and c2.jugador = p_otro;
$$;

revoke all on function public.cruce_en_cuadro(bigint, uuid, uuid)
	from public, anon, authenticated;

-- 4. Registrar un partido, también de torneo ----------------------------------------------
-- Se borra la versión de 4 parámetros: si no, quedarían dos funciones con el mismo
-- nombre y Postgres no sabría a cuál llamar. Con `p_torneo default null`, las llamadas
-- de la app sin torneo (entrenamientos) siguen funcionando igual.

drop function if exists public.registrar_partido(uuid, date, text, jsonb);

create or replace function public.registrar_partido(
	p_rival uuid,
	p_fecha date,
	p_formato text,
	p_juegos jsonb,
	p_torneo bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
	yo uuid := auth.uid();
	-- Juegos que hay que ganar para llevarse el partido (`null` en formato libre).
	objetivo integer;
	max_juegos integer;
	ganados_a integer := 0;
	ganados_b integer := 0;
	juego jsonb;
	v_numero integer;
	v_puntos_a integer;
	v_puntos_b integer;
	v_ganador uuid;
	v_ronda smallint;
	v_cruce integer;
	nuevo_id bigint;
begin
	if yo is null then
		raise exception 'Tu dois être connecté pour enregistrer un match.' using errcode = '42501';
	end if;

	if p_rival is null or p_rival = yo then
		raise exception 'Choisis un adversaire (autre que toi).' using errcode = '22023';
	end if;
	if not exists (select 1 from public.jugadores where id = p_rival) then
		raise exception 'Cet adversaire n’existe pas.' using errcode = '22023';
	end if;

	-- La fecha de hoy en Francia: el servidor de Supabase va en hora UTC.
	if p_fecha is null or p_fecha > (now() at time zone 'Europe/Paris')::date then
		raise exception 'La date du match ne peut pas être dans le futur.' using errcode = '22023';
	end if;

	case p_formato
		when 'libre' then objetivo := null; max_juegos := 2;
		when 'mejor_de_3' then objetivo := 2; max_juegos := 3;
		when 'mejor_de_5' then objetivo := 3; max_juegos := 5;
		else raise exception 'Format de match inconnu.' using errcode = '22023';
	end case;

	-- Partido de torneo (R19) ----------------------------------------------------------
	if p_torneo is not null then
		-- Bloquea el torneo: si los dos jugadores registran el mismo partido a la vez,
		-- el segundo espera y después ve que el partido ya existe.
		perform 1 from public.torneos where id = p_torneo for update;
		if not found then
			raise exception 'Ce tournoi n’existe pas.' using errcode = '22023';
		end if;

		if p_formato = 'libre' then
			raise exception 'Un match de tournoi se joue au meilleur des 3 ou des 5 jeux.'
				using errcode = '22023';
		end if;

		select c.ronda, c.cruce into v_ronda, v_cruce
		from public.cruce_en_cuadro(p_torneo, yo, p_rival) c;
		if not found then
			raise exception 'Vous ne vous affrontez pas dans le tableau de ce tournoi.'
				using errcode = '22023';
		end if;

		-- Un partido rechazado no cuenta: el cruce se puede volver a registrar.
		if exists (
			select 1 from public.partidos
			where torneo = p_torneo and estado <> 'rechazado'
				and ((jugador_a = yo and jugador_b = p_rival)
					or (jugador_a = p_rival and jugador_b = yo))
		) then
			raise exception 'Ce match du tableau est déjà enregistré.' using errcode = '22023';
		end if;
	end if;

	if p_juegos is null or jsonb_typeof(p_juegos) <> 'array'
		or jsonb_array_length(p_juegos) = 0 then
		raise exception 'Indique le score d’au moins un jeu.' using errcode = '22023';
	end if;
	if jsonb_array_length(p_juegos) > max_juegos then
		raise exception 'Trop de jeux pour ce format (% au maximum).', max_juegos
			using errcode = '22023';
	end if;

	for juego, v_numero in
		select valor, posicion from jsonb_array_elements(p_juegos) with ordinality as j (valor, posicion)
	loop
		-- Puntos: números enteros de 0 a 99 (ni negativos ni decimales).
		if jsonb_typeof(juego -> 'a') is distinct from 'number'
			or jsonb_typeof(juego -> 'b') is distinct from 'number'
			or (juego ->> 'a') !~ '^[0-9]{1,2}$'
			or (juego ->> 'b') !~ '^[0-9]{1,2}$' then
			raise exception 'Jeu %: les points doivent être des nombres entiers entre 0 et 99.', v_numero
				using errcode = '22023';
		end if;
		v_puntos_a := (juego ->> 'a')::integer;
		v_puntos_b := (juego ->> 'b')::integer;

		if v_puntos_a = v_puntos_b then
			raise exception 'Jeu %: il faut un gagnant (pas d’égalité).', v_numero using errcode = '22023';
		end if;
		if objetivo is not null and greatest(ganados_a, ganados_b) >= objetivo then
			raise exception 'Jeu %: le match était déjà terminé, ce jeu est en trop.', v_numero
				using errcode = '22023';
		end if;

		if v_puntos_a > v_puntos_b then
			ganados_a := ganados_a + 1;
		else
			ganados_b := ganados_b + 1;
		end if;
	end loop;

	if objetivo is not null and greatest(ganados_a, ganados_b) < objetivo then
		raise exception 'Le match n’est pas terminé : il faut gagner % jeux.', objetivo
			using errcode = '22023';
	end if;

	v_ganador := case
		when ganados_a > ganados_b then yo
		when ganados_b > ganados_a then p_rival
		else null -- empate, solo posible en formato libre (1-1)
	end;

	insert into public.partidos
		(fecha, tipo, torneo, formato, jugador_a, jugador_b, ganador, registrado_por)
	values (
		p_fecha,
		case when p_torneo is null then 'entrenamiento' else 'torneo' end,
		p_torneo, p_formato, yo, p_rival, v_ganador, yo
	)
	returning id into nuevo_id;

	insert into public.juegos (partido, numero, puntos_a, puntos_b)
	select nuevo_id, posicion, (valor ->> 'a')::smallint, (valor ->> 'b')::smallint
	from jsonb_array_elements(p_juegos) with ordinality as j (valor, posicion);

	return nuevo_id;
end;
$$;

revoke all on function public.registrar_partido(uuid, date, text, jsonb, bigint) from public, anon;
grant execute on function public.registrar_partido(uuid, date, text, jsonb, bigint)
	to authenticated;

-- 5. Al confirmarse, el ganador avanza (trigger) -------------------------------------------
-- Un trigger es una función que la base de datos ejecuta sola cuando cambia una fila.
-- Hay dos caminos para confirmar un partido (`responder_partido` y
-- `validar_partidos_vencidos`): el trigger los cubre a los dos sin tocarlos, y se
-- ejecuta dentro de la misma transacción (si falla, el partido no se confirma).
-- El ganador del cruce p de la ronda r va a la posición p de la ronda r + 1; el de la
-- final (ronda 4) va a la ronda 5: es el campeón.

create or replace function public.avanzar_ganador()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_ronda smallint;
	v_cruce integer;
begin
	select c.ronda, c.cruce into v_ronda, v_cruce
	from public.cruce_en_cuadro(new.torneo, new.jugador_a, new.jugador_b) c;
	if not found then
		raise exception 'Ce match ne correspond à aucun match du tableau.' using errcode = '22023';
	end if;

	-- `plaza_unica` impide que se decida dos veces la misma plaza.
	insert into public.cuadros (torneo, cuadro, ronda, posicion, jugador)
	values (new.torneo, 'principal', v_ronda + 1, v_cruce, new.ganador);
	return new;
end;
$$;

revoke all on function public.avanzar_ganador() from public, anon, authenticated;

drop trigger if exists avanzar_ganador on public.partidos;
create trigger avanzar_ganador
	after update of estado on public.partidos
	for each row
	when (new.tipo = 'torneo' and new.estado = 'confirmado' and old.estado <> 'confirmado')
	execute function public.avanzar_ganador();

commit;
