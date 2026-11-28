<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Boton from '#lib/componentes/Boton.svelte';
	import Seleccion from '#lib/componentes/Seleccion.svelte';
	import {
		MIN_INSCRITOS,
		campeonDe,
		construirCuadro,
		juegosDesde,
		partidoDeCruce,
		type Cruce,
		type Lado
	} from '#lib/cuadro.ts';
	import { duracion } from '#lib/movimiento.ts';
	import { fechaCorta, textoMarcador } from '#lib/partidos.ts';
	import { MAX_INSCRITOS } from '#lib/torneos.ts';
	import { fly } from 'svelte/transition';
	import type { SubmitFunction } from './$types';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const torneo = $derived(data.torneo.ok ? data.torneo.datos : null);
	const completo = $derived((torneo?.inscritos.length ?? 0) >= MAX_INSCRITOS);

	const plazas = $derived(data.cuadro.ok ? data.cuadro.datos : []);
	// Con el cuadro generado, las inscripciones están cerradas (R17).
	const generado = $derived(plazas.length > 0);
	// Los cruces entre dos plazas vacías no tienen nada que enseñar (pocos inscritos).
	const rondas = $derived(
		generado
			? construirCuadro(plazas)
					.map((r) => ({ ...r, cruces: r.cruces.filter((c) => c.estado !== 'vacio') }))
					.filter((r) => r.cruces.length > 0)
			: []
	);
	const campeon = $derived(campeonDe(plazas));
	const partidos = $derived(data.partidos.ok ? data.partidos.datos : []);

	/**
	 * Qué enseñar en un cruce entre dos jugadores: su partido (confirmado o pendiente),
	 * el botón para registrarlo si juego yo, o "À jouer".
	 */
	function situacion(cruce: Cruce) {
		const { arriba, abajo } = cruce;
		if (arriba.tipo !== 'jugador' || abajo.tipo !== 'jugador') return null;
		const partido = partidoDeCruce(partidos, arriba.jugador.id, abajo.jugador.id);
		if (partido?.estado === 'confirmado' && partido.ganador) {
			const ganador = arriba.jugador.id === partido.ganador ? arriba.jugador : abajo.jugador;
			return {
				tipo: 'jugado' as const,
				ganador: ganador.id,
				texto: `${ganador.nombre} gagne ${textoMarcador(juegosDesde(partido, ganador.id))}`
			};
		}
		if (partido) return { tipo: 'pendiente' as const };
		const rival =
			arriba.jugador.id === data.yo
				? abajo.jugador.id
				: abajo.jugador.id === data.yo
					? arriba.jugador.id
					: null;
		return rival ? { tipo: 'registrar' as const, rival } : { tipo: 'por_jugar' as const };
	}

	const puedeGenerar = $derived((torneo?.inscritos.length ?? 0) >= MIN_INSCRITOS);

	// Qué se está enviando: "inscribir", o el id del jugador que se desinscribe.
	// Mientras tanto, los botones afectados se desactivan (evita el doble clic).
	let enviando = $state<string | null>(null);
	function trabajando(clave: string): SubmitFunction {
		return () => {
			enviando = clave;
			return async ({ update }) => {
				await update();
				enviando = null;
			};
		};
	}

	/** Como `trabajando`, pero antes pide confirmación (borrar el cuadro). */
	function conConfirmacion(clave: string, pregunta: string): SubmitFunction {
		const seguir = trabajando(clave);
		return (opciones) => {
			if (!confirm(pregunta)) {
				opciones.cancel();
				return;
			}
			return seguir(opciones);
		};
	}

	function textoLado(lado: Lado): string {
		if (lado.tipo === 'exento') return 'Exempt';
		if (lado.tipo === 'por_decidir') return 'À déterminer';
		return lado.jugador.nombre;
	}
</script>

<svelte:head>
	<title>{torneo?.nombre ?? 'Tournoi'} · Squash AS</title>
</svelte:head>

<a class="volver" href={resolve('/tournois')}>← Tous les tournois</a>

