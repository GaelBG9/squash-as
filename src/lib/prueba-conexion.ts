import type { ClienteSupabase } from './supabase.ts';

export type ResultadoPrueba = { ok: true; mensaje: string } | { ok: false; error: string };

/** Lee el mensaje de la tabla `prueba_conexion` para comprobar que Supabase responde. */
export async function leerMensajePrueba(cliente: ClienteSupabase): Promise<ResultadoPrueba> {
	try {
		const { data, error } = await cliente
			.from('prueba_conexion')
			.select('mensaje')
			.limit(1)
			.overrideTypes<{ mensaje: unknown }[], { merge: false }>();

		if (error) {
			return { ok: false, error: `Supabase ha respondido con un error: ${error.message}` };
		}
		const mensaje = data[0]?.mensaje;
		if (typeof mensaje !== 'string') {
			return { ok: false, error: 'Conexión correcta, pero no hay datos de prueba en la tabla.' };
		}
		return { ok: true, mensaje };
	} catch (e) {
		const detalle = e instanceof Error ? e.message : String(e);
		return { ok: false, error: `No se ha podido contactar con Supabase: ${detalle}` };
	}
}
