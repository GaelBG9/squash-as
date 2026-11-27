import { createServerClient } from '@supabase/ssr';
import type { Cookies } from '@sveltejs/kit';

export type ConfigSupabase = { url: string; clave: string };

export type ResultadoConfig = { ok: true; config: ConfigSupabase } | { ok: false; error: string };

/** Tipo del cliente que devuelve `crearClienteServidor`. */
export type ClienteSupabase = ReturnType<typeof crearClienteServidor>;

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
			error: `Supabase n’est pas configuré (${faltan.join(', ')}) : copie .env.example vers .env et remplis-le.`
		};
	}
	return { ok: true, config: { url, clave } };
}

/**
 * Cliente de Supabase para el servidor de SvelteKit, uno por petición.
 * Guarda la sesión del jugador en cookies: así Supabase sabe quién hace cada
 * consulta y aplica sus permisos (RLS).
 */
export function crearClienteServidor(
	config: ConfigSupabase,
	cookies: Cookies,
	/** Para medir el tiempo de cada consulta (ver `medicion.ts`). */
	fetchPropio?: typeof fetch
) {
	return createServerClient(config.url, config.clave, {
		...(fetchPropio && { global: { fetch: fetchPropio } }),
		cookies: {
			getAll: () => cookies.getAll(),
			setAll: (lista) => {
				for (const { name, value, options } of lista) {
					cookies.set(name, value, { ...options, path: '/' });
				}
			}
		}
	});
}
