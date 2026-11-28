import { fail, redirect } from '@sveltejs/kit';
import {
	errorFecha,
	esFormato,
	hoyEnFrancia,
	leerJuegosDelFormulario,
	textoDelFormulario,
	validarMarcador
} from '#lib/marcador.ts';
import { buscarCruce, leerCuadro, nombreRonda } from '#lib/cuadro.ts';
import { leerRivales, registrarPartido } from '#lib/partidos.ts';
import type { Resultado } from '#lib/resultado.ts';
import type { ClienteSupabase } from '#lib/supabase.ts';
import { leerId, leerTorneo, type Inscrito } from '#lib/torneos.ts';
import type { Actions, PageServerLoad } from './$types';

/** Un partido de torneo que se va a registrar: el torneo, la ronda y el rival. */
export type PartidoDeTorneo = { id: number; nombre: string; ronda: string; rival: Inscrito };

/**
 * `/matchs/nouveau?tournoi=7&adversaire=…` (botón del cuadro): comprueba que los dos
 * jugadores se enfrentan en el cuadro. La base de datos lo vuelve a comprobar al
 * registrar; aquí sirve para enseñar el rival y la ronda, o un error claro.
 */
async function leerPartidoDeTorneo(
	cliente: ClienteSupabase,
	torneo: number | null,
	yo: string,
	rival: string
): Promise<Resultado<PartidoDeTorneo>> {
	const noSeEnfrentan = 'Vous ne vous affrontez pas dans le tableau de ce tournoi.';
	if (torneo === null) return { ok: false, error: 'Tournoi introuvable.' };
	const [leido, plazas] = await Promise.all([
		leerTorneo(cliente, torneo),
		leerCuadro(cliente, torneo)
	]);
	if (!leido.ok) return leido;
	if (!plazas.ok) return plazas;
	if (!leido.datos) return { ok: false, error: 'Tournoi introuvable.' };

	const cruce = buscarCruce(plazas.datos, yo, rival);
	const jugadorRival = plazas.datos.find((p) => p.jugador?.id === rival)?.jugador;
	if (!cruce || !jugadorRival) return { ok: false, error: noSeEnfrentan };
	return {
		ok: true,
		datos: {
			id: leido.datos.id,
			nombre: leido.datos.nombre,
			ronda: nombreRonda(cruce.ronda),
			rival: jugadorRival
		}
	};
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const usuario = await locals.obtenerUsuario();
	if (!locals.supabase || !usuario) redirect(303, '/');

	// Partido de torneo: el rival ya está decidido por el cuadro, no hace falta la lista.
	if (url.searchParams.has('tournoi')) {
		const torneo = await leerPartidoDeTorneo(
			locals.supabase,
			leerId(url.searchParams.get('tournoi')),
			usuario.id,
			url.searchParams.get('adversaire') ?? ''
		);
		return { torneo, rivales: null, hoy: hoyEnFrancia() };
	}

	return {
		torneo: null,
		rivales: await leerRivales(locals.supabase, usuario.id),
		hoy: hoyEnFrancia()
	};
};

/** Errores del formulario, cada uno junto a su campo. */
export type ErroresFormulario = Partial<
	Record<'rival' | 'fecha' | 'formato' | 'juegos' | 'general', string>
>;

// Una "form action": el formulario se envía aquí (POST) y el servidor responde con
// los errores o redirige a la lista. Funciona aunque el navegador no tenga JavaScript.
export const actions = {
	default: async ({ request, locals }) => {
		const usuario = await locals.obtenerUsuario();
		if (!locals.supabase || !usuario) redirect(303, '/');

		const formulario = await request.formData();
		// Lo escrito se devuelve con los errores para no tener que volver a escribirlo.
		const valores: Record<string, string> = {};
		for (const [campo, valor] of formulario) if (typeof valor === 'string') valores[campo] = valor;

		const errores: ErroresFormulario = {};
		const rival = textoDelFormulario(formulario, 'rival');
		const fecha = textoDelFormulario(formulario, 'fecha');
		const formato = textoDelFormulario(formulario, 'formato');
		// Campo oculto, solo en un partido de torneo.
		const textoTorneo = textoDelFormulario(formulario, 'torneo');
		const torneo = textoTorneo === '' ? undefined : leerId(textoTorneo);
		if (torneo === null) {
			const errorTorneo: ErroresFormulario = { general: 'Tournoi introuvable.' };
			return fail(400, { errores: errorTorneo, valores });
		}

		if (!rival) errores.rival = 'Choisis ton adversaire.';
		else if (rival === usuario.id) errores.rival = 'Choisis un adversaire autre que toi.';

		const problemaFecha = errorFecha(fecha, hoyEnFrancia());
		if (problemaFecha) errores.fecha = problemaFecha;

		if (!esFormato(formato)) {
			errores.formato = 'Choisis le format du match.';
			return fail(400, { errores, valores });
		}
		// R19: un partido de torneo es un partido completo, nunca juegos libres.
		if (torneo !== undefined && formato === 'libre') {
			errores.formato = 'Un match de tournoi se joue au meilleur des 3 ou des 5 jeux.';
			return fail(400, { errores, valores });
		}

		const leidos = leerJuegosDelFormulario(formulario, formato);
		if (!leidos.ok) errores.juegos = leidos.error;
		else {
			const marcador = validarMarcador(formato, leidos.juegos);
			if (!marcador.ok) errores.juegos = marcador.error;
		}

		if (Object.keys(errores).length > 0 || !leidos.ok) return fail(400, { errores, valores });

		const resultado = await registrarPartido(locals.supabase, {
			rival,
			fecha,
			formato,
			juegos: leidos.juegos,
			torneo
		});
		if (!resultado.ok) {
			const errorGeneral: ErroresFormulario = { general: resultado.error };
			return fail(400, { errores: errorGeneral, valores });
		}

		// Un partido de torneo vuelve al cuadro; un entrenamiento, a "Mes matchs".
		redirect(303, torneo === undefined ? '/matchs?enregistre' : `/tournois/${torneo}?enregistre`);
	}
} satisfies Actions;
