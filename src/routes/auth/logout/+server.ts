import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// El botón "Desconectarse" envía un formulario (POST) aquí.
export const POST: RequestHandler = async ({ locals }) => {
	await locals.supabase?.auth.signOut();
	redirect(303, '/');
};
