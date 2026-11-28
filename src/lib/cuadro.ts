import { errorDeRed, type Resultado } from './resultado.ts';
import type { ClienteSupabase } from './supabase.ts';
import type { Inscrito } from './torneos.ts';

/**
 * Orden clásico de un cuadro de 16, de arriba abajo: la posición 1 de la 1.ª ronda
 * es para el cabeza de serie 1, la 2 para el 16, la 3 para el 8... El mismo array
 * está en `generar_cuadro` (supabase/sql/0011_cuadros.sql).
 */
export const ORDEN_CABEZAS = [1, 16, 8, 9, 5, 12, 4, 13, 3, 14, 6, 11, 7, 10, 2, 15] as const;

/** Rondas del cuadro principal: 16 plazas, 8, 4 (semifinales) y 2 (final). */
export const RONDAS = 4;

/** Mínimo de inscritos para generar el cuadro (R18). */
export const MIN_INSCRITOS = 2;

/** Plazas de una ronda: 16 en la 1.ª, 8 en la 2.ª, 4 en la 3.ª y 2 en la final. */
export function plazasDeRonda(ronda: number): number {
	return 16 >> (ronda - 1);
}

/** Cabeza de serie que ocupa una posición de la 1.ª ronda (1 a 16). */
export function cabezaDePosicion(posicion: number): number {
	const cabeza = ORDEN_CABEZAS[posicion - 1];
	if (cabeza === undefined) throw new RangeError(`Posición fuera del cuadro: ${posicion}`);
	return cabeza;
}

export function nombreRonda(ronda: number): string {
	return ['Premier tour', 'Quarts de finale', 'Demi-finales', 'Finale'][ronda - 1] ?? '';
}

/**
 * Fila de la tabla `cuadros`. Solo existe cuando la plaza está decidida:
 * `jugador` es quien la ocupa, o `null` si está vacía (exento).
 */
export type Plaza<J = Inscrito> = { ronda: number; posicion: number; jugador: J | null };

/** Un lado de un cruce: un jugador (con su cabeza de serie), un exento o aún sin saber. */
export type Lado =
	| { tipo: 'jugador'; jugador: Inscrito; cabeza: number | null }
	| { tipo: 'exento' }
	| { tipo: 'por_decidir' };

/**
 * - `partido`: dos jugadores, se juega (tarea 2.3);
 * - `exento`: un jugador contra una plaza vacía, pasa solo;
 * - `vacio`: dos plazas vacías, no hay nada que jugar;
 * - `por_decidir`: falta saber quién llega a una de las plazas.
 */
export type EstadoCruce = 'partido' | 'exento' | 'vacio' | 'por_decidir';

export type Cruce = { arriba: Lado; abajo: Lado; estado: EstadoCruce };

export type Ronda = { ronda: number; nombre: string; cruces: Cruce[] };

function estadoDe(arriba: Lado, abajo: Lado): EstadoCruce {
	if (arriba.tipo === 'por_decidir' || abajo.tipo === 'por_decidir') return 'por_decidir';
	if (arriba.tipo === 'jugador' && abajo.tipo === 'jugador') return 'partido';
	if (arriba.tipo === 'exento' && abajo.tipo === 'exento') return 'vacio';
	return 'exento';
}

/**
 * Agrupa las plazas leídas de la base de datos en rondas y cruces (posiciones 1-2,
 * 3-4...). El cabeza de serie de cada jugador sale de su posición en la 1.ª ronda,
 * así que no hace falta guardarlo.
 */
