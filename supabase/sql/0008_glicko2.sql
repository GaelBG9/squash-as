-- Tarea 1.3: cálculo Glicko-2 al confirmar un partido (reglas R1 y R3).
-- Ejecutar una vez en el SQL Editor, después de 0007_responder_partido.sql.
--
-- Glicko-2 (Mark Glickman, "Example of the Glicko-2 system", 2022) estima el nivel
-- de cada jugador con tres números: rating (nivel), RD (incertidumbre) y volatilidad.
-- Aquí cada partido confirmado cuenta como un "periodo" del algoritmo: los dos
-- jugadores se actualizan en cuanto el rival confirma. Además, quien pasa semanas sin
-- jugar ve crecer su RD antes del partido siguiente (Glickman, paso 6 sin partidos).
--
-- La app no puede escribir los ratings (trigger `proteger_campos_jugador`): el cálculo
-- se hace en funciones `security definer`, que se ejecutan como dueño de las tablas.

begin;

-- 1. Historial de rating ----------------------------------------------------------------
-- Una fila por jugador y partido con los valores DESPUÉS de ese partido. Sirve para la
-- gráfica de evolución y para saber qué partido movió cada rating. La restricción
-- `unique` impide contar dos veces el mismo partido.

create table if not exists public.historial_rating (
	id bigint generated always as identity primary key,
	jugador uuid not null references public.jugadores (id),
	partido bigint not null references public.partidos (id),
	-- Fecha en la que se jugó el partido (no la de la confirmación).
	fecha date not null,
	rating double precision not null,
	rd double precision not null,
	volatilidad double precision not null,
	constraint un_calculo_por_partido unique (jugador, partido)
);

create index if not exists historial_rating_partido on public.historial_rating (partido);

-- Como `partidos`: los conectados leen; nadie escribe desde la app.
revoke all on public.historial_rating from anon, authenticated;
grant select on public.historial_rating to authenticated;

alter table public.historial_rating enable row level security;

drop policy if exists "conectados leen historial" on public.historial_rating;
create policy "conectados leen historial"
	on public.historial_rating
	for select
	to authenticated
	using (true);

-- 2. El algoritmo Glicko-2 ------------------------------------------------------------
-- Función pura: no lee ni escribe tablas. Recibe el estado de un jugador y la lista de
-- sus partidos del periodo, `p_rivales` = [{"rating": 1400, "rd": 30, "resultado": 1}, ...]
-- con resultado 1 (victoria), 0 (derrota) o 0.5 (empate). Devuelve el nuevo estado.
-- Los números de los pasos son los del artículo de Glickman.

create or replace function public.glicko2(
	p_rating double precision,
	p_rd double precision,
	p_volatilidad double precision,
	p_rivales jsonb,
	out rating double precision,
	out rd double precision,
	out volatilidad double precision
)
language plpgsql
immutable
set search_path = ''
as $$
declare
	-- Factor entre la escala Glicko (1500, 350) y la escala interna de Glicko-2 (0, 2).
	escala constant double precision := 173.7178;
	-- τ (tau): cuánto puede cambiar la volatilidad. Glickman propone entre 0,3 y 1,2.
	tau constant double precision := 0.5;
	-- Precisión del paso 5 (convergencia).
	epsilon constant double precision := 0.000001;
	mu double precision;
	phi double precision;
	rival jsonb;
	mu_j double precision;
	phi_j double precision;
	g double precision;
	esperado double precision;
	resultado double precision;
	inversa_v double precision := 0;
	suma double precision := 0;
	v double precision;
	delta double precision;
	a double precision;
	x_a double precision;
	x_b double precision;
	x_c double precision;
	f_a double precision;
	f_b double precision;
	f_c double precision;
	k integer;
	nueva_volatilidad double precision;
	phi_previo double precision;
	nuevo_phi double precision;
