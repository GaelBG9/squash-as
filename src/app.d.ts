// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { UsuarioConectado } from '#lib/sesion.ts';
import type { ClienteSupabase } from '#lib/supabase.ts';

declare global {
	namespace App {
		// interface Error {}
		/** Datos que `hooks.server.ts` deja preparados para cada petición. */
		interface Locals {
			/** `null` si falta configurar Supabase en `.env`. */
			supabase: ClienteSupabase | null;
			errorConfig: string | null;
			/** Usuario conectado (firma de la sesión verificada), o `null` si no hay sesión. */
			obtenerUsuario: () => Promise<UsuarioConectado | null>;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