{#if !data.torneo.ok}
	<p class="aviso" role="alert">{data.torneo.error}</p>
{:else if torneo}
	<section class="bloque" aria-labelledby="titulo">
		<p class="etiqueta">Tournoi · saison {torneo.temporada}</p>
		<h1 id="titulo">{torneo.nombre}</h1>
		<p class="texto-suave">{fechaCorta(torneo.fecha)}</p>
	</section>

	{#if data.recienCreado}
		<p class="confirmacion" role="status" in:fly={{ y: -8, duration: duracion(200) }}>
			Tournoi créé. Tu peux maintenant inscrire les joueurs.
		</p>
	{/if}

	{#if data.recienRegistrado}
		<p class="confirmacion" role="status" in:fly={{ y: -8, duration: duracion(200) }}>
			Match enregistré. Ton adversaire doit maintenant le confirmer.
		</p>
	{/if}

	{#if form && 'error' in form}
		<p class="aviso" role="alert">{form.error}</p>
	{:else if form?.accion === 'generar'}
		<p class="confirmacion" role="status" in:fly={{ y: -8, duration: duracion(200) }}>
			Tableau généré. Les inscriptions sont fermées.
		</p>
	{/if}

	{#if data.esAdmin && data.inscribibles}
		<section class="bloque" aria-labelledby="titulo-inscribir">
			<h2 id="titulo-inscribir">Inscrire un joueur</h2>
			{#if !data.inscribibles.ok}
				<p class="aviso" role="alert">{data.inscribibles.error}</p>
			{:else if completo}
				<p class="texto-suave">Le tableau est complet ({MAX_INSCRITOS} joueurs).</p>
			{:else if data.inscribibles.datos.length === 0}
				<p class="texto-suave">Tous les joueurs sont déjà inscrits.</p>
			{:else}
				<form
					method="POST"
					action="?/inscrire"
					class="inscribir"
					use:enhance={trabajando('inscribir')}
				>
					<Seleccion
						id="jugador"
						name="jugador"
						etiqueta="Joueur"
						textoVacio="Choisis un joueur"
						required
						opciones={data.inscribibles.datos.map((j) => ({ valor: j.id, texto: j.nombre }))}
					/>
					<Boton type="submit" cargando={enviando === 'inscribir'} disabled={enviando !== null}>
						Inscrire
					</Boton>
				</form>
			{/if}
		</section>
	{/if}

	<section class="bloque" aria-labelledby="titulo-inscritos">
		<h2 id="titulo-inscritos">
			Inscrits <span class="contador">{torneo.inscritos.length} / {MAX_INSCRITOS}</span>
		</h2>
		{#if torneo.inscritos.length === 0}
			<p class="texto-suave">Personne n’est encore inscrit.</p>
		{:else}
			<ul class="lista">
				{#each torneo.inscritos as jugador (jugador.id)}
					<li class="tarjeta inscrito">
						<span class="nombre">{jugador.nombre}</span>
						{#if data.esAdmin && !generado}
							<form method="POST" action="?/desinscrire" use:enhance={trabajando(jugador.id)}>
								<input type="hidden" name="jugador" value={jugador.id} />
								<Boton
									type="submit"
									variante="secundario"
									cargando={enviando === jugador.id}
									disabled={enviando !== null}
									aria-label="Retirer {jugador.nombre}"
								>
									Retirer
								</Boton>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="bloque" aria-labelledby="titulo-cuadro">
		<h2 id="titulo-cuadro">Tableau principal</h2>
		{#if !data.cuadro.ok}
			<p class="aviso" role="alert">{data.cuadro.error}</p>
		{:else if !generado}
			<p class="texto-suave">Le tableau n’est pas encore généré.</p>
			{#if data.esAdmin}
				<p class="texto-suave">
					Les têtes de série suivent le classement Glicko-2 du jour ; les places vides sont des
					exemptés.
				</p>
				<form method="POST" action="?/generer" use:enhance={trabajando('generar')}>
					<Boton
						type="submit"
						cargando={enviando === 'generar'}
						disabled={enviando !== null || !puedeGenerar}
					>
						Générer le tableau
					</Boton>
				</form>
				{#if !puedeGenerar}
					<p class="texto-suave">Il faut au moins {MIN_INSCRITOS} inscrits.</p>
				{/if}
			{/if}
		{:else}
			{#if !data.partidos.ok}
				<p class="aviso" role="alert">{data.partidos.error}</p>
			{/if}
			{#if campeon}
				<p class="campeon">🏆 Vainqueur du tournoi : <strong>{campeon.nombre}</strong></p>
			{/if}
			{#each rondas as ronda (ronda.ronda)}
				<h3>{ronda.nombre}</h3>
				<ul class="lista">
					{#each ronda.cruces as cruce, i (i)}
						{@const s = situacion(cruce)}
						<li class="tarjeta cruce">
							{#each [cruce.arriba, cruce.abajo] as lado, j (j)}
								<p
									class="lado"
									class:texto-suave={lado.tipo !== 'jugador' ||
										(s?.tipo === 'jugado' && s.ganador !== lado.jugador.id)}
								>
									{#if lado.tipo === 'jugador' && lado.cabeza !== null}
										<span class="cabeza">[{lado.cabeza}]</span>
									{/if}
									<span class="nombre-lado">{textoLado(lado)}</span>
								</p>
							{/each}
							{#if s?.tipo === 'jugado'}
								<span class="etiqueta-cruce">{s.texto}</span>
							{:else if s?.tipo === 'pendiente'}
								<span class="etiqueta-cruce">En attente de confirmation</span>
							{:else if s?.tipo === 'registrar'}
								<a
									class="boton-enlace"
									href="{resolve('/matchs/nouveau')}?tournoi={torneo.id}&adversaire={s.rival}"
								>
									Enregistrer le résultat
								</a>
							{:else if cruce.estado === 'partido'}
								<span class="etiqueta-cruce">À jouer</span>
							{:else if cruce.estado === 'exento'}
								<span class="etiqueta-cruce">Qualifié d’office</span>
							{/if}
						</li>
					{/each}
				</ul>
			{/each}
			{#if data.esAdmin}
				<form
					method="POST"
					action="?/supprimer"
					use:enhance={conConfirmacion(
						'borrar',
						'Supprimer le tableau ? Les inscriptions seront rouvertes.'
					)}
				>
					<Boton
						type="submit"
						variante="secundario"
						cargando={enviando === 'borrar'}
						disabled={enviando !== null}
					>
						Supprimer le tableau
					</Boton>
				</form>
			{/if}
		{/if}
	</section>
{/if}

<style>
	.bloque {
		display: grid;
		gap: var(--espacio-2);
	}

	.texto-suave {
		color: var(--color-texto-suave);
	}

	.volver {
		justify-self: start;
		display: inline-flex;
		align-items: center;
		min-height: var(--altura-toque);
	}

	.confirmacion {
		padding: var(--espacio-3) var(--espacio-4);
		border-radius: var(--radio-campo);
		border-left: 4px solid var(--color-acento);
		background: var(--color-superficie);
	}

	.inscribir {
		display: grid;
		gap: var(--espacio-3);
	}

	.contador {
		font-variant-numeric: tabular-nums;
		color: var(--color-texto-suave);
		font-weight: 400;
	}

	.lista {
		display: grid;
		gap: var(--espacio-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.inscrito {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--espacio-3);
	}

	.nombre {
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	h3 {
		margin: var(--espacio-2) 0 0;
		font-size: 1rem;
	}

	.cruce {
		display: grid;
		gap: var(--espacio-1);
	}

	.lado {
		display: flex;
		gap: var(--espacio-2);
		margin: 0;
	}

	.cabeza {
		min-width: 2.5em;
		font-variant-numeric: tabular-nums;
		color: var(--color-texto-suave);
	}

	.nombre-lado {
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.texto-suave .nombre-lado {
		font-weight: 400;
	}

	.campeon {
		padding: var(--espacio-3) var(--espacio-4);
		border-radius: var(--radio-campo);
		border-left: 4px solid var(--color-acento);
		background: var(--color-superficie);
	}

	/* Enlace con aspecto de botón principal (ver Boton.svelte). */
	.boton-enlace {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: var(--altura-toque);
		margin-top: var(--espacio-2);
		padding: 0 var(--espacio-5);
		border-radius: var(--radio-boton);
		background: var(--color-acento);
		color: var(--color-acento-texto);
		font-weight: 600;
		text-decoration: none;
	}

	.etiqueta-cruce {
		justify-self: start;
		font-size: 0.85rem;
		color: var(--color-texto-suave);
	}
</style>
