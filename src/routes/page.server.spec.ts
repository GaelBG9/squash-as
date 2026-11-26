import { describe, it, expect } from 'vitest';
import { load } from './+page.server.ts';

async function errorLogin(direccion: string): Promise<string | null | undefined> {
	const evento = { url: new URL(direccion) };
	const datos = await load(evento as unknown as Parameters<typeof load>[0]);
	return (datos as { errorLogin: string | null } | undefined)?.errorLogin;
}

describe('load de la página de inicio', () => {
	it('muestra el error de login si vuelve de Google con ?error=login', async () => {
		expect(await errorLogin('http://localhost/?error=login')).toContain('Google');
	});

	it('sin ?error=login no hay aviso', async () => {
		expect(await errorLogin('http://localhost/')).toBeNull();
		expect(await errorLogin('http://localhost/?error=otro')).toBeNull();
	});
});
