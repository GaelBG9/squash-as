import { describe, it, expect } from 'vitest';
import {
	camposJuego,
	errorFecha,
	esFormato,
	hoyEnFrancia,
	leerJuegosDelFormulario,
	maxJuegos,
	validarMarcador,
	type Formato,
	type Juego
} from './marcador.ts';

/** "11-7, 9-11" → [{ a: 11, b: 7 }, { a: 9, b: 11 }] */
function juegos(texto: string): Juego[] {
	if (texto === '') return [];
	return texto.split(',').map((juego) => {
		const [a, b] = juego.trim().split('-').map(Number);
		return { a, b };
	});
}

describe('validarMarcador', () => {
	it('criterio de la 1.1: 3-1 (11-7, 9-11, 11-5, 11-8) al mejor de 5 lo gana A', () => {
		expect(validarMarcador('mejor_de_5', juegos('11-7, 9-11, 11-5, 11-8'))).toEqual({
			ok: true,
			ganador: 'a',
			juegosA: 3,
			juegosB: 1
		});
	});

	it.each<[Formato, string, 'a' | 'b' | null]>([
		['libre', '11-9', 'a'],
		['libre', '7-9', 'b'],
		['libre', '11-9, 4-11', null],
		['libre', '3-11, 5-11', 'b'],
		['mejor_de_3', '11-3, 15-13', 'a'],
		['mejor_de_3', '11-3, 8-11, 9-11', 'b'],
		['mejor_de_5', '0-11, 0-11, 0-11', 'b'],
		['mejor_de_5', '11-9, 9-11, 11-9, 9-11, 12-10', 'a']
	])('%s %s → ganador %s', (formato, marcador, ganador) => {
		const resultado = validarMarcador(formato, juegos(marcador));
		expect(resultado.ok && resultado.ganador).toBe(ganador);
	});

	it('acepta cualquier marcador, no solo a 11 (R12)', () => {
		expect(validarMarcador('libre', juegos('9-0')).ok).toBe(true);
		expect(validarMarcador('libre', juegos('25-23')).ok).toBe(true);
		expect(validarMarcador('libre', juegos('99-0')).ok).toBe(true);
	});

	it.each<[string, Formato, Juego[], string]>([
		['sin juegos', 'libre', [], 'au moins un jeu'],
		['libre con 3 juegos', 'libre', juegos('11-1, 11-2, 11-3'), '2 au maximum'],
		['mejor de 5 con 6 juegos', 'mejor_de_5', juegos('11-1, 1-11, 11-1, 1-11, 11-1, 11-1'), '5 au'],
		['juego empatado', 'libre', juegos('7-7'), 'Jeu 1 : il faut un gagnant'],
		['mejor de 3 sin terminar', 'mejor_de_3', juegos('11-1, 1-11'), 'gagner 2 jeux'],
		['mejor de 5 sin terminar', 'mejor_de_5', juegos('11-1, 11-1'), 'gagner 3 jeux'],
		['juego después del final', 'mejor_de_5', juegos('11-1, 11-2, 11-3, 11-4'), 'Jeu 4 : le match'],
		['juego después del 2-0', 'mejor_de_3', juegos('11-1, 11-2, 3-11'), 'Jeu 3 : le match'],
		['puntos negativos', 'libre', [{ a: -1, b: 11 }], 'nombres entiers'],
		['puntos con decimales', 'libre', [{ a: 7.5, b: 11 }], 'nombres entiers'],
		['100 puntos', 'libre', [{ a: 100, b: 98 }], 'entre 0 et 99'],
		['puntos que no son número', 'libre', [{ a: Number.NaN, b: 11 }], 'nombres entiers']
	])('rechaza: %s', (_nombre, formato, lista, mensaje) => {
		const resultado = validarMarcador(formato, lista);
		expect(resultado.ok).toBe(false);
		if (!resultado.ok) expect(resultado.error).toContain(mensaje);
	});

	it('dice qué juego tiene el error', () => {
		const resultado = validarMarcador('mejor_de_5', juegos('11-1, 5-5, 11-3'));
		expect(resultado).toEqual({ ok: false, error: 'Jeu 2 : il faut un gagnant (pas d’égalité).' });
	});
});

