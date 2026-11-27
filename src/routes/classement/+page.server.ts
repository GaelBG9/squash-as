import { redirect } from '@sveltejs/kit';
import {
	construirClasificacion,
	hoyEnFrancia,
	leerClasificacion,
	leerFiltroGrupo
} from '#lib/clasificacion.ts';
import type { PageServerLoad } from './$types';

// Clasificación Glicko-2 (historia 4). Solo con sesión: sin ella, `jugadores` no se
// puede leer (R10). `?groupe=1` o `?groupe=2` filtra por grupo; sin él, todos.
export const load: PageServerLoad = async ({ locals, url }) => {
	const usuario = await locals.obtenerUsuario();
	if (!locals.supabase || !usuario) redirect(303, '/');

	const grupo = leerFiltroGrupo(url.searchParams.get('groupe'));
	const filas = await leerClasificacion(locals.supabase);

	return {
		grupo,
		idUsuario: usuario.id,
		clasificacion: filas.ok
			? { ok: true as const, datos: construirClasificacion(filas.datos, hoyEnFrancia(), grupo) }
			: filas
	};
};
