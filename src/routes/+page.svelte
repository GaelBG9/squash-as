<script lang="ts">
	import Boton from '#lib/componentes/Boton.svelte';
	import { textoGrupo, textoRol } from '#lib/perfil.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

{#if data.errorLogin}
	<p class="aviso" role="alert">{data.errorLogin}</p>
{/if}

{#if data.perfil.estado === 'conectado'}
	<section class="bloque" aria-labelledby="saludo">
		<p class="etiqueta">Tu perfil</p>
		<h1 id="saludo">Hola, {data.perfil.jugador.nombre}</h1>
	</section>
	<dl class="tarjeta datos">
		<div>
			<dt class="etiqueta">Grupo</dt>
			<dd>{textoGrupo(data.perfil.jugador.grupo)}</dd>
		</div>
		<div>
			<dt class="etiqueta">Rol</dt>
			<dd>{textoRol(data.perfil.jugador.rol)}</dd>
		</div>
	</dl>
{:else if data.perfil.estado === 'sin-perfil'}
	<p class="aviso" role="alert">Estás conectado, pero tu perfil de jugador no existe todavía.</p>
{:else if data.perfil.estado === 'error'}
	<p class="aviso" role="alert">{data.perfil.error}</p>
{:else}
	<section class="bloque" aria-labelledby="bienvenida">
		<p class="etiqueta">Squash del AS</p>
		<h1 id="bienvenida">Partidos, ranking y torneos</h1>
		<p class="texto-suave">Conéctate con tu cuenta Google para ver tu perfil.</p>
	</section>
	<form method="POST" action="/auth/login">
		<Boton type="submit">Conectarse con Google</Boton>
	</form>
{/if}

<style>
	.bloque {
		display: grid;
		gap: var(--espacio-2);
	}

	.texto-suave {
		color: var(--color-texto-suave);
	}

	.datos {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: var(--espacio-3);
		margin: 0;
	}

	.datos div {
		display: grid;
		gap: var(--espacio-1);
	}

	dd {
		margin: 0;
		font-weight: 600;
	}
</style>
