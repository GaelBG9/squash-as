import { fail, redirect } from '@sveltejs/kit';
import {
	errorFecha,
	esFormato,
	hoyEnFrancia,
	leerJuegosDelFormulario,
	textoDelFormulario,
	validarMarcador
} from '#lib/marcador.ts';
import { leerRivales, registrarPartido } from '#lib/partidos.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const usuario = await locals.obtenerUsuario();
	if (!locals.supabase || !usuario) redirect(303, '/');

	return { rivales: await leerRivales(locals.supabase, usuario.id), hoy: hoyEnFrancia() };
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

		if (!rival) errores.rival = 'Choisis ton adversaire.';
		else if (rival === usuario.id) errores.rival = 'Choisis un adversaire autre que toi.';

		const problemaFecha = errorFecha(fecha, hoyEnFrancia());
		if (problemaFecha) errores.fecha = problemaFecha;

		if (!esFormato(formato)) {
			errores.formato = 'Choisis le format du match.';
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
			juegos: leidos.juegos
		});
		if (!resultado.ok) {
			const errorGeneral: ErroresFormulario = { general: resultado.error };
			return fail(400, { errores: errorGeneral, valores });
		}

		redirect(303, '/matchs?enregistre');
	}
} satisfies Actions;
