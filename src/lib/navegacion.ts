import type { RouteId } from '$app/types';

/** `RouteId` solo admite rutas que existen en `src/routes`: un enlace roto no compila. */
export type EntradaMenu = { texto: string; ruta: RouteId };

/** Entradas del menú. Cada página nueva añade aquí la suya cuando existe. */
export const MENU: readonly EntradaMenu[] = [{ texto: 'Inicio', ruta: '/' }];

/**
 * ¿Es `ruta` la página en la que está el usuario?
 * `/` solo cuenta en el inicio; `/partidos` también cuenta en `/partidos/12`.
 */
export function esRutaActual(ruta: string, rutaActual: string): boolean {
	if (ruta === '/') return rutaActual === '/';
	return rutaActual === ruta || rutaActual.startsWith(`${ruta}/`);
}

/** Iniciales para el avatar: primera letra de las dos primeras palabras ("Ana María" → "AM"). */
export function iniciales(nombre: string): string {
	const palabras = nombre.trim().split(/\s+/).filter(Boolean).slice(0, 2);
	if (palabras.length === 0) return '?';
	// `[...palabra]` separa por caracteres reales, no por unidades de código UTF-16.
	return palabras.map((palabra) => [...palabra][0].toLocaleUpperCase('es')).join('');
}
