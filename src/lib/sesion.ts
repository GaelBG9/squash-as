/** Lo que la app necesita saber de quien está conectado. */
export type UsuarioConectado = { id: string };

/** La parte del cliente de Supabase que usa `crearObtenerUsuario` (así se prueba sin red). */
export type AuthConClaims = {
	auth: {
		getClaims: () => Promise<{
			data: { claims: { sub?: string } } | null;
			error: unknown;
		}>;
	};
};

/**
 * Devuelve una función que dice quién está conectado, para UNA petición.
 *
 * - `getClaims()` comprueba la firma de la sesión (cookie) con la clave pública de
 *   Supabase, que se descarga una vez y se guarda en memoria: normalmente no hace
 *   ningún viaje de red. Si el proyecto todavía firma con la clave antigua (secreta,
 *   "HS256"), `getClaims()` pregunta a Supabase, como hacía `getUser()`.
 * - El resultado se guarda: el layout y la página piden el usuario en la misma
 *   petición, y solo se comprueba una vez.
 */
export function crearObtenerUsuario(
	cliente: AuthConClaims | null
): () => Promise<UsuarioConectado | null> {
	let pendiente: Promise<UsuarioConectado | null> | null = null;

	async function comprobar(): Promise<UsuarioConectado | null> {
		if (!cliente) return null;
		try {
			const { data, error } = await cliente.auth.getClaims();
			const id = data?.claims.sub;
			return error || !id ? null : { id };
		} catch {
			// Sesión dañada o Supabase inalcanzable: como si no hubiera sesión.
			return null;
		}
	}

	return () => (pendiente ??= comprobar());
}
