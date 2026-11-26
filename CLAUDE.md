# squash-as

Plataforma web del AS de squash: miembros, partidos con confirmación, ranking Glicko-2, torneos con cuadros de 16 y emparejamiento de los jueves.
Especificación: `docs/cahier-des-charges.md`. Léela antes de cualquier tarea.
Hoja de ruta: `docs/hoja-de-ruta.md`. Al terminar una tarea, márcala como hecha `[x]` en el mismo commit.
Decisiones: `docs/decisiones.md`.

## Stack

- SvelteKit + TypeScript (frontend, uso principal en móvil)
- Supabase (PostgreSQL, login con Google, permisos por filas)
- Vitest (tests), ESLint + Prettier (calidad de código)

## Comandos

- Instalar: `npm install`
- Lanzar en local: `npm run dev`
- Verificar todo (igual que la CI): `scripts/verificar.sh`

## Estructura

- `src/routes/`: páginas · `src/lib/`: lógica y componentes · tests `*.spec.ts` junto al código · `docs/`: especificación, hoja de ruta y decisiones

## Cómo trabajamos

- Soy principiante: explícame brevemente cada decisión técnica y cada concepto nuevo.
- Para tareas que tocan varios archivos, propón un plan antes de codificar.
- Una tarea = una rama. Nunca trabajes directamente en `main`.
- Antes de decir que algo está terminado: lanza `scripts/verificar.sh` y dime cómo probarlo a mano, incluidos los casos límite.
- Cada funcionalidad nueva viene con sus tests.
- Si cambia una regla de negocio, actualiza `docs/cahier-des-charges.md` en el mismo commit.
- Si durante una tarea aparece trabajo nuevo, añádelo a `docs/hoja-de-ruta.md` en lugar de hacerlo sin avisar.
- Commits pequeños, mensajes claros en inglés.

## Prohibido

- `git push` (lo hago yo).
- Añadir una dependencia sin preguntarme y explicar por qué.
- Modificar el cahier des charges sin avisarme.
- Secretos en el código: van en `.env`, que está en `.gitignore`. Las claves de Supabase nunca en el repo.
- Probar con datos reales de personas: solo datos de prueba.
