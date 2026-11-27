import { describe, it, expect } from 'vitest';
import {
	construirClasificacion,
	hoyEnFrancia,
	leerFiltroGrupo,
	rdTrasInactividad,
	type FilaClasificacion
} from './clasificacion.ts';

const HOY = '2026-11-27';

/** Fecha `dias` días antes de HOY. */
function haceDias(dias: number): string {
	return new Date(Date.parse(`${HOY}T00:00:00Z`) - dias * 86_400_000).toISOString().slice(0, 10);
}

function fila(datos: Partial<FilaClasificacion> & Pick<FilaClasificacion, 'id'>) {
	return {
		nombre: `Jugador ${datos.id}`,
		grupo: 1,
		rating: 1500,
		rd: 50,
		volatilidad: 0.06,
		historial_rating: [{ fecha: haceDias(7) }],
		...datos
	} satisfies FilaClasificacion;
}

describe('rdTrasInactividad (mismos casos que supabase/tests/0008_glicko2.sql)', () => {
	it('sin partido anterior no cambia', () => {
		expect(rdTrasInactividad(50, 0.06, null, HOY)).toBe(50);
	});

	it('jugar cada semana no aumenta el RD', () => {
		expect(rdTrasInactividad(50, 0.06, haceDias(7), HOY)).toBe(50);
	});

	it('un año sin jugar (52 semanas vacías): 50 → 90,27', () => {
		expect(rdTrasInactividad(50, 0.06, haceDias(371), HOY)).toBeCloseTo(90.27, 2);
	});

	it('cerca del tope: 340 tras un año → 348,21', () => {
		expect(rdTrasInactividad(340, 0.06, haceDias(371), HOY)).toBeCloseTo(348.21, 2);
	});

	it('nunca pasa de 350', () => {
		expect(rdTrasInactividad(340, 0.06, haceDias(742), HOY)).toBe(350);
	});

	it('una fecha anterior al último partido no reduce el RD', () => {
		expect(rdTrasInactividad(50, 0.06, HOY, haceDias(30))).toBe(50);
	});
});

describe('construirClasificacion', () => {
	it('criterio de la 1.5: del rating más alto al más bajo', () => {
		const clasificacion = construirClasificacion(
			[
				fila({ id: 'b', rating: 1450 }),
				fila({ id: 'a', rating: 1620 }),
				fila({ id: 'c', rating: 1500 })
			],
			HOY
		);
		expect(clasificacion.map(({ puesto, id }) => [puesto, id])).toEqual([
			[1, 'a'],
			[2, 'c'],
			[3, 'b']
		]);
	});

	it('criterio de la 1.5: sin partido confirmado, no sale', () => {
		const clasificacion = construirClasificacion(
			[fila({ id: 'a' }), fila({ id: 'nuevo', historial_rating: [] })],
			HOY
		);
		expect(clasificacion.map(({ id }) => id)).toEqual(['a']);
	});

	it('sin jugadores: lista vacía', () => {
		expect(construirClasificacion([], HOY)).toEqual([]);
	});

	it('mismo rating: por orden alfabético', () => {
		const clasificacion = construirClasificacion(
			[
				fila({ id: '1', nombre: 'Zoé' }),
				fila({ id: '2', nombre: 'Élodie' }),
				fila({ id: '3', nombre: 'Bruno' })
			],
			HOY
		);
		expect(clasificacion.map(({ nombre }) => nombre)).toEqual(['Bruno', 'Élodie', 'Zoé']);
	});

	it('cuenta los partidos y toma el último, aunque vengan desordenados', () => {
		const [jugador] = construirClasificacion(
			[
				fila({
					id: 'a',
					historial_rating: [
						{ fecha: '2026-11-05' },
						{ fecha: '2026-11-20' },
						{ fecha: '2026-10-01' }
					]
				})
			],
			HOY
		);
		expect(jugador).toMatchObject({ partidos: 3, ultimoPartido: '2026-11-20' });
	});

	it('muestra el RD de hoy: crece si el jugador lleva tiempo sin jugar', () => {
		const [activo, inactivo] = construirClasificacion(
			[
				fila({ id: 'activo', rating: 1600, historial_rating: [{ fecha: haceDias(7) }] }),
				fila({ id: 'inactivo', rating: 1500, historial_rating: [{ fecha: haceDias(371) }] })
			],
			HOY
		);
		expect(activo.rd).toBe(50);
		expect(inactivo.rd).toBeCloseTo(90.27, 2);
	});

	it('filtro de grupo: solo ese grupo, puestos dentro del grupo, sin los que no tienen grupo', () => {
		const filas = [
			fila({ id: 'g1-alto', grupo: 1, rating: 1700 }),
			fila({ id: 'g2', grupo: 2, rating: 1600 }),
			fila({ id: 'sin-grupo', grupo: null, rating: 1550 }),
			fila({ id: 'g1-bajo', grupo: 1, rating: 1400 })
		];
		expect(construirClasificacion(filas, HOY, 2).map(({ puesto, id }) => [puesto, id])).toEqual([
			[1, 'g2']
		]);
		expect(construirClasificacion(filas, HOY, 1).map(({ id }) => id)).toEqual([
			'g1-alto',
			'g1-bajo'
		]);
		expect(construirClasificacion(filas, HOY).map(({ id }) => id)).toEqual([
			'g1-alto',
			'g2',
			'sin-grupo',
			'g1-bajo'
		]);
	});
});

describe('leerFiltroGrupo', () => {
	it.each([
		['1', 1],
		['2', 2],
		[null, null],
		['', null],
		['3', null],
		['tous', null]
	])('"%s" → %s', (valor, esperado) => {
		expect(leerFiltroGrupo(valor)).toBe(esperado);
	});
});

describe('hoyEnFrancia', () => {
	it('usa la hora de París: el 31 a las 23:30 UTC ya es día 1 en Francia', () => {
		expect(hoyEnFrancia(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
		expect(hoyEnFrancia(new Date('2026-07-15T12:00:00Z'))).toBe('2026-07-15');
	});
});
