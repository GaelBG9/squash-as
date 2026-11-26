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
		dato: 'Nom',
		para: 'T’afficher dans les matchs et les classements. Il vient de ton compte Google et tu peux le modifier.',
		columnas: ['nombre']
	},
	{
		dato: 'E-mail Google',
		para: 'Savoir quel compte est le tien et pouvoir te contacter en cas de problème avec un résultat.',
		columnas: ['email']
	},
	{
		dato: 'Groupe (1 ou 2) et rôle (joueur ou administrateur)',
		para: 'Organiser les cours et décider qui peut gérer les membres et les tournois. Seul l’administrateur peut les modifier.',
		columnas: ['grupo', 'rol']
	},
	{
		dato: 'Niveau Glicko-2 (classement, incertitude et volatilité)',
		para: 'Calculer le classement par niveau à partir de tes matchs confirmés.',
		columnas: ['rating', 'rd', 'volatilidad']
	},
	{
		dato: 'Identifiant interne et date d’inscription',
		para: 'Relier ton profil à ton compte et savoir depuis quand tu es inscrit.',
		columnas: ['id', 'creado_en']
	}
];

/** Columnas de `jugadores` que ninguna línea de `DATOS_GUARDADOS` explica. */
export function columnasSinExplicar(datos: readonly DatoGuardado[] = DATOS_GUARDADOS): string[] {
	const explicadas = new Set<string>(datos.flatMap((d) => d.columnas));
	return Object.keys(COLUMNAS_JUGADOR).filter((columna) => !explicadas.has(columna));
}

/** "2026-11-26" → "26 novembre 2026". */
export function fechaLegible(fecha: string): string {
	const [anio, mes, dia] = fecha.split('-').map(Number);
	// Mediodía UTC: el día no cambia sea cual sea la zona horaria del servidor.
	return new Date(Date.UTC(anio, mes - 1, dia, 12)).toLocaleDateString('fr', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	});
}
