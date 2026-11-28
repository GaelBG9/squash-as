import { describe, it, expect } from 'vitest';
import type { User } from '@supabase/supabase-js';
import type { EstadoPerfil } from '#lib/perfil.ts';
import type { ClienteSupabase } from '#lib/supabase.ts';
import { actions, load } from './+page.server.ts';

const ANA = { id: 'a', nombre: 'Ana Prueba' };
const BEA = { id: 'b', nombre: 'Bea Prueba' };

const FILA_TORNEO = {
	id: 1,
	nombre: 'Open de printemps',
	fecha: '2027-03-15',
	temporada: '2026-2027',
	inscripciones: [{ jugadores: BEA }]
};

function perfil(rol: 'jugador' | 'admin'): EstadoPerfil {
	return {
		estado: 'conectado',
		jugador: { nombre: 'Prueba', grupo: 1, rol, rating: 1500, rd: 350 }
	};
}

/**
 * Cliente falso: la consulta a `torneos` devuelve `filaTorneo` y la de `jugadores`,
 * Ana y Bea. Apunta las tablas consultadas y las llamadas a `rpc`.
 */
function clienteFalso(
	filaTorneo: unknown = FILA_TORNEO,
	respuestaRpc: { data: unknown; error: { message: string } | null } = { data: null, error: null }
) {
	const tablas: string[] = [];
	const llamadasRpc: unknown[][] = [];
	let tabla = '';
	const consulta: Record<string, (...argumentos: unknown[]) => unknown> = {};
	for (const metodo of ['select', 'eq', 'order', 'maybeSingle']) consulta[metodo] = () => consulta;
	consulta.from = (nombre) => {
		tabla = String(nombre);
		tablas.push(tabla);
		return consulta;
	};
	consulta.overrideTypes = () =>
		Promise.resolve({ data: tabla === 'torneos' ? filaTorneo : [ANA, BEA], error: null });
	consulta.rpc = (...argumentos) => {
		llamadasRpc.push(argumentos);
		return Promise.resolve(respuestaRpc);
	};
	return { cliente: consulta as unknown as ClienteSupabase, tablas, llamadasRpc };
}

function locals(cliente: ClienteSupabase, conectado = true): App.Locals {
	return {
		supabase: cliente,
		errorConfig: null,
		obtenerUsuario: () => Promise.resolve(conectado ? ({ id: 'yo' } as User) : null)
	};
}

function cargar(id: string, estadoPerfil: EstadoPerfil, falso = clienteFalso(), direccion = '') {
	const evento = {
		params: { id },
		url: new URL(`http://localhost/tournois/${id}${direccion}`),
		locals: locals(falso.cliente),
		parent: () => Promise.resolve({ perfil: estadoPerfil, errorConfig: null })
	};
	return load(evento as unknown as Parameters<typeof load>[0]);
}

describe('load de un torneo', () => {
	it('un jugador ve los inscritos, sin controles ni lista de jugadores', async () => {
		const falso = clienteFalso();
		expect(await cargar('1', perfil('jugador'), falso)).toMatchObject({
			torneo: { ok: true, datos: { nombre: 'Open de printemps', inscritos: [BEA] } },
			esAdmin: false,
			inscribibles: null,
			recienCreado: false
		});
		expect(falso.tablas).toEqual(['torneos']);
	});

	it('el admin ve a quién puede inscribir: todos menos los ya inscritos', async () => {
		expect(await cargar('1', perfil('admin'), clienteFalso(), '?cree')).toMatchObject({
			esAdmin: true,
			inscribibles: { ok: true, datos: [ANA] },
			recienCreado: true
		});
	});

	it('torneo que no existe → 404', async () => {
		await expect(cargar('99', perfil('jugador'), clienteFalso(null))).rejects.toMatchObject({
			status: 404
		});
	});

	it.each(['abc', '0', '-1', '1.5'])('id no válido "%s" → 404 sin consultar', async (id) => {
		const falso = clienteFalso();
		await expect(cargar(id, perfil('jugador'), falso)).rejects.toMatchObject({ status: 404 });
		expect(falso.tablas).toEqual([]);
	});
});

function enviar(
	accion: 'inscrire' | 'desinscrire',
	campos: Record<string, string>,
	falso = clienteFalso(),
	id = '1'
) {
	const cuerpo = new FormData();
	for (const [campo, valor] of Object.entries(campos)) cuerpo.set(campo, valor);
	const evento = {
		params: { id },
		request: new Request(`http://localhost/tournois/${id}?/${accion}`, {
			method: 'POST',
			body: cuerpo
		}),
		locals: locals(falso.cliente)
	};
	return actions[accion](evento as unknown as Parameters<(typeof actions)['inscrire']>[0]);
}

describe('actions inscrire / desinscrire', () => {
	it('inscribir llama a inscribir_jugador', async () => {
		const falso = clienteFalso();
		expect(await enviar('inscrire', { jugador: 'a' }, falso)).toEqual({
			accion: 'inscribir',
			hecho: true
		});
		expect(falso.llamadasRpc).toEqual([['inscribir_jugador', { p_torneo: 1, p_jugador: 'a' }]]);
	});

	it('desinscribir llama a desinscribir_jugador', async () => {
		const falso = clienteFalso();
		await enviar('desinscrire', { jugador: 'b' }, falso);
		expect(falso.llamadasRpc).toEqual([['desinscribir_jugador', { p_torneo: 1, p_jugador: 'b' }]]);
	});

	it('sin jugador elegido: error sin llamar a la base de datos', async () => {
		const falso = clienteFalso();
		expect(await enviar('inscrire', {}, falso)).toMatchObject({
			status: 400,
			data: { error: 'Choisis un joueur.' }
		});
		expect(falso.llamadasRpc).toEqual([]);
	});

	it('criterio de la 2.1: el 17.º jugador es rechazado con el mensaje de la base de datos', async () => {
		const falso = clienteFalso(FILA_TORNEO, {
			data: null,
			error: { message: 'Le tableau est complet (16 joueurs au maximum).' }
		});
		expect(await enviar('inscrire', { jugador: 'a' }, falso)).toMatchObject({
			status: 400,
			data: {
				accion: 'inscribir',
				error: 'Impossible d’inscrire le joueur : Le tableau est complet (16 joueurs au maximum).'
			}
		});
	});

	it('id de torneo no válido → 404', async () => {
		await expect(enviar('inscrire', { jugador: 'a' }, clienteFalso(), 'abc')).rejects.toMatchObject(
			{ status: 404 }
		);
	});
});
