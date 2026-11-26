<script lang="ts">
	import { resolve } from '$app/paths';
	import { iniciales } from '#lib/navegacion.ts';
	import Menu from './Menu.svelte';

	type Props = {
		/** Nombre del jugador conectado, o `null` si no hay sesión o perfil. */
		nombre: string | null;
		conectado: boolean;
		rutaActual: string;
	};

	let { nombre, conectado, rutaActual }: Props = $props();
	let menuAbierto = $state(false);

	// Al cambiar de página, el menú se cierra solo.
	$effect(() => {
		void rutaActual;
		menuAbierto = false;
	});
</script>

<header class="cabecera">
	<div class="barra">
		<a class="marca" href={resolve('/')}>
			<span class="pelota" aria-hidden="true"><span></span><span></span></span>
			Squash AS
		</a>
		<div class="sesion">
			{#if nombre}
				<span class="avatar" title={nombre}>
					<span aria-hidden="true">{iniciales(nombre)}</span>
					<span class="solo-lector">Conectado como {nombre}</span>
				</span>
			{/if}
			<button
				class="boton-menu"
				type="button"
				aria-expanded={menuAbierto}
				aria-controls="menu-principal"
				onclick={() => (menuAbierto = !menuAbierto)}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true">
					{#if menuAbierto}
						<path d="M6 6l12 12M18 6L6 18" />
					{:else}
						<path d="M4 7h16M4 12h16M4 17h16" />
					{/if}
				</svg>
				<span class="solo-lector">{menuAbierto ? 'Cerrar el menú' : 'Abrir el menú'}</span>
			</button>
		</div>
	</div>
	{#if menuAbierto}
		<Menu id="menu-principal" {rutaActual} {conectado} />
	{/if}
</header>

<style>
	.barra {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--espacio-3);
		min-height: 60px;
		padding: var(--espacio-2) var(--espacio-4);
		background: var(--color-acento);
		color: var(--color-acento-texto);
	}

	.marca {
		display: flex;
		align-items: center;
		gap: var(--espacio-2);
		min-height: var(--altura-toque);
		font-family: var(--fuente-titulo);
		font-size: 1.45rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		text-decoration: none;
	}

	/* Pelota de competición: negra con dos puntos amarillos. */
	.pelota {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 3px;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: var(--color-pelota);
	}

	.pelota span {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--color-punto);
	}

	.sesion {
		display: flex;
		align-items: center;
		gap: var(--espacio-2);
	}

	.avatar {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--color-punto);
		color: var(--color-punto-texto);
		font-size: 0.85rem;
		font-weight: 700;
	}

	.boton-menu {
		display: grid;
		place-items: center;
		width: var(--altura-toque);
		height: var(--altura-toque);
		border: 0;
		border-radius: var(--radio-campo);
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.boton-menu svg {
		width: 24px;
		height: 24px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
	}
</style>
