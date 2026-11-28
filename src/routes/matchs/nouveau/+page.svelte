<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Boton from '#lib/componentes/Boton.svelte';
	import Campo from '#lib/componentes/Campo.svelte';
	import Seleccion from '#lib/componentes/Seleccion.svelte';
	import { FORMATOS, PUNTOS_MAXIMOS, camposJuego, maxJuegos } from '#lib/marcador.ts';
	import { textoFormato } from '#lib/partidos.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Si el servidor devuelve errores, el formulario conserva lo que se había escrito.
	const valores = $derived<Record<string, string>>(form?.valores ?? {});
	const errores = $derived(form?.errores ?? {});
	// Partido de torneo (R19): rival fijado por el cuadro y nunca en formato libre.
	const torneo = $derived(data.torneo?.ok ? data.torneo.datos : null);
	const formatos = $derived(torneo ? FORMATOS.filter((f) => f !== 'libre') : FORMATOS);
	const formatoInicial = $derived(valores.formato ?? (torneo ? 'mejor_de_3' : 'libre'));
	const volverA = $derived(
		torneo ? resolve('/tournois/[id]', { id: String(torneo.id) }) : resolve('/matchs')
	);
	const numerosJuego = Array.from({ length: maxJuegos('mejor_de_5') }, (_, i) => i + 1);

	let enviando = $state(false);
</script>

<svelte:head>
	<title>Enregistrer un match · Squash AS</title>
</svelte:head>

