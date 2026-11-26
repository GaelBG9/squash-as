import { describe, it, expect } from 'vitest';
import { rutaInternaSegura } from './rutas.ts';

describe('rutaInternaSegura', () => {
	it('acepta una ruta interna normal', () => {
		expect(rutaInternaSegura('/partidos?id=3')).toBe('/partidos?id=3');
	});

	it('va al inicio si no hay destino', () => {
		expect(rutaInternaSegura(null)).toBe('/');
		expect(rutaInternaSegura(undefined)).toBe('/');
		expect(rutaInternaSegura('')).toBe('/');
	});

	it.each([
		['web externa', 'https://web-maliciosa.com'],
		['sin barra inicial', 'web-maliciosa.com'],
		['doble barra', '//web-maliciosa.com'],
		['barra invertida', '/\\web-maliciosa.com'],
		['salto de línea', '/ok\nhttps://web-maliciosa.com'],
		['tabulador', '/\t/web-maliciosa.com']
	])('rechaza %s', (_, destino) => {
		expect(rutaInternaSegura(destino)).toBe('/');
	});
});
