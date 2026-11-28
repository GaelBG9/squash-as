/**
 * Reglas del marcador de un partido (R6 y R12). Son las mismas que comprueba la
 * función `registrar_partido` en supabase/sql/0006_partidos.sql: aquí sirven para
 * avisar al jugador antes de enviar; la base de datos vuelve a comprobarlas.
 */

/** `libre`: 1 o 2 juegos sueltos (entrenamientos); los otros, partidos completos. */
export type Formato = 'libre' | 'mejor_de_3' | 'mejor_de_5';

export const FORMATOS: readonly Formato[] = ['libre', 'mejor_de_3', 'mejor_de_5'];

/** Un juego: `a` son los puntos de quien registra; `b`, los del rival. */
export type Juego = { a: number; b: number };

export const PUNTOS_MAXIMOS = 99;

/** `objetivo`: juegos que hay que ganar para llevarse el partido (`null` = sin final). */
const REGLAS: Record<Formato, { maxJuegos: number; objetivo: number | null }> = {
	libre: { maxJuegos: 2, objetivo: null },
	mejor_de_3: { maxJuegos: 3, objetivo: 2 },
	mejor_de_5: { maxJuegos: 5, objetivo: 3 }
};

export function esFormato(valor: unknown): valor is Formato {
	return typeof valor === 'string' && (FORMATOS as readonly string[]).includes(valor);
}

/** Número máximo de juegos que admite un formato. */
export function maxJuegos(formato: Formato): number {
	return REGLAS[formato].maxJuegos;
}

export type ResultadoMarcador =
	/** `ganador`: `'a'`, `'b'` o `null` si hay empate (solo en formato libre). */
	| { ok: true; ganador: 'a' | 'b' | null; juegosA: number; juegosB: number }
	| { ok: false; error: string };

/** Comprueba el marcador y calcula quién gana el partido. */
export function validarMarcador(formato: Formato, juegos: readonly Juego[]): ResultadoMarcador {
	const { maxJuegos, objetivo } = REGLAS[formato];

	if (juegos.length === 0) return { ok: false, error: 'Indique le score d’au moins un jeu.' };
	if (juegos.length > maxJuegos) {
		return { ok: false, error: `Trop de jeux pour ce format (${maxJuegos} au maximum).` };
	}

	let juegosA = 0;
	let juegosB = 0;
	for (const [indice, { a, b }] of juegos.entries()) {
		const numero = indice + 1;
		if (!esPuntuacion(a) || !esPuntuacion(b)) {
			return {
				ok: false,
				error: `Jeu ${numero} : les points doivent être des nombres entiers entre 0 et ${PUNTOS_MAXIMOS}.`
			};
		}
		if (a === b) return { ok: false, error: `Jeu ${numero} : il faut un gagnant (pas d’égalité).` };
		if (objetivo !== null && Math.max(juegosA, juegosB) >= objetivo) {
			return {
				ok: false,
				error: `Jeu ${numero} : le match était déjà terminé, ce jeu est en trop.`
			};
		}
		if (a > b) juegosA++;
		else juegosB++;
	}

	if (objetivo !== null && Math.max(juegosA, juegosB) < objetivo) {
		return { ok: false, error: `Le match n’est pas terminé : il faut gagner ${objetivo} jeux.` };
	}

	const ganador = juegosA > juegosB ? 'a' : juegosB > juegosA ? 'b' : null;
	return { ok: true, ganador, juegosA, juegosB };
}

function esPuntuacion(puntos: number): boolean {
	return Number.isInteger(puntos) && puntos >= 0 && puntos <= PUNTOS_MAXIMOS;
}

/** Nombres de los campos del formulario para el juego `numero` (de 1 a 5). */
export function camposJuego(numero: number): { a: string; b: string } {
	return { a: `juego_${numero}_a`, b: `juego_${numero}_b` };
}

/** Texto de un campo del formulario, sin espacios alrededor ('' si falta o es un archivo). */
export function textoDelFormulario(formulario: FormData, campo: string): string {
	const valor = formulario.get(campo);
	return typeof valor === 'string' ? valor.trim() : '';
}

export type JuegosLeidos = { ok: true; juegos: Juego[] } | { ok: false; error: string };

/**
 * Lee los juegos del formulario, en orden, hasta el máximo del formato.
 * Las filas vacías se ignoran; una fila con un solo lado rellenado es un error.
 */
export function leerJuegosDelFormulario(formulario: FormData, formato: Formato): JuegosLeidos {
	const juegos: Juego[] = [];
	for (let numero = 1; numero <= maxJuegos(formato); numero++) {
		const campos = camposJuego(numero);
		const textoA = textoDelFormulario(formulario, campos.a);
		const textoB = textoDelFormulario(formulario, campos.b);
		if (textoA === '' && textoB === '') continue;
		if (textoA === '' || textoB === '') {
			return { ok: false, error: `Jeu ${numero} : indique les points des deux joueurs.` };
		}
		// Solo cifras: `Number('1e1')` o `Number(' 0x1')` darían números inesperados.
		if (!/^\d+$/.test(textoA) || !/^\d+$/.test(textoB)) {
			return {
				ok: false,
				error: `Jeu ${numero} : les points doivent être des nombres entiers entre 0 et ${PUNTOS_MAXIMOS}.`
			};
		}
		juegos.push({ a: Number(textoA), b: Number(textoB) });
	}
	return { ok: true, juegos };
}

/** La fecha de hoy en Francia, en formato AAAA-MM-DD (el servidor puede ir en UTC). */
export function hoyEnFrancia(ahora: Date = new Date()): string {
	// `en-CA` escribe las fechas como AAAA-MM-DD.
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(ahora);
}

/** ¿Es `fecha` un día que existe, escrito AAAA-MM-DD? */
export function esFechaValida(fecha: string): boolean {
	// JavaScript acepta "2026-02-31" (lo pasa al 3 de marzo): se comprueba que el día existe.
	const dia = new Date(`${fecha}T12:00:00Z`);
	return (
		/^\d{4}-\d{2}-\d{2}$/.test(fecha) &&
		!Number.isNaN(dia.getTime()) &&
		dia.toISOString().slice(0, 10) === fecha
	);
}

/** Error si la fecha falta, no es válida o está en el futuro; si no, `null`. */
export function errorFecha(fecha: string, hoy: string): string | null {
	if (!esFechaValida(fecha)) return 'Indique la date du match.';
	// Mismo formato AAAA-MM-DD: comparar los textos es comparar las fechas.
	if (fecha > hoy) return 'La date du match ne peut pas être dans le futur.';
	return null;
}
