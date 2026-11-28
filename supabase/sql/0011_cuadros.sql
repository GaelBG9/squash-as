-- Tarea 2.2: generar el cuadro principal con cabezas de serie y exentos
-- (reglas R5, R16, R17 y R18). Ejecutar una vez en el SQL Editor, después de 0010.
--
-- Un cuadro es una lista de plazas: (ronda, posición, jugador). La ronda 1 tiene
-- 16 plazas, la 2 tiene 8, la 3 (semifinales) 4 y la 4 (final) 2. Los jugadores
-- de las posiciones 1 y 2 se enfrentan, los de la 3 y la 4 también, etc.; el
-- ganador del cruce de las posiciones 2p-1 y 2p va a la posición p de la ronda
-- siguiente.
--
-- Una fila solo existe cuando la plaza ya está decidida:
--   - fila con jugador          → ese jugador ocupa la plaza;
--   - fila con jugador `null`   → plaza vacía (exento): su rival pasa solo;
--   - sin fila                  → todavía no se sabe (falta jugar un partido, 2.3).
--
-- Como siempre, la app solo LEE. Para escribir están `generar_cuadro` y
-- `borrar_cuadro`, que comprueban que quien llama es el administrador.

begin;

-- 1. Tabla --------------------------------------------------------------------------

create table if not exists public.cuadros (
	id bigint generated always as identity primary key,
	-- Si se borra un torneo, se borra su cuadro.
	torneo bigint not null references public.torneos (id) on delete cascade,
	-- La consolación (plate) llega con la tarea 2.4.
	cuadro text not null default 'principal' check (cuadro in ('principal', 'consolacion')),
	ronda smallint not null check (ronda between 1 and 4),
	posicion smallint not null,
	-- `null` = exento (plaza vacía).
	jugador uuid references public.jugadores (id),
	-- Ronda 1: posiciones 1 a 16; ronda 2: 1 a 8; ronda 3: 1 a 4; ronda 4: 1 a 2.
	-- `>>` divide entre 2 tantas veces como indica el número de la derecha.
	constraint posicion_valida check (posicion between 1 and (16 >> (ronda - 1))),
	constraint plaza_unica unique (torneo, cuadro, ronda, posicion)
);

create index if not exists cuadros_jugador on public.cuadros (jugador);

revoke all on public.cuadros from anon, authenticated;
grant select on public.cuadros to authenticated;
alter table public.cuadros enable row level security;

drop policy if exists "conectados leen cuadros" on public.cuadros;
create policy "conectados leen cuadros"
	on public.cuadros
	for select
	to authenticated
	using (true);

-- 2. Los partidos de torneo dicen a qué torneo pertenecen -------------------------------
-- Registrarlos llega con la tarea 2.3; aquí solo hace falta la columna para que
-- `borrar_cuadro` sepa si ya se ha jugado algo. Sin `on delete cascade`: un torneo
-- con partidos no se puede borrar (ver tarea 2.11).

alter table public.partidos
	add column if not exists torneo bigint references public.torneos (id);

create index if not exists partidos_torneo on public.partidos (torneo);

alter table public.partidos drop constraint if exists torneo_si_tipo_torneo;
alter table public.partidos
	add constraint torneo_si_tipo_torneo check ((tipo = 'torneo') = (torneo is not null));

-- 3. Generar el cuadro (solo el administrador) ------------------------------------------