begin
	-- Paso 2: pasar a la escala de Glicko-2.
	mu := (p_rating - 1500) / escala;
	phi := p_rd / escala;

	-- Sin partidos en el periodo: solo crece la incertidumbre (sin pasar de 350).
	if p_rivales is null or jsonb_array_length(p_rivales) = 0 then
		rating := p_rating;
		rd := least(350, escala * sqrt(phi ^ 2 + p_volatilidad ^ 2));
		volatilidad := p_volatilidad;
		return;
	end if;

	-- Pasos 3 y 4: varianza estimada (v) y mejora estimada (delta).
	for rival in select value from jsonb_array_elements(p_rivales) loop
		mu_j := ((rival ->> 'rating')::double precision - 1500) / escala;
		phi_j := (rival ->> 'rd')::double precision / escala;
		resultado := (rival ->> 'resultado')::double precision;
		if resultado is null or resultado not in (0, 0.5, 1) then
			raise exception 'Glicko-2: resultado % no válido (0, 0.5 o 1).', rival ->> 'resultado'
				using errcode = '22023';
		end if;
		g := 1 / sqrt(1 + 3 * phi_j ^ 2 / pi() ^ 2);
		esperado := 1 / (1 + exp(-g * (mu - mu_j)));
		inversa_v := inversa_v + g ^ 2 * esperado * (1 - esperado);
		suma := suma + g * (resultado - esperado);
	end loop;
	v := 1 / inversa_v;
	delta := v * suma;

	-- Paso 5: nueva volatilidad, buscando el cero de f con el método de Illinois.
	a := ln(p_volatilidad ^ 2);
	x_a := a;
	if delta ^ 2 > phi ^ 2 + v then
		x_b := ln(delta ^ 2 - phi ^ 2 - v);
	else
		k := 1;
		while public.glicko2_f(a - k * tau, delta, phi, v, a, tau) < 0 loop
			k := k + 1;
		end loop;
		x_b := a - k * tau;
	end if;
	f_a := public.glicko2_f(x_a, delta, phi, v, a, tau);
	f_b := public.glicko2_f(x_b, delta, phi, v, a, tau);
	while abs(x_b - x_a) > epsilon loop
		x_c := x_a + (x_a - x_b) * f_a / (f_b - f_a);
		f_c := public.glicko2_f(x_c, delta, phi, v, a, tau);
		if f_c * f_b <= 0 then
			x_a := x_b;
			f_a := f_b;
		else
			f_a := f_a / 2;
		end if;
		x_b := x_c;
		f_b := f_c;
	end loop;
	nueva_volatilidad := exp(x_a / 2);

	-- Pasos 6 y 7: nueva incertidumbre y nuevo nivel.
	phi_previo := sqrt(phi ^ 2 + nueva_volatilidad ^ 2);
	nuevo_phi := 1 / sqrt(1 / phi_previo ^ 2 + 1 / v);
	mu := mu + nuevo_phi ^ 2 * suma;

	-- Paso 8: volver a la escala Glicko.
	rating := escala * mu + 1500;
	rd := escala * nuevo_phi;
	volatilidad := nueva_volatilidad;
end;
$$;

-- La función f del paso 5 (aparte para no repetir la fórmula cuatro veces).
create or replace function public.glicko2_f(
	x double precision,
	delta double precision,
	phi double precision,
	v double precision,
	a double precision,
	tau double precision
)
returns double precision
language sql
immutable
set search_path = ''
as $$
	select exp(x) * (delta ^ 2 - phi ^ 2 - v - exp(x)) / (2 * (phi ^ 2 + v + exp(x)) ^ 2)
		- (x - a) / tau ^ 2;
$$;

-- 3. Incertidumbre que crece sin jugar -------------------------------------------------
-- Glickman: en un periodo sin partidos, phi pasa a sqrt(phi² + volatilidad²). Aquí un
-- periodo es una semana (hay clase cada jueves). El partido en sí ya cuenta como un
-- periodo, así que solo se añaden las semanas vacías ANTERIORES: 7 días desde el último
-- partido = 0 semanas vacías; 21 días = 2. Se admiten fracciones de semana.
-- Sin partido anterior (`p_ultima_fecha` vacía) no cambia nada: un jugador nuevo ya
-- tiene el RD máximo, 350, que nunca se supera.

create or replace function public.rd_tras_inactividad(
	p_rd double precision,
	p_volatilidad double precision,
	p_ultima_fecha date,
	p_fecha date
)
returns double precision
language sql
immutable
set search_path = ''
as $$
	select case
		when p_ultima_fecha is null then p_rd
		else least(
			350,
			173.7178 * sqrt(
				(p_rd / 173.7178) ^ 2
				+ greatest(0, (p_fecha - p_ultima_fecha) / 7.0 - 1) * p_volatilidad ^ 2
			)
		)
	end;
$$;

-- 4. Aplicar Glicko-2 a un partido confirmado ------------------------------------------
-- Interna: la app NO puede llamarla. La usan `responder_partido` (abajo) y, en la tarea
-- 1.4, la validación automática a los 15 días.
-- Los dos jugadores se actualizan a la vez: cada uno se calcula con los valores que
-- tenía el otro ANTES del partido. `for update` bloquea sus dos filas hasta el final
-- de la transacción, para que dos confirmaciones simultáneas no se pisen.

