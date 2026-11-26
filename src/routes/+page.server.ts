import { leerPerfil } from '#lib/perfil.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const errorLogin =
		url.searchParams.get('error') === 'login'
			? 'No se ha podido completar la conexión con Google. Inténtalo de nuevo.'
			: null;

	if (!locals.supabase) {
		return {
			errorLogin,
			errorConfig: locals.errorConfig ?? 'Supabase no está configurado.',
			perfil: { estado: 'sin-sesion' as const }
		};
	}

	// Sin sesión, `leerPerfil` no consulta `jugadores` (R10: solo para usuarios conectados).
	const usuario = await locals.obtenerUsuario();
	const perfil = await leerPerfil(locals.supabase, usuario?.id ?? null);
	return { errorLogin, errorConfig: null, perfil };
};
