<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Boton from '#lib/componentes/Boton.svelte';
	import Campo from '#lib/componentes/Campo.svelte';
	import { esFechaValida } from '#lib/marcador.ts';
	import { LARGO_MAXIMO_NOMBRE, temporadaDe } from '#lib/torneos.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const errores = $derived(form?.errores ?? {});

	// La fecha escrita, para enseñar a qué temporada pertenecerá el torneo (R25).
	// Empieza con lo que devolvió el servidor si hubo un error, o con hoy.
	// svelte-ignore state_referenced_locally
	let fecha = $state(form?.valores.fecha ?? data.hoy);
	const temporada = $derived(esFechaValida(fecha) ? temporadaDe(fecha) : null);

	let enviando = $state(false);
</script>

<svelte:head>
	<title>Créer un tournoi · Squash AS</title>
</svelte:head>

<section class="bloque" aria-labelledby="titulo">
	<p class="etiqueta">Tournois</p>
	<h1 id="titulo">Créer un tournoi</h1>
	<p class="texto-suave">Tu pourras ensuite inscrire jusqu’à 16 joueurs.</p>
</section>

<form
	method="POST"
	class="formulario"
	use:enhance={() => {
		enviando = true;
		return async ({ update }) => {
			await update({ reset: false });
			enviando = false;
		};
	}}
>
	{#if errores.general}
		<p class="aviso" role="alert">{errores.general}</p>
	{/if}

	<Campo
		id="nombre"
		name="nombre"
		etiqueta="Nom du tournoi"
		placeholder="Open de printemps"
		required
		maxlength={LARGO_MAXIMO_NOMBRE}
		value={form?.valores.nombre ?? ''}
		error={errores.nombre}
	/>

	<Campo
		id="fecha"
		name="fecha"
		type="date"
		etiqueta="Date du tournoi"
		required
		bind:value={fecha}
		error={errores.fecha}
		ayuda={temporada ? `Saison ${temporada}` : null}
	/>

	<Boton type="submit" cargando={enviando}>
		{enviando ? 'Création…' : 'Créer le tournoi'}
	</Boton>
	<a class="volver" href={resolve('/tournois')}>Annuler</a>
</form>

<style>
	.bloque,
	.formulario {
		display: grid;
		gap: var(--espacio-4);
	}

	.texto-suave {
		color: var(--color-texto-suave);
	}

	.volver {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: var(--altura-toque);
	}
</style>