export function construirCuadro(plazas: readonly Plaza[]): Ronda[] {
	const porClave = new Map(plazas.map((p) => [`${p.ronda}-${p.posicion}`, p]));
	const cabezas = new Map<string, number>();
	for (const p of plazas) {
		if (p.ronda === 1 && p.jugador) cabezas.set(p.jugador.id, cabezaDePosicion(p.posicion));
	}

	function lado(ronda: number, posicion: number): Lado {
		const plaza = porClave.get(`${ronda}-${posicion}`);
		if (!plaza) return { tipo: 'por_decidir' };
		if (!plaza.jugador) return { tipo: 'exento' };
		return {
			tipo: 'jugador',
			jugador: plaza.jugador,
			cabeza: cabezas.get(plaza.jugador.id) ?? null
		};
	}

	const rondas: Ronda[] = [];
	for (let ronda = 1; ronda <= RONDAS; ronda++) {
		const cruces: Cruce[] = [];
		for (let p = 1; p <= plazasDeRonda(ronda) / 2; p++) {
			const arriba = lado(ronda, 2 * p - 1);
			const abajo = lado(ronda, 2 * p);
			cruces.push({ arriba, abajo, estado: estadoDe(arriba, abajo) });
		}
		rondas.push({ ronda, nombre: nombreRonda(ronda), cruces });
	}
	return rondas;
}

/**
 * Copia en TypeScript del cálculo de `generar_cuadro`, para probar con Vitest los
 * mismos casos que el script SQL (la CI no lanza los tests SQL). Recibe los
 * inscritos ya ordenados: el primero es el cabeza 1. La base de datos es quien
 * genera de verdad el cuadro; esta función no se usa en las páginas.
 */
export function generarPlazas<J>(ordenados: readonly J[]): Plaza<J>[] {
	if (ordenados.length < MIN_INSCRITOS || ordenados.length > 16) {
		throw new RangeError(`Entre ${MIN_INSCRITOS} y 16 inscritos: ${ordenados.length}`);
	}
	const plazas: Plaza<J>[] = ORDEN_CABEZAS.map((cabeza, i) => ({
		ronda: 1,
		posicion: i + 1,
		jugador: ordenados[cabeza - 1] ?? null
	}));
	for (let ronda = 1; ronda < RONDAS; ronda++) {
		for (let p = 1; p <= plazasDeRonda(ronda) / 2; p++) {
			const par = plazas.filter(
				(pl) => pl.ronda === ronda && (pl.posicion === 2 * p - 1 || pl.posicion === 2 * p)
			);
			const conJugador = par.filter((pl) => pl.jugador !== null);
			if (par.length === 2 && conJugador.length <= 1) {
				plazas.push({ ronda: ronda + 1, posicion: p, jugador: conJugador[0]?.jugador ?? null });
			}
		}
	}
	return plazas;
}

type FilaCuadro = { ronda: number; posicion: number; jugador: Inscrito | null };

/** Plazas del cuadro principal de un torneo; lista vacía si aún no se ha generado. */
export async function leerCuadro(
	cliente: ClienteSupabase,
	torneo: number
): Promise<Resultado<Plaza[]>> {
	try {
		const { data, error } = await cliente
			.from('cuadros')
			// `jugador:jugadores(...)` sigue la clave foránea y llama "jugador" al resultado.
			.select('ronda, posicion, jugador:jugadores(id, nombre)')
			.eq('torneo', torneo)
			.eq('cuadro', 'principal')
			.order('ronda')
			.order('posicion')
			.overrideTypes<FilaCuadro[], { merge: false }>();
		if (error) return { ok: false, error: `Impossible de lire le tableau : ${error.message}` };
		return { ok: true, datos: data ?? [] };
	} catch (e) {
		return { ok: false, error: errorDeRed(e) };
	}
}

type RespuestaRpc = { data: unknown; error: { message: string } | null };

/** Genera o borra el cuadro con `generar_cuadro` / `borrar_cuadro` (solo el admin). */
export async function cambiarCuadro(
	cliente: ClienteSupabase,
	accion: 'generar' | 'borrar',
	torneo: number
): Promise<Resultado<null>> {
	try {
		const { error } = (await cliente.rpc(
			accion === 'generar' ? 'generar_cuadro' : 'borrar_cuadro',
			{ p_torneo: torneo }
		)) as RespuestaRpc;
		if (error) {
			const que = accion === 'generar' ? 'de générer' : 'de supprimer';
			return { ok: false, error: `Impossible ${que} le tableau : ${error.message}` };
		}
		return { ok: true, datos: null };
	} catch (e) {
		return { ok: false, error: errorDeRed(e) };
	}
}
