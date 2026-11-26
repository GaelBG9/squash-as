import type { PageServerLoad } from './$types';

// El perfil lo carga `+layout.server.ts`; aquí solo el aviso de vuelta del login.
export const load: PageServerLoad = ({ url }) => {
	const errorLogin =
		url.searchParams.get('error') === 'login'
			? 'La connexion avec Google n’a pas abouti. Réessaie.'
			: null;
	return { errorLogin };
};
