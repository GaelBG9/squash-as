<script lang="ts">
	import { textoGrupo, textoRol } from '#lib/perfil.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<h1>Squash AS</h1>

{#if data.errorLogin}
	<p role="alert">{data.errorLogin}</p>
{/if}

{#if data.perfil.estado === 'conectado'}
	<p>Hola, <strong>{data.perfil.jugador.nombre}</strong></p>
	<ul>
		<li>{textoGrupo(data.perfil.jugador.grupo)}</li>
		<li>Rol: {textoRol(data.perfil.jugador.rol)}</li>
	</ul>
{:else if data.perfil.estado === 'sin-perfil'}
	<p role="alert">Estás conectado, pero tu perfil de jugador no existe todavía.</p>
{:else if data.perfil.estado === 'error'}
	<p role="alert">{data.perfil.error}</p>
{/if}

{#if data.perfil.estado === 'sin-sesion'}
	<form method="POST" action="/auth/login">
		<button type="submit">Conectarse con Google</button>
	</form>
{:else}
	<form method="POST" action="/auth/logout">
		<button type="submit">Desconectarse</button>
	</form>
{/if}

<hr />
{#if data.prueba.ok}
	<p><small>Conexión con Supabase: {data.prueba.mensaje}</small></p>
{:else}
	<p role="alert"><small>{data.prueba.error}</small></p>
{/if}
