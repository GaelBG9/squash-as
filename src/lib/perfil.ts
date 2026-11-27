import type { Jugador } from './jugadores.ts';
import type { ClienteSupabase } from './supabase.ts';

export type DatosPerfil = Pick<Jugador, 'nombre' | 'grupo' | 'rol' | 'rating' | 'rd'>;

export type EstadoPerfil =
	| { estado: 'sin-sesion' }
	| { estado: 'conectado'; jugador: DatosPerfil }
	/** Conectado, pero sin fila en `jugadores` (p. ej. falta ejecutar el SQL 0003). */
	| { estado: 'sin-perfil' }
	| { estado: 'error'; error: string };

/** Lee el perfil del jugador conectado; `idUsuario` es `null` si no hay sesión. */
export async function leerPerfil(
	cliente: ClienteSupabase,
	idUsuario: string | null
): Promise<EstadoPerfil> {
	if (!idUsuario) return { estado: 'sin-sesion' };

	try {
		const { data, error } = await cliente
			.from('jugadores')
			.select('nombre, grupo, rol, rating, rd')
			.eq('id', idUsuario)
			.maybeSingle()
			.overrideTypes<DatosPerfil | null, { merge: false }>();

		if (error)
			return { estado: 'error', error: `Impossible de lire ton profil : ${error.message}` };
		if (!data) return { estado: 'sin-perfil' };
		return { estado: 'conectado', jugador: data };
	} catch (e) {
		const detalle = e instanceof Error ? e.message : String(e);
		return { estado: 'error', error: `Impossible de contacter Supabase : ${detalle}` };
	}
}

/** Texto para mostrar el grupo, que puede no estar asignado todavía. */
export function textoGrupo(grupo: DatosPerfil['grupo']): string {
	return grupo === null
		? 'Non attribué (c’est l’administrateur qui l’attribue)'
		: `Groupe ${grupo}`;
}

export function textoRol(rol: DatosPerfil['rol']): string {
	return rol === 'admin' ? 'Administrateur' : 'Joueur';
}

/**
 * Nivel Glicko-2 redondeado, con su incertidumbre (RD): "1662 ± 290".
 * Un RD alto quiere decir que todavía no sabemos bien tu nivel.
 */
export function textoNivel(rating: number, rd: number): string {
	return `${Math.round(rating)} ± ${Math.round(rd)}`;
}
