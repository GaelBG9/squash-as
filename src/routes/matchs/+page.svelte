<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Boton from '#lib/componentes/Boton.svelte';
	import {
		diaEnFrancia,
		fechaCorta,
		textoEstado,
		textoFormato,
		textoMarcador,
		textoResultado,
		type MiPartido
	} from '#lib/partidos.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Los partidos que esperan mi respuesta van arriba, aparte, para que no se pierdan.
	const porResponder = $derived(
		data.partidos.ok ? data.partidos.datos.filter((p) => p.puedoResponder) : []
	);
	const resto = $derived(
		data.partidos.ok ? data.partidos.datos.filter((p) => !p.puedoResponder) : []
	);

	// Mientras se envía una respuesta, sus botones se desactivan (evita el doble clic).
	let enviando = $state<number | null>(null);
</script>

{#snippet tarjeta(partido: MiPartido)}
	<li class="tarjeta partido">
		<div class="linea">
			<span class="rival">contre {partido.rival}</span>
			<span class={['estado', partido.estado]}>
				{textoEstado(partido.estado, partido.validadoAutomaticamente)}
			</span>
		</div>
		<p class="marcador">
			<span class={['resultado', partido.resultado]}>{textoResultado(partido.resultado)}</span>
			{textoMarcador(partido.juegos)}
		</p>
		<p class="detalle">
			{fechaCorta(partido.fecha)} · {textoFormato(partido.formato)}
			{#if !partido.registradoPorMi}· enregistré par {partido.rival}{/if}
		</p>
		{#if partido.validacionAutomaticaEl}
			<!-- R8: sin respuesta en 15 días, el partido se confirma solo. -->
			<p class="detalle">
				{partido.puedoResponder ? 'Sans réponse de ta part' : 'Sans réponse de ton adversaire'}, il
				sera confirmé automatiquement le {diaEnFrancia(partido.validacionAutomaticaEl)}.
			</p>
		{/if}
		{#if partido.puedoResponder}
			{#if form && 'error' in form && form.partido === partido.id}
				<p class="aviso" role="alert">{form.error}</p>
			{/if}
			<form
				method="POST"
				action="?/repondre"
				class="respuesta"
				use:enhance={() => {
					enviando = partido.id;
					return async ({ update }) => {
						await update();
						enviando = null;
					};
				}}
			>
				<input type="hidden" name="partido" value={partido.id} />
				<Boton type="submit" name="respuesta" value="confirmado" disabled={enviando === partido.id}>
					Confirmer
				</Boton>
				<Boton
					type="submit"
					name="respuesta"
					value="rechazado"
					variante="secundario"
					disabled={enviando === partido.id}
				>
					Refuser
				</Boton>
			</form>
		{/if}
	</li>
{/snippet}

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

{#if form && 'respondido' in form}
	<p class="confirmacion" role="status">
		{form.respondido === 'confirmado'
			? 'Match confirmé.'
			: 'Match refusé. Il ne compte pas dans les classements.'}
	</p>
{:else if form && 'error' in form && form.partido === null}
	<p class="aviso" role="alert">{form.error}</p>
{/if}

{#if !data.partidos.ok}
	<p class="aviso" role="alert">{data.partidos.error}</p>
{:else if data.partidos.datos.length === 0}
	<p class="texto-suave">Tu n’as encore aucun match enregistré.</p>
{:else}
	{#if porResponder.length > 0}
		<section class="bloque" aria-labelledby="titulo-responder">
			<h2 id="titulo-responder">À confirmer ({porResponder.length})</h2>
			<p class="texto-suave">
				Vérifie le score : si tu confirmes, le match compte pour le classement.
			</p>
			<ul class="lista">
				{#each porResponder as partido (partido.id)}
					{@render tarjeta(partido)}
				{/each}
			</ul>
		</section>
	{/if}
	{#if resto.length > 0}
		{#if porResponder.length > 0}<h2>Mes autres matchs</h2>{/if}
		<ul class="lista">
			{#each resto as partido (partido.id)}
				{@render tarjeta(partido)}
			{/each}
		</ul>
	{/if}
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

	/* Dos botones lado a lado; en pantallas muy estrechas, uno debajo del otro. */
	.respuesta {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
		gap: var(--espacio-2);
	}
</style>
