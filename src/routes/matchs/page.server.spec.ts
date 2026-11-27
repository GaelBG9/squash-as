import { describe, it, expect } from 'vitest';
import type { User } from '@supabase/supabase-js';
import type { ClienteSupabase } from '#lib/supabase.ts';
import type { FilaPartido } from '#lib/partidos.ts';
import { load } from './+page.server.ts';

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
	juegos: [
		{ numero: 1, puntos_a: 11, puntos_b: 7 },
		{ numero: 2, puntos_a: 9, puntos_b: 11 },
		{ numero: 3, puntos_a: 11, puntos_b: 5 },
		{ numero: 4, puntos_a: 11, puntos_b: 8 }
	],
	nombre_a: { nombre: 'Yo Prueba' },
	nombre_b: { nombre: 'Rival Prueba' }
};

function clienteFalso() {
	const consulta: Record<string, () => unknown> = {};
	for (const metodo of ['from', 'select', 'or', 'order']) consulta[metodo] = () => consulta;
	consulta.overrideTypes = () => Promise.resolve({ data: [PENDIENTE], error: null });
	return consulta as unknown as ClienteSupabase;
}

function cargar(direccion: string, conectado = true) {
	const evento = {
		url: new URL(direccion),
		locals: {
			supabase: clienteFalso(),
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
