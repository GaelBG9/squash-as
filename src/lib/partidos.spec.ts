import { describe, it, expect } from 'vitest';
import {
	desdeMiPunto,
	fechaCorta,
	leerMisPartidos,
	leerRivales,
	esRespuesta,
	registrarPartido,
	responderPartido,
	textoEstado,
	textoFormato,
	textoMarcador,
	textoResultado,
	type FilaPartido
} from './partidos.ts';
import type { ClienteSupabase } from './supabase.ts';

const ID_YO = '00000000-0000-4000-8000-0000000011c1';
const ID_RIVAL = '00000000-0000-4000-8000-0000000011c2';

type Respuesta = { data: unknown; error: { message: string } | null };

/**
 * Cliente falso: cada método de consulta (`from`, `select`, `eq`, `order`...) se apunta
 * en `llamadas` y devuelve la misma consulta; `overrideTypes()` y `rpc()` dan la respuesta.
 */
function clienteFalso(respuesta: () => Promise<Respuesta>) {
	const llamadas: { metodo: string; argumentos: unknown[] }[] = [];
	const consulta: Record<string, (...argumentos: unknown[]) => unknown> = {};
	for (const metodo of ['from', 'select', 'eq', 'neq', 'or', 'order']) {
		consulta[metodo] = (...argumentos) => {
			llamadas.push({ metodo, argumentos });
			return consulta;
		};
	}
	consulta.overrideTypes = () => respuesta();
	consulta.rpc = (...argumentos) => {
		llamadas.push({ metodo: 'rpc', argumentos });
		return respuesta();
	};
	return { cliente: consulta as unknown as ClienteSupabase, llamadas };
}

const datos = (data: unknown) => () => Promise.resolve({ data, error: null });
const errorSupabase = () =>
	Promise.resolve({ data: null, error: { message: 'permission denied' } });
const redCaida = () => Promise.reject(new Error('fetch failed'));

describe('registrarPartido', () => {
	const registro = {
		rival: ID_RIVAL,
		fecha: '2026-11-27',
		formato: 'mejor_de_5' as const,
		juegos: [
			{ a: 11, b: 7 },
			{ a: 9, b: 11 },
			{ a: 11, b: 5 },
			{ a: 11, b: 8 }
		]
	};

	it('llama a la función registrar_partido con el marcador', async () => {
		const { cliente, llamadas } = clienteFalso(datos(42));
		expect(await registrarPartido(cliente, registro)).toEqual({ ok: true, datos: 42 });
		expect(llamadas).toEqual([
			{
				metodo: 'rpc',
				argumentos: [
					'registrar_partido',
					{
						p_rival: ID_RIVAL,
						p_fecha: '2026-11-27',
						p_formato: 'mejor_de_5',
						p_juegos: registro.juegos
					}
				]
			}
		]);
	});

	it('devuelve el mensaje de la base de datos si rechaza el partido', async () => {
		const { cliente } = clienteFalso(() =>
			Promise.resolve({ data: null, error: { message: 'Le match n’est pas terminé' } })
		);
		const resultado = await registrarPartido(cliente, registro);
		expect(resultado).toEqual({
			ok: false,
			error: 'Impossible d’enregistrer le match : Le match n’est pas terminé'
		});
	});

	it('no lanza excepción si la red falla', async () => {
		const { cliente } = clienteFalso(redCaida);
		const resultado = await registrarPartido(cliente, registro);
		expect(resultado.ok).toBe(false);
		if (!resultado.ok) expect(resultado.error).toContain('fetch failed');
	});
});

