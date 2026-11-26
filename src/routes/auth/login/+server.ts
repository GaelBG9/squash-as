import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// El botón "Conectarse con Google" envía un formulario (POST) aquí.
export const POST: RequestHandler = async ({ locals, url }) => {
	if (!locals.supabase) redirect(303, '/');

	const { data, error } = await locals.supabase.auth.signInWithOAuth({
		provider: 'google',
		// Adónde vuelve Google (vía Supabase) cuando aceptas.
		options: { redirectTo: `${url.origin}/auth/callback` }
	});

	if (error) redirect(303, '/?error=login');
	redirect(303, data.url);
};
