<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		DATOS_GUARDADOS,
		EMAIL_CONTACTO,
		ULTIMA_ACTUALIZACION,
		fechaLegible
	} from '#lib/privacidad.ts';
</script>

<svelte:head>
	<title>Politique de confidentialité · Squash AS</title>
</svelte:head>

<section class="bloque" aria-labelledby="titulo">
	<p class="etiqueta">Squash AS</p>
	<h1 id="titulo">Politique de confidentialité</h1>
	<p class="texto-suave">Dernière mise à jour : {fechaLegible(ULTIMA_ACTUALIZACION)}</p>
</section>

<article class="politica">
	<section class="tarjeta">
		<h2>Qui est responsable</h2>
		<p>
			Ce site est l’outil interne de l’AS de squash pour gérer les membres, les matchs, les
			classements et les tournois. Le responsable des données est Gaël, administrateur de
			l’application. Contact : <a href="mailto:{EMAIL_CONTACTO}">{EMAIL_CONTACTO}</a>.
		</p>
	</section>

	<section class="tarjeta">
		<h2>Quelles données nous gardons et pourquoi</h2>
		<p>Lors de ta première connexion avec Google, ton profil de joueur est créé avec :</p>
		<dl class="lista-datos">
			{#each DATOS_GUARDADOS as { dato, para } (dato)}
				<div>
					<dt>{dato}</dt>
					<dd>{para}</dd>
				</div>
			{/each}
		</dl>
		<p>
			Le service de connexion garde aussi les données que Google nous envoie quand tu te connectes
			(nom, e-mail et lien vers ta photo de profil) ainsi que la date de ta dernière connexion. Nous
			ne demandons à Google que ton nom, ton e-mail et ta photo de profil : nous ne voyons jamais
			ton mot de passe ni les autres données de ton compte.
		</p>
	</section>

	<section class="tarjeta">
		<h2>Qui peut les voir</h2>
		<ul>
			<li>Sans être connecté, personne ne peut voir la liste des joueurs.</li>
			<li>
				Les joueurs connectés peuvent voir les profils des autres membres (nom, e-mail, groupe, rôle
				et niveau).
			</li>
			<li>
				Chaque joueur ne peut modifier que son propre nom. L’administrateur peut tout modifier.
			</li>
			<li>Nous ne vendons ni ne cédons tes données à personne, et il n’y a pas de publicité.</li>
		</ul>
	</section>

	<section class="tarjeta">
		<h2>Où elles sont stockées</h2>
		<ul>
			<li><strong>Supabase</strong> : base de données et connexion.</li>
			<li>
				<strong>Vercel</strong> : héberge le site. Comme tout serveur, il enregistre des données techniques
				sur les visites (par exemple l’adresse IP) pendant une durée limitée.
			</li>
			<li><strong>Google</strong> : uniquement pour la connexion avec ton compte.</li>
		</ul>
	</section>

	<section class="tarjeta">
		<h2>Cookies</h2>
		<p>
			Nous utilisons uniquement les cookies nécessaires pour garder ta session ouverte. Il n’y a pas
			de cookies publicitaires ni de statistiques, et les polices de caractères sont servies depuis
			notre propre site.
		</p>
	</section>

	<section class="tarjeta">
		<h2>Durée de conservation et tes droits</h2>
		<p>
			Nous gardons tes données tant que tu es membre et que tu as un compte. Tu peux demander à tout
			moment à consulter tes données, à les corriger ou à supprimer ton compte en écrivant à
			<a href="mailto:{EMAIL_CONTACTO}">{EMAIL_CONTACTO}</a>. Si la réponse ne te convient pas, tu
			peux déposer une réclamation auprès de l’autorité de protection des données de ton pays (en
			France, la CNIL).
		</p>
	</section>
</article>

<p><a href={resolve('/')}>Retour à l’accueil</a></p>

<style>
	.bloque,
	.politica,
	.tarjeta {
		display: grid;
		gap: var(--espacio-3);
	}

	.politica {
		gap: var(--espacio-4);
	}

	h2 {
		font-size: var(--texto-grande);
	}

	.texto-suave {
		color: var(--color-texto-suave);
	}

	ul {
		display: grid;
		gap: var(--espacio-2);
		margin: 0;
		padding-left: var(--espacio-5);
	}

	.lista-datos {
		display: grid;
		gap: var(--espacio-3);
		margin: 0;
	}

	dt {
		font-weight: 600;
	}

	dd {
		margin: 0;
		color: var(--color-texto-suave);
	}

	/* Los emails largos se parten en vez de provocar scroll horizontal en móvil. */
	a {
		overflow-wrap: anywhere;
	}
</style>
