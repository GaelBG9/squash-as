/** Fila de la tabla `jugadores` (ver supabase/sql/0002_jugadores.sql). */
export type Jugador = {
	id: string;
	nombre: string;
	email: string;
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
