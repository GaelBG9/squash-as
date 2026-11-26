import type { DatosPrivados, Jugador } from './jugadores.ts';

/** Email publicado en la política para pedir acceso, corrección o borrado de los datos. */
export const EMAIL_CONTACTO = 'boennec.gael@gmail.com';

/** Fecha de la última versión de la política (formato AAAA-MM-DD). */
export const ULTIMA_ACTUALIZACION = '2026-11-26';

/**
 * Todas las columnas de las tablas con datos de jugadores. `satisfies` obliga a
 * listarlas todas: si se añade una columna a `Jugador` o a `DatosPrivados` y no
 * aquí, el código no compila.
 */
export const COLUMNAS_GUARDADAS = {
	/** Visible para todos los jugadores conectados (R10). */
	jugadores: {
		id: true,
		nombre: true,
		grupo: true,
		rol: true,
		rating: true,
		rd: true,
		volatilidad: true,
		creado_en: true
	} satisfies Record<keyof Jugador, true>,
	/** Visible solo para el propio jugador y el admin (R11). */
	jugadores_privado: {
		id: true,
		email: true
	} satisfies Record<keyof DatosPrivados, true>
} as const;

type Tabla = keyof typeof COLUMNAS_GUARDADAS;

/** Columna con su tabla delante, p. ej. `'jugadores_privado.email'`. */
export type Columna = {
	[T in Tabla]: `${T}.${keyof (typeof COLUMNAS_GUARDADAS)[T] & string}`;
}[Tabla];

export type DatoGuardado = {
	/** Qué dato es, en palabras normales. */
	dato: string;
	/** Para qué lo usamos. */
	para: string;
	/** Columnas que cubre esta línea. */
	columnas: readonly Columna[];
};

/** Datos de tu perfil de jugador que guarda la app (tablas `jugadores` y `jugadores_privado`). */
export const DATOS_GUARDADOS: readonly DatoGuardado[] = [
	{
		dato: 'Nom',
		para: 'T’afficher dans les matchs et les classements. Il vient de ton compte Google et tu peux le modifier.',
		columnas: ['jugadores.nombre']
	},
	{
		dato: 'E-mail Google',
		para: 'Savoir quel compte est le tien et pouvoir te contacter en cas de problème avec un résultat.',
		columnas: ['jugadores_privado.email']
	},
	{
		dato: 'Groupe (1 ou 2) et rôle (joueur ou administrateur)',
		para: 'Organiser les cours et décider qui peut gérer les membres et les tournois. Seul l’administrateur peut les modifier.',
		columnas: ['jugadores.grupo', 'jugadores.rol']
	},
	{
		dato: 'Niveau Glicko-2 (classement, incertitude et volatilité)',
		para: 'Calculer le classement par niveau à partir de tes matchs confirmés.',
		columnas: ['jugadores.rating', 'jugadores.rd', 'jugadores.volatilidad']
	},
	{
		dato: 'Identifiant interne et date d’inscription',
		para: 'Relier ton profil à ton compte et savoir depuis quand tu es inscrit.',
		columnas: ['jugadores.id', 'jugadores_privado.id', 'jugadores.creado_en']
	}
];

/** Todas las columnas guardadas, con su tabla delante. */
export function todasLasColumnas(): Columna[] {
	return Object.entries(COLUMNAS_GUARDADAS).flatMap(([tabla, columnas]) =>
		Object.keys(columnas).map((columna) => `${tabla}.${columna}` as Columna)
	);
}

/** Columnas que ninguna línea de `DATOS_GUARDADOS` explica. */
export function columnasSinExplicar(datos: readonly DatoGuardado[] = DATOS_GUARDADOS): string[] {
	const explicadas = new Set<string>(datos.flatMap((d) => d.columnas));
	return todasLasColumnas().filter((columna) => !explicadas.has(columna));
}

/**
 * Quién puede ver un dato, según su tabla: lo de `jugadores` lo ven todos los
 * conectados (R10); lo que solo está en `jugadores_privado`, tú y el admin (R11).
 */
export function quienLoVe(dato: DatoGuardado): string {
	return dato.columnas.some((columna) => columna.startsWith('jugadores.'))
		? 'Visible par les joueurs connectés'
		: 'Visible uniquement par toi et l’administrateur';
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
