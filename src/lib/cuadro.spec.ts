import { describe, it, expect } from 'vitest';
import {
	ORDEN_CABEZAS,
	cabezaDePosicion,
	cambiarCuadro,
	construirCuadro,
	generarPlazas,
	leerCuadro,
	type Plaza
} from './cuadro.ts';
import type { ClienteSupabase } from './supabase.ts';
import type { Inscrito } from './torneos.ts';

/** N jugadores de prueba ya ordenados: el jugador "j1" es el cabeza 1. */
function jugadores(n: number): Inscrito[] {
	return Array.from({ length: n }, (_, i) => ({ id: `j${i + 1}`, nombre: `Joueur ${i + 1}` }));
}

function cuadroCon(n: number) {
	return construirCuadro(generarPlazas(jugadores(n)));
}

/** Ids de los jugadores que ya ocupan una plaza de la ronda dada. */
function enRonda(plazas: Plaza[], ronda: number) {
	return plazas.filter((p) => p.ronda === ronda && p.jugador).map((p) => p.jugador?.id);
}

describe('orden de los cabezas de serie', () => {
	it('contiene cada cabeza del 1 al 16 una vez', () => {
		expect([...ORDEN_CABEZAS].sort((a, b) => a - b)).toEqual(
			Array.from({ length: 16 }, (_, i) => i + 1)
		);
	});

	it('cada cabeza k se enfrenta al 17 - k en primera ronda', () => {
		for (let p = 0; p < 16; p += 2) {
			expect(ORDEN_CABEZAS[p] + ORDEN_CABEZAS[p + 1]).toBe(17);
		}
	});

	it('el 1 está en la mitad de arriba y el 2 en la de abajo: solo se cruzan en la final', () => {
		expect(cabezaDePosicion(1)).toBe(1);
		expect(ORDEN_CABEZAS.indexOf(2)).toBeGreaterThanOrEqual(8);
	});

	it('los cabezas 1 a 4 están en cuartos distintos del cuadro', () => {
		const cuarto = (cabeza: number) => Math.floor(ORDEN_CABEZAS.indexOf(cabeza as 1) / 4);
		expect(new Set([1, 2, 3, 4].map(cuarto)).size).toBe(4);
	});

	it('una posición fuera del cuadro da error', () => {
		expect(() => cabezaDePosicion(17)).toThrow(RangeError);
	});
});

describe('generarPlazas y construirCuadro (R16, R18, historia 5)', () => {
	it('16 inscritos: 8 partidos en primera ronda y nadie pasa solo', () => {
		const plazas = generarPlazas(jugadores(16));
		expect(plazas).toHaveLength(16);
		const [primera, cuartos] = construirCuadro(plazas);
		expect(primera.cruces.filter((c) => c.estado === 'partido')).toHaveLength(8);
		expect(cuartos.cruces.every((c) => c.estado === 'por_decidir')).toBe(true);
	});

	it('16 inscritos: el cabeza 1 juega contra el 16 y el 8 contra el 9', () => {
		const [primera] = cuadroCon(16);
		const cabezas = primera.cruces.map((c) =>
			[c.arriba, c.abajo].map((l) => (l.tipo === 'jugador' ? l.cabeza : null))
		);
		expect(cabezas[0]).toEqual([1, 16]);
		expect(cabezas[1]).toEqual([8, 9]);
		expect(cabezas[7]).toEqual([2, 15]);
	});

	it('12 inscritos: los cabezas 1 a 4 pasan solos a cuartos y hay 4 partidos', () => {
		const plazas = generarPlazas(jugadores(12));
		expect(enRonda(plazas, 2).sort()).toEqual(['j1', 'j2', 'j3', 'j4']);
		const [primera] = construirCuadro(plazas);
		expect(primera.cruces.filter((c) => c.estado === 'partido')).toHaveLength(4);
		expect(primera.cruces.filter((c) => c.estado === 'exento')).toHaveLength(4);
	});

	it('12 inscritos: cada exento pasa a la plaza p de cuartos (como en el SQL)', () => {
		const cuartos = generarPlazas(jugadores(12)).filter((p) => p.ronda === 2);
		expect(cuartos.map((p) => [p.posicion, p.jugador?.id])).toEqual([
			[1, 'j1'],
			[4, 'j4'],
			[5, 'j3'],
			[8, 'j2']
		]);
	});

	it('9 inscritos: un solo partido en primera ronda (8 contra 9)', () => {
		const plazas = generarPlazas(jugadores(9));
		const [primera, cuartos] = construirCuadro(plazas);
		const partidos = primera.cruces.filter((c) => c.estado === 'partido');
		expect(partidos).toHaveLength(1);
		expect(partidos[0].arriba).toMatchObject({ cabeza: 8 });
		expect(partidos[0].abajo).toMatchObject({ cabeza: 9 });
		// El cabeza 1 espera en cuartos al ganador de 8 contra 9.
		expect(cuartos.cruces[0]).toMatchObject({
			arriba: { tipo: 'jugador', cabeza: 1 },
			abajo: { tipo: 'por_decidir' }
		});
	});

	it('2 inscritos: pasan solos hasta la final, uno contra otro', () => {
		const plazas = generarPlazas(jugadores(2));
		expect(plazas).toHaveLength(16 + 8 + 4 + 2);
		const final = construirCuadro(plazas)[3];
		expect(final.nombre).toBe('Finale');
		expect(final.cruces).toEqual([
			{
				arriba: { tipo: 'jugador', jugador: jugadores(2)[0], cabeza: 1 },
				abajo: { tipo: 'jugador', jugador: jugadores(2)[1], cabeza: 2 },
				estado: 'partido'
			}
		]);
	});

	it('5 inscritos: dos plazas vacías juntas dejan vacía la siguiente', () => {
		const [primera, cuartos, semis] = cuadroCon(5);
		// 8 contra 9, 6 contra 11 y 7 contra 10: los seis cabezas no existen.
		expect(primera.cruces.filter((c) => c.estado === 'vacio')).toHaveLength(3);
		// En cuartos, el 1 espera al 8-9 (vacío): pasa solo a semifinales.
		expect(cuartos.cruces[0].estado).toBe('exento');
		// El 4 contra el 5 es el único partido de verdad.
		expect(cuartos.cruces.filter((c) => c.estado === 'partido')).toHaveLength(1);
		expect(semis.cruces[0]).toMatchObject({
			arriba: { tipo: 'jugador', cabeza: 1 },
			abajo: { tipo: 'por_decidir' }
		});
	});

	it('menos de 2 o más de 16 inscritos da error', () => {
		expect(() => generarPlazas(jugadores(1))).toThrow(RangeError);
		expect(() => generarPlazas(jugadores(17))).toThrow(RangeError);
	});

	it('sin plazas (cuadro aún no generado), todo está por decidir', () => {
		const rondas = construirCuadro([]);
		expect(rondas.map((r) => r.cruces.length)).toEqual([8, 4, 2, 1]);
		expect(rondas.every((r) => r.cruces.every((c) => c.estado === 'por_decidir'))).toBe(true);
	});
});

