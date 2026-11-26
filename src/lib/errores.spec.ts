import { describe, it, expect } from 'vitest';
import { textoError } from './errores.ts';

describe('textoError', () => {
	it.each([
		[404, 'Page introuvable'],
		[401, 'Accès refusé'],
		[403, 'Accès refusé'],
		[500, 'Une erreur est survenue sur le serveur'],
		[503, 'Une erreur est survenue sur le serveur'],
		[400, 'Une erreur est survenue']
	])('%i → "%s"', (estado, esperado) => {
		expect(textoError(estado)).toBe(esperado);
	});
});
