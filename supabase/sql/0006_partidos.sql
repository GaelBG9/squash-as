-- Tarea 1.1: registrar un partido juego a juego (reglas R1, R6, R12 y R13).
-- Ejecutar una vez en el SQL Editor, después de 0002 a 0005.
--
-- Un partido se guarda en `partidos` y su marcador, juego a juego, en `juegos`.
-- La app NO puede escribir en estas tablas directamente: la única forma de crear
-- un partido es la función `registrar_partido`, que comprueba el marcador, se pone
-- a sí misma como quien registra y deja el partido "pendiente". Así nadie puede
-- hacer trampas llamando a la API a mano (fijarse "confirmado", registrar un
-- partido entre otros dos...). La función no toca `jugadores`: los ratings no cambian.

begin;

-- 1. Tablas ---------------------------------------------------------------------

create table if not exists public.partidos (
	-- Número automático: 1, 2, 3...
	id bigint generated always as identity primary key,
	fecha date not null,
	-- Por ahora solo entrenamientos; los torneos llegan con la tarea 2.1.
	tipo text not null default 'entrenamiento' check (tipo in ('entrenamiento', 'torneo')),
	-- libre: 1 o 2 juegos sueltos; mejor_de_3 / mejor_de_5: partido completo (R12).
	formato text not null check (formato in ('libre', 'mejor_de_3', 'mejor_de_5')),
	-- A es siempre quien registra; B, el rival que tiene que confirmar (R13).
	-- Sin `on delete cascade`: borrar a un jugador con partidos queda bloqueado
	-- hasta decidir qué hacer con su historial (tarea 2.5).
	jugador_a uuid not null references public.jugadores (id),
	jugador_b uuid not null references public.jugadores (id),
	-- `null` = empate (solo posible en formato libre, 1-1).
	ganador uuid references public.jugadores (id),
	estado text not null default 'pendiente'
		check (estado in ('pendiente', 'confirmado', 'rechazado')),
	registrado_por uuid not null references public.jugadores (id),
	-- Fecha y hora del registro: la tarea 1.4 cuenta los 15 días desde aquí (R8).
	registrado_en timestamptz not null default now(),
	constraint jugadores_distintos check (jugador_a <> jugador_b),
	constraint ganador_es_un_jugador check (ganador is null or ganador in (jugador_a, jugador_b)),
	constraint empate_solo_en_libre check (ganador is not null or formato = 'libre'),
	constraint registra_un_participante check (registrado_por in (jugador_a, jugador_b))
);

-- Índices: buscar rápido "los partidos en los que juego".
create index if not exists partidos_jugador_a on public.partidos (jugador_a);
create index if not exists partidos_jugador_b on public.partidos (jugador_b);
create index if not exists partidos_ganador on public.partidos (ganador);
create index if not exists partidos_registrado_por on public.partidos (registrado_por);

create table if not exists public.juegos (
	-- Si se borra el partido, se borran sus juegos.
	partido bigint not null references public.partidos (id) on delete cascade,
	numero smallint not null check (numero between 1 and 5),
	-- Puntos del jugador A y del jugador B. Sin regla de 11 puntos (R12).
	puntos_a smallint not null check (puntos_a between 0 and 99),
	puntos_b smallint not null check (puntos_b between 0 and 99),
	primary key (partido, numero),
	-- Un juego siempre tiene ganador.
	constraint juego_con_ganador check (puntos_a <> puntos_b)
);

-- 2. Permisos: los conectados leen; nadie escribe directamente ---------------------

revoke all on public.partidos from anon, authenticated;
revoke all on public.juegos from anon, authenticated;
grant select on public.partidos to authenticated;
grant select on public.juegos to authenticated;

alter table public.partidos enable row level security;
alter table public.juegos enable row level security;

-- Como la lista de jugadores (R10): todos los conectados ven todos los partidos,
-- que harán falta para la clasificación (1.5) y las estadísticas (2.3).
drop policy if exists "conectados leen partidos" on public.partidos;
create policy "conectados leen partidos"
	on public.partidos
	for select
	to authenticated
	using (true);

drop policy if exists "conectados leen juegos" on public.juegos;
create policy "conectados leen juegos"
	on public.juegos
	for select
	to authenticated
	using (true);

-- 3. Función para registrar un partido ----------------------------------------------
-- `p_juegos` es una lista JSON, en orden: [{"a": 11, "b": 7}, {"a": 9, "b": 11}, ...]
-- donde "a" son los puntos de quien registra y "b" los del rival.
-- Las reglas son las mismas que `validarMarcador` en src/lib/marcador.ts.
-- `security definer`: escribe como dueño de las tablas, que la app no puede tocar.
-- Una función se ejecuta en una sola transacción: se guardan el partido y todos
-- sus juegos, o nada.

create or replace function public.registrar_partido(
	p_rival uuid,
	p_fecha date,
	p_formato text,
	p_juegos jsonb
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

	insert into public.partidos (fecha, formato, jugador_a, jugador_b, ganador, registrado_por)
	values (p_fecha, p_formato, yo, p_rival, v_ganador, yo)
	returning id into nuevo_id;

	insert into public.juegos (partido, numero, puntos_a, puntos_b)
	select nuevo_id, posicion, (valor ->> 'a')::smallint, (valor ->> 'b')::smallint
	from jsonb_array_elements(p_juegos) with ordinality as j (valor, posicion);

	return nuevo_id;
end;
$$;

revoke all on function public.registrar_partido(uuid, date, text, jsonb) from public, anon;
grant execute on function public.registrar_partido(uuid, date, text, jsonb) to authenticated;

commit;
