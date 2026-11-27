import type { Formato, Juego } from './marcador.ts';
import type { Jugador } from './jugadores.ts';
import type { ClienteSupabase } from './supabase.ts';

/** Estado de un partido: solo cuenta en las clasificaciones cuando está confirmado (R1). */
export type EstadoPartido = 'pendiente' | 'confirmado' | 'rechazado';

/** Fila de la tabla `partidos` (ver supabase/sql/0006_partidos.sql). */
export type Partido = {
	id: number;
	fecha: string;
	tipo: 'entrenamiento' | 'torneo';
	formato: Formato;
	/** Quien registró el partido (R13). */
	jugador_a: string;
	/** El rival, el único que puede confirmarlo o rechazarlo (R2). */
	jugador_b: string;
	/** `null` = empate (solo en formato libre). */
	ganador: string | null;
	estado: EstadoPartido;
	registrado_por: string;
	registrado_en: string;
	/** Cuándo respondió el rival; `null` mientras está pendiente. */
	respondido_en: string | null;
};

/** Fila de la tabla `juegos`. */
export type JuegoGuardado = { partido: number; numero: number; puntos_a: number; puntos_b: number };

export type Rival = Pick<Jugador, 'id' | 'nombre'>;

type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string };

function errorDeRed(e: unknown): string {
	const detalle = e instanceof Error ? e.message : String(e);
	return `Impossible de contacter Supabase : ${detalle}`;
}

/** Jugadores contra los que puedo registrar un partido: todos menos yo, por nombre. */
export async function leerRivales(
	cliente: ClienteSupabase,
	idUsuario: string
): Promise<Resultado<Rival[]>> {
	try {
		const { data, error } = await cliente
			.from('jugadores')
			.select('id, nombre')
			.neq('id', idUsuario)
			.order('nombre')
			.overrideTypes<Rival[], { merge: false }>();
		if (error) return { ok: false, error: `Impossible de lire les joueurs : ${error.message}` };
		return { ok: true, datos: data ?? [] };
	} catch (e) {
		return { ok: false, error: errorDeRed(e) };
	}
}

export type DatosRegistro = { rival: string; fecha: string; formato: Formato; juegos: Juego[] };

/**
 * Registra un partido con la función `registrar_partido` de la base de datos,
 * que vuelve a comprobar el marcador y lo deja "pendiente". Devuelve su id.
 */
export async function registrarPartido(
	cliente: ClienteSupabase,
	{ rival, fecha, formato, juegos }: DatosRegistro
): Promise<Resultado<number>> {
	try {
		// Sin tipos generados de la base de datos, `rpc` no sabe qué devuelve: se lo decimos.
		const { data, error } = (await cliente.rpc('registrar_partido', {
			p_rival: rival,
			p_fecha: fecha,
			p_formato: formato,
			p_juegos: juegos.map(({ a, b }) => ({ a, b }))
		})) as { data: number | null; error: { message: string } | null };
		if (error) return { ok: false, error: `Impossible d’enregistrer le match : ${error.message}` };
		return { ok: true, datos: Number(data) };
	} catch (e) {
		return { ok: false, error: errorDeRed(e) };
	}
}

/** Lo que el rival puede contestar a un partido pendiente. */
export type Respuesta = Extract<EstadoPartido, 'confirmado' | 'rechazado'>;

export function esRespuesta(valor: unknown): valor is Respuesta {
	return valor === 'confirmado' || valor === 'rechazado';
}

/**
 * Confirma o rechaza un partido con la función `responder_partido` de la base de
 * datos, que comprueba que soy el rival y que el partido sigue pendiente.
 */
export async function responderPartido(
	cliente: ClienteSupabase,
	partido: number,
	respuesta: Respuesta
): Promise<Resultado<null>> {
	try {
		const { error } = (await cliente.rpc('responder_partido', {
			p_partido: partido,
			p_respuesta: respuesta
		})) as { error: { message: string } | null };
		if (error) return { ok: false, error: `Impossible de répondre au match : ${error.message}` };
		return { ok: true, datos: null };
	} catch (e) {
		return { ok: false, error: errorDeRed(e) };
	}
}

/** Lo que devuelve la consulta de `leerMisPartidos`. */
export type FilaPartido = Partido & {
	juegos: Omit<JuegoGuardado, 'partido'>[];
	nombre_a: { nombre: string } | null;
	nombre_b: { nombre: string } | null;
};

