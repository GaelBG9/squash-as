import { redirect } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL } from '$app/env/public';
import type { RequestHandler } from './$types';

// El botón "Conectarse con Google" envía un formulario (POST) aquí.
export const POST: RequestHandler = async ({ locals, url }) => {
	if (!locals.supabase || !PUBLIC_SUPABASE_URL) redirect(303, '/');

	const { data, error } = await locals.supabase.auth.signInWithOAuth({
		provider: 'google',
		// Adónde vuelve Google (vía Supabase) cuando aceptas.
		options: { redirectTo: `${url.origin}/auth/callback` }
	});

	if (error) redirect(303, '/?error=login');
	// SvelteKit bloquea por defecto las redirecciones a otras webs: solo
	// permitimos la de nuestro proyecto Supabase, que es quien habla con Google.
	redirect(303, data.url, { external: [new URL(PUBLIC_SUPABASE_URL).origin] });
};
