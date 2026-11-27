import { fail, redirect } from '@sveltejs/kit';
import { hoyEnFrancia, textoDelFormulario } from '#lib/marcador.ts';
import { esAdmin } from '#lib/perfil.ts';
import { crearTorneo, validarTorneo, type ErroresTorneo } from '#lib/torneos.ts';
import type { Actions, PageServerLoad } from './$types';

// Crear un torneo (tarea 2.1). Solo el administrador: los demás vuelven a la lista.
export const load: PageServerLoad = async ({ locals, parent }) => {
	const usuario = await locals.obtenerUsuario();
	if (!locals.supabase || !usuario) redirect(303, '/');
	const { perfil } = await parent();
	if (!esAdmin(perfil)) redirect(303, '/tournois');

	return { hoy: hoyEnFrancia() };
};

export const actions = {
	// Las actions no tienen `parent()`: no se comprueba aquí si es admin. Lo hace
	// la base de datos en `crear_torneo`, que es la que de verdad protege los datos.
	default: async ({ request, locals }) => {
		const usuario = await locals.obtenerUsuario();
		if (!locals.supabase || !usuario) redirect(303, '/');

		const formulario = await request.formData();
		const valores = {
			nombre: textoDelFormulario(formulario, 'nombre'),
			fecha: textoDelFormulario(formulario, 'fecha')
		};

		const errores = validarTorneo(valores.nombre, valores.fecha);
		if (Object.keys(errores).length > 0) return fail(400, { errores, valores });

		const resultado = await crearTorneo(locals.supabase, valores.nombre, valores.fecha);
		if (!resultado.ok) {
			const errorGeneral: ErroresTorneo = { general: resultado.error };
			return fail(400, { errores: errorGeneral, valores });
		}

		redirect(303, `/tournois/${resultado.datos}?cree`);
	}
} satisfies Actions;
