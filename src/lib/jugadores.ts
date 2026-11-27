/**
 * Fila de la tabla `jugadores` (ver supabase/sql/0002_jugadores.sql y 0005).
 * Todos los jugadores conectados ven todas las filas (R10).
 */
export type Jugador = {
	id: string;
	nombre: string;
	/** `null` hasta que el admin asigne el grupo. */
	grupo: 1 | 2 | null;
	rol: 'jugador' | 'admin';
	/** Glicko-2: nivel estimado (empieza en 1500). */
	rating: number;
	/** Glicko-2: incertidumbre sobre el nivel (empieza en 350). */
	rd: number;
	/** Glicko-2: cuánto varía el nivel con el tiempo (empieza en 0.06). */
	volatilidad: number;
	creado_en: string;
};

/**
 * Fila de la tabla `historial_rating` (ver supabase/sql/0008_glicko2.sql): los valores
 * Glicko-2 de un jugador justo después de un partido confirmado. La escribe solo la
 * base de datos; todos los jugadores conectados la leen.
 */
export type HistorialRating = {
	id: number;
	jugador: string;
	partido: number;
	/** Fecha en la que se jugó el partido. */
	fecha: string;
	rating: number;
	rd: number;
	volatilidad: number;
};

/**
 * Fila de la tabla `jugadores_privado` (ver supabase/sql/0005_email_privado.sql).
 * Cada jugador solo ve la suya; el admin, todas (R11).
 */
export type DatosPrivados = {
	/** El mismo id que en `jugadores`. */
	id: string;
	email: string;
};
