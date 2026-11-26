# Decisiones técnicas

Formato: fecha, decisión, alternativas consideradas, por qué.

## 2026-11-26 - Stack: SvelteKit + Supabase

- **Decisión**: frontend en SvelteKit con TypeScript; backend, base de datos y login con Supabase.
- **Alternativas**: Next.js; Python (FastAPI) + HTML + HTMX.
- **Por qué**: SvelteKit es más simple de aprender que Next.js y permite una web moderna y fluida en móvil. Supabase evita programar un servidor: incluye PostgreSQL, login con Google y permisos por filas, con un plan gratuito suficiente para un AS.

## 2026-11-26 - Ranking: Glicko-2

- **Decisión**: clasificación de nivel con Glicko-2.
- **Alternativas**: ELO clásico.
- **Por qué**: Glicko-2 tiene en cuenta la incertidumbre (RD), así que es más justo con jugadores nuevos o que juegan poco.
