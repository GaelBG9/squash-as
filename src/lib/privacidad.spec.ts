import { describe, it, expect } from 'vitest';
import {
	COLUMNAS_JUGADOR,
	DATOS_GUARDADOS,
	EMAIL_CONTACTO,
	ULTIMA_ACTUALIZACION,
	columnasSinExplicar,
	fechaLegible
} from './privacidad.ts';

describe('datos declarados en la política de privacidad', () => {
	it('explica todas las columnas de la tabla jugadores', () => {
		expect(columnasSinExplicar()).toEqual([]);
	});

	it('detecta una columna que se ha quedado sin explicar', () => {
		const sinEmail = DATOS_GUARDADOS.filter((d) => !d.columnas.includes('email'));
		expect(columnasSinExplicar(sinEmail)).toEqual(['email']);
	});

	it('no explica columnas que no existen ni repite ninguna', () => {
		const columnas = DATOS_GUARDADOS.flatMap((d) => d.columnas);
		for (const columna of columnas) expect(Object.keys(COLUMNAS_JUGADOR)).toContain(columna);
		expect(new Set(columnas).size).toBe(columnas.length);
	});

	it('cada dato dice qué es y para qué sirve', () => {
		for (const { dato, para } of DATOS_GUARDADOS) {
			expect(dato.trim()).not.toBe('');
			expect(para.trim()).not.toBe('');
		}
	});
});

describe('contacto y fecha', () => {
	it('el email de contacto tiene forma de email', () => {
		expect(EMAIL_CONTACTO).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
	});

	it('la fecha de actualización es válida', () => {
		expect(ULTIMA_ACTUALIZACION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(fechaLegible(ULTIMA_ACTUALIZACION)).toBe('26 novembre 2026');
	});

	it.each([
		['2026-01-01', '1 janvier 2026'],
		['2026-12-31', '31 décembre 2026']
	])('%s → %s (sin cambiar de día por la zona horaria)', (fecha, esperado) => {
		expect(fechaLegible(fecha)).toBe(esperado);
	});
});
