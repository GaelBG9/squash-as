import { fail, redirect } from '@sveltejs/kit';
import { esRespuesta, leerMisPartidos, responderPartido } from '#lib/partidos.ts';
import type { Actions, PageServerLoad } from './$types';

// Lista de mis partidos. Solo para jugadores conectados: sin sesión, vuelta al inicio.
export const load: PageServerLoad = async ({ locals, url }) => {
	const usuario = await locals.obtenerUsuario();
	if (!locals.supabase || !usuario) redirect(303, '/');

	return {
		partidos: await leerMisPartidos(locals.supabase, usuario.id),
		// `/matchs?enregistre` al volver del formulario: muestra "Match enregistré".
		recienRegistrado: url.searchParams.has('enregistre')
	};
};

export const actions = {
	// Confirmar o rechazar un partido (tarea 1.2). Cada tarjeta tiene un formulario con
	// el id del partido en un campo oculto y dos botones `respuesta`: el navegador
	// envía el valor del botón pulsado ("confirmado" o "rechazado").
	// La base de datos vuelve a comprobar que soy el rival y que sigue pendiente.
	repondre: async ({ request, locals }) => {
		const usuario = await locals.obtenerUsuario();
		if (!locals.supabase || !usuario) redirect(303, '/');

		const formulario = await request.formData();
		const textoPartido = formulario.get('partido');
		const partido = typeof textoPartido === 'string' ? Number(textoPartido) : NaN;
		const respuesta = formulario.get('respuesta');

		if (!Number.isSafeInteger(partido) || partido <= 0) {
			return fail(400, { error: 'Match introuvable.', partido: null });
		}
		if (!esRespuesta(respuesta)) {
			return fail(400, { error: 'Choisis « Confirmer » ou « Refuser ».', partido });
		}

		const resultado = await responderPartido(locals.supabase, partido, respuesta);
		if (!resultado.ok) return fail(400, { error: resultado.error, partido });

		return { respondido: respuesta };
	}
} satisfies Actions;
