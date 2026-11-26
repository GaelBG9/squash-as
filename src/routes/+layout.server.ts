import { leerPerfil } from '#lib/perfil.ts';
import type { LayoutServerLoad } from './$types';

// Se ejecuta en todas las páginas: la cabecera necesita saber quién está conectado.
export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.supabase) {
		return {
			errorConfig: locals.errorConfig ?? 'Supabase no está configurado.',
			perfil: { estado: 'sin-sesion' as const }
		};
	}

	// Sin sesión, `leerPerfil` no consulta `jugadores` (R10: solo para usuarios conectados).
	const usuario = await locals.obtenerUsuario();
	const perfil = await leerPerfil(locals.supabase, usuario?.id ?? null);
	return { errorConfig: null, perfil };
};
