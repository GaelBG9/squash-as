import { describe, it, expect } from 'vitest';
import { leerPerfil, textoGrupo, textoRol, type DatosPerfil } from './perfil.ts';
import type { ClienteSupabase } from './supabase.ts';

type Respuesta = { data: DatosPerfil | null; error: { message: string } | null };

const ID_PRUEBA = '00000000-0000-4000-8000-0000000000c1';

/** Cliente falso: imita `from().select().eq().maybeSingle().overrideTypes()` sin red. */
function clienteFalso(respuesta: () => Promise<Respuesta>) {
	const llamadas: { tabla?: string; columna?: string; valor?: string } = {};
	const falso = {
		from: (tabla: string) => {
			llamadas.tabla = tabla;
			return {
				select: () => ({
					eq: (columna: string, valor: string) => {
						llamadas.columna = columna;
						llamadas.valor = valor;
						return { maybeSingle: () => ({ overrideTypes: respuesta }) };
					}
				})
			};
		}
	};
	return { cliente: falso as unknown as ClienteSupabase, llamadas };
}

describe('leerPerfil', () => {
	it('sin sesión no consulta nada', async () => {
		const { cliente, llamadas } = clienteFalso(() =>
			Promise.reject(new Error('no debería llamarse'))
		);
		expect(await leerPerfil(cliente, null)).toEqual({ estado: 'sin-sesion' });
		expect(llamadas.tabla).toBeUndefined();
	});

	it('devuelve el perfil del jugador conectado', async () => {
		const jugador: DatosPerfil = { nombre: 'Jugadora Prueba', grupo: null, rol: 'jugador' };
		const { cliente, llamadas } = clienteFalso(() =>
			Promise.resolve({ data: jugador, error: null })
		);
		expect(await leerPerfil(cliente, ID_PRUEBA)).toEqual({ estado: 'conectado', jugador });
		expect(llamadas).toEqual({ tabla: 'jugadores', columna: 'id', valor: ID_PRUEBA });
	});

	it('avisa si el usuario está conectado pero no tiene perfil', async () => {
		const { cliente } = clienteFalso(() => Promise.resolve({ data: null, error: null }));
		expect(await leerPerfil(cliente, ID_PRUEBA)).toEqual({ estado: 'sin-perfil' });
	});

	it('devuelve el error de Supabase', async () => {
		const { cliente } = clienteFalso(() =>
			Promise.resolve({ data: null, error: { message: 'permission denied' } })
		);
		const resultado = await leerPerfil(cliente, ID_PRUEBA);
		expect(resultado.estado).toBe('error');
		if (resultado.estado === 'error') expect(resultado.error).toContain('permission denied');
	});

	it('no lanza excepción si la red falla', async () => {
		const { cliente } = clienteFalso(() => Promise.reject(new Error('fetch failed')));
		const resultado = await leerPerfil(cliente, ID_PRUEBA);
		expect(resultado.estado).toBe('error');
		if (resultado.estado === 'error') expect(resultado.error).toContain('fetch failed');
	});
});

describe('textos del perfil', () => {
	it('muestra el grupo o "sin asignar"', () => {
		expect(textoGrupo(1)).toBe('Grupo 1');
		expect(textoGrupo(null)).toContain('Sin asignar');
	});

	it('traduce el rol', () => {
		expect(textoRol('admin')).toBe('Administrador');
		expect(textoRol('jugador')).toBe('Jugador');
	});
});
