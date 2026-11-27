import { describe, it, expect } from 'vitest';
import type { User } from '@supabase/supabase-js';
import type { ClienteSupabase } from '#lib/supabase.ts';
import type { FilaClasificacion } from '#lib/clasificacion.ts';
import { load } from './+page.server.ts';

const ID_YO = '00000000-0000-4000-8000-0000000015e1';

const FILAS: FilaClasificacion[] = [
	{
		id: 'g2',
		nombre: 'Rival Prueba',
		grupo: 2,
		rating: 1480,
		rd: 120,
		volatilidad: 0.06,
		historial_rating: [{ fecha: '2026-11-20' }]
	},
	{
		id: ID_YO,
		nombre: 'Yo Prueba',
		grupo: 1,
		rating: 1520,
		rd: 120,
		volatilidad: 0.06,
		historial_rating: [{ fecha: '2026-11-20' }]
	}
];

type RespuestaConsulta = { data: unknown; error: { message: string } | null };

/** Cliente falso: apunta qué se pide a Supabase y devuelve `respuesta`. */
function clienteFalso(respuesta: RespuestaConsulta = { data: FILAS, error: null }) {
	const llamadas: unknown[][] = [];
	const consulta: Record<string, (...argumentos: unknown[]) => unknown> = {};
	for (const metodo of ['from', 'select']) {
		consulta[metodo] = (...argumentos) => {
			llamadas.push([metodo, ...argumentos]);
			return consulta;
		};
	}
	consulta.overrideTypes = () => Promise.resolve(respuesta);
	return { cliente: consulta as unknown as ClienteSupabase, llamadas };
}

function cargar(direccion: string, cliente = clienteFalso(), conectado = true) {
	const evento = {
		url: new URL(direccion),
		locals: {
			supabase: cliente.cliente,
			errorConfig: null,
			obtenerUsuario: () => Promise.resolve(conectado ? ({ id: ID_YO } as User) : null)
		}
	};
	return load(evento as unknown as Parameters<typeof load>[0]);
}

describe('load de la clasificación', () => {
	it('criterio de la 1.5: jugadores con partido confirmado, del rating más alto al más bajo', async () => {
		const cliente = clienteFalso();
		const datos = await cargar('http://localhost/classement', cliente);
		expect(datos).toMatchObject({
			grupo: null,
			idUsuario: ID_YO,
			clasificacion: {
				ok: true,
				datos: [
					{ puesto: 1, id: ID_YO, rating: 1520 },
					{ puesto: 2, id: 'g2', rating: 1480 }
				]
			}
		});
		// `!inner` es lo que deja fuera a los jugadores sin partido confirmado.
		expect(cliente.llamadas).toContainEqual(['from', 'jugadores']);
		expect(String(cliente.llamadas.find(([m]) => m === 'select')?.[1])).toContain(
			'historial_rating!inner(fecha)'
		);
	});

	it('?groupe=2 solo muestra el grupo 2', async () => {
		const datos = await cargar('http://localhost/classement?groupe=2');
		expect(datos).toMatchObject({
			grupo: 2,
			clasificacion: { ok: true, datos: [{ puesto: 1, id: 'g2' }] }
		});
	});

	it('un grupo desconocido muestra a todos', async () => {
		const datos = await cargar('http://localhost/classement?groupe=9');
		expect(datos).toMatchObject({ grupo: null });
	});

	it('muestra el error de Supabase', async () => {
		const cliente = clienteFalso({ data: null, error: { message: 'permission denied' } });
		expect(await cargar('http://localhost/classement', cliente)).toMatchObject({
			clasificacion: { ok: false, error: 'Impossible de lire le classement : permission denied' }
		});
	});

	it('sin sesión vuelve al inicio', async () => {
		await expect(
			cargar('http://localhost/classement', clienteFalso(), false)
		).rejects.toMatchObject({ status: 303, location: '/' });
	});
});
