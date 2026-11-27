import { describe, it, expect } from 'vitest';
import type { ClienteSupabase } from './supabase.ts';
import {
	LARGO_MAXIMO_NOMBRE,
	cambiarInscripcion,
	crearTorneo,
	leerId,
	leerTorneo,
	noInscritos,
	temporadaDe,
	validarTorneo
} from './torneos.ts';

describe('temporadaDe (R25)', () => {
	it.each([
		['2027-03-15', '2026-2027'],
		['2027-08-31', '2026-2027'],
		['2027-09-01', '2027-2028'],
		['2026-12-31', '2026-2027'],
		['2027-01-01', '2026-2027']
	])('%s → %s', (fecha, temporada) => {
		expect(temporadaDe(fecha)).toBe(temporada);
	});
});

describe('validarTorneo', () => {
	it('acepta "Open de printemps" con una fecha válida, también en el futuro', () => {
		expect(validarTorneo('Open de printemps', '2099-03-15')).toEqual({});
	});

	it('nombre vacío o solo espacios', () => {
		expect(validarTorneo('   ', '2027-03-15').nombre).toBeDefined();
	});

	it('nombre de 80 caracteres sí, de 81 no', () => {
		expect(validarTorneo('a'.repeat(LARGO_MAXIMO_NOMBRE), '2027-03-15')).toEqual({});
		expect(validarTorneo('a'.repeat(LARGO_MAXIMO_NOMBRE + 1), '2027-03-15').nombre).toContain(
			'trop long'
		);
	});

	it('los espacios de alrededor no cuentan en el largo', () => {
		expect(validarTorneo(`  ${'a'.repeat(LARGO_MAXIMO_NOMBRE)}  `, '2027-03-15')).toEqual({});
	});

	it.each(['', '2027-02-30', '15/03/2027', 'mañana'])('fecha no válida: "%s"', (fecha) => {
		expect(validarTorneo('Open', fecha).fecha).toBeDefined();
	});
});

describe('leerId', () => {
	it.each([
		['1', 1],
		['42', 42]
	])('"%s" → %d', (texto, id) => {
		expect(leerId(texto)).toBe(id);
	});

	it.each(['', '0', '-3', '1.5', 'abc', '1e3', ' 2', '99999999999999999999', null, 7])(
		'%s → null',
		(texto) => {
			expect(leerId(texto)).toBeNull();
		}
	);
});

describe('noInscritos', () => {
	it('quita a los que ya están inscritos', () => {
		const ana = { id: 'a', nombre: 'Ana' };
		const bea = { id: 'b', nombre: 'Bea' };
		expect(noInscritos([ana, bea], [bea])).toEqual([ana]);
	});
});

describe('leerTorneo', () => {
	function clienteConFila(fila: unknown) {
		const consulta: Record<string, () => unknown> = {};
		for (const metodo of ['from', 'select', 'eq', 'maybeSingle']) consulta[metodo] = () => consulta;
		consulta.overrideTypes = () => Promise.resolve({ data: fila, error: null });
		return consulta as unknown as ClienteSupabase;
	}

	it('devuelve los inscritos por orden alfabético', async () => {
		const fila = {
			id: 1,
			nombre: 'Open de printemps',
			fecha: '2027-03-15',
			temporada: '2026-2027',
			inscripciones: [
				{ jugadores: { id: 'z', nombre: 'Zoé Prueba' } },
				{ jugadores: { id: 'e', nombre: 'Élodie Prueba' } },
				{ jugadores: null }
			]
		};
		expect(await leerTorneo(clienteConFila(fila), 1)).toEqual({
			ok: true,
			datos: {
				id: 1,
				nombre: 'Open de printemps',
				fecha: '2027-03-15',
				temporada: '2026-2027',
				inscritos: [
					{ id: 'e', nombre: 'Élodie Prueba' },
					{ id: 'z', nombre: 'Zoé Prueba' }
				]
			}
		});
	});

	it('torneo que no existe → datos null', async () => {
		expect(await leerTorneo(clienteConFila(null), 99)).toEqual({ ok: true, datos: null });
	});
});

/** Cliente falso que apunta las llamadas a `rpc` y devuelve `respuesta`. */
function clienteRpc(respuesta: { data: unknown; error: { message: string } | null }) {
	const llamadas: unknown[][] = [];
	const cliente = {
		rpc: (...argumentos: unknown[]) => {
			llamadas.push(argumentos);
			return Promise.resolve(respuesta);
		}
	} as unknown as ClienteSupabase;
	return { cliente, llamadas };
}

describe('crearTorneo', () => {
	it('llama a crear_torneo con el nombre sin espacios y devuelve el id', async () => {
		const { cliente, llamadas } = clienteRpc({ data: 7, error: null });
		expect(await crearTorneo(cliente, '  Open  ', '2027-03-15')).toEqual({ ok: true, datos: 7 });
		expect(llamadas).toEqual([['crear_torneo', { p_nombre: 'Open', p_fecha: '2027-03-15' }]]);
	});

	it('pasa el mensaje de la base de datos', async () => {
		const { cliente } = clienteRpc({
			data: null,
			error: { message: 'Seul l’administrateur peut créer un tournoi.' }
		});
		const resultado = await crearTorneo(cliente, 'Open', '2027-03-15');
		expect(resultado).toEqual({
			ok: false,
			error: 'Impossible de créer le tournoi : Seul l’administrateur peut créer un tournoi.'
		});
	});
});

describe('cambiarInscripcion', () => {
	it('inscribir llama a inscribir_jugador', async () => {
		const { cliente, llamadas } = clienteRpc({ data: null, error: null });
		expect(await cambiarInscripcion(cliente, 'inscribir', 3, 'j1')).toEqual({
			ok: true,
			datos: null
		});
		expect(llamadas).toEqual([['inscribir_jugador', { p_torneo: 3, p_jugador: 'j1' }]]);
	});

	it('desinscribir llama a desinscribir_jugador', async () => {
		const { cliente, llamadas } = clienteRpc({ data: null, error: null });
		await cambiarInscripcion(cliente, 'desinscribir', 3, 'j1');
		expect(llamadas[0]?.[0]).toBe('desinscribir_jugador');
	});

	it('el 17.º jugador: pasa el mensaje de la base de datos', async () => {
		const { cliente } = clienteRpc({
			data: null,
			error: { message: 'Le tableau est complet (16 joueurs au maximum).' }
		});
		const resultado = await cambiarInscripcion(cliente, 'inscribir', 3, 'j17');
		expect(resultado.ok === false && resultado.error).toContain('complet');
	});

	it('sin red: mensaje claro', async () => {
		const cliente = {
			rpc: () => Promise.reject(new Error('fetch failed'))
		} as unknown as ClienteSupabase;
		expect(await cambiarInscripcion(cliente, 'inscribir', 3, 'j1')).toEqual({
			ok: false,
			error: 'Impossible de contacter Supabase : fetch failed'
		});
	});
});
