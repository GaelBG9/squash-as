import type { PageServerLoad } from './$types';

// El perfil lo carga `+layout.server.ts`; aquí solo el aviso de vuelta del login.
export const load: PageServerLoad = ({ url }) => {
	const errorLogin =
		url.searchParams.get('error') === 'login'
			? 'No se ha podido completar la conexión con Google. Inténtalo de nuevo.'
			: null;
	return { errorLogin };
};
