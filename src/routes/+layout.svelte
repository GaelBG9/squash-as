<script lang="ts">
	import '@fontsource/barlow/400.css';
	import '@fontsource/barlow/500.css';
	import '@fontsource/barlow/600.css';
	import '@fontsource/barlow-condensed/600.css';
	import '@fontsource/barlow-condensed/700.css';
	import '#lib/estilos/tema.css';
	import favicon from '#lib/assets/favicon.svg';
	import BarraCarga from '#lib/componentes/BarraCarga.svelte';
	import Cabecera from '#lib/componentes/Cabecera.svelte';
	import { duracion } from '#lib/movimiento.ts';
	import { fade } from 'svelte/transition';
	import { resolve } from '$app/paths';
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

<BarraCarga />

<Cabecera {nombre} {conectado} rutaActual={page.url.pathname} />

<main class="contenido">
	{#if data.errorConfig}
		<p class="aviso" role="alert">{data.errorConfig}</p>
	{/if}
	<!-- `{#key}`: al cambiar de página, el contenido nuevo aparece con un fundido corto. -->
	{#key page.url.pathname}
		<div class="pagina" in:fade={{ duration: duracion(180) }}>
			{@render children()}
		</div>
	{/key}
</main>

<!-- Google exige que la página principal enlace a la política de privacidad. -->
<footer class="pie">
	<a href={resolve('/confidentialite')}>Politique de confidentialité</a>
</footer>

<style>
	.pie {
		display: flex;
		justify-content: center;
		padding: var(--espacio-4) var(--espacio-4) var(--espacio-6);
		font-size: var(--texto-pequeno);
		color: var(--color-texto-suave);
	}

	.pie a {
		display: inline-flex;
		align-items: center;
		min-height: var(--altura-toque);
	}

	.contenido,
	.pagina {
		display: grid;
		gap: var(--espacio-5);
	}

	.contenido {
		max-width: var(--ancho-contenido);
		margin: 0 auto;
		padding: var(--espacio-5) var(--espacio-4) var(--espacio-6);
	}
</style>
