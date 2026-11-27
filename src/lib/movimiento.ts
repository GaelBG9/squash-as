/**
 * Duración de una animación, en milisegundos. Si el jugador ha pedido "reducir el
 * movimiento" en su móvil (ajuste de accesibilidad), devuelve 0: la animación no se ve.
 * Las transiciones de Svelte (`svelte/transition`) no respetan solas ese ajuste; las
 * de CSS sí, gracias a la regla `prefers-reduced-motion` de `tema.css`.
 */
export function duracion(
	ms: number,
	reducirMovimiento = typeof matchMedia === 'function' &&
		matchMedia('(prefers-reduced-motion: reduce)').matches
): number {
	return reducirMovimiento ? 0 : ms;
}
