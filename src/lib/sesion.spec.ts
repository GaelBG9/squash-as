import { describe, it, expect } from 'vitest';
import { crearObtenerUsuario, type AuthConClaims } from './sesion.ts';

const ID = '00000000-0000-4000-8000-0000000016e1';

/** Cliente falso que cuenta cuántas veces se comprueba la sesión. */
function clienteFalso(respuesta: () => ReturnType<AuthConClaims['auth']['getClaims']>) {
	const contador = { llamadas: 0 };
	const cliente: AuthConClaims = {
		auth: {
			getClaims: () => {
				contador.llamadas++;
				return respuesta();
			}
		}
	};
	return { cliente, contador };
}

describe('crearObtenerUsuario', () => {
	it('devuelve el id de la sesión (`sub`)', async () => {
		const { cliente } = clienteFalso(() =>
			Promise.resolve({ data: { claims: { sub: ID } }, error: null })
		);
		expect(await crearObtenerUsuario(cliente)()).toEqual({ id: ID });
	});

	it('layout y página en la misma petición: una sola comprobación', async () => {
		const { cliente, contador } = clienteFalso(() =>
			Promise.resolve({ data: { claims: { sub: ID } }, error: null })
		);
		const obtenerUsuario = crearObtenerUsuario(cliente);
		const [layout, pagina] = await Promise.all([obtenerUsuario(), obtenerUsuario()]);
		expect(layout).toEqual({ id: ID });
		expect(pagina).toEqual({ id: ID });
		expect(contador.llamadas).toBe(1);
	});

	it('cada petición vuelve a comprobar', async () => {
		const { cliente, contador } = clienteFalso(() =>
			Promise.resolve({ data: { claims: { sub: ID } }, error: null })
		);
		await crearObtenerUsuario(cliente)();
		await crearObtenerUsuario(cliente)();
		expect(contador.llamadas).toBe(2);
	});

	it('sin sesión o con sesión no válida: null', async () => {
		const casos = [
			clienteFalso(() => Promise.resolve({ data: null, error: null })),
			clienteFalso(() => Promise.resolve({ data: null, error: new Error('invalid JWT') })),
			clienteFalso(() => Promise.resolve({ data: { claims: {} }, error: null })),
			clienteFalso(() => Promise.reject(new Error('fetch failed')))
		];
		for (const { cliente } of casos) expect(await crearObtenerUsuario(cliente)()).toBeNull();
	});

	it('sin Supabase configurado: null', async () => {
		expect(await crearObtenerUsuario(null)()).toBeNull();
	});
});
