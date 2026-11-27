import type { HistorialRating, Jugador } from './jugadores.ts';
import type { ClienteSupabase } from './supabase.ts';

/** El RD nunca pasa de este valor (el de un jugador nuevo). */
export const RD_MAXIMO = 350;

/** Factor entre la escala Glicko (1500, 350) y la interna de Glicko-2 (0, 2). */
const ESCALA = 173.7178;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Días entre dos fechas "AAAA-MM-DD" (negativo si `hasta` es anterior). */
function diasEntre(desde: string, hasta: string): number {
	return (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / MS_POR_DIA;
}

/**
 * Incertidumbre (RD) de un jugador el día `fecha`, tras las semanas sin jugar desde
 * su último partido (R14). Es la misma fórmula que `rd_tras_inactividad` en
 * supabase/sql/0008_glicko2.sql, que es la que cuenta al jugar el partido siguiente;
 * aquí solo sirve para mostrar el RD de hoy, y los tests usan los mismos números.
 * El partido en sí cuenta como una semana: solo suman las semanas vacías.
 */
export function rdTrasInactividad(
	rd: number,
	volatilidad: number,
	ultimaFecha: string | null,
	fecha: string
): number {
	if (ultimaFecha === null) return rd;
	const semanasVacias = Math.max(0, diasEntre(ultimaFecha, fecha) / 7 - 1);
	const phi = rd / ESCALA;
	return Math.min(RD_MAXIMO, ESCALA * Math.sqrt(phi ** 2 + semanasVacias * volatilidad ** 2));
}

/** "Hoy" en Francia, como "AAAA-MM-DD" (`en-CA` escribe las fechas en ese orden). */
export function hoyEnFrancia(ahora = new Date()): string {
	return ahora.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
}

/** Lo que devuelve la consulta de `leerClasificacion`: un jugador y sus fechas de partido. */
export type FilaClasificacion = Pick<
	Jugador,
	'id' | 'nombre' | 'grupo' | 'rating' | 'rd' | 'volatilidad'
> & {
	historial_rating: Pick<HistorialRating, 'fecha'>[];
};

/** Una línea de la clasificación, lista para mostrar. */
export type PuestoClasificacion = {
	/** 1 = primero, dentro de la lista mostrada (con filtro de grupo, dentro del grupo). */
	puesto: number;
	id: string;
	nombre: string;
	grupo: Jugador['grupo'];
	rating: number;
	/** RD de hoy, con las semanas sin jugar ya sumadas. */
	rd: number;
	/** Partidos confirmados (una fila de historial por partido). */
	partidos: number;
	/** Fecha "AAAA-MM-DD" del último partido confirmado. */
	ultimoPartido: string;
};

/** Qué grupo se muestra: `null` = todos. */
export type FiltroGrupo = 1 | 2 | null;

/** `?groupe=1` → 1; cualquier otro valor (o ninguno) → todos. */
export function leerFiltroGrupo(valor: string | null): FiltroGrupo {
	if (valor === '1') return 1;
	if (valor === '2') return 2;
	return null;
}

/**
 * Construye la clasificación (historia 4): solo jugadores con al menos un partido
 * confirmado, del rating más alto al más bajo; con el mismo rating, por nombre.
 * Con filtro de grupo, los jugadores sin grupo no salen y los puestos se cuentan
 * dentro del grupo.
 */
export function construirClasificacion(
	filas: readonly FilaClasificacion[],
	hoy: string,
	grupo: FiltroGrupo = null
): PuestoClasificacion[] {
	return filas
		.filter((fila) => fila.historial_rating.length > 0)
		.filter((fila) => grupo === null || fila.grupo === grupo)
		.map((fila) => {
			// Las fechas "AAAA-MM-DD" se ordenan bien como texto.
			const ultimoPartido = fila.historial_rating
				.map(({ fecha }) => fecha)
				.reduce((a, b) => (b > a ? b : a));
			return {
				id: fila.id,
				nombre: fila.nombre,
				grupo: fila.grupo,
				rating: fila.rating,
				rd: rdTrasInactividad(fila.rd, fila.volatilidad, ultimoPartido, hoy),
				partidos: fila.historial_rating.length,
				ultimoPartido
			};
		})
		.sort((a, b) => b.rating - a.rating || a.nombre.localeCompare(b.nombre, 'fr'))
		.map((jugador, indice) => ({ puesto: indice + 1, ...jugador }));
}

type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string };

/** Lee de Supabase los jugadores con al menos un partido confirmado y su historial. */
export async function leerClasificacion(
	cliente: ClienteSupabase
): Promise<Resultado<FilaClasificacion[]>> {
	try {
		const { data, error } = await cliente
			.from('jugadores')
			// `!inner`: solo los jugadores con al menos una fila en `historial_rating`,
			// es decir, con al menos un partido confirmado (como un JOIN de SQL).
			.select('id, nombre, grupo, rating, rd, volatilidad, historial_rating!inner(fecha)')
			.overrideTypes<FilaClasificacion[], { merge: false }>();
		if (error) {
			return { ok: false, error: `Impossible de lire le classement : ${error.message}` };
		}
		return { ok: true, datos: data ?? [] };
	} catch (e) {
		const detalle = e instanceof Error ? e.message : String(e);
		return { ok: false, error: `Impossible de contacter Supabase : ${detalle}` };
	}
}
