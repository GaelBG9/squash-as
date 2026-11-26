<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { textoError } from '#lib/errores.ts';
</script>

<svelte:head>
	<title>{textoError(page.status)} · Squash AS</title>
</svelte:head>

<section class="bloque" aria-labelledby="titulo-error">
	<p class="etiqueta">Erreur {page.status}</p>
	<h1 id="titulo-error">{textoError(page.status)}</h1>
	<p><a href={resolve('/')}>Retour à l’accueil</a></p>
</section>

<style>
	.bloque {
		display: grid;
		gap: var(--espacio-3);
	}
</style>
