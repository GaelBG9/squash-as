/**
 * Lo que devuelven las funciones que leen o escriben en Supabase: los datos, o un
 * mensaje de error en francés listo para mostrar. Así las páginas no tienen que
 * capturar excepciones.
 */
export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string };

/** Mensaje cuando ni siquiera se ha podido hablar con Supabase (sin red, URL mal...). */
export function errorDeRed(e: unknown): string {
	const detalle = e instanceof Error ? e.message : String(e);
	return `Impossible de contacter Supabase : ${detalle}`;
}
