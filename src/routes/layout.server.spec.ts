import { describe, it, expect } from 'vitest';
import type { User } from '@supabase/supabase-js';
import type { ClienteSupabase } from '#lib/supabase.ts';
import { load } from './+layout.server.ts';

const ID_PRUEBA = '00000000-0000-4000-8000-0000000000c2';

/** Cliente falso que apunta las tablas consultadas; responde con un perfil de prueba. */
function clienteFalso() {
	const tablas: string[] = [];
	const respuesta = {
		data: { nombre: 'Jugador Prueba', grupo: 2, rol: 'jugador', rating: 1500, rd: 350 },
		error: null
	};
	const falso = {
		from: (tabla: string) => {
			tablas.push(tabla);
			return {
				select: () => ({
					eq: () => ({ maybeSingle: () => ({ overrideTypes: () => Promise.resolve(respuesta) }) })
				})
			};
		}
	};
	return { cliente: falso as unknown as ClienteSupabase, tablas };
}

/** Llama a `load` con los `locals` que prepararía `hooks.server.ts`. */
function cargar(locals: Partial<App.Locals>) {
	const evento = {
		locals: {
			supabase: null,
			errorConfig: null,
			obtenerUsuario: () => Promise.resolve(null),
			...locals
		}
	};
	return load(evento as unknown as Parameters<typeof load>[0]);
}

describe('load del layout (todas las páginas)', () => {
	it('sin sesión no consulta ninguna tabla (R10)', async () => {
		const { cliente, tablas } = clienteFalso();
		const datos = await cargar({ supabase: cliente });
		expect(datos).toMatchObject({ perfil: { estado: 'sin-sesion' }, errorConfig: null });
		expect(tablas).toEqual([]);
	});

	it('con sesión muestra el perfil y solo consulta `jugadores`', async () => {
		const { cliente, tablas } = clienteFalso();
		const usuario = { id: ID_PRUEBA } as User;
		const datos = await cargar({
			supabase: cliente,
			obtenerUsuario: () => Promise.resolve(usuario)
		});
		expect(datos).toMatchObject({
			perfil: { estado: 'conectado', jugador: { nombre: 'Jugador Prueba' } }
		});
		expect(tablas).toEqual(['jugadores']);
	});

	it('avisa si falta configurar Supabase', async () => {
		const datos = await cargar({ errorConfig: 'Supabase n’est pas configuré' });
		expect(datos).toMatchObject({
			errorConfig: 'Supabase n’est pas configuré',
			perfil: { estado: 'sin-sesion' }
		});
	});
});
