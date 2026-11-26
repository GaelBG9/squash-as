<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	type Props = Omit<HTMLInputAttributes, 'value'> & {
		/** Texto visible encima del campo. */
		etiqueta: string;
		/** Obligatorio: une la etiqueta y el mensaje con el campo. */
		id: string;
		/** Si hay error, se muestra en rojo en lugar de la ayuda. */
		error?: string | null;
		ayuda?: string | null;
		value?: string | number | null;
	};

	let {
		etiqueta,
		id,
		error = null,
		ayuda = null,
		value = $bindable(''),
		...resto
	}: Props = $props();

	const mensaje = $derived(error ?? ayuda);
	const idMensaje = $derived(`${id}-mensaje`);
</script>

<div class={['campo', { 'con-error': error }]}>
	<label for={id}>{etiqueta}</label>
	<input
		{id}
		bind:value
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={mensaje ? idMensaje : undefined}
		{...resto}
	/>
	{#if mensaje}
		<p id={idMensaje} class="mensaje">{mensaje}</p>
	{/if}
</div>

<style>
	.campo {
		display: grid;
		gap: var(--espacio-2);
	}

	label {
		font-weight: 600;
		font-size: 0.95rem;
	}

	input {
		width: 100%;
		min-height: var(--altura-toque);
		padding: 0 var(--espacio-4);
		border: 2px solid transparent;
		border-radius: var(--radio-campo);
		background: var(--color-superficie);
		color: var(--color-texto);
		box-shadow: inset 0 0 0 1px var(--color-borde);
	}

	input:focus {
		border-color: var(--color-acento);
	}

	.mensaje {
		font-size: var(--texto-pequeno);
		color: var(--color-texto-suave);
	}

	.con-error input {
		border-color: var(--color-error);
	}

	.con-error .mensaje {
		color: var(--color-error);
	}
</style>
