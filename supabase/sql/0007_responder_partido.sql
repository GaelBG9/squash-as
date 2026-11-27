-- Tarea 1.2: confirmar o rechazar un partido (reglas R1, R2 y R13).
-- Ejecutar una vez en el SQL Editor, después de 0006_partidos.sql.
--
-- Igual que para registrar, la app no puede escribir en `partidos`: la única forma
-- de responder es la función `responder_partido`, que comprueba que quien llama es
-- el rival (no quien registró) y que el partido sigue "pendiente".
-- Confirmar todavía NO cambia los ratings: el cálculo Glicko-2 llega con la tarea 1.3.

begin;

-- 1. Cuándo se respondió -----------------------------------------------------------
-- Vacío mientras el partido está pendiente. Sirve para revisar casos dudosos y,
-- en la tarea 1.4, para distinguir una respuesta del rival de una validación automática.

alter table public.partidos add column if not exists respondido_en timestamptz;

alter table public.partidos drop constraint if exists respondido_si_no_pendiente;
alter table public.partidos add constraint respondido_si_no_pendiente
	check ((estado = 'pendiente') = (respondido_en is null));

-- 2. Función para responder ---------------------------------------------------------
-- `p_respuesta`: 'confirmado' o 'rechazado'.
-- El `update ... where estado = 'pendiente'` es atómico: si llegan dos respuestas a
-- la vez (doble clic, dos móviles), solo la primera cambia la fila; la segunda no
-- encuentra un partido pendiente y da error.

create or replace function public.responder_partido(p_partido bigint, p_respuesta text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	yo uuid := auth.uid();
	v_partido public.partidos;
begin
	if yo is null then
		raise exception 'Tu dois être connecté pour répondre à un match.' using errcode = '42501';
	end if;

	if p_respuesta is null or p_respuesta not in ('confirmado', 'rechazado') then
		raise exception 'Réponse inconnue.' using errcode = '22023';
	end if;

	select * into v_partido from public.partidos where id = p_partido;
	if not found then
		raise exception 'Ce match n’existe pas.' using errcode = '22023';
	end if;

	-- Solo el rival: quien registró no puede confirmar su propio partido (R2), y
	-- nadie de fuera puede responder por otros.
	if yo <> v_partido.jugador_b or yo = v_partido.registrado_por then
		raise exception 'Seul ton adversaire peut confirmer ou refuser ce match.'
			using errcode = '42501';
	end if;

	update public.partidos
	set estado = p_respuesta, respondido_en = now()
	where id = p_partido and estado = 'pendiente';

	if not found then
		raise exception 'Ce match a déjà reçu une réponse.' using errcode = '22023';
	end if;
end;
$$;

revoke all on function public.responder_partido(bigint, text) from public, anon;
grant execute on function public.responder_partido(bigint, text) to authenticated;

commit;