describe('acceso a Supabase', () => {
	function clienteFalso(respuesta: { data: unknown; error: { message: string } | null }) {
		const llamadas: unknown[][] = [];
		const consulta: Record<string, (...argumentos: unknown[]) => unknown> = {};
		for (const metodo of ['from', 'select', 'eq', 'order']) {
			consulta[metodo] = (...argumentos) => {
				llamadas.push([metodo, ...argumentos]);
				return consulta;
			};
		}
		consulta.overrideTypes = () => Promise.resolve(respuesta);
		consulta.rpc = (...argumentos) => {
			llamadas.push(['rpc', ...argumentos]);
			return Promise.resolve(respuesta);
		};
		return { cliente: consulta as unknown as ClienteSupabase, llamadas };
	}

	it('leerCuadro lee el cuadro principal del torneo', async () => {
		const plaza = { ronda: 1, posicion: 1, jugador: jugadores(1)[0] };
		const { cliente, llamadas } = clienteFalso({ data: [plaza], error: null });
		expect(await leerCuadro(cliente, 7)).toEqual({ ok: true, datos: [plaza] });
		expect(llamadas).toContainEqual(['from', 'cuadros']);
		expect(llamadas).toContainEqual(['eq', 'torneo', 7]);
		expect(llamadas).toContainEqual(['eq', 'cuadro', 'principal']);
	});

	it('leerCuadro devuelve el error en francés', async () => {
		const { cliente } = clienteFalso({ data: null, error: { message: 'boom' } });
		expect(await leerCuadro(cliente, 7)).toEqual({
			ok: false,
			error: 'Impossible de lire le tableau : boom'
		});
	});

	it('cambiarCuadro llama a generar_cuadro o borrar_cuadro', async () => {
		const { cliente, llamadas } = clienteFalso({ data: null, error: null });
		expect(await cambiarCuadro(cliente, 'generar', 7)).toEqual({ ok: true, datos: null });
		expect(await cambiarCuadro(cliente, 'borrar', 7)).toEqual({ ok: true, datos: null });
		expect(llamadas).toEqual([
			['rpc', 'generar_cuadro', { p_torneo: 7 }],
			['rpc', 'borrar_cuadro', { p_torneo: 7 }]
		]);
	});

	it('cambiarCuadro devuelve el mensaje de la base de datos', async () => {
		const { cliente } = clienteFalso({
			data: null,
			error: { message: 'Le tableau est déjà généré.' }
		});
		expect(await cambiarCuadro(cliente, 'generar', 7)).toEqual({
			ok: false,
			error: 'Impossible de générer le tableau : Le tableau est déjà généré.'
		});
	});
});
