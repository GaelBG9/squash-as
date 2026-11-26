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
