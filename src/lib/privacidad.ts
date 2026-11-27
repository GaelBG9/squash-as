import type { DatosPrivados, Jugador } from './jugadores.ts';
import type { JuegoGuardado, Partido } from './partidos.ts';

/** Email publicado en la política para pedir acceso, corrección o borrado de los datos. */
export const EMAIL_CONTACTO = 'boennec.gael@gmail.com';

/** Fecha de la última versión de la política (formato AAAA-MM-DD). */
export const ULTIMA_ACTUALIZACION = '2026-11-27';

/**
 * Todas las columnas de las tablas con datos de jugadores. `satisfies` obliga a
 * listarlas todas: si se añade una columna a uno de estos tipos y no aquí, el
 * código no compila.
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
	} satisfies Record<keyof DatosPrivados, true>,
	/** Visible para todos los jugadores conectados (tarea 1.1). */
	partidos: {
		id: true,
		fecha: true,
		tipo: true,
		formato: true,
		jugador_a: true,
		jugador_b: true,
		ganador: true,
		estado: true,
		registrado_por: true,
		registrado_en: true,
		respondido_en: true
	} satisfies Record<keyof Partido, true>,
	/** Visible para todos los jugadores conectados (tarea 1.1). */
	juegos: {
		partido: true,
		numero: true,
		puntos_a: true,
		puntos_b: true
	} satisfies Record<keyof JuegoGuardado, true>
} as const;

/** Tablas que solo ven el propio jugador y el admin (R11); las demás, todos los conectados. */
const TABLAS_PRIVADAS: readonly Tabla[] = ['jugadores_privado'];

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

/** Datos de jugadores que guarda la app: perfil (`jugadores`, `jugadores_privado`) y partidos. */
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
	},
	{
		dato: 'Matchs : adversaire, date, type, format, gagnant et statut (en attente, confirmé ou refusé)',
		para: 'Permettre à ton adversaire de confirmer le résultat et calculer les classements et les statistiques.',
		columnas: [
			'partidos.id',
			'partidos.fecha',
			'partidos.tipo',
			'partidos.formato',
			'partidos.jugador_a',
			'partidos.jugador_b',
			'partidos.ganador',
			'partidos.estado'
		]
	},
	{
		dato: 'Score de chaque jeu',
		para: 'Afficher le résultat détaillé et calculer les statistiques (jeux et points gagnés ou perdus).',
		columnas: ['juegos.partido', 'juegos.numero', 'juegos.puntos_a', 'juegos.puntos_b']
	},
	{
		dato: 'Qui a enregistré un match, et quand',
		para: 'Savoir qui doit le confirmer et le valider automatiquement s’il reste sans réponse 15 jours.',
		columnas: ['partidos.registrado_por', 'partidos.registrado_en']
	},
	{
		dato: 'Date de la réponse à un match (confirmation ou refus)',
		para: 'Savoir quand ton adversaire a répondu, pour vérifier un résultat en cas de doute.',
		columnas: ['partidos.respondido_en']
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
 * Quién puede ver un dato, según su tabla: lo que solo está en tablas privadas
 * (`jugadores_privado`) lo ven tú y el admin (R11); el resto, todos los conectados (R10).
 */
export function quienLoVe(dato: DatoGuardado): string {
	const esPrivada = (columna: Columna) =>
		TABLAS_PRIVADAS.some((tabla) => columna.startsWith(`${tabla}.`));
	return dato.columnas.every(esPrivada)
		? 'Visible uniquement par toi et l’administrateur'
		: 'Visible par les joueurs connectés';
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
