import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from '$app/env/public';
import { crearMedidor } from '#lib/medicion.ts';
import { crearObtenerUsuario } from '#lib/sesion.ts';
import { crearClienteServidor, leerConfigSupabase } from '#lib/supabase.ts';
import type { Handle } from '@sveltejs/kit/hooks';

const config = leerConfigSupabase({ PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY });

// Se ejecuta en cada petición, antes de cualquier página o ruta: prepara
// el cliente de Supabase con la sesión (cookies) de quien visita la app.
export const handle: Handle = async ({ event, resolve }) => {
	const inicio = performance.now();
	const medidor = crearMedidor();
	const supabase = config.ok
		? crearClienteServidor(config.config, event.cookies, medidor.fetch)
		: null;

	event.locals.supabase = supabase;
	event.locals.errorConfig = config.ok ? null : config.error;
	// Comprueba la sesión una sola vez por petición (ver `sesion.ts`).
	event.locals.obtenerUsuario = crearObtenerUsuario(supabase);

	const respuesta = await resolve(event, {
		// Cabeceras que Supabase necesita leer en las respuestas.
		filterSerializedResponseHeaders: (nombre) =>
			nombre === 'content-range' || nombre === 'x-supabase-api-version'
	});
	// Algunas respuestas (redirecciones de `fetch`) tienen cabeceras de solo lectura.
	try {
		respuesta.headers.set('Server-Timing', medidor.cabecera(performance.now() - inicio));
	} catch {
		// Sin medición en esa respuesta: no pasa nada.
	}
	return respuesta;
};
