import { redirect } from '@sveltejs/kit';
import { leerMisPartidos } from '#lib/partidos.ts';
import type { PageServerLoad } from './$types';

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
