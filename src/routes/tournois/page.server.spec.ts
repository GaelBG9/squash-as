import { describe, it, expect } from 'vitest';
import type { User } from '@supabase/supabase-js';
import type { EstadoPerfil } from '#lib/perfil.ts';
import type { ClienteSupabase } from '#lib/supabase.ts';
import { load } from './+page.server.ts';

const TORNEO = { id: 1, nombre: 'Open de printemps', fecha: '2027-03-15', temporada: '2026-2027' };

function clienteFalso() {
	const consulta: Record<string, () => unknown> = {};
	for (const metodo of ['from', 'select', 'order']) consulta[metodo] = () => consulta;
	consulta.overrideTypes = () => Promise.resolve({ data: [TORNEO], error: null });
	return consulta as unknown as ClienteSupabase;
}

function perfil(rol: 'jugador' | 'admin'): EstadoPerfil {
	return {
		estado: 'conectado',
		jugador: { nombre: 'Prueba', grupo: 1, rol, rating: 1500, rd: 350 }
	};
}

function cargar(estadoPerfil: EstadoPerfil, conectado = true) {
	const evento = {
		locals: {
			supabase: clienteFalso(),
			errorConfig: null,
			obtenerUsuario: () => Promise.resolve(conectado ? ({ id: 'yo' } as User) : null)
		},
		parent: () => Promise.resolve({ perfil: estadoPerfil, errorConfig: null })
	};
	return load(evento as unknown as Parameters<typeof load>[0]);
}

describe('load de la lista de torneos', () => {
	it('un jugador ve los torneos pero no el botón de crear', async () => {
		expect(await cargar(perfil('jugador'))).toEqual({
			torneos: { ok: true, datos: [TORNEO] },
			esAdmin: false
		});
	});

	it('el admin ve el botón de crear', async () => {
		expect(await cargar(perfil('admin'))).toMatchObject({ esAdmin: true });
	});

	it('sin sesión vuelve al inicio', async () => {
		await expect(cargar({ estado: 'sin-sesion' }, false)).rejects.toMatchObject({
			status: 303,
			location: '/'
		});
	});
});
