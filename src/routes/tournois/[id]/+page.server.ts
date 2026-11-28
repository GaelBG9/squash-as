import { error, fail, redirect } from '@sveltejs/kit';
import { esAdmin } from '#lib/perfil.ts';
import {
	cambiarInscripcion,
	leerId,
	leerJugadores,
	leerTorneo,
	noInscritos
} from '#lib/torneos.ts';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

// Un torneo y sus inscritos (tarea 2.1). Todos los conectados lo ven; solo el
// administrador ve los controles para inscribir y desinscribir.
export const load: PageServerLoad = async ({ locals, params, parent, url }) => {
	const usuario = await locals.obtenerUsuario();
	if (!locals.supabase || !usuario) redirect(303, '/');

	const id = leerId(params.id);
	if (id === null) error(404, 'Tournoi introuvable');

	const [{ perfil }, torneo] = await Promise.all([parent(), leerTorneo(locals.supabase, id)]);
	if (torneo.ok && torneo.datos === null) error(404, 'Tournoi introuvable');

	const admin = esAdmin(perfil);
	// Solo el admin necesita la lista de jugadores para elegir a quién inscribir.
	const jugadores = admin && torneo.ok ? await leerJugadores(locals.supabase) : null;

	return {
		torneo,
		esAdmin: admin,
		inscribibles:
			jugadores?.ok && torneo.ok && torneo.datos
				? { ok: true as const, datos: noInscritos(jugadores.datos, torneo.datos.inscritos) }
				: jugadores,
		// `/tournois/7?cree` al volver del formulario de creación.
		recienCreado: url.searchParams.has('cree')
	};
};

/**
 * Inscribir y desinscribir comparten todo menos la función de la base de datos,
 * que comprueba que quien llama es el admin, el máximo de 16 y los duplicados.
 */
async function cambiar(
	accion: 'inscribir' | 'desinscribir',
	{ request, locals, params }: RequestEvent
) {
	const usuario = await locals.obtenerUsuario();
	if (!locals.supabase || !usuario) redirect(303, '/');

	const torneo = leerId(params.id);
	if (torneo === null) error(404, 'Tournoi introuvable');

	const jugador = (await request.formData()).get('jugador');
	if (typeof jugador !== 'string' || jugador === '') {
		return fail(400, { accion, error: 'Choisis un joueur.' });
	}

	const resultado = await cambiarInscripcion(locals.supabase, accion, torneo, jugador);
	if (!resultado.ok) return fail(400, { accion, error: resultado.error });
	return { accion, hecho: true as const };
}

export const actions = {
	inscrire: (evento) => cambiar('inscribir', evento),
	desinscrire: (evento) => cambiar('desinscribir', evento)
} satisfies Actions;
