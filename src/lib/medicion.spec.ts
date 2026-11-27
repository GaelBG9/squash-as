import { describe, it, expect } from 'vitest';
import { crearMedidor } from './medicion.ts';

/** Reloj falso: cada lectura avanza 10 ms. */
function relojFalso() {
	let ahora = 0;
	return () => (ahora += 10);
}

describe('crearMedidor', () => {
	it('suma el tiempo y el número de consultas a Supabase', async () => {
		const medidor = crearMedidor(() => Promise.resolve(new Response('ok')), relojFalso());
		await medidor.fetch('https://ejemplo.test/a');
		await medidor.fetch('https://ejemplo.test/b');
		expect(medidor.cabecera(42)).toBe('supabase;dur=20.0;desc="2 requêtes", total;dur=42.0');
	});

	it('sin consultas', () => {
		const medidor = crearMedidor(() => Promise.resolve(new Response('ok')), relojFalso());
		expect(medidor.cabecera(5)).toBe('supabase;dur=0.0;desc="0 requêtes", total;dur=5.0');
	});

	it('una consulta: singular', async () => {
		const medidor = crearMedidor(() => Promise.resolve(new Response('ok')), relojFalso());
		await medidor.fetch('https://ejemplo.test/a');
		expect(medidor.cabecera(10)).toContain('desc="1 requête"');
	});

	it('una consulta que falla también cuenta, y el error sigue llegando', async () => {
		const medidor = crearMedidor(() => Promise.reject(new Error('red caída')), relojFalso());
		await expect(medidor.fetch('https://ejemplo.test/a')).rejects.toThrow('red caída');
		expect(medidor.cabecera(10)).toContain('desc="1 requête"');
	});
});
