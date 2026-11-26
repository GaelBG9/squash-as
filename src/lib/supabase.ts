import { createClient } from '@supabase/supabase-js';

export type ConfigSupabase = { url: string; clave: string };

export type ResultadoConfig = { ok: true; config: ConfigSupabase } | { ok: false; error: string };

/** Tipo del cliente que devuelve `crearClienteSupabase`. */
export type ClienteSupabase = ReturnType<typeof crearClienteSupabase>;

/**
 * Lee la URL y la clave pública de Supabase de las variables de entorno.
 * Devuelve un error legible si falta alguna, en lugar de fallar más tarde.
 */
export function leerConfigSupabase(env: Record<string, string | undefined>): ResultadoConfig {
	const url = env.PUBLIC_SUPABASE_URL?.trim();
	const clave = env.PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

	const faltan: string[] = [];
	if (!url) faltan.push('PUBLIC_SUPABASE_URL');
	if (!clave) faltan.push('PUBLIC_SUPABASE_PUBLISHABLE_KEY');

	if (!url || !clave) {
		return {
			ok: false,
			error: `Falta configurar Supabase (${faltan.join(', ')}): copia .env.example a .env y rellénalo.`
		};
	}
	return { ok: true, config: { url, clave } };
}

export function crearClienteSupabase(config: ConfigSupabase) {
	return createClient(config.url, config.clave);
}
