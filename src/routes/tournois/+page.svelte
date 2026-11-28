<script lang="ts">
	import { resolve } from '$app/paths';
	import { fechaCorta } from '#lib/partidos.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Tournois · Squash AS</title>
</svelte:head>

<section class="bloque" aria-labelledby="titulo">
	<p class="etiqueta">Tournois</p>
	<h1 id="titulo">Tournois</h1>
	<p class="texto-suave">Les tournois du club et leurs inscrits (16 joueurs au maximum).</p>
</section>

{#if data.esAdmin}
	<a class="boton-enlace" href={resolve('/tournois/nouveau')}>Créer un tournoi</a>
{/if}

{#if !data.torneos.ok}
	<p class="aviso" role="alert">{data.torneos.error}</p>
{:else if data.torneos.datos.length === 0}
	<p class="texto-suave">Aucun tournoi pour l’instant.</p>
{:else}
	<ul class="lista">
		{#each data.torneos.datos as torneo (torneo.id)}
			<li>
				<a class="tarjeta torneo" href={resolve('/tournois/[id]', { id: String(torneo.id) })}>
					<span class="nombre">{torneo.nombre}</span>
					<span class="detalle">{fechaCorta(torneo.fecha)} · saison {torneo.temporada}</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.bloque {
		display: grid;
		gap: var(--espacio-2);
	}

	.texto-suave,
	.detalle {
		color: var(--color-texto-suave);
	}

	/* Enlace con aspecto de botón principal (ver Boton.svelte). */
	.boton-enlace {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: var(--altura-toque);
		padding: 0 var(--espacio-5);
		border-radius: var(--radio-boton);
		background: var(--color-acento);
		color: var(--color-acento-texto);
		font-size: 1.05rem;
		font-weight: 600;
		text-decoration: none;
	}

	.lista {
		display: grid;
		gap: var(--espacio-3);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.torneo {
		display: grid;
		gap: var(--espacio-1);
		color: inherit;
		text-decoration: none;
	}

	.nombre {
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.detalle {
		font-size: var(--texto-pequeno);
	}
</style>
