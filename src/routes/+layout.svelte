<script lang="ts">
	import '@fontsource/barlow/400.css';
	import '@fontsource/barlow/500.css';
	import '@fontsource/barlow/600.css';
	import '@fontsource/barlow-condensed/600.css';
	import '@fontsource/barlow-condensed/700.css';
	import '#lib/estilos/tema.css';
	import favicon from '#lib/assets/favicon.svg';
	import Cabecera from '#lib/componentes/Cabecera.svelte';
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const nombre = $derived(data.perfil.estado === 'conectado' ? data.perfil.jugador.nombre : null);
	const conectado = $derived(data.perfil.estado !== 'sin-sesion');
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Squash AS</title>
</svelte:head>

<Cabecera {nombre} {conectado} rutaActual={page.url.pathname} />

<main class="contenido">
	{#if data.errorConfig}
		<p class="aviso" role="alert">{data.errorConfig}</p>
	{/if}
	{@render children()}
</main>

<style>
	.contenido {
		display: grid;
		gap: var(--espacio-5);
		max-width: var(--ancho-contenido);
		margin: 0 auto;
		padding: var(--espacio-5) var(--espacio-4) var(--espacio-6);
	}
</style>
