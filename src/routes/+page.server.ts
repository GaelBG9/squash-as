import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from '$app/env/public';
import { crearClienteSupabase, leerConfigSupabase } from '#lib/supabase.ts';
import { leerMensajePrueba } from '#lib/prueba-conexion.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const config = leerConfigSupabase({ PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY });
	if (!config.ok) {
		return { prueba: config };
	}
	const cliente = crearClienteSupabase(config.config);
	return { prueba: await leerMensajePrueba(cliente) };
};
