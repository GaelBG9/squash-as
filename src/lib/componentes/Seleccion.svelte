<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';

	type Opcion = { valor: string; texto: string };

	type Props = Omit<HTMLSelectAttributes, 'value'> & {
		/** Texto visible encima de la lista. */
		etiqueta: string;
		/** Obligatorio: une la etiqueta y el mensaje con la lista. */
		id: string;
		opciones: readonly Opcion[];
		/** Primera opción vacía, p. ej. "Choisis…"; obliga a elegir. */
		textoVacio?: string;
		error?: string | null;
		ayuda?: string | null;
		value?: string;
	};

	let {
		etiqueta,
		id,
		opciones,
		textoVacio = 'Choisis…',
		error = null,
		ayuda = null,
		value = $bindable(''),
		...resto
	}: Props = $props();

	const mensaje = $derived(error ?? ayuda);
	const idMensaje = $derived(`${id}-mensaje`);
</script>

<!-- Mismo aspecto que `Campo.svelte`, pero con una lista desplegable. -->
<div class={['campo', { 'con-error': error }]}>
	<label for={id}>{etiqueta}</label>
	<select
		{id}
		bind:value
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={mensaje ? idMensaje : undefined}
		{...resto}
	>
		<option value="" disabled>{textoVacio}</option>
		{#each opciones as opcion (opcion.valor)}
			<option value={opcion.valor}>{opcion.texto}</option>
		{/each}
	</select>
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

	select {
		width: 100%;
		min-height: var(--altura-toque);
		padding: 0 var(--espacio-4);
		border: 2px solid transparent;
		border-radius: var(--radio-campo);
		background: var(--color-superficie);
		color: var(--color-texto);
		box-shadow: inset 0 0 0 1px var(--color-borde);
		font: inherit;
	}

	select:focus {
		border-color: var(--color-acento);
	}

	.mensaje {
		font-size: var(--texto-pequeno);
		color: var(--color-texto-suave);
	}

	.con-error select {
		border-color: var(--color-error);
	}

	.con-error .mensaje {
		color: var(--color-error);
	}
</style>
