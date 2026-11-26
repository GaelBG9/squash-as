<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		DATOS_GUARDADOS,
		EMAIL_CONTACTO,
		ULTIMA_ACTUALIZACION,
		fechaLegible
	} from '#lib/privacidad.ts';
</script>

<svelte:head>
	<title>Política de privacidad · Squash AS</title>
</svelte:head>

<section class="bloque" aria-labelledby="titulo">
	<p class="etiqueta">Squash AS</p>
	<h1 id="titulo">Política de privacidad</h1>
	<p class="texto-suave">Última actualización: {fechaLegible(ULTIMA_ACTUALIZACION)}</p>
</section>

<article class="politica">
	<section class="tarjeta">
		<h2>Quién es responsable</h2>
		<p>
			Esta web es la herramienta interna del AS de squash para gestionar miembros, partidos,
			clasificaciones y torneos. El responsable de los datos es Gaël, administrador de la app.
			Contacto: <a href="mailto:{EMAIL_CONTACTO}">{EMAIL_CONTACTO}</a>.
		</p>
	</section>

	<section class="tarjeta">
		<h2>Qué datos guardamos y para qué</h2>
		<p>Al conectarte con Google por primera vez se crea tu perfil de jugador con:</p>
		<dl class="lista-datos">
			{#each DATOS_GUARDADOS as { dato, para } (dato)}
				<div>
					<dt>{dato}</dt>
					<dd>{para}</dd>
				</div>
			{/each}
		</dl>
		<p>
			Además, el servicio de login guarda los datos que Google nos envía al conectarte (nombre,
			email y enlace a tu foto de perfil) y la fecha de tu último acceso. Solo pedimos a Google tu
			nombre, tu email y tu foto de perfil: nunca vemos tu contraseña ni otros datos de tu cuenta.
		</p>
	</section>

	<section class="tarjeta">
		<h2>Quién puede verlos</h2>
		<ul>
			<li>Sin conectarse, nadie puede ver la lista de jugadores.</li>
			<li>
				Los jugadores conectados pueden ver los perfiles de los demás miembros (nombre, email,
				grupo, rol y nivel).
			</li>
			<li>
				Cada jugador solo puede cambiar su propio nombre. El administrador puede cambiar todo.
			</li>
			<li>No vendemos ni cedemos tus datos a nadie y no hay publicidad.</li>
		</ul>
	</section>

	<section class="tarjeta">
		<h2>Dónde se guardan</h2>
		<ul>
			<li><strong>Supabase</strong>: base de datos y login.</li>
			<li>
				<strong>Vercel</strong>: aloja la web. Como cualquier servidor, registra datos técnicos de
				las visitas (por ejemplo la dirección IP) durante un tiempo limitado.
			</li>
			<li><strong>Google</strong>: solo para el login con tu cuenta.</li>
		</ul>
	</section>

	<section class="tarjeta">
		<h2>Cookies</h2>
		<p>
			Solo usamos las cookies necesarias para mantener tu sesión abierta. No hay cookies de
			publicidad ni de estadísticas, y las fuentes de letra se sirven desde nuestra propia web.
		</p>
	</section>

	<section class="tarjeta">
		<h2>Cuánto tiempo y tus derechos</h2>
		<p>
			Guardamos tus datos mientras seas miembro y tengas cuenta. Puedes pedir en cualquier momento
			ver tus datos, corregirlos o borrar tu cuenta escribiendo a
			<a href="mailto:{EMAIL_CONTACTO}">{EMAIL_CONTACTO}</a>. Si no estás conforme con la respuesta,
			puedes reclamar ante la autoridad de protección de datos de tu país.
		</p>
	</section>
</article>

<p><a href={resolve('/')}>Volver al inicio</a></p>

<style>
	.bloque,
	.politica,
	.tarjeta {
		display: grid;
		gap: var(--espacio-3);
	}

	.politica {
		gap: var(--espacio-4);
	}

	h2 {
		font-size: var(--texto-grande);
	}

	.texto-suave {
		color: var(--color-texto-suave);
	}

	ul {
		display: grid;
		gap: var(--espacio-2);
		margin: 0;
		padding-left: var(--espacio-5);
	}

	.lista-datos {
		display: grid;
		gap: var(--espacio-3);
		margin: 0;
	}

	dt {
		font-weight: 600;
	}

	dd {
		margin: 0;
		color: var(--color-texto-suave);
	}

	/* Los emails largos se parten en vez de provocar scroll horizontal en móvil. */
	a {
		overflow-wrap: anywhere;
	}
</style>
