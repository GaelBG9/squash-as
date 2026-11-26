import { redirect } from '@sveltejs/kit';
import { rutaInternaSegura } from '#lib/rutas.ts';
import type { RequestHandler } from './$types';

// Google -> Supabase -> aquí, con un código de un solo uso en la URL.
// Si cancelas en Google, no llega código sino un parámetro `error`.
export const GET: RequestHandler = async ({ locals, url }) => {
	const codigo = url.searchParams.get('code');
	const destino = rutaInternaSegura(url.searchParams.get('next'));

	if (codigo && locals.supabase) {
		// Cambia el código por una sesión y la guarda en cookies.
		const { error } = await locals.supabase.auth.exchangeCodeForSession(codigo);
		if (!error) redirect(303, destino);
	}

	redirect(303, '/?error=login');
};