create or replace function public.aplicar_glicko2(p_partido bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_partido public.partidos;
	a public.jugadores;
	b public.jugadores;
	rd_a double precision;
	rd_b double precision;
	resultado_a double precision;
	nuevo_a record;
	nuevo_b record;
begin
	select * into v_partido from public.partidos where id = p_partido;
	if not found or v_partido.estado <> 'confirmado' then
		raise exception 'Glicko-2: el partido % no existe o no está confirmado.', p_partido
			using errcode = '22023';
	end if;
	if exists (select 1 from public.historial_rating where partido = p_partido) then
		raise exception 'Glicko-2: el partido % ya se ha contado.', p_partido using errcode = '22023';
	end if;

	-- Bloquear en orden de id: dos transacciones nunca se esperan la una a la otra.
	perform 1 from public.jugadores
	where id in (v_partido.jugador_a, v_partido.jugador_b)
	order by id
	for update;
	select * into a from public.jugadores where id = v_partido.jugador_a;
	select * into b from public.jugadores where id = v_partido.jugador_b;

	-- Incertidumbre de cada uno el día del partido, tras sus semanas sin jugar.
	rd_a := public.rd_tras_inactividad(a.rd, a.volatilidad,
		(select max(fecha) from public.historial_rating where jugador = a.id), v_partido.fecha);
	rd_b := public.rd_tras_inactividad(b.rd, b.volatilidad,
		(select max(fecha) from public.historial_rating where jugador = b.id), v_partido.fecha);

	-- Empate (formato libre 1-1, R12): medio punto para cada uno.
	resultado_a := case
		when v_partido.ganador is null then 0.5
		when v_partido.ganador = a.id then 1
		else 0
	end;

	select * into nuevo_a from public.glicko2(a.rating, rd_a, a.volatilidad,
		jsonb_build_array(jsonb_build_object('rating', b.rating, 'rd', rd_b, 'resultado', resultado_a)));
	select * into nuevo_b from public.glicko2(b.rating, rd_b, b.volatilidad,
		jsonb_build_array(jsonb_build_object('rating', a.rating, 'rd', rd_a, 'resultado', 1 - resultado_a)));

	update public.jugadores
	set rating = nuevo_a.rating, rd = nuevo_a.rd, volatilidad = nuevo_a.volatilidad
	where id = a.id;
	update public.jugadores
	set rating = nuevo_b.rating, rd = nuevo_b.rd, volatilidad = nuevo_b.volatilidad
	where id = b.id;

	insert into public.historial_rating (jugador, partido, fecha, rating, rd, volatilidad)
	values
		(a.id, p_partido, v_partido.fecha, nuevo_a.rating, nuevo_a.rd, nuevo_a.volatilidad),
		(b.id, p_partido, v_partido.fecha, nuevo_b.rating, nuevo_b.rd, nuevo_b.volatilidad);
end;
$$;

-- Las funciones de cálculo no se exponen a la API: solo las usa la base de datos.
revoke all on function public.glicko2(double precision, double precision, double precision, jsonb)
	from public, anon, authenticated;
revoke all on function public.glicko2_f(double precision, double precision, double precision,
	double precision, double precision, double precision) from public, anon, authenticated;
revoke all on function public.rd_tras_inactividad(double precision, double precision, date, date)
	from public, anon, authenticated;
revoke all on function public.aplicar_glicko2(bigint) from public, anon, authenticated;

-- 5. Confirmar = actualizar los ratings -------------------------------------------------
-- La misma función que en 0007, con una línea más: al confirmar se aplica Glicko-2 en
-- la misma transacción (si el cálculo falla, el partido tampoco se confirma).

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

	-- Un partido solo cuenta cuando está confirmado (R1).
	if p_respuesta = 'confirmado' then
		perform public.aplicar_glicko2(p_partido);
	end if;
end;
$$;

revoke all on function public.responder_partido(bigint, text) from public, anon;
grant execute on function public.responder_partido(bigint, text) to authenticated;

-- 6. Partidos confirmados antes de esta tarea ---------------------------------------------
-- Se cuentan una vez, en el orden en que se confirmaron.

do $$
declare
	v_id bigint;
begin
	for v_id in
		select p.id from public.partidos p
		where p.estado = 'confirmado'
			and not exists (select 1 from public.historial_rating h where h.partido = p.id)
		order by p.respondido_en, p.id
	loop
		perform public.aplicar_glicko2(v_id);
	end loop;
end;
$$;

commit;
