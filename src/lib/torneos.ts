import type { Jugador } from './jugadores.ts';
import { esFechaValida } from './marcador.ts';
import { errorDeRed, type Resultado } from './resultado.ts';
import type { ClienteSupabase } from './supabase.ts';

/** Un cuadro tiene 16 plazas: no se inscribe a nadie más (R5, R17). */
export const MAX_INSCRITOS = 16;

/** Igual que el `check` de la tabla `torneos` (supabase/sql/0010_torneos.sql). */
export const LARGO_MAXIMO_NOMBRE = 80;

/** Fila de la tabla `torneos`. */
export type Torneo = {
	id: number;
	nombre: string;
	/** AAAA-MM-DD. */
	fecha: string;
	/** "2026-2027": la calcula la base de datos a partir de la fecha (R25). */
	temporada: string;
};

export type Inscrito = Pick<Jugador, 'id' | 'nombre'>;

export type TorneoConInscritos = Torneo & { inscritos: Inscrito[] };

/**
 * Temporada de una fecha AAAA-MM-DD: del 1 de septiembre al 31 de agosto (R25).
 * La base de datos hace el mismo cálculo en la columna `temporada`; esta versión
 * sirve para enseñar la temporada en el formulario antes de crear el torneo.
 */
export function temporadaDe(fecha: string): string {
	const anio = Number(fecha.slice(0, 4));
	const mes = Number(fecha.slice(5, 7));
	return mes >= 9 ? `${anio}-${anio + 1}` : `${anio - 1}-${anio}`;
}

export type ErroresTorneo = Partial<Record<'nombre' | 'fecha' | 'general', string>>;

/** Comprueba el formulario de creación; la base de datos lo vuelve a comprobar. */
export function validarTorneo(nombre: string, fecha: string): ErroresTorneo {
	const errores: ErroresTorneo = {};
	const limpio = nombre.trim();
	if (limpio.length === 0) errores.nombre = 'Indique le nom du tournoi.';
	else if (limpio.length > LARGO_MAXIMO_NOMBRE) {
		errores.nombre = `Le nom est trop long (${LARGO_MAXIMO_NOMBRE} caractères au maximum).`;
	}
	if (!esFechaValida(fecha)) errores.fecha = 'Indique la date du tournoi.';
	return errores;
}

/** Lee un número de id positivo de un texto (URL o formulario); si no vale, `null`. */
export function leerId(texto: unknown): number | null {
	if (typeof texto !== 'string' || !/^\d+$/.test(texto)) return null;
	const id = Number(texto);
	return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Todos los torneos, del más reciente al más antiguo. */
export async function leerTorneos(cliente: ClienteSupabase): Promise<Resultado<Torneo[]>> {
	try {
		const { data, error } = await cliente
			.from('torneos')
			.select('id, nombre, fecha, temporada')
			.order('fecha', { ascending: false })
			.order('id', { ascending: false })
			.overrideTypes<Torneo[], { merge: false }>();
		if (error) return { ok: false, error: `Impossible de lire les tournois : ${error.message}` };
		return { ok: true, datos: data ?? [] };
	} catch (e) {
		return { ok: false, error: errorDeRed(e) };
	}
}

type FilaTorneo = Torneo & { inscripciones: { jugadores: Inscrito | null }[] };

/** Un torneo con sus inscritos por orden alfabético; `null` si no existe. */
export async function leerTorneo(
	cliente: ClienteSupabase,
	id: number
): Promise<Resultado<TorneoConInscritos | null>> {
	try {
		const { data, error } = await cliente
			.from('torneos')
			// Sigue la clave foránea inscripciones → jugadores para traer el nombre.
			.select('id, nombre, fecha, temporada, inscripciones(jugadores(id, nombre))')
			.eq('id', id)
			.maybeSingle()
			.overrideTypes<FilaTorneo | null, { merge: false }>();
		if (error) return { ok: false, error: `Impossible de lire le tournoi : ${error.message}` };
		if (!data) return { ok: true, datos: null };
		const { inscripciones, ...torneo } = data;
		const inscritos = inscripciones
			.map((fila) => fila.jugadores)
			.filter((jugador): jugador is Inscrito => jugador !== null)
			.sort((a, b) => a.nombre.localeCompare(b.nombre, 'fr'));
		return { ok: true, datos: { ...torneo, inscritos } };
	} catch (e) {
		return { ok: false, error: errorDeRed(e) };
	}
}

/** Todos los jugadores, por nombre: el admin elige entre ellos a quién inscribir. */
export async function leerJugadores(cliente: ClienteSupabase): Promise<Resultado<Inscrito[]>> {
	try {
		const { data, error } = await cliente
			.from('jugadores')
			.select('id, nombre')
			.order('nombre')
			.overrideTypes<Inscrito[], { merge: false }>();
		if (error) return { ok: false, error: `Impossible de lire les joueurs : ${error.message}` };
		return { ok: true, datos: data ?? [] };
	} catch (e) {
		return { ok: false, error: errorDeRed(e) };
	}
}

/** Jugadores que todavía se pueden inscribir: los que no lo están ya. */
export function noInscritos(jugadores: readonly Inscrito[], inscritos: readonly Inscrito[]) {
	const ya = new Set(inscritos.map((j) => j.id));
	return jugadores.filter((j) => !ya.has(j.id));
}

type RespuestaRpc<T> = { data: T | null; error: { message: string } | null };

/** Crea un torneo con la función `crear_torneo` (solo el admin). Devuelve su id. */
export async function crearTorneo(
	cliente: ClienteSupabase,
	nombre: string,
	fecha: string
): Promise<Resultado<number>> {
	try {
		const { data, error } = (await cliente.rpc('crear_torneo', {
			p_nombre: nombre.trim(),
			p_fecha: fecha
		})) as RespuestaRpc<number>;
		if (error) return { ok: false, error: `Impossible de créer le tournoi : ${error.message}` };
		return { ok: true, datos: Number(data) };
	} catch (e) {
		return { ok: false, error: errorDeRed(e) };
	}
}

/**
 * Inscribe o desinscribe a un jugador (solo el admin). La base de datos comprueba
 * el máximo de 16 y que nadie esté inscrito dos veces.
 */
export async function cambiarInscripcion(
	cliente: ClienteSupabase,
	accion: 'inscribir' | 'desinscribir',
	torneo: number,
	jugador: string
): Promise<Resultado<null>> {
	try {
		const { error } = (await cliente.rpc(
			accion === 'inscribir' ? 'inscribir_jugador' : 'desinscribir_jugador',
			{ p_torneo: torneo, p_jugador: jugador }
		)) as RespuestaRpc<null>;
		if (error) {
			// "d’inscrire" pero "de désinscrire": delante de vocal, "de" pierde la e.
			const que = accion === 'inscribir' ? 'd’inscrire' : 'de désinscrire';
			return { ok: false, error: `Impossible ${que} le joueur : ${error.message}` };
		}
		return { ok: true, datos: null };
	} catch (e) {
		return { ok: false, error: errorDeRed(e) };
	}
}
