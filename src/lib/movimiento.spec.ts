import { describe, it, expect } from 'vitest';
import { duracion } from './movimiento.ts';

describe('duracion', () => {
	it('sin preferencia: la duración pedida', () => {
		expect(duracion(200, false)).toBe(200);
	});

	it('con "reducir movimiento": 0', () => {
		expect(duracion(200, true)).toBe(0);
	});

	it('en el servidor (sin matchMedia): la duración pedida', () => {
		expect(duracion(150)).toBe(150);
	});
});
