<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Boton from '#lib/componentes/Boton.svelte';
	import Seleccion from '#lib/componentes/Seleccion.svelte';
	import { duracion } from '#lib/movimiento.ts';
	import { fechaCorta } from '#lib/partidos.ts';
	import { MAX_INSCRITOS } from '#lib/torneos.ts';
	import { fly } from 'svelte/transition';
	import type { SubmitFunction } from './$types';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const torneo = $derived(data.torneo.ok ? data.torneo.datos : null);
	const completo = $derived((torneo?.inscritos.length ?? 0) >= MAX_INSCRITOS);

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

	{#if form && 'error' in form}
		<p class="aviso" role="alert">{form.error}</p>
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
						{#if data.esAdmin}
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
</style>
