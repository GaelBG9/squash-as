<script lang="ts">
	import { fechaCorta } from '#lib/partidos.ts';
	import { navigating } from '$app/state';
	import { leerFiltroGrupo, type FiltroGrupo } from '#lib/clasificacion.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// El filtro es un formulario GET: cada botón añade `?groupe=1` (o 2, o nada) a la URL.
	// Funciona sin JavaScript, la URL se puede compartir y el botón "atrás" del móvil
	// vuelve al filtro anterior. SvelteKit lo trata como un enlace (sin recargar la página).
	const FILTROS: { texto: string; grupo: FiltroGrupo }[] = [
		{ texto: 'Tous', grupo: null },
		{ texto: 'Groupe 1', grupo: 1 },
		{ texto: 'Groupe 2', grupo: 2 }
	];

	// Mientras carga el filtro pulsado, ya se marca como elegido: respuesta inmediata.
	const grupoMostrado = $derived(
		navigating.to?.route.id === '/classement'
			? leerFiltroGrupo(navigating.to.url.searchParams.get('groupe'))
			: data.grupo
	);
</script>

<svelte:head>
	<title>Classement · Squash AS</title>
</svelte:head>

<section class="bloque" aria-labelledby="titulo">
	<p class="etiqueta">Glicko-2</p>
	<h1 id="titulo">Classement</h1>
	<p class="texto-suave">
		Le niveau de chaque joueur, calculé à partir des matchs confirmés. Le « ± » indique
		l’incertitude : elle baisse quand on joue souvent et remonte quand on ne joue plus.
	</p>
</section>

<form method="GET" class="filtros" aria-label="Filtrer par groupe">
	{#each FILTROS as filtro (filtro.texto)}
		<button
			class="filtro"
			name="groupe"
			value={filtro.grupo ?? ''}
			aria-pressed={grupoMostrado === filtro.grupo}
		>
			{filtro.texto}
		</button>
	{/each}
</form>

{#if !data.clasificacion.ok}
	<p class="aviso" role="alert">{data.clasificacion.error}</p>
{:else if data.clasificacion.datos.length === 0}
	<p class="texto-suave">
		{data.grupo === null
			? 'Personne n’a encore de match confirmé. Le classement apparaîtra après le premier.'
			: `Aucun joueur du groupe ${data.grupo} n’a encore de match confirmé.`}
	</p>
{:else}
	<ol class="lista">
		{#each data.clasificacion.datos as jugador (jugador.id)}
			{@const soyYo = jugador.id === data.idUsuario}
			<li class={['tarjeta', 'puesto', { yo: soyYo }]} aria-current={soyYo ? 'true' : undefined}>
				<span class="numero" aria-label="Position {jugador.puesto}">{jugador.puesto}</span>
				<div class="jugador">
					<span class="nombre">
						{jugador.nombre}
						{#if soyYo}<span class="tu">(toi)</span>{/if}
					</span>
					<span class="detalle">
						{jugador.grupo === null ? 'Sans groupe' : `Groupe ${jugador.grupo}`} ·
						{jugador.partidos} match{jugador.partidos > 1 ? 's' : ''} · dernier le
						{fechaCorta(jugador.ultimoPartido)}
					</span>
				</div>
				<span class="nivel">
					<span class="rating">{Math.round(jugador.rating)}</span>
					<span class="rd">± {Math.round(jugador.rd)}</span>
				</span>
			</li>
		{/each}
	</ol>
{/if}

<style>
	.bloque {
		display: grid;
		gap: var(--espacio-2);
	}

	.texto-suave,
	.detalle,
	.rd {
		color: var(--color-texto-suave);
	}

	/* Tres pastillas del mismo ancho; la activa, en el color de la pista. */
	.filtros {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--espacio-2);
	}

	.filtro {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: var(--altura-toque);
		padding: 0 var(--espacio-2);
		border: 1px solid var(--color-borde);
		border-radius: var(--radio-boton);
		background: var(--color-superficie);
		color: var(--color-texto);
		font: inherit;
		font-weight: 600;
		white-space: nowrap;
		cursor: pointer;
		transition:
			background-color 0.15s,
			color 0.15s,
			transform 0.1s;
	}

	.filtro:active {
		transform: scale(0.96);
	}

	.filtro[aria-pressed='true'] {
		border-color: var(--color-acento);
		background: var(--color-acento);
		color: var(--color-acento-texto);
	}

	.lista {
		display: grid;
		gap: var(--espacio-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.puesto {
		display: grid;
		grid-template-columns: 2.25rem 1fr auto;
		align-items: center;
		gap: var(--espacio-3);
	}

	/* Mi fila: borde amarillo, como los puntos de la pelota. */
	.puesto.yo {
		box-shadow: inset 4px 0 0 var(--color-punto);
	}

	.numero {
		font-family: var(--fuente-titulo);
		font-size: var(--texto-grande);
		font-weight: 700;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}

	.jugador {
		display: grid;
		min-width: 0;
	}

	.nombre {
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.tu {
		font-weight: 400;
		color: var(--color-texto-suave);
	}

	.detalle {
		font-size: var(--texto-pequeno);
	}

	.nivel {
		display: grid;
		justify-items: end;
		font-variant-numeric: tabular-nums;
	}

	.rating {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--color-acento);
	}

	.rd {
		font-size: var(--texto-pequeno);
	}
</style>
