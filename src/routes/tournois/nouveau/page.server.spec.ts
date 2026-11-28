import { describe, it, expect } from 'vitest';
import type { User } from '@supabase/supabase-js';
import type { EstadoPerfil } from '#lib/perfil.ts';
import type { ClienteSupabase } from '#lib/supabase.ts';
import { actions, load } from './+page.server.ts';

function perfil(rol: 'jugador' | 'admin'): EstadoPerfil {
	return {
		estado: 'conectado',
		jugador: { nombre: 'Prueba', grupo: 1, rol, rating: 1500, rd: 350 }
	};
}

/** Cliente falso: apunta las llamadas a `rpc` y responde con `respuesta`. */
function clienteFalso(respuesta: { data: unknown; error: { message: string } | null }) {
	const llamadas: unknown[][] = [];
	const cliente = {
		rpc: (...argumentos: unknown[]) => {
			llamadas.push(argumentos);
			return Promise.resolve(respuesta);
		}
	} as unknown as ClienteSupabase;
	return { cliente, llamadas };
}

function locals(cliente: ClienteSupabase, conectado = true): App.Locals {
	return {
		supabase: cliente,
		errorConfig: null,
		obtenerUsuario: () => Promise.resolve(conectado ? ({ id: 'yo' } as User) : null)
	};
}

function cargar(estadoPerfil: EstadoPerfil) {
	const evento = {
		locals: locals(clienteFalso({ data: null, error: null }).cliente),
		parent: () => Promise.resolve({ perfil: estadoPerfil, errorConfig: null })
	};
	return load(evento as unknown as Parameters<typeof load>[0]);
}

describe('load de crear torneo', () => {
	it('el admin puede abrir el formulario', async () => {
		expect(await cargar(perfil('admin'))).toHaveProperty('hoy');
	});

	it('un jugador que escribe la URL a mano vuelve a la lista', async () => {
		await expect(cargar(perfil('jugador'))).rejects.toMatchObject({
			status: 303,
			location: '/tournois'
		});
	});
});

function enviar(campos: Record<string, string>, cliente = clienteFalso({ data: 7, error: null })) {
	const cuerpo = new FormData();
	for (const [campo, valor] of Object.entries(campos)) cuerpo.set(campo, valor);
	const evento = {
		request: new Request('http://localhost/tournois/nouveau', { method: 'POST', body: cuerpo }),
		locals: locals(cliente.cliente)
	};
	return actions.default(evento as unknown as Parameters<typeof actions.default>[0]);
}

describe('action crear torneo', () => {
	it('criterio de la 2.1: crea "Open de printemps" y va a su página', async () => {
		const cliente = clienteFalso({ data: 7, error: null });
		await expect(
			enviar({ nombre: 'Open de printemps', fecha: '2027-03-15' }, cliente)
		).rejects.toMatchObject({ status: 303, location: '/tournois/7?cree' });
		expect(cliente.llamadas).toEqual([
			['crear_torneo', { p_nombre: 'Open de printemps', p_fecha: '2027-03-15' }]
		]);
	});

	it('nombre vacío: error junto al campo, sin llamar a la base de datos', async () => {
		const cliente = clienteFalso({ data: 7, error: null });
		const respuesta = await enviar({ nombre: '  ', fecha: '2027-03-15' }, cliente);
		expect(respuesta).toMatchObject({
			status: 400,
			data: { errores: { nombre: 'Indique le nom du tournoi.' } }
		});
		expect(cliente.llamadas).toEqual([]);
	});

	it('fecha que no existe', async () => {
		expect(await enviar({ nombre: 'Open', fecha: '2027-02-30' })).toMatchObject({
			status: 400,
			data: { errores: { fecha: 'Indique la date du tournoi.' }, valores: { nombre: 'Open' } }
		});
	});

	it('un jugador que no es admin: la base de datos lo rechaza y se muestra el mensaje', async () => {
		const cliente = clienteFalso({
			data: null,
			error: { message: 'Seul l’administrateur peut créer un tournoi.' }
		});
		expect(await enviar({ nombre: 'Open', fecha: '2027-03-15' }, cliente)).toMatchObject({
			status: 400,
			data: {
				errores: {
					general: 'Impossible de créer le tournoi : Seul l’administrateur peut créer un tournoi.'
				}
			}
		});
	});
});
