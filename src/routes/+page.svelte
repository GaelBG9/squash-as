<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<h1>Squash AS</h1>

{#if data.prueba.ok}
	<p>Conexión con Supabase: <strong>{data.prueba.mensaje}</strong></p>
{:else}
	<p role="alert">{data.prueba.error}</p>
{/if}