describe('responderPartido', () => {
	it('llama a la función responder_partido', async () => {
		const { cliente, llamadas } = clienteFalso(datos(null));
		expect(await responderPartido(cliente, 7, 'confirmado')).toEqual({ ok: true, datos: null });
		expect(llamadas).toEqual([
			{
				metodo: 'rpc',
				argumentos: ['responder_partido', { p_partido: 7, p_respuesta: 'confirmado' }]
			}
		]);
	});

	it('devuelve el mensaje de la base de datos si rechaza la respuesta', async () => {
		const { cliente } = clienteFalso(() =>
			Promise.resolve({ data: null, error: { message: 'Ce match a déjà reçu une réponse.' } })
		);
		expect(await responderPartido(cliente, 7, 'rechazado')).toEqual({
			ok: false,
			error: 'Impossible de répondre au match : Ce match a déjà reçu une réponse.'
		});
	});

	it('no lanza excepción si la red falla', async () => {
		const resultado = await responderPartido(clienteFalso(redCaida).cliente, 7, 'confirmado');
		expect(resultado.ok).toBe(false);
		if (!resultado.ok) expect(resultado.error).toContain('fetch failed');
	});

	it('solo acepta confirmado o rechazado', () => {
		expect(esRespuesta('confirmado')).toBe(true);
		expect(esRespuesta('rechazado')).toBe(true);
		expect(esRespuesta('pendiente')).toBe(false);
		expect(esRespuesta(null)).toBe(false);
	});
});

describe('leerRivales', () => {
	it('lista a todos menos a mí, por nombre', async () => {
		const rivales = [{ id: ID_RIVAL, nombre: 'Rival Prueba' }];
		const { cliente, llamadas } = clienteFalso(datos(rivales));
		expect(await leerRivales(cliente, ID_YO)).toEqual({ ok: true, datos: rivales });
		expect(llamadas).toContainEqual({ metodo: 'from', argumentos: ['jugadores'] });
		expect(llamadas).toContainEqual({ metodo: 'neq', argumentos: ['id', ID_YO] });
		expect(llamadas).toContainEqual({ metodo: 'order', argumentos: ['nombre'] });
	});

	it('errores de Supabase y de red', async () => {
		expect((await leerRivales(clienteFalso(errorSupabase).cliente, ID_YO)).ok).toBe(false);
		expect((await leerRivales(clienteFalso(redCaida).cliente, ID_YO)).ok).toBe(false);
	});
});

/** Partido de prueba: el criterio de la 1.1, registrado por mí (A) contra el rival (B). */
function fila(cambios: Partial<FilaPartido> = {}): FilaPartido {
	return {
		id: 7,
		fecha: '2026-11-27',
		tipo: 'entrenamiento',
		formato: 'mejor_de_5',
		jugador_a: ID_YO,
		jugador_b: ID_RIVAL,
		ganador: ID_YO,
		estado: 'pendiente',
		registrado_por: ID_YO,
		registrado_en: '2026-11-27T18:00:00Z',
		respondido_en: null,
		// Desordenados a propósito: se ordenan por número.
		juegos: [
			{ numero: 3, puntos_a: 11, puntos_b: 5 },
			{ numero: 1, puntos_a: 11, puntos_b: 7 },
			{ numero: 4, puntos_a: 11, puntos_b: 8 },
			{ numero: 2, puntos_a: 9, puntos_b: 11 }
		],
		nombre_a: { nombre: 'Yo Prueba' },
		nombre_b: { nombre: 'Rival Prueba' },
		...cambios
	};
}

