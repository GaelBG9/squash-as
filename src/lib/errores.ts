/**
 * Título en francés para la página de error. SvelteKit da mensajes en inglés
 * ("Not Found"), así que no los mostramos: elegimos el texto según el código HTTP.
 */
export function textoError(estado: number): string {
	if (estado === 404) return 'Page introuvable';
	if (estado === 401 || estado === 403) return 'Accès refusé';
	if (estado >= 500) return 'Une erreur est survenue sur le serveur';
	return 'Une erreur est survenue';
}