<section class="bloque" aria-labelledby="titulo">
	{#if torneo}
		<p class="etiqueta">{torneo.nombre} · {torneo.ronda}</p>
		<h1 id="titulo">Match de tournoi</h1>
		<p class="texto-suave">
			Ton adversaire devra le confirmer. Ensuite, le vainqueur passe au tour suivant.
		</p>
	{:else}
		<p class="etiqueta">Matchs</p>
		<h1 id="titulo">Enregistrer un match</h1>
		<p class="texto-suave">
			Ton adversaire devra le confirmer. En attendant, il ne compte pas dans le classement.
		</p>
	{/if}
</section>

{#if data.torneo && !data.torneo.ok}
	<p class="aviso" role="alert">{data.torneo.error}</p>
	<a class="volver" href={resolve('/tournois')}>Voir les tournois</a>
{:else if data.rivales && !data.rivales.ok}
	<p class="aviso" role="alert">{data.rivales.error}</p>
{:else if data.rivales && data.rivales.datos.length === 0}
	<p class="aviso" role="alert">Il n’y a pas encore d’autres joueurs inscrits.</p>
{:else}
	<form
		method="POST"
		class="formulario"
		use:enhance={() => {
			enviando = true;
			return async ({ update }) => {
				// `reset: false`: si hay un error, no se borra lo escrito.
				await update({ reset: false });
				enviando = false;
			};
		}}
	>
		{#if errores.general}
			<p class="aviso" role="alert">{errores.general}</p>
		{/if}

		{#if torneo}
			<input type="hidden" name="torneo" value={torneo.id} />
			<input type="hidden" name="rival" value={torneo.rival.id} />
			<div class="rival-fijo">
				<span class="etiqueta-campo">Adversaire</span>
				<span class="nombre-rival">{torneo.rival.nombre}</span>
			</div>
		{:else if data.rivales?.ok}
			<Seleccion
				id="rival"
				name="rival"
				etiqueta="Adversaire"
				textoVacio="Choisis ton adversaire"
				required
				value={valores.rival ?? ''}
				error={errores.rival}
				opciones={data.rivales.datos.map((r) => ({ valor: r.id, texto: r.nombre }))}
			/>
		{/if}

		<Campo
			id="fecha"
			name="fecha"
			type="date"
			etiqueta="Date du match"
			required
			max={data.hoy}
			value={valores.fecha ?? data.hoy}
			error={errores.fecha}
		/>

		<fieldset class="formatos" aria-describedby={errores.formato ? 'formato-error' : undefined}>
			<legend>Format</legend>
			{#each formatos as formato (formato)}
				<label class="opcion">
					<input type="radio" name="formato" value={formato} checked={formatoInicial === formato} />
					{textoFormato(formato)}
				</label>
			{/each}
			{#if errores.formato}
				<p id="formato-error" class="error">{errores.formato}</p>
			{/if}
		</fieldset>

		<fieldset class="juegos" aria-describedby="juegos-mensaje">
			<legend>Score, jeu par jeu</legend>
			<div class="cabecera-juegos" aria-hidden="true">
				<span></span><span>Toi</span><span>Adversaire</span>
			</div>
			<!-- Se pintan las 5 filas; el CSS esconde las que el formato no usa. -->
			<div class="filas">
				{#each numerosJuego as numero (numero)}
					{@const campos = camposJuego(numero)}
					<div class="juego">
						<span class="numero">Jeu {numero}</span>
						<input
							name={campos.a}
							type="number"
							inputmode="numeric"
							min="0"
							max={PUNTOS_MAXIMOS}
							aria-label="Jeu {numero}, tes points"
							value={valores[campos.a] ?? ''}
						/>
						<input
							name={campos.b}
							type="number"
							inputmode="numeric"
							min="0"
							max={PUNTOS_MAXIMOS}
							aria-label="Jeu {numero}, points de ton adversaire"
							value={valores[campos.b] ?? ''}
						/>
					</div>
				{/each}
			</div>
			<p id="juegos-mensaje" class={errores.juegos ? 'error' : 'ayuda'}>
				{errores.juegos ??
					'N’importe quel score (pas forcément en 11 points). Laisse vides les jeux non joués.'}
			</p>
		</fieldset>

		<Boton type="submit" cargando={enviando}>
			{enviando ? 'Enregistrement…' : 'Enregistrer le match'}
		</Boton>
		<a class="volver" href={volverA}>Annuler</a>
	</form>
{/if}

<style>
	.bloque,
	.formulario {
		display: grid;
		gap: var(--espacio-4);
	}

	.texto-suave,
	.ayuda {
		color: var(--color-texto-suave);
	}

	fieldset {
		display: grid;
		gap: var(--espacio-2);
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}

	legend {
		padding: 0;
		margin-bottom: var(--espacio-2);
		font-weight: 600;
		font-size: 0.95rem;
	}

	.opcion {
		display: flex;
		align-items: center;
		gap: var(--espacio-3);
		min-height: var(--altura-toque);
		padding: 0 var(--espacio-4);
		border-radius: var(--radio-campo);
		background: var(--color-superficie);
		box-shadow: inset 0 0 0 1px var(--color-borde);
		cursor: pointer;
	}

	.opcion:has(input:checked) {
		box-shadow: inset 0 0 0 2px var(--color-acento);
		font-weight: 600;
	}

	.opcion input {
		width: 20px;
		height: 20px;
		accent-color: var(--color-acento);
	}

	.cabecera-juegos,
	.juego {
		display: grid;
		grid-template-columns: 4.5rem 1fr 1fr;
		gap: var(--espacio-2);
		align-items: center;
	}

	.cabecera-juegos {
		font-size: var(--texto-pequeno);
		color: var(--color-texto-suave);
		text-align: center;
	}

	.filas {
		display: grid;
		gap: var(--espacio-2);
	}

	.numero {
		font-weight: 600;
	}

	.juego input {
		width: 100%;
		min-width: 0;
		min-height: var(--altura-toque);
		padding: 0 var(--espacio-3);
		border: 2px solid transparent;
		border-radius: var(--radio-campo);
		background: var(--color-superficie);
		color: var(--color-texto);
		box-shadow: inset 0 0 0 1px var(--color-borde);
		font: inherit;
		font-size: 1.15rem;
		text-align: center;
	}

	.juego input:focus {
		border-color: var(--color-acento);
	}

	/* Filas que se ven según el formato: libre 2, mejor de 3 → 3, mejor de 5 → 5. */
	.formulario:has(input[name='formato'][value='libre']:checked) .juego:nth-child(n + 3),
	.formulario:has(input[name='formato'][value='mejor_de_3']:checked) .juego:nth-child(n + 4) {
		display: none;
	}

	.ayuda,
	.error {
		font-size: var(--texto-pequeno);
	}

	.error {
		color: var(--color-error);
	}

	.rival-fijo {
		display: grid;
		gap: var(--espacio-1);
	}

	.etiqueta-campo {
		font-weight: 600;
		font-size: 0.95rem;
	}

	.nombre-rival {
		display: flex;
		align-items: center;
		min-height: var(--altura-toque);
		padding: 0 var(--espacio-4);
		border-radius: var(--radio-campo);
		background: var(--color-superficie);
		box-shadow: inset 0 0 0 1px var(--color-borde);
		overflow-wrap: anywhere;
	}

	.volver {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: var(--altura-toque);
	}
</style>