describe('desdeMiPunto', () => {
	it('si registré yo: mis puntos primero, victoria, pendiente', () => {
		expect(desdeMiPunto(fila(), ID_YO)).toEqual({
			id: 7,
			fecha: '2026-11-27',
			formato: 'mejor_de_5',
			estado: 'pendiente',
			rival: 'Rival Prueba',
			resultado: 'victoria',
			juegos: [
				{ a: 11, b: 7 },
				{ a: 9, b: 11 },
				{ a: 11, b: 5 },
				{ a: 11, b: 8 }
			],
			registradoPorMi: true,
			puedoResponder: false
		});
	});

	it('el mismo partido visto por el rival: le dan la vuelta al marcador', () => {
		const visto = desdeMiPunto(fila(), ID_RIVAL);
		expect(visto.rival).toBe('Yo Prueba');
		expect(visto.resultado).toBe('derrota');
		expect(visto.registradoPorMi).toBe(false);
		expect(visto.puedoResponder).toBe(true);
		expect(textoMarcador(visto.juegos)).toBe('1-3 · 7-11, 11-9, 5-11, 8-11');
	});

	it('criterio de la 1.2: quien registró no puede responder', () => {
		// Aunque fuera jugador B (no debería pasar, R13), si lo registré no respondo (R2).
		const registradoPorB = fila({ registrado_por: ID_RIVAL });
		expect(desdeMiPunto(registradoPorB, ID_RIVAL).puedoResponder).toBe(false);
		expect(desdeMiPunto(fila(), ID_YO).puedoResponder).toBe(false);
	});

	it('un partido ya confirmado o rechazado no se puede responder', () => {
		for (const estado of ['confirmado', 'rechazado'] as const) {
			const respondido = fila({ estado, respondido_en: '2026-11-28T10:00:00Z' });
			expect(desdeMiPunto(respondido, ID_RIVAL).puedoResponder).toBe(false);
		}
	});

	it('empate en formato libre', () => {
		const empate = fila({
			formato: 'libre',
			ganador: null,
			juegos: [
				{ numero: 1, puntos_a: 11, puntos_b: 9 },
				{ numero: 2, puntos_a: 4, puntos_b: 11 }
			]
		});
		expect(desdeMiPunto(empate, ID_YO).resultado).toBe('empate');
	});

	it('si no se puede leer el nombre del rival', () => {
		expect(desdeMiPunto(fila({ nombre_b: null }), ID_YO).rival).toBe('Joueur inconnu');
	});
});

describe('leerMisPartidos', () => {
	it('busca mis partidos como A o como B, los más recientes primero', async () => {
		const { cliente, llamadas } = clienteFalso(datos([fila()]));
		const resultado = await leerMisPartidos(cliente, ID_YO);
		expect(resultado.ok && resultado.datos.map((p) => p.id)).toEqual([7]);
		expect(llamadas).toContainEqual({ metodo: 'from', argumentos: ['partidos'] });
		expect(llamadas).toContainEqual({
			metodo: 'or',
			argumentos: [`jugador_a.eq.${ID_YO},jugador_b.eq.${ID_YO}`]
		});
		expect(llamadas).toContainEqual({
			metodo: 'order',
			argumentos: ['fecha', { ascending: false }]
		});
	});

	it('sin partidos devuelve una lista vacía', async () => {
		expect(await leerMisPartidos(clienteFalso(datos(null)).cliente, ID_YO)).toEqual({
			ok: true,
			datos: []
		});
	});

	it('errores de Supabase y de red', async () => {
		expect((await leerMisPartidos(clienteFalso(errorSupabase).cliente, ID_YO)).ok).toBe(false);
		expect((await leerMisPartidos(clienteFalso(redCaida).cliente, ID_YO)).ok).toBe(false);
	});
});

describe('textos de los partidos', () => {
	it('criterio de la 1.1: el partido se muestra pendiente', () => {
		expect(textoEstado('pendiente')).toBe('En attente de confirmation');
		expect(textoEstado('confirmado')).toBe('Confirmé');
		expect(textoEstado('rechazado')).toBe('Refusé');
	});

	it('marcador del criterio', () => {
		const juegos = [
			{ a: 11, b: 7 },
			{ a: 9, b: 11 },
			{ a: 11, b: 5 },
			{ a: 11, b: 8 }
		];
		expect(textoMarcador(juegos)).toBe('3-1 · 11-7, 9-11, 11-5, 11-8');
	});

	it('formatos, resultados y fecha', () => {
		expect(textoFormato('libre')).toContain('libres');
		expect(textoFormato('mejor_de_3')).toBe('Au meilleur des 3 jeux');
		expect(textoResultado('empate')).toBe('Égalité');
		expect(fechaCorta('2026-11-27')).toBe('27 nov. 2026');
	});
});
