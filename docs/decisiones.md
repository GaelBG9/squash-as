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

## 2026-11-26 - Finales de línea: LF en todos los sistemas con `.gitattributes`

- **Decisión**: un `.gitattributes` con `* text=auto eol=lf` hace que Git guarde y descargue todos los archivos de texto con LF, también en Windows.
- **Alternativas**: pedir a cada persona que configure `core.autocrlf=false` en su Git; configurar Prettier con `endOfLine: "auto"`.
- **Por qué**: la regla viaja con el repo y manda sobre la configuración de cada ordenador, así nadie tiene que acordarse de nada. Prettier y la CI (Linux) esperan LF; aceptar los dos finales solo escondería el problema.

## 2026-11-26 - Diseño base: estilo "Pelota", CSS propio y fuentes alojadas en la app

- **Decisión**: estilo B · Pelota elegido entre tres maquetas (verde de pista, los dos puntos amarillos de la pelota de competición, tipografía Barlow / Barlow Condensed). Colores, tipografías y espacios son variables CSS en `src/lib/estilos/tema.css`, con modo oscuro automático; los componentes reutilizables están en `src/lib/componentes/`. Las fuentes vienen de `@fontsource/barlow` y `@fontsource/barlow-condensed`. El menú se define en `src/lib/navegacion.ts` con rutas tipadas (`RouteId`) y solo lista páginas que existen.
- **Alternativas**: un framework de CSS (Tailwind) o una librería de componentes; cargar las fuentes desde Google Fonts; la fuente del sistema (estilo A).
- **Por qué**: con pocas pantallas, CSS propio con variables es fácil de entender y no añade herramientas. Alojar las fuentes en la app evita que cada visita contacte con Google (privacidad de los jugadores) y funciona sin conexión a terceros. Tipar las rutas del menú hace que un enlace a una página inexistente no compile.

## 2026-11-26 - Alojamiento en Vercel y política de privacidad generada desde el código

- **Decisión**: la web se aloja en Vercel (plan Hobby gratuito) con el `adapter-auto` que ya tenemos, que detecta Vercel solo. La política de privacidad es una página de la app (`/privacidad`), enlazada desde el pie de todas las páginas. La lista de datos que muestra viene de `src/lib/privacidad.ts`, que obliga (al compilar y en un test) a explicar cada columna de `jugadores`.
- **Alternativas**: Netlify (parecido); Cloudflare Pages (habría que añadir su adaptador); un VPS (cuesta dinero y hay que mantenerlo). Para la política, un texto suelto o un documento externo.
- **Por qué**: Vercel funciona sin dependencias nuevas y despliega solo en cada merge a `main`. Google pide una página principal pública y una política de privacidad para publicar la app en producción. Generar la lista desde el código evita que la política se quede desactualizada cuando añadamos datos.

## 2026-11-26 - Interfaz en francés, código en español

- **Decisión**: todo lo que ve el usuario está en francés: textos, títulos, mensajes de error, textos para lectores de pantalla, fechas (`toLocaleDateString('fr')`), `lang="fr"` y las URLs (la política de privacidad pasa de `/privacidad` a `/confidentialite`). Se tutea al jugador, como en un club. Los nombres de variables, comentarios y la documentación siguen en español.
- **Alternativas**: una librería de traducción (i18n) con varios idiomas; traducir también el código.
- **Por qué**: los miembros del AS hablan francés y la app tiene un solo idioma, así que una librería i18n sería complejidad sin uso. Cambiar los nombres del código no aporta nada al usuario y rompería la coherencia con la documentación.

## 2026-11-26 - Email privado en una tabla aparte (`jugadores_privado`)

- **Decisión**: el email sale de `jugadores` y pasa a `jugadores_privado (id, email)`, con RLS "cada uno su fila, el admin todas" y solo lectura desde la app. El trigger de alta crea las dos filas. La política de privacidad dice quién ve cada dato a partir de la tabla en la que está (`quienLoVe` en `src/lib/privacidad.ts`).
- **Alternativas**: dejar el email en `jugadores` y quitar el permiso de lectura de esa columna (`revoke select (email)`), con una función especial para el admin; una vista que oculte el email de los demás.
- **Por qué**: RLS solo filtra filas, no columnas. El admin usa el mismo rol `authenticated` que los demás, así que con permisos por columna tampoco él podría leer los emails, y un `select *` daría error. Una vista no basta si la tabla sigue legible por la API. Con una tabla aparte se reutiliza el mismo patrón de RLS que ya conocemos y se prueba igual, con scripts SQL.
