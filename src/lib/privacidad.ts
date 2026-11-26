import type { Jugador } from './jugadores.ts';

/** Email publicado en la política para pedir acceso, corrección o borrado de los datos. */
export const EMAIL_CONTACTO = 'boennec.gael@gmail.com';

/** Fecha de la última versión de la política (formato AAAA-MM-DD). */
export const ULTIMA_ACTUALIZACION = '2026-11-26';

/**
 * Todas las columnas de la tabla `jugadores`. `satisfies` obliga a listarlas
 * todas: si se añade una columna a `Jugador` y no aquí, el código no compila.
 */
export const COLUMNAS_JUGADOR = {
	id: true,
	nombre: true,
	email: true,
	grupo: true,
	rol: true,
	rating: true,
	rd: true,
	volatilidad: true,
	creado_en: true
} as const satisfies Record<keyof Jugador, true>;

export type DatoGuardado = {
	/** Qué dato es, en palabras normales. */
	dato: string;
	/** Para qué lo usamos. */
	para: string;
	/** Columnas de `jugadores` que cubre esta línea. */
	columnas: readonly (keyof Jugador)[];
};

/** Datos de tu perfil de jugador que guarda la app (tabla `jugadores`). */
export const DATOS_GUARDADOS: readonly DatoGuardado[] = [
	{
		dato: 'Nombre',
		para: 'Mostrarte en los partidos y las clasificaciones. Viene de tu cuenta Google y puedes cambiarlo.',
		columnas: ['nombre']
	},
	{
		dato: 'Email de Google',
		para: 'Saber qué cuenta es la tuya y poder contactarte si hay un problema con un resultado.',
		columnas: ['email']
	},
	{
		dato: 'Grupo (1 o 2) y rol (jugador o administrador)',
		para: 'Organizar las clases y decidir quién puede gestionar miembros y torneos. Solo el administrador los cambia.',
		columnas: ['grupo', 'rol']
	},
	{
		dato: 'Nivel Glicko-2 (rating, incertidumbre y volatilidad)',
		para: 'Calcular la clasificación de nivel a partir de tus partidos confirmados.',
		columnas: ['rating', 'rd', 'volatilidad']
	},
	{
		dato: 'Identificador interno y fecha de alta',
		para: 'Relacionar tu perfil con tu cuenta y saber desde cuándo estás inscrito.',
		columnas: ['id', 'creado_en']
	}
];

/** Columnas de `jugadores` que ninguna línea de `DATOS_GUARDADOS` explica. */
export function columnasSinExplicar(datos: readonly DatoGuardado[] = DATOS_GUARDADOS): string[] {
	const explicadas = new Set<string>(datos.flatMap((d) => d.columnas));
	return Object.keys(COLUMNAS_JUGADOR).filter((columna) => !explicadas.has(columna));
}

/** "2026-11-26" → "26 de noviembre de 2026". */
export function fechaLegible(fecha: string): string {
	const [anio, mes, dia] = fecha.split('-').map(Number);
	// Mediodía UTC: el día no cambia sea cual sea la zona horaria del servidor.
	return new Date(Date.UTC(anio, mes - 1, dia, 12)).toLocaleDateString('es', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	});
}