describe('formatos', () => {
	it('reconoce los tres formatos y nada más', () => {
		expect(esFormato('libre')).toBe(true);
		expect(esFormato('mejor_de_3')).toBe(true);
		expect(esFormato('mejor_de_5')).toBe(true);
		expect(esFormato('mejor_de_7')).toBe(false);
		expect(esFormato(null)).toBe(false);
	});

	it('número máximo de juegos', () => {
		expect([maxJuegos('libre'), maxJuegos('mejor_de_3'), maxJuegos('mejor_de_5')]).toEqual([
			2, 3, 5
		]);
	});
});

describe('leerJuegosDelFormulario', () => {
	function formulario(valores: Record<string, string>): FormData {
		const datos = new FormData();
		for (const [campo, valor] of Object.entries(valores)) datos.set(campo, valor);
		return datos;
	}

	it('lee los juegos en orden', () => {
		const datos = formulario({ juego_1_a: '11', juego_1_b: '7', juego_2_a: '9', juego_2_b: '11' });
		expect(leerJuegosDelFormulario(datos, 'mejor_de_5')).toEqual({
			ok: true,
			juegos: [
				{ a: 11, b: 7 },
				{ a: 9, b: 11 }
			]
		});
	});

	it('ignora las filas vacías y los espacios', () => {
		const datos = formulario({ juego_1_a: ' 11 ', juego_1_b: '7', juego_2_a: '', juego_2_b: '' });
		expect(leerJuegosDelFormulario(datos, 'libre')).toEqual({
			ok: true,
			juegos: [{ a: 11, b: 7 }]
		});
	});

	it('no lee más filas que las del formato', () => {
		const datos = formulario({ juego_1_a: '11', juego_1_b: '7', juego_3_a: '11', juego_3_b: '2' });
		expect(leerJuegosDelFormulario(datos, 'libre')).toEqual({
			ok: true,
			juegos: [{ a: 11, b: 7 }]
		});
	});

	it('error si solo se rellena un lado', () => {
		const resultado = leerJuegosDelFormulario(formulario({ juego_2_a: '11' }), 'mejor_de_3');
		expect(resultado).toEqual({ ok: false, error: 'Jeu 2 : indique les points des deux joueurs.' });
	});

	it.each(['-1', '7.5', '1e1', 'once', '0x1'])('error con puntos "%s"', (valor) => {
		const resultado = leerJuegosDelFormulario(
			formulario({ juego_1_a: valor, juego_1_b: '11' }),
			'libre'
		);
		expect(resultado.ok).toBe(false);
	});

	it('los nombres de campo coinciden con los que lee', () => {
		expect(camposJuego(3)).toEqual({ a: 'juego_3_a', b: 'juego_3_b' });
	});
});

describe('fecha del partido', () => {
	it('hoy en Francia, aunque en UTC aún sea ayer', () => {
		expect(hoyEnFrancia(new Date('2026-11-27T23:30:00Z'))).toBe('2026-11-28');
		expect(hoyEnFrancia(new Date('2026-07-01T21:59:00Z'))).toBe('2026-07-01');
	});

	it('acepta hoy y el pasado', () => {
		expect(errorFecha('2026-11-27', '2026-11-27')).toBeNull();
		expect(errorFecha('2025-03-01', '2026-11-27')).toBeNull();
	});

	it('rechaza el futuro', () => {
		expect(errorFecha('2026-11-28', '2026-11-27')).toContain('futur');
	});

	it.each(['', 'hier', '2026-02-31', '2026-13-01', '27/11/2026'])(
		'rechaza la fecha "%s"',
		(fecha) => {
			expect(errorFecha(fecha, '2026-11-27')).toBe('Indique la date du match.');
		}
	);
});
