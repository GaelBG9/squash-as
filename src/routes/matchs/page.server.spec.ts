import { describe, it, expect } from 'vitest';
import type { User } from '@supabase/supabase-js';
import type { ClienteSupabase } from '#lib/supabase.ts';
import type { FilaPartido } from '#lib/partidos.ts';
import { actions, load } from './+page.server.ts';

const ID_YO = '00000000-0000-4000-8000-0000000011e1';
const ID_RIVAL = '00000000-0000-4000-8000-0000000011e2';

const PENDIENTE: FilaPartido = {
	id: 1,
	fecha: '2026-11-20',
	tipo: 'entrenamiento',
	formato: 'mejor_de_5',
	jugador_a: ID_YO,
	jugador_b: ID_RIVAL,
	ganador: ID_YO,
	estado: 'pendiente',
	registrado_por: ID_YO,
	registrado_en: '2026-11-20T18:00:00Z',
	respondido_en: null,
	juegos: [
		{ numero: 1, puntos_a: 11, puntos_b: 7 },
		{ numero: 2, puntos_a: 9, puntos_b: 11 },
		{ numero: 3, puntos_a: 11, puntos_b: 5 },
		{ numero: 4, puntos_a: 11, puntos_b: 8 }
	],
	nombre_a: { nombre: 'Yo Prueba' },
	nombre_b: { nombre: 'Rival Prueba' }
};

type RespuestaRpc = { data: unknown; error: { message: string } | null };

/** Cliente falso: devuelve `PENDIENTE` en las consultas y apunta las llamadas a `rpc`. */
function clienteFalso(respuestaRpc: RespuestaRpc = { data: null, error: null }) {
	const llamadasRpc: unknown[][] = [];
	const consulta: Record<string, (...argumentos: unknown[]) => unknown> = {};
	for (const metodo of ['from', 'select', 'or', 'order']) consulta[metodo] = () => consulta;
	consulta.overrideTypes = () => Promise.resolve({ data: [PENDIENTE], error: null });
	consulta.rpc = (...argumentos) => {
		llamadasRpc.push(argumentos);
		return Promise.resolve(respuestaRpc);
	};
	return { cliente: consulta as unknown as ClienteSupabase, llamadasRpc };
}

function cargar(direccion: string, conectado = true) {
	const evento = {
		url: new URL(direccion),
		locals: {
			supabase: clienteFalso().cliente,
			errorConfig: null,
			obtenerUsuario: () => Promise.resolve(conectado ? ({ id: ID_YO } as User) : null)
		}
	};
	return load(evento as unknown as Parameters<typeof load>[0]);
}

describe('load de mis partidos', () => {
	it('criterio de la 1.1: el partido registrado aparece pendiente', async () => {
		const datos = await cargar('http://localhost/matchs?enregistre');
		expect(datos).toMatchObject({
			recienRegistrado: true,
			partidos: {
				ok: true,
				datos: [{ id: 1, estado: 'pendiente', rival: 'Rival Prueba', resultado: 'victoria' }]
			}
		});
	});

	it('sin ?enregistre no hay aviso', async () => {
		expect(await cargar('http://localhost/matchs')).toMatchObject({ recienRegistrado: false });
	});

	it('sin sesión vuelve al inicio', async () => {
		await expect(cargar('http://localhost/matchs', false)).rejects.toMatchObject({
			status: 303,
			location: '/'
		});
	});
});

/** Envía el formulario de respuesta como lo haría el navegador. */
function responder(campos: Record<string, string>, cliente = clienteFalso(), conectado = true) {
	const cuerpo = new FormData();
	for (const [campo, valor] of Object.entries(campos)) cuerpo.set(campo, valor);
	const evento = {
		request: new Request('http://localhost/matchs?/repondre', { method: 'POST', body: cuerpo }),
		locals: {
			supabase: cliente.cliente,
			errorConfig: null,
			obtenerUsuario: () => Promise.resolve(conectado ? ({ id: ID_RIVAL } as User) : null)
		}
	};
	return actions.repondre(evento as unknown as Parameters<typeof actions.repondre>[0]);
}

describe('action repondre', () => {
	it('criterio de la 1.2: confirmar llama a responder_partido', async () => {
		const cliente = clienteFalso();
		expect(await responder({ partido: '1', respuesta: 'confirmado' }, cliente)).toEqual({
			respondido: 'confirmado'
		});
		expect(cliente.llamadasRpc).toEqual([
			['responder_partido', { p_partido: 1, p_respuesta: 'confirmado' }]
		]);
	});

	it('criterio de la 1.2: rechazar', async () => {
		const cliente = clienteFalso();
		expect(await responder({ partido: '1', respuesta: 'rechazado' }, cliente)).toEqual({
			respondido: 'rechazado'
		});
		expect(cliente.llamadasRpc[0]?.[1]).toEqual({ p_partido: 1, p_respuesta: 'rechazado' });
	});

	it('id de partido no válido: no llama a la base de datos', async () => {
		for (const partido of ['', 'abc', '0', '-3', '1.5']) {
			const cliente = clienteFalso();
			const resultado = await responder({ partido, respuesta: 'confirmado' }, cliente);
			expect(resultado).toMatchObject({ status: 400, data: { partido: null } });
			expect(cliente.llamadasRpc).toEqual([]);
		}
	});

	it('respuesta desconocida o ausente: no llama a la base de datos', async () => {
		const casos: Record<string, string>[] = [
			{ partido: '1', respuesta: 'pendiente' },
			{ partido: '1' }
		];
		for (const campos of casos) {
			const cliente = clienteFalso();
			expect(await responder(campos, cliente)).toMatchObject({
				status: 400,
				data: { partido: 1 }
			});
			expect(cliente.llamadasRpc).toEqual([]);
		}
	});

	it('muestra el error de la base de datos (p. ej. ya respondido)', async () => {
		const cliente = clienteFalso({
			data: null,
			error: { message: 'Ce match a déjà reçu une réponse.' }
		});
		expect(await responder({ partido: '1', respuesta: 'confirmado' }, cliente)).toMatchObject({
			status: 400,
			data: {
				partido: 1,
				error: 'Impossible de répondre au match : Ce match a déjà reçu une réponse.'
			}
		});
	});

	it('sin sesión vuelve al inicio', async () => {
		await expect(
			responder({ partido: '1', respuesta: 'confirmado' }, clienteFalso(), false)
		).rejects.toMatchObject({ status: 303, location: '/' });
	});
});
