import { redirect } from '@sveltejs/kit';
import { esAdmin } from '#lib/perfil.ts';
import { leerTorneos } from '#lib/torneos.ts';
import type { PageServerLoad } from './$types';

// Lista de torneos (tarea 2.1). Solo con sesión: sin ella, vuelta al inicio.
export const load: PageServerLoad = async ({ locals, parent }) => {
	const usuario = await locals.obtenerUsuario();
	if (!locals.supabase || !usuario) redirect(303, '/');

	// `parent()` da lo que ya cargó +layout.server.ts (el perfil): sin otra consulta.
	const { perfil } = await parent();
	return { torneos: await leerTorneos(locals.supabase), esAdmin: esAdmin(perfil) };
};
