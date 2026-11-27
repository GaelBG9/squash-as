<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Props = HTMLButtonAttributes & {
		/** `principal`: la acción más importante de la pantalla; `secundario`: el resto. */
		variante?: 'principal' | 'secundario';
		/** Se está enviando: muestra un círculo que gira y desactiva el botón. */
		cargando?: boolean;
		children: Snippet;
	};

	let {
		variante = 'principal',
		type = 'button',
		cargando = false,
		disabled,
		children,
		...resto
	}: Props = $props();
</script>

<button
	{type}
	class={['boton', variante, { cargando }]}
	disabled={disabled || cargando}
	aria-busy={cargando || undefined}
	{...resto}
>
	{#if cargando}<span class="giro" aria-hidden="true"></span>{/if}
	{@render children()}
</button>

<style>
	.boton {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--espacio-2);
		width: 100%;
		min-height: var(--altura-toque);
		padding: 0 var(--espacio-5);
		border: 0;
		border-radius: var(--radio-boton);
		font-size: 1.05rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			filter 0.15s,
			transform 0.1s,
			opacity 0.15s;
	}

	.boton:hover {
		filter: brightness(1.06);
	}

	/* Al tocarlo, se hunde un poco al instante: el dedo nota que ha funcionado. */
	.boton:active:not(:disabled) {
		transform: scale(0.97);
		filter: brightness(0.94);
	}

	.boton:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	/* Enviando: se ve que trabaja, no que está desactivado. */
	.boton.cargando {
		opacity: 0.85;
		cursor: progress;
	}

	.giro {
		width: 1em;
		height: 1em;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: girar 0.7s linear infinite;
	}

	@keyframes girar {
		to {
			transform: rotate(1turn);
		}
	}

	.principal {
		background: var(--color-acento);
		color: var(--color-acento-texto);
	}

	.secundario {
		background: var(--color-acento-suave);
		color: var(--color-texto);
	}
</style>
