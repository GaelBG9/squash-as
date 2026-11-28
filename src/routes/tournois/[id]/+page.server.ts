import { error, fail, redirect } from '@sveltejs/kit';
import { cambiarCuadro, leerCuadro } from '#lib/cuadro.ts';
import { esAdmin } from '#lib/perfil.ts';
import {
	cambiarInscripcion,
	leerId,
	leerJugadores,
	leerTorneo,
	noInscritos
} from '#lib/torneos.ts';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

// Un torneo, sus inscritos (tarea 2.1) y su cuadro (tarea 2.2). Todos los conectados
// lo ven; solo el administrador ve los controles para inscribir, desinscribir,
// generar y borrar el cuadro.
export const load: PageServerLoad = async ({ locals, params, parent, url }) => {
	const usuario = await locals.obtenerUsuario();
	if (!locals.supabase || !usuario) redirect(303, '/');

	const id = leerId(params.id);
	if (id === null) error(404, 'Tournoi introuvable');

	const [{ perfil }, torneo, cuadro] = await Promise.all([
		parent(),
		leerTorneo(locals.supabase, id),
		leerCuadro(locals.supabase, id)
	]);
	if (torneo.ok && torneo.datos === null) error(404, 'Tournoi introuvable');

	const admin = esAdmin(perfil);
	// Con el cuadro generado, las inscripciones están cerradas (R17).
	const generado = cuadro.ok && cuadro.datos.length > 0;
	// Solo el admin necesita la lista de jugadores para elegir a quién inscribir.
	const jugadores =
		admin && torneo.ok && cuadro.ok && !generado ? await leerJugadores(locals.supabase) : null;

	return {
		torneo,
		cuadro,
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

/** Generar y borrar el cuadro: la base de datos comprueba que quien llama es el admin. */
async function cambiarElCuadro(accion: 'generar' | 'borrar', { locals, params }: RequestEvent) {
	const usuario = await locals.obtenerUsuario();
	if (!locals.supabase || !usuario) redirect(303, '/');

	const torneo = leerId(params.id);
	if (torneo === null) error(404, 'Tournoi introuvable');

	const resultado = await cambiarCuadro(locals.supabase, accion, torneo);
	if (!resultado.ok) return fail(400, { accion, error: resultado.error });
	return { accion, hecho: true as const };
}

export const actions = {
	inscrire: (evento) => cambiar('inscribir', evento),
	desinscrire: (evento) => cambiar('desinscribir', evento),
	generer: (evento) => cambiarElCuadro('generar', evento),
	supprimer: (evento) => cambiarElCuadro('borrar', evento)
} satisfies Actions;
