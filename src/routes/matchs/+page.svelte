<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		fechaCorta,
		textoEstado,
		textoFormato,
		textoMarcador,
		textoResultado
	} from '#lib/partidos.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Mes matchs · Squash AS</title>
</svelte:head>

<section class="bloque" aria-labelledby="titulo">
	<p class="etiqueta">Matchs</p>
	<h1 id="titulo">Mes matchs</h1>
</section>

{#if data.recienRegistrado}
	<p class="confirmacion" role="status">
		Match enregistré. Il attend la confirmation de ton adversaire.
	</p>
{/if}

<a class="boton-enlace" href={resolve('/matchs/nouveau')}>Enregistrer un match</a>

{#if !data.partidos.ok}
	<p class="aviso" role="alert">{data.partidos.error}</p>
{:else if data.partidos.datos.length === 0}
	<p class="texto-suave">Tu n’as encore aucun match enregistré.</p>
{:else}
	<ul class="lista">
		{#each data.partidos.datos as partido (partido.id)}
			<li class="tarjeta partido">
				<div class="linea">
					<span class="rival">contre {partido.rival}</span>
					<span class={['estado', partido.estado]}>{textoEstado(partido.estado)}</span>
				</div>
				<p class="marcador">
					<span class={['resultado', partido.resultado]}>{textoResultado(partido.resultado)}</span>
					{textoMarcador(partido.juegos)}
				</p>
				<p class="detalle">
					{fechaCorta(partido.fecha)} · {textoFormato(partido.formato)}
					{#if !partido.registradoPorMi}· enregistré par {partido.rival}{/if}
				</p>
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

	.confirmacion {
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

	.partido {
		display: grid;
		gap: var(--espacio-2);
	}

	.linea {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: var(--espacio-2);
	}

	.rival {
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.estado {
		padding: var(--espacio-1) var(--espacio-3);
		border-radius: var(--radio-boton);
		font-size: var(--texto-pequeno);
		font-weight: 600;
		background: var(--color-acento-suave);
	}

	.estado.pendiente {
		background: var(--color-punto);
		color: var(--color-punto-texto);
	}

	.marcador {
		font-size: 1.15rem;
		font-variant-numeric: tabular-nums;
	}

	.resultado {
		font-weight: 700;
		margin-right: var(--espacio-2);
	}

	.resultado.victoria {
		color: var(--color-acento);
	}

	.detalle {
		font-size: var(--texto-pequeno);
	}
</style>
