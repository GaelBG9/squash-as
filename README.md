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
