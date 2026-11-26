import { describe, it, expect } from 'vitest';
import type { ClienteSupabase } from './supabase.ts';
import { leerMensajePrueba } from './prueba-conexion.ts';

type Respuesta = { data: { mensaje: string }[] | null; error: { message: string } | null };

/** Cliente falso: imita `from().select().limit().overrideTypes()` sin llamar a la red. */
function clienteFalso(respuesta: () => Promise<Respuesta>): ClienteSupabase {
	const falso = {
		from: () => ({ select: () => ({ limit: () => ({ overrideTypes: respuesta }) }) })
	};
	return falso as unknown as ClienteSupabase;
}

describe('leerMensajePrueba', () => {
	it('devuelve el mensaje si la tabla tiene datos', async () => {
		const cliente = clienteFalso(() =>
			Promise.resolve({ data: [{ mensaje: 'Hola desde Supabase' }], error: null })
		);
		expect(await leerMensajePrueba(cliente)).toEqual({ ok: true, mensaje: 'Hola desde Supabase' });
	});

	it('devuelve el error de Supabase (p. ej. clave incorrecta)', async () => {
		const cliente = clienteFalso(() =>
			Promise.resolve({ data: null, error: { message: 'Invalid API key' } })
		);
		const resultado = await leerMensajePrueba(cliente);
		expect(resultado.ok).toBe(false);
		if (!resultado.ok) expect(resultado.error).toContain('Invalid API key');
	});

	it('avisa si la tabla está vacía', async () => {
		const cliente = clienteFalso(() => Promise.resolve({ data: [], error: null }));
		const resultado = await leerMensajePrueba(cliente);
		expect(resultado.ok).toBe(false);
		if (!resultado.ok) expect(resultado.error).toContain('no hay datos de prueba');
	});

	it('no lanza excepción si la red falla', async () => {
		const cliente = clienteFalso(() => Promise.reject(new Error('fetch failed')));
		const resultado = await leerMensajePrueba(cliente);
		expect(resultado.ok).toBe(false);
		if (!resultado.ok) expect(resultado.error).toContain('fetch failed');
	});
});
