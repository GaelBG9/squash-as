import { describe, it, expect } from 'vitest';
import type { User } from '@supabase/supabase-js';
import type { ClienteSupabase } from '#lib/supabase.ts';
import { actions, load } from './+page.server.ts';

const ID_YO = '00000000-0000-4000-8000-0000000011d1';
const ID_RIVAL = '00000000-0000-4000-8000-0000000011d2';

/** Cliente falso: apunta las llamadas a `rpc` y responde con `respuestaRpc`. */
function clienteFalso(respuestaRpc: { data: unknown; error: { message: string } | null }) {
	const llamadasRpc: unknown[][] = [];
	const consulta: Record<string, (...argumentos: unknown[]) => unknown> = {};
	for (const metodo of ['from', 'select', 'neq', 'order']) consulta[metodo] = () => consulta;
	consulta.overrideTypes = () =>
		Promise.resolve({ data: [{ id: ID_RIVAL, nombre: 'Rival Prueba' }], error: null });
	consulta.rpc = (...argumentos) => {
		llamadasRpc.push(argumentos);
		return Promise.resolve(respuestaRpc);
	};
	return { cliente: consulta as unknown as ClienteSupabase, llamadasRpc };
}

function locals(cliente: ClienteSupabase | null, conectado = true): App.Locals {
	return {
		supabase: cliente,
		errorConfig: null,
		obtenerUsuario: () => Promise.resolve(conectado ? ({ id: ID_YO } as User) : null)
	};
}

/** El partido del criterio de la 1.1: 3-1 (11-7, 9-11, 11-5, 11-8) al mejor de 5. */
const PARTIDO_CRITERIO: Record<string, string> = {
	rival: ID_RIVAL,
	fecha: '2026-11-20',
	formato: 'mejor_de_5',
	juego_1_a: '11',
	juego_1_b: '7',
	juego_2_a: '9',
	juego_2_b: '11',
	juego_3_a: '11',
	juego_3_b: '5',
	juego_4_a: '11',
	juego_4_b: '8',
	juego_5_a: '',
	juego_5_b: ''
};

/** Envía el formulario a la acción y devuelve su respuesta (o la redirección que lanza). */
async function enviar(campos: Record<string, string>, l: App.Locals) {
	const formulario = new FormData();
	for (const [campo, valor] of Object.entries(campos)) formulario.set(campo, valor);
	const evento = {
		request: new Request('http://localhost/matchs/nouveau', { method: 'POST', body: formulario }),
		locals: l
	};
	try {
		return await actions.default(evento as unknown as Parameters<typeof actions.default>[0]);
	} catch (lanzado) {
		// `redirect()` de SvelteKit no devuelve: lanza un objeto con `status` y `location`.
		return lanzado;
	}
}

