import { leerMensajePrueba } from '#lib/prueba-conexion.ts';
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
			prueba: { ok: false as const, error: locals.errorConfig ?? 'Supabase no configurado.' },
			perfil: { estado: 'sin-sesion' as const }
		};
	}

	const usuario = await locals.obtenerUsuario();
	const [prueba, perfil] = await Promise.all([
		leerMensajePrueba(locals.supabase),
		leerPerfil(locals.supabase, usuario?.id ?? null)
	]);
	return { errorLogin, prueba, perfil };
};
