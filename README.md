# squash-as

Web platform for a university squash club: member list, match results with opponent confirmation, Glicko-2 rating, tournament standings, 16-player draws and automatic pairing for weekly training sessions.

## Stack

- SvelteKit + TypeScript
- Supabase (PostgreSQL, Google sign-in)
- Vitest, ESLint, Prettier

## Install

```bash
npm install
```

## Configure Supabase

1. Copy `.env.example` to `.env` (never commit `.env`).
2. Fill in `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase dashboard → Project Settings → API Keys).
3. Run the SQL files in `supabase/sql/` in order, in the Supabase SQL Editor.

### Google sign-in

1. In Google Cloud Console, create an OAuth client ID (type "Web application") with the authorized redirect URI `https://<your-project>.supabase.co/auth/v1/callback`.
2. In Supabase → Authentication → Sign In / Providers → Google: enable it and paste the client ID and client secret (the secret never goes in the repo).
3. In Supabase → Authentication → URL Configuration: add `http://localhost:5173/auth/callback` to the redirect URLs.
4. After your first sign-in, give yourself the admin role in the SQL Editor (see the end of `supabase/sql/0003_perfil_automatico.sql`).

### Database tests

The files in `supabase/tests/` check the database permissions. Run each one in the Supabase SQL Editor after the matching file in `supabase/sql/`. They use test accounts only and remove them at the end. The last line must show `TODOS LOS TESTS OK`; otherwise the error says which test failed.

## Run

```bash
npm run dev
```

Then open http://localhost:5173.

## Test

```bash
scripts/verificar.sh
```

This runs formatting and lint checks, the type checker and the unit tests, exactly as CI does.

## Documentation

- `docs/cahier-des-charges.md`: specification (Spanish)
- `docs/hoja-de-ruta.md`: roadmap
- `docs/decisiones.md`: technical decisions
