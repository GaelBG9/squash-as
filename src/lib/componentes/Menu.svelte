<script lang="ts">
	import { resolve } from '$app/paths';
	import { MENU, esRutaActual } from '#lib/navegacion.ts';
	import Boton from './Boton.svelte';

	type Props = {
		id: string;
		rutaActual: string;
		/** Si hay sesión, el menú incluye "Desconectarse". */
		conectado: boolean;
	};

	let { id, rutaActual, conectado }: Props = $props();
</script>

<nav {id} class="menu" aria-label="Menú principal">
	<ul>
		{#each MENU as entrada (entrada.ruta)}
			<li>
				<a
					href={resolve(entrada.ruta)}
					aria-current={esRutaActual(entrada.ruta, rutaActual) ? 'page' : undefined}
				>
					{entrada.texto}
				</a>
			</li>
		{/each}
	</ul>
	{#if conectado}
		<form method="POST" action="/auth/logout">
			<Boton type="submit" variante="secundario">Desconectarse</Boton>
		</form>
	{/if}
</nav>

<style>
	.menu {
		display: grid;
		gap: var(--espacio-3);
		padding: var(--espacio-2) var(--espacio-4) var(--espacio-4);
		background: var(--color-superficie);
		border-bottom: 1px solid var(--color-borde);
	}

	ul {
		display: grid;
		gap: var(--espacio-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	a {
		display: flex;
		align-items: center;
		min-height: var(--altura-toque);
		padding: 0 var(--espacio-3);
		border-radius: var(--radio-campo);
		text-decoration: none;
		font-weight: 500;
	}

	a[aria-current='page'] {
		background: var(--color-acento-suave);
		font-weight: 600;
	}
</style>