/** Un partido contado desde mi punto de vista: "mis puntos - sus puntos". */
export type MiPartido = {
	id: number;
	fecha: string;
	formato: Formato;
	estado: EstadoPartido;
	rival: string;
	resultado: 'victoria' | 'derrota' | 'empate';
	/** Juegos en orden: `a` son mis puntos y `b` los del rival. */
	juegos: Juego[];
	registradoPorMi: boolean;
	/** Puedo confirmarlo o rechazarlo: está pendiente y soy el rival (R2, R13). */
	puedoResponder: boolean;
};

/** Pasa una fila de la base de datos a mi punto de vista. */
export function desdeMiPunto(fila: FilaPartido, idUsuario: string): MiPartido {
	const soyA = fila.jugador_a === idUsuario;
	const juegos = [...fila.juegos]
		.sort((x, y) => x.numero - y.numero)
		.map(({ puntos_a, puntos_b }) =>
			soyA ? { a: puntos_a, b: puntos_b } : { a: puntos_b, b: puntos_a }
		);
	const rival = (soyA ? fila.nombre_b : fila.nombre_a)?.nombre ?? 'Joueur inconnu';
	const resultado =
		fila.ganador === null ? 'empate' : fila.ganador === idUsuario ? 'victoria' : 'derrota';
	return {
		id: fila.id,
		fecha: fila.fecha,
		formato: fila.formato,
		estado: fila.estado,
		rival,
		resultado,
		juegos,
		registradoPorMi: fila.registrado_por === idUsuario,
		puedoResponder:
			fila.estado === 'pendiente' &&
			fila.jugador_b === idUsuario &&
			fila.registrado_por !== idUsuario
	};
}

/** Mis partidos (como A o como B), del más reciente al más antiguo. */
export async function leerMisPartidos(
	cliente: ClienteSupabase,
	idUsuario: string
): Promise<Resultado<MiPartido[]>> {
	try {
		const { data, error } = await cliente
			.from('partidos')
			// `nombre_a:jugadores!partidos_jugador_a_fkey(nombre)`: trae el nombre del jugador A
			// siguiendo la clave foránea; hay que decir cuál porque hay varias hacia `jugadores`.
			.select(
				'*, juegos(numero, puntos_a, puntos_b), ' +
					'nombre_a:jugadores!partidos_jugador_a_fkey(nombre), ' +
					'nombre_b:jugadores!partidos_jugador_b_fkey(nombre)'
			)
			.or(`jugador_a.eq.${idUsuario},jugador_b.eq.${idUsuario}`)
			.order('fecha', { ascending: false })
			.order('registrado_en', { ascending: false })
			.overrideTypes<FilaPartido[], { merge: false }>();
		if (error) return { ok: false, error: `Impossible de lire tes matchs : ${error.message}` };
		return { ok: true, datos: (data ?? []).map((fila) => desdeMiPunto(fila, idUsuario)) };
	} catch (e) {
		return { ok: false, error: errorDeRed(e) };
	}
}

export function textoEstado(estado: EstadoPartido): string {
	const textos: Record<EstadoPartido, string> = {
		pendiente: 'En attente de confirmation',
		confirmado: 'Confirmé',
		rechazado: 'Refusé'
	};
	return textos[estado];
}

export function textoFormato(formato: Formato): string {
	const textos: Record<Formato, string> = {
		libre: 'Jeux libres (1 ou 2)',
		mejor_de_3: 'Au meilleur des 3 jeux',
		mejor_de_5: 'Au meilleur des 5 jeux'
	};
	return textos[formato];
}

export function textoResultado(resultado: MiPartido['resultado']): string {
	const textos: Record<MiPartido['resultado'], string> = {
		victoria: 'Victoire',
		derrota: 'Défaite',
		empate: 'Égalité'
	};
	return textos[resultado];
}

/** "3-1 · 11-7, 9-11, 11-5, 11-8" (mis juegos ganados primero). */
export function textoMarcador(juegos: readonly Juego[]): string {
	const ganados = juegos.filter(({ a, b }) => a > b).length;
	const detalle = juegos.map(({ a, b }) => `${a}-${b}`).join(', ');
	return `${ganados}-${juegos.length - ganados} · ${detalle}`;
}

/** "2026-11-27" → "27 nov. 2026". */
export function fechaCorta(fecha: string): string {
	const [anio, mes, dia] = fecha.split('-').map(Number);
	return new Date(Date.UTC(anio, mes - 1, dia, 12)).toLocaleDateString('fr', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC'
	});
}
