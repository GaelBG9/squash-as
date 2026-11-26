/**
 * Devuelve `destino` solo si es una ruta interna de la app (como `/partidos`);
 * si no, `/`. Evita que un enlace trampa (`?next=https://web-maliciosa.com`)
 * use el login de la app para mandarte a otra web ("open redirect").
 */
export function rutaInternaSegura(destino: string | null | undefined): string {
	if (!destino) return '/';
	// Debe empezar por una sola "/". "//web.com" y "/\web.com" los navegadores
	// los entienden como otra web.
	if (!destino.startsWith('/') || destino.startsWith('//') || destino.startsWith('/\\')) {
		return '/';
	}
	// Caracteres de control (saltos de línea, tabuladores...) nunca son una ruta normal.
	for (const caracter of destino) {
		const codigo = caracter.charCodeAt(0);
		if (codigo < 32 || codigo === 127) return '/';
	}
	return destino;
}
