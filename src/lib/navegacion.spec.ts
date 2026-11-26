import { describe, it, expect } from 'vitest';
import { MENU, esRutaActual, iniciales } from './navegacion.ts';

describe('MENU', () => {
	it('empieza solo con el inicio', () => {
		expect(MENU).toEqual([{ texto: 'Accueil', ruta: '/' }]);
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
