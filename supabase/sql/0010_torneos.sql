-- Tarea 2.1: crear un torneo e inscribir jugadores (reglas R5, R17 y R25).
-- Ejecutar una vez en el SQL Editor, después de 0002 a 0009.
--
-- Igual que con los partidos (0006), la app solo LEE estas tablas. Para escribir
-- hay tres funciones, y las tres comprueban que quien llama es el administrador:
-- `crear_torneo`, `inscribir_jugador` y `desinscribir_jugador`.

begin;

-- 1. Tablas ---------------------------------------------------------------------

create table if not exists public.torneos (
	id bigint generated always as identity primary key,
	nombre text not null check (char_length(btrim(nombre)) between 1 and 80),
	fecha date not null,
	-- R25: la temporada va del 1 de septiembre al 31 de agosto. Es una columna
	-- "generada": la calcula Postgres a partir de la fecha y nadie puede escribirla.
	-- 15/03/2027 → '2026-2027'; 01/09/2027 → '2027-2028'.
	temporada text generated always as (
		case
			when extract(month from fecha) >= 9
				then extract(year from fecha)::int::text || '-' || (extract(year from fecha)::int + 1)::text
			else (extract(year from fecha)::int - 1)::text || '-' || extract(year from fecha)::int::text
		end
	) stored,
	creado_en timestamptz not null default now()
);

create index if not exists torneos_temporada on public.torneos (temporada);

create table if not exists public.inscripciones (
	-- Si se borra un torneo, se borran sus inscripciones.
	torneo bigint not null references public.torneos (id) on delete cascade,
	-- Sin `on delete cascade`, como en `partidos`: ver tarea 2.10.
	jugador uuid not null references public.jugadores (id),
	inscrito_en timestamptz not null default now(),
	-- La pareja (torneo, jugador) es única: nadie se inscribe dos veces (R17).
	primary key (torneo, jugador)
);

create index if not exists inscripciones_jugador on public.inscripciones (jugador);

-- 2. Permisos: los conectados leen; nadie escribe directamente ---------------------

revoke all on public.torneos from anon, authenticated;
revoke all on public.inscripciones from anon, authenticated;
grant select on public.torneos to authenticated;
grant select on public.inscripciones to authenticated;

alter table public.torneos enable row level security;
alter table public.inscripciones enable row level security;

drop policy if exists "conectados leen torneos" on public.torneos;
create policy "conectados leen torneos"
	on public.torneos
	for select
	to authenticated
	using (true);

drop policy if exists "conectados leen inscripciones" on public.inscripciones;
create policy "conectados leen inscripciones"
	on public.inscripciones
	for select
	to authenticated
	using (true);

-- 3. Funciones (solo el administrador) -----------------------------------------------
-- `security definer`: escriben como dueño de las tablas, que la app no puede tocar.
-- Por eso lo primero que hacen es comprobar `es_admin()` (ver 0002).

create or replace function public.crear_torneo(p_nombre text, p_fecha date)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
	nombre_limpio text := btrim(coalesce(p_nombre, ''));
	nuevo_id bigint;
begin
	if not public.es_admin() then
		raise exception 'Seul l’administrateur peut créer un tournoi.' using errcode = '42501';
	end if;
	if char_length(nombre_limpio) = 0 then
		raise exception 'Indique le nom du tournoi.' using errcode = '22023';
	end if;
	if char_length(nombre_limpio) > 80 then
		raise exception 'Le nom du tournoi est trop long (80 caractères au maximum).'
			using errcode = '22023';
	end if;
	if p_fecha is null then
		raise exception 'Indique la date du tournoi.' using errcode = '22023';
	end if;

	insert into public.torneos (nombre, fecha)
	values (nombre_limpio, p_fecha)
	returning id into nuevo_id;
	return nuevo_id;
end;
$$;

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

	delete from public.inscripciones where torneo = p_torneo and jugador = p_jugador;
	if not found then
		raise exception 'Ce joueur n’est pas inscrit à ce tournoi.' using errcode = '22023';
	end if;
end;
$$;

revoke all on function public.crear_torneo(text, date) from public, anon;
revoke all on function public.inscribir_jugador(bigint, uuid) from public, anon;
revoke all on function public.desinscribir_jugador(bigint, uuid) from public, anon;
grant execute on function public.crear_torneo(text, date) to authenticated;
grant execute on function public.inscribir_jugador(bigint, uuid) to authenticated;
grant execute on function public.desinscribir_jugador(bigint, uuid) to authenticated;

commit;
