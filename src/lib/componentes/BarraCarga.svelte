<script lang="ts">
	import { navigating } from '$app/state';

	// Barra fina arriba de la pantalla mientras se carga una página nueva o se envía
	// un formulario. Solo aparece si la espera pasa de 120 ms: en cargas rápidas no
	// parpadea. `navigating.to` vale `null` cuando no se está cargando nada.
	let visible = $state(false);

	$effect(() => {
		if (!navigating.to) {
			visible = false;
			return;
		}
		const temporizador = setTimeout(() => (visible = true), 120);
		return () => clearTimeout(temporizador);
	});
</script>

{#if visible}
	<div class="barra" role="progressbar" aria-label="Chargement…"></div>
{/if}

<style>
	.barra {
		position: fixed;
		inset: 0 0 auto;
		z-index: 10;
		height: 3px;
		overflow: hidden;
		background: color-mix(in srgb, var(--color-punto) 30%, transparent);
	}

	/* Un trozo amarillo que recorre la barra de izquierda a derecha, sin fin. */
	.barra::after {
		content: '';
		position: absolute;
		inset: 0;
		width: 40%;
		background: var(--color-punto);
		animation: recorrer 1s ease-in-out infinite;
	}

	@keyframes recorrer {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(250%);
		}
	}

	/* Con "reducir movimiento" la animación se quita (tema.css): barra fija entera. */
	@media (prefers-reduced-motion: reduce) {
		.barra::after {
			width: 100%;
		}
	}
</style>
