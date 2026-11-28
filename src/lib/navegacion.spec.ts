import { describe, it, expect } from 'vitest';
import { MENU, entradasMenu, esRutaActual, iniciales } from './navegacion.ts';

describe('MENU', () => {
	it('con sesión: inicio, mis partidos, clasificación y torneos', () => {
		expect(entradasMenu(true).map((e) => e.ruta)).toEqual([
			'/',
			'/matchs',
			'/classement',
			'/tournois'
		]);
	});

	it('sin sesión no enseña páginas que necesitan sesión', () => {
		expect(entradasMenu(false).map((e) => e.ruta)).toEqual(['/']);
	});

	it('todas las rutas son internas', () => {
		for (const entrada of MENU) expect(entrada.ruta.startsWith('/')).toBe(true);
	});
});

describe('esRutaActual', () => {
	it('el inicio solo está activo en "/"', () => {
		expect(esRutaActual('/', '/')).toBe(true);
		expect(esRutaActual('/', '/partidos')).toBe(false);
	});

	it('una sección está activa en sus subpáginas', () => {
		expect(esRutaActual('/partidos', '/partidos')).toBe(true);
		expect(esRutaActual('/partidos', '/partidos/12')).toBe(true);
	});

	it('no confunde rutas que empiezan igual', () => {
		expect(esRutaActual('/partidos', '/partidos-antiguos')).toBe(false);
	});
});

describe('iniciales', () => {
	it.each([
		['Jugadora Prueba', 'JP'],
		['Ana María López', 'AM'],
		['prueba', 'P'],
		['  Jugador   Prueba  ', 'JP'],
		['Íñigo Ñandú', 'ÍÑ'],
		['', '?'],
		['   ', '?']
	])('"%s" → "%s"', (nombre, esperado) => {
		expect(iniciales(nombre)).toBe(esperado);
	});
});
