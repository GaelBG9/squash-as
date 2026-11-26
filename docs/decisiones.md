# Decisiones técnicas

Formato: fecha, decisión, alternativas consideradas, por qué.

## 2026-11-26 - Stack: SvelteKit + Supabase

- **Decisión**: frontend en SvelteKit con TypeScript; backend, base de datos y login con Supabase.
- **Alternativas**: Next.js; Python (FastAPI) + HTML + HTMX.
- **Por qué**: SvelteKit es más simple de aprender que Next.js y permite una web moderna y fluida en móvil. Supabase evita programar un servidor: incluye PostgreSQL, login con Google y permisos por filas, con un plan gratuito suficiente para un AS.

## 2026-11-26 - Claude puede subir ramas y fusionar PRs

- **Decisión**: Claude sube la rama de cada tarea, abre la PR y la fusiona tras CI verde y aprobación de Gaël.
- **Alternativas**: que Gaël haga todos los push a mano.
- **Por qué**: el flujo manual (parches, PRs) era fuente de errores; se mantienen prohibidos el push directo a `main` y el force push.

## 2026-11-26 - Ranking: Glicko-2

- **Decisión**: clasificación de nivel con Glicko-2.
- **Alternativas**: ELO clásico.
- **Por qué**: Glicko-2 tiene en cuenta la incertidumbre (RD), así que es más justo con jugadores nuevos o que juegan poco.

## 2026-11-26 - Conexión a Supabase: supabase-js y variables en tiempo de ejecución

- **Decisión**: usar la librería oficial `@supabase/supabase-js`. La URL y la clave pública se declaran en `src/env.ts` (`defineEnvVars` de SvelteKit 3) como variables públicas no estáticas, y se leen con `$app/env/public`.
- **Alternativas**: llamar a la API REST de Supabase a mano con `fetch`; variables estáticas (se fijan al compilar).
- **Por qué**: supabase-js es la vía documentada y la necesitaremos para el login y los permisos. Las variables no estáticas se leen al arrancar la app, así la CI (que no tiene `.env`) verifica el código sin fallar, y si falta una la página lo dice en vez de romperse.

## 2026-11-26 - Permisos de `jugadores`: RLS + trigger, probados con SQL

- **Decisión**: RLS decide qué filas puede ver o cambiar cada usuario (la suya; el admin, todas). Un trigger (`proteger_campos_jugador`) decide qué columnas: un jugador normal solo cambia su nombre. Los permisos se prueban con scripts en `supabase/tests/` que simulan usuarios conectados en el SQL Editor.
- **Alternativas**: permisos por columnas con `GRANT UPDATE (nombre)` (también limitaría al admin, que usa el mismo rol `authenticated`); pgTAP o la CLI de Supabase con Docker para los tests.
- **Por qué**: RLS solo trabaja por filas, y sin el trigger un jugador podría ponerse `rol = admin` o cambiarse el rating. Los scripts SQL no necesitan instalar nada; pasar a la CLI de Supabase queda para cuando haya más tablas.

## 2026-11-26 - Login con Google: @supabase/ssr y perfil creado por trigger

- **Decisión**: la sesión se guarda en cookies con `@supabase/ssr`; `src/hooks.server.ts` crea un cliente de Supabase por petición y verifica el usuario con `auth.getUser()`. El perfil en `jugadores` lo crea un trigger sobre `auth.users` al primer login. El rol admin se da a mano con una línea SQL, sin guardar ningún email en el repo.
- **Alternativas**: login solo en el navegador con `supabase-js` (el servidor no sabría quién está conectado); crear el perfil desde el código de la app tras el login; escribir el email del admin en el SQL.
- **Por qué**: es la forma documentada por Supabase para SvelteKit y permite que las páginas del servidor respeten los permisos RLS de cada jugador. El trigger garantiza que toda cuenta tiene perfil, venga de donde venga. El email es un dato personal y el repo está en GitHub.