describe('formulario de nuevo partido', () => {
	it('criterio de la 1.1: registra el 3-1 y vuelve a la lista', async () => {
		const { cliente, llamadasRpc } = clienteFalso({ data: 1, error: null });
		const respuesta = await enviar(PARTIDO_CRITERIO, locals(cliente));
		expect(respuesta).toMatchObject({ status: 303, location: '/matchs?enregistre' });
		expect(llamadasRpc).toEqual([
			[
				'registrar_partido',
				{
					p_rival: ID_RIVAL,
					p_fecha: '2026-11-20',
					p_formato: 'mejor_de_5',
					p_juegos: [
						{ a: 11, b: 7 },
						{ a: 9, b: 11 },
						{ a: 11, b: 5 },
						{ a: 11, b: 8 }
					]
				}
			]
		]);
	});

	it.each<[string, Record<string, string>, string, string]>([
		['sin rival', { rival: '' }, 'rival', 'Choisis ton adversaire.'],
		['contra uno mismo', { rival: ID_YO }, 'rival', 'Choisis un adversaire autre que toi.'],
		['fecha futura', { fecha: '2999-01-01' }, 'fecha', 'futur'],
		['sin fecha', { fecha: '' }, 'fecha', 'Indique la date'],
		['formato desconocido', { formato: 'mejor_de_7' }, 'formato', 'format'],
		['juego empatado', { juego_2_b: '9' }, 'juegos', 'Jeu 2 : il faut un gagnant'],
		['partido sin terminar', { juego_4_a: '', juego_4_b: '' }, 'juegos', 'pas terminé'],
		['un solo lado', { juego_5_a: '11' }, 'juegos', 'Jeu 5 : indique les points']
	])('no registra nada si hay un error: %s', async (_nombre, cambios, campo, mensaje) => {
		const { cliente, llamadasRpc } = clienteFalso({ data: 1, error: null });
		const respuesta = await enviar({ ...PARTIDO_CRITERIO, ...cambios }, locals(cliente));
		expect(respuesta).toMatchObject({ status: 400 });
		const { errores, valores } = (
			respuesta as { data: { errores: Record<string, string>; valores: Record<string, string> } }
		).data;
		expect(errores[campo]).toContain(mensaje);
		// Lo escrito vuelve al formulario.
		expect(valores.juego_1_a).toBe('11');
		expect(llamadasRpc).toEqual([]);
	});

	it('muestra el error de la base de datos', async () => {
		const { cliente } = clienteFalso({
			data: null,
			error: { message: 'Cet adversaire n’existe pas.' }
		});
		const respuesta = await enviar(PARTIDO_CRITERIO, locals(cliente));
		expect(respuesta).toMatchObject({
			status: 400,
			data: {
				errores: { general: 'Impossible d’enregistrer le match : Cet adversaire n’existe pas.' }
			}
		});
	});

	it('sin sesión vuelve al inicio sin registrar nada', async () => {
		const { cliente, llamadasRpc } = clienteFalso({ data: 1, error: null });
		const respuesta = await enviar(PARTIDO_CRITERIO, locals(cliente, false));
		expect(respuesta).toMatchObject({ status: 303, location: '/' });
		expect(llamadasRpc).toEqual([]);
	});
});

