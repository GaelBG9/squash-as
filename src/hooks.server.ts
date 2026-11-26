import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from '$app/env/public';
import { crearClienteServidor, leerConfigSupabase } from '#lib/supabase.ts';
import type { Handle } from '@sveltejs/kit/hooks';

const config = leerConfigSupabase({ PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY });

// Se ejecuta en cada petición, antes de cualquier página o ruta: prepara
// el cliente de Supabase con la sesión (cookies) de quien visita la app.
export const handle: Handle = ({ event, resolve }) => {
	const supabase = config.ok ? crearClienteServidor(config.config, event.cookies) : null;

	event.locals.supabase = supabase;
	event.locals.errorConfig = config.ok ? null : config.error;
	event.locals.obtenerUsuario = async () => {
		if (!supabase) return null;
		// getUser() pregunta a Supabase si la sesión es válida (no se fía solo de la cookie).
		const { data, error } = await supabase.auth.getUser();
		return error ? null : data.user;
	};

	return resolve(event, {
		// Cabeceras que Supabase necesita leer en las respuestas.
		filterSerializedResponseHeaders: (nombre) =>
			nombre === 'content-range' || nombre === 'x-supabase-api-version'
	});
};
