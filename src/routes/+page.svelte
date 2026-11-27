<script lang="ts">
	import Boton from '#lib/componentes/Boton.svelte';
	import { textoGrupo, textoNivel, textoRol } from '#lib/perfil.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let conectando = $state(false);
</script>

{#if data.errorLogin}
	<p class="aviso" role="alert">{data.errorLogin}</p>
{/if}

{#if data.perfil.estado === 'conectado'}
	<section class="bloque" aria-labelledby="saludo">
		<p class="etiqueta">Ton profil</p>
		<h1 id="saludo">Bonjour, {data.perfil.jugador.nombre}</h1>
	</section>
	<dl class="tarjeta datos">
		<div>
			<dt class="etiqueta">Groupe</dt>
			<dd>{textoGrupo(data.perfil.jugador.grupo)}</dd>
		</div>
		<div>
			<dt class="etiqueta">Rôle</dt>
			<dd>{textoRol(data.perfil.jugador.rol)}</dd>
		</div>
		<div>
			<dt class="etiqueta">Niveau Glicko-2</dt>
			<dd>{textoNivel(data.perfil.jugador.rating, data.perfil.jugador.rd)}</dd>
		</div>
	</dl>
{:else if data.perfil.estado === 'sin-perfil'}
	<p class="aviso" role="alert">Tu es connecté, mais ton profil de joueur n’existe pas encore.</p>
{:else if data.perfil.estado === 'error'}
	<p class="aviso" role="alert">{data.perfil.error}</p>
{:else}
	<section class="bloque" aria-labelledby="bienvenida">
		<p class="etiqueta">Squash de l’AS</p>
		<h1 id="bienvenida">Matchs, classement et tournois</h1>
		<p class="texto-suave">Connecte-toi avec ton compte Google pour voir ton profil.</p>
	</section>
	<!-- Sin `enhance`: el navegador sale hacia Google. Mientras, el botón muestra que trabaja. -->
	<form method="POST" action="/auth/login" onsubmit={() => (conectando = true)}>
		<Boton type="submit" cargando={conectando}>Se connecter avec Google</Boton>
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
