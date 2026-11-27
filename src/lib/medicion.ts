/**
 * Mide cuánto tarda el servidor en cada petición y lo cuenta en la cabecera HTTP
 * `Server-Timing`. El navegador la muestra en las herramientas de desarrollo
 * (pestaña Red → la petición → Tiempos), también en la web publicada en Vercel.
 * No contiene datos personales: solo números de milisegundos.
 */
export type Medidor = {
	/** `fetch` que apunta cuánto tarda cada llamada a Supabase. */
	fetch: typeof fetch;
	/** Valor de la cabecera: `supabase;dur=123;desc="3 requêtes", total;dur=150`. */
	cabecera: (totalMs: number) => string;
};

export function crearMedidor(
	fetchReal: typeof fetch = fetch,
	reloj: () => number = () => performance.now()
): Medidor {
	let consultas = 0;
	let msSupabase = 0;

	const medido: typeof fetch = async (...argumentos) => {
		const inicio = reloj();
		try {
			return await fetchReal(...argumentos);
		} finally {
			consultas++;
			msSupabase += reloj() - inicio;
		}
	};

	return {
		fetch: medido,
		cabecera: (totalMs) =>
			`supabase;dur=${msSupabase.toFixed(1)};desc="${consultas} requête${consultas === 1 ? '' : 's'}", ` +
			`total;dur=${totalMs.toFixed(1)}`
	};
}