create or replace function public.generar_cuadro(p_torneo bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	-- Orden clásico de un cuadro de 16, de arriba abajo: la posición 1 es para el
	-- cabeza 1, la 2 para el 16, la 3 para el 8... El 1 está arriba y el 2 abajo,
	-- así que solo pueden cruzarse en la final. Cada cabeza k juega contra el 17-k,
	-- de modo que las plazas vacías (los cabezas que faltan) caen frente a los
	-- mejores. El mismo orden está en src/lib/cuadro.ts (ORDEN_CABEZAS).
	orden constant smallint[] := array[1, 16, 8, 9, 5, 12, 4, 13, 3, 14, 6, 11, 7, 10, 2, 15];
	inscritos integer;
	r integer;
	p integer;
	filas integer;
	con_jugador integer;
	quien uuid;
begin
	if not public.es_admin() then
		raise exception 'Seul l’administrateur peut générer le tableau.' using errcode = '42501';
	end if;

	-- Bloquea el torneo: mientras se genera, nadie inscribe ni desinscribe.
	perform 1 from public.torneos where id = p_torneo for update;
	if not found then
		raise exception 'Ce tournoi n’existe pas.' using errcode = '22023';
	end if;

	if exists (select 1 from public.cuadros where torneo = p_torneo and cuadro = 'principal') then
		raise exception 'Le tableau est déjà généré.' using errcode = '22023';
	end if;

	select count(*) into inscritos from public.inscripciones where torneo = p_torneo;
	if inscritos < 2 then
		raise exception 'Il faut au moins 2 inscrits pour générer le tableau.' using errcode = '22023';
	end if;

	-- Ronda 1: cabezas de serie por el rating Glicko-2 de hoy (R16). Si empatan,
	-- primero el RD más bajo (nivel más fiable) y después el nombre; el id solo
	-- desempata a dos jugadores con el mismo nombre, para que el orden no sea al azar.
	-- Los cabezas que no existen (más de N) quedan como plaza vacía: exentos (R18).
	insert into public.cuadros (torneo, cuadro, ronda, posicion, jugador)
	select p_torneo, 'principal', 1, o.posicion, c.jugador
	from unnest(orden) with ordinality as o (cabeza, posicion)
	left join (
		select i.jugador,
			row_number() over (order by j.rating desc, j.rd asc, j.nombre, j.id) as cabeza
		from public.inscripciones i
		join public.jugadores j on j.id = i.jugador
		where i.torneo = p_torneo
	) c on c.cabeza = o.cabeza;

	-- Exentos: ronda a ronda, cada cruce con al menos una plaza vacía se resuelve
	-- solo. Un jugador contra una plaza vacía pasa; dos plazas vacías dejan vacía
	-- la siguiente. Un cruce entre dos jugadores es un partido de verdad, y su
	-- plaza siguiente queda sin fila hasta que se juegue (tarea 2.3).
	for r in 1..3 loop
		for p in 1..(8 >> (r - 1)) loop
			select count(*), count(jugador), max(jugador::text)::uuid
			into filas, con_jugador, quien
			from public.cuadros
			where torneo = p_torneo and cuadro = 'principal' and ronda = r
				and posicion in (2 * p - 1, 2 * p);

			if filas = 2 and con_jugador <= 1 then
				insert into public.cuadros (torneo, cuadro, ronda, posicion, jugador)
				values (p_torneo, 'principal', r + 1, p, quien);
			end if;
		end loop;
	end loop;
end;
$$;

-- 4. Borrar el cuadro (solo el administrador, mientras no haya partidos) -------------------

create or replace function public.borrar_cuadro(p_torneo bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if not public.es_admin() then
		raise exception 'Seul l’administrateur peut supprimer le tableau.' using errcode = '42501';
	end if;

	perform 1 from public.torneos where id = p_torneo for update;
	if not found then
		raise exception 'Ce tournoi n’existe pas.' using errcode = '22023';
	end if;

	-- Un partido rechazado no cuenta: es como si no se hubiera jugado.
	if exists (
		select 1 from public.partidos where torneo = p_torneo and estado <> 'rechazado'
	) then
		raise exception 'Des matchs du tournoi sont déjà enregistrés : le tableau ne peut plus être supprimé.'
			using errcode = '22023';
	end if;

	delete from public.cuadros where torneo = p_torneo;
	if not found then
		raise exception 'Ce tournoi n’a pas encore de tableau.' using errcode = '22023';
	end if;
end;
$$;

-- 5. Con el cuadro generado, las inscripciones quedan bloqueadas (R17) ---------------------
-- Mismas funciones que en 0010, con una comprobación más.

create or replace function public.inscribir_jugador(p_torneo bigint, p_jugador uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	inscritos integer;
begin
	if not public.es_admin() then
		raise exception 'Seul l’administrateur peut inscrire des joueurs.' using errcode = '42501';
	end if;

	-- `for update` bloquea la fila del torneo hasta el final de la transacción.
	-- Si llegan dos inscripciones a la vez con 15 inscritos, la segunda espera a que
	-- termine la primera y cuenta 16: no se cuela un 17.º jugador.
	perform 1 from public.torneos where id = p_torneo for update;
	if not found then
		raise exception 'Ce tournoi n’existe pas.' using errcode = '22023';
	end if;

	if exists (select 1 from public.cuadros where torneo = p_torneo) then
		raise exception 'Le tableau est déjà généré : les inscriptions sont fermées.'
			using errcode = '22023';
	end if;

	if p_jugador is null or not exists (select 1 from public.jugadores where id = p_jugador) then
		raise exception 'Ce joueur n’existe pas.' using errcode = '22023';
	end if;
	if exists (
		select 1 from public.inscripciones where torneo = p_torneo and jugador = p_jugador
	) then
		raise exception 'Ce joueur est déjà inscrit.' using errcode = '23505';
	end if;

	select count(*) into inscritos from public.inscripciones where torneo = p_torneo;
	if inscritos >= 16 then
		raise exception 'Le tableau est complet (16 joueurs au maximum).' using errcode = '22023';
	end if;

	insert into public.inscripciones (torneo, jugador) values (p_torneo, p_jugador);
end;
$$;

create or replace function public.desinscribir_jugador(p_torneo bigint, p_jugador uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if not public.es_admin() then
		raise exception 'Seul l’administrateur peut désinscrire des joueurs.' using errcode = '42501';
	end if;

	perform 1 from public.torneos where id = p_torneo for update;
	if exists (select 1 from public.cuadros where torneo = p_torneo) then
		raise exception 'Le tableau est déjà généré : les inscriptions sont fermées.'
			using errcode = '22023';
	end if;

	delete from public.inscripciones where torneo = p_torneo and jugador = p_jugador;
	if not found then
		raise exception 'Ce joueur n’est pas inscrit à ce tournoi.' using errcode = '22023';
	end if;
end;
$$;

revoke all on function public.generar_cuadro(bigint) from public, anon;
revoke all on function public.borrar_cuadro(bigint) from public, anon;
grant execute on function public.generar_cuadro(bigint) to authenticated;
grant execute on function public.borrar_cuadro(bigint) to authenticated;

commit;
