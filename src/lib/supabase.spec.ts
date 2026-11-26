import { describe, it, expect } from 'vitest';
import { leerConfigSupabase } from './supabase.ts';

const URL_PRUEBA = 'https://ejemplo-de-prueba.supabase.co';
const CLAVE_PRUEBA = 'sb_publishable_clave_de_prueba';

describe('leerConfigSupabase', () => {
	it('devuelve la config cuando están las dos variables', () => {
		const resultado = leerConfigSupabase({
			PUBLIC_SUPABASE_URL: URL_PRUEBA,
			PUBLIC_SUPABASE_PUBLISHABLE_KEY: CLAVE_PRUEBA
		});
		expect(resultado).toEqual({ ok: true, config: { url: URL_PRUEBA, clave: CLAVE_PRUEBA } });
	});

	it('da error si falta la URL', () => {
		const resultado = leerConfigSupabase({ PUBLIC_SUPABASE_PUBLISHABLE_KEY: CLAVE_PRUEBA });
		expect(resultado.ok).toBe(false);
		if (!resultado.ok) {
			expect(resultado.error).toContain('PUBLIC_SUPABASE_URL');
			expect(resultado.error).not.toContain('PUBLISHABLE_KEY');
		}
	});

	it('da error si la clave está vacía o solo tiene espacios', () => {
		const resultado = leerConfigSupabase({
			PUBLIC_SUPABASE_URL: URL_PRUEBA,
			PUBLIC_SUPABASE_PUBLISHABLE_KEY: '   '
		});
		expect(resultado.ok).toBe(false);
		if (!resultado.ok) expect(resultado.error).toContain('PUBLIC_SUPABASE_PUBLISHABLE_KEY');
	});

	it('nombra las dos variables si faltan ambas', () => {
		const resultado = leerConfigSupabase({});
		expect(resultado.ok).toBe(false);
		if (!resultado.ok) {
			expect(resultado.error).toContain('PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY');
		}
	});
});
