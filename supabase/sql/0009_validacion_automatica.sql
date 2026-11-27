-- Tarea 1.4: validación automática a los 15 días, sin aviso (regla R8).
-- Ejecutar una vez en el SQL Editor, después de 0008_glicko2.sql.
--
-- Si el rival no confirma ni rechaza un partido en 15 días desde su registro, el
-- partido pasa solo a "confirmado" y se actualizan los ratings, como si el rival lo
-- hubiera confirmado. No se avisa a nadie.
--
-- La base de datos no hace nada si nadie se lo pide: la extensión pg_cron (incluida en
-- Supabase) hace de "despertador" y llama a `validar_partidos_vencidos` cada hora.

begin;

-- 1. Distinguir una validación automática de una confirmación del rival ---------------
-- `respondido_en` se rellena igual (lo exige `respondido_si_no_pendiente`): guarda el
-- momento de la validación. Esta columna dice quién "respondió".

alter table public.partidos
	add column if not exists validado_automaticamente boolean not null default false;

alter table public.partidos drop constraint if exists automatico_solo_si_confirmado;
alter table public.partidos add constraint automatico_solo_si_confirmado
	check (not validado_automaticamente or estado = 'confirmado');

-- Índice: el despertador busca cada hora los partidos pendientes más antiguos.
create index if not exists partidos_pendientes on public.partidos (registrado_en)
	where estado = 'pendiente';

-- 2. Validar los partidos vencidos ------------------------------------------------------
-- Interna: la app NO puede llamarla. `p_ahora` permite probarla con una fecha
-- ("el 16 de marzo") sin esperar 15 días; pg_cron la llama sin argumentos (ahora).
-- Devuelve cuántos partidos ha validado.
-- Del más antiguo al más reciente: los ratings se calculan en el orden de registro.
-- `for update skip locked`: si el rival está respondiendo a ese partido justo en ese
-- momento, el despertador lo salta; si el rival confirma o rechaza, gana su respuesta,
-- y si no, el partido se validará en la siguiente pasada.

create or replace function public.validar_partidos_vencidos(p_ahora timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_id bigint;
	validados integer := 0;
begin
	for v_id in
		select id from public.partidos
		where estado = 'pendiente' and registrado_en <= p_ahora - interval '15 days'
		order by registrado_en, id
		for update skip locked
	loop
		update public.partidos
		set estado = 'confirmado', respondido_en = p_ahora, validado_automaticamente = true
		where id = v_id;
		-- Igual que al confirmar (R1): en la misma transacción que el cambio de estado.
		perform public.aplicar_glicko2(v_id);
		validados := validados + 1;
	end loop;
	return validados;
end;
$$;

revoke all on function public.validar_partidos_vencidos(timestamptz)
	from public, anon, authenticated;

-- 3. El despertador: cada hora, en el minuto 0 -----------------------------------------
-- Formato cron: minuto hora día mes día-de-la-semana. '0 * * * *' = a las en punto.
-- Un partido registrado el 1 de marzo a las 10:20 se valida el 16 de marzo a las 11:00.
-- `cron.schedule` con un nombre reemplaza la tarea si ya existe: este script se puede
-- volver a ejecutar sin duplicarla. El historial de ejecuciones está en
-- `cron.job_run_details`.

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
	'validar-partidos-vencidos',
	'0 * * * *',
	'select public.validar_partidos_vencidos()'
);

-- 4. Partidos que ya llevan más de 15 días pendientes -----------------------------------
select public.validar_partidos_vencidos();

commit;