describe('load del formulario', () => {
	const cargar = (l: App.Locals) =>
		load({
			locals: l,
			url: new URL('http://localhost/matchs/nouveau')
		} as unknown as Parameters<typeof load>[0]);

	it('da los rivales y la fecha de hoy', async () => {
		const { cliente } = clienteFalso({ data: null, error: null });
		const datos = await cargar(locals(cliente));
		expect(datos).toMatchObject({
			torneo: null,
			rivales: { ok: true, datos: [{ id: ID_RIVAL, nombre: 'Rival Prueba' }] }
		});
		expect((datos as { hoy: string }).hoy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it('sin sesión o sin Supabase vuelve al inicio', async () => {
		const { cliente } = clienteFalso({ data: null, error: null });
		await expect(cargar(locals(cliente, false))).rejects.toMatchObject({
			status: 303,
			location: '/'
		});
		await expect(cargar(locals(null))).rejects.toMatchObject({ status: 303, location: '/' });
	});
});

describe('partido de torneo (R19)', () => {
	const PARTIDO_TORNEO = {
		...PARTIDO_CRITERIO,
		torneo: '7',
		formato: 'mejor_de_3',
		juego_3_a: '',
		juego_3_b: '',
		juego_4_a: '',
		juego_4_b: '',
		juego_2_a: '11',
		juego_2_b: '9'
	};

	it('registra el partido con el torneo y vuelve al cuadro', async () => {
		const { cliente, llamadasRpc } = clienteFalso({ data: 5, error: null });
		const respuesta = await enviar(PARTIDO_TORNEO, locals(cliente));
		expect(respuesta).toMatchObject({ status: 303, location: '/tournois/7?enregistre' });
		expect(llamadasRpc).toEqual([
			[
				'registrar_partido',
				{
					p_rival: ID_RIVAL,
					p_fecha: '2026-11-20',
					p_formato: 'mejor_de_3',
					p_juegos: [
						{ a: 11, b: 7 },
						{ a: 11, b: 9 }
					],
					p_torneo: 7
				}
			]
		]);
	});

	it('no acepta el formato libre en un torneo', async () => {
		const { cliente, llamadasRpc } = clienteFalso({ data: 5, error: null });
		const respuesta = await enviar({ ...PARTIDO_TORNEO, formato: 'libre' }, locals(cliente));
		expect(respuesta).toMatchObject({
			status: 400,
			data: { errores: { formato: 'Un match de tournoi se joue au meilleur des 3 ou des 5 jeux.' } }
		});
		expect(llamadasRpc).toEqual([]);
	});

	it('un torneo que no es un número no registra nada', async () => {
		const { cliente, llamadasRpc } = clienteFalso({ data: 5, error: null });
		const respuesta = await enviar({ ...PARTIDO_TORNEO, torneo: 'abc' }, locals(cliente));
		expect(respuesta).toMatchObject({
			status: 400,
			data: { errores: { general: 'Tournoi introuvable.' } }
		});
		expect(llamadasRpc).toEqual([]);
	});

	it('muestra el error de la base de datos (cruce ya registrado)', async () => {
		const { cliente } = clienteFalso({
			data: null,
			error: { message: 'Ce match du tableau est déjà enregistré.' }
		});
		const respuesta = await enviar(PARTIDO_TORNEO, locals(cliente));
		expect(respuesta).toMatchObject({
			status: 400,
			data: {
				errores: {
					general: 'Impossible d’enregistrer le match : Ce match du tableau est déjà enregistré.'
				}
			}
		});
	});

	describe('load con ?tournoi=…&adversaire=…', () => {
		const YO = { id: ID_YO, nombre: 'Yo Prueba' };
		const RIVAL = { id: ID_RIVAL, nombre: 'Rival Prueba' };
		const OTRO = { id: 'otro', nombre: 'Otro Prueba' };
		// Semifinal: yo (posición 1) contra el rival (posición 2); el otro, en el cruce 2.
		const PLAZAS = [
			{ ronda: 3, posicion: 1, jugador: YO },
			{ ronda: 3, posicion: 2, jugador: RIVAL },
			{ ronda: 3, posicion: 3, jugador: OTRO }
		];

		/** Cliente falso: `torneos` devuelve el torneo 7 (o `null`) y `cuadros`, las plazas. */
		function clienteTorneo(filaTorneo: unknown) {
			let tabla = '';
			const consulta: Record<string, (...argumentos: unknown[]) => unknown> = {};
			for (const metodo of ['select', 'eq', 'order', 'maybeSingle', 'neq']) {
				consulta[metodo] = () => consulta;
			}
			consulta.from = (nombre) => {
				tabla = String(nombre);
				return consulta;
			};
			consulta.overrideTypes = () =>
				Promise.resolve({ data: tabla === 'torneos' ? filaTorneo : PLAZAS, error: null });
			return consulta as unknown as ClienteSupabase;
		}

		const FILA = {
			id: 7,
			nombre: 'Open de printemps',
			fecha: '2026-11-01',
			temporada: '2026-2027',
			inscripciones: []
		};

		function cargar(cliente: ClienteSupabase, busqueda: string) {
			return load({
				locals: locals(cliente),
				url: new URL(`http://localhost/matchs/nouveau${busqueda}`)
			} as unknown as Parameters<typeof load>[0]);
		}

		it('da el torneo, la ronda y el rival, sin la lista de rivales', async () => {
			const datos = await cargar(clienteTorneo(FILA), `?tournoi=7&adversaire=${ID_RIVAL}`);
			expect(datos).toMatchObject({
				rivales: null,
				torneo: {
					ok: true,
					datos: { id: 7, nombre: 'Open de printemps', ronda: 'Demi-finales', rival: RIVAL }
				}
			});
		});

		it.each([
			['un jugador contra el que no juego', '?tournoi=7&adversaire=otro'],
			['sin adversario', '?tournoi=7']
		])('error si me paso %s', async (_nombre, busqueda) => {
			expect(await cargar(clienteTorneo(FILA), busqueda)).toMatchObject({
				torneo: { ok: false, error: 'Vous ne vous affrontez pas dans le tableau de ce tournoi.' }
			});
		});

		it.each([
			['un torneo que no existe', clienteTorneo(null), '?tournoi=8&adversaire=x'],
			['un id que no es un número', clienteTorneo(FILA), '?tournoi=abc']
		])('error con %s', async (_nombre, cliente, busqueda) => {
			expect(await cargar(cliente, busqueda)).toMatchObject({
				torneo: { ok: false, error: 'Tournoi introuvable.' }
			});
		});
	});
});
