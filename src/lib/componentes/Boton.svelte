<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Props = HTMLButtonAttributes & {
		/** `principal`: la acción más importante de la pantalla; `secundario`: el resto. */
		variante?: 'principal' | 'secundario';
		children: Snippet;
	};

	let { variante = 'principal', type = 'button', children, ...resto }: Props = $props();
</script>

<button {type} class={['boton', variante]} {...resto}>
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
		transition: filter 0.15s;
	}

	.boton:hover {
		filter: brightness(1.06);
	}

	.boton:disabled {
		opacity: 0.55;
		cursor: not-allowed;
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
