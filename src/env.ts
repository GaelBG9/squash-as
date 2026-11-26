import { defineEnvVars } from '@sveltejs/kit/env';

/** Devuelve el valor tal cual; si falta, `undefined` (la página muestra un aviso claro). */
const opcional = (valor: string | undefined) => valor;

// Variables de entorno de la app (SvelteKit 3). Se leen de `.env` al arrancar,
// no al compilar, así la CI funciona sin `.env`.
export const variables = defineEnvVars({
	PUBLIC_SUPABASE_URL: {
		public: true,
		schema: opcional,
		description: 'URL del proyecto Supabase'
	},
	PUBLIC_SUPABASE_PUBLISHABLE_KEY: {
		public: true,
		schema: opcional,
		description: 'Clave pública (Publishable key) de Supabase'
	}
});
