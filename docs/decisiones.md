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

## 2026-11-27 - Partidos: solo se crean con la función `registrar_partido`

- **Decisión**: los partidos se guardan en `partidos` y su marcador en `juegos`. La app solo puede leer estas tablas; para crear un partido llama (`rpc`) a la función `registrar_partido` (`security definer`), que comprueba el marcador según el formato (R12), pone a quien llama como jugador A y como quien registra (R13) y deja el partido "pendiente". Las mismas reglas están en `src/lib/marcador.ts` para avisar en el formulario antes de enviar.
- **Alternativas**: dejar que la app inserte en las tablas con permisos RLS y comprobar el marcador con restricciones (`check`) o triggers; comprobar el marcador solo en SvelteKit.
- **Por qué**: el partido y sus juegos se guardan en una sola transacción (todo o nada), y nadie puede saltarse las reglas llamando a la API de Supabase a mano (por ejemplo, registrarse un partido ya "confirmado" o entre otros dos jugadores). Repetir las reglas en TypeScript da mensajes de error inmediatos y probados con Vitest; la base de datos sigue siendo la que manda.

## 2026-11-27 - Responder a un partido: función `responder_partido` y columna `respondido_en`

- **Decisión**: el rival confirma o rechaza llamando a la función `responder_partido` (`security definer`), que comprueba que quien llama es el jugador B y no quien registró (R2, R13) y que el partido sigue "pendiente". El cambio se hace con un solo `update ... where estado = 'pendiente'`, así dos respuestas a la vez no pueden pisarse. Una respuesta es definitiva. Se guarda cuándo se respondió en `partidos.respondido_en`. En la app, una sola form action (`?/repondre`) con dos botones `name="respuesta"`; los partidos que esperan mi respuesta salen arriba, en "À confirmer".
- **Alternativas**: dar permiso `UPDATE` sobre `partidos` con una política RLS para el jugador B; dos actions separadas (`?/confirmer` y `?/refuser`); poder cambiar de opinión tras responder.
- **Por qué**: con RLS el rival podría cambiar también el marcador o el ganador, y RLS no controla columnas (como con el email). La función reutiliza el patrón de `registrar_partido`. Una sola action con el valor del botón evita duplicar código. Que la respuesta sea definitiva hace que la tarea 1.3 pueda calcular Glicko-2 una sola vez por partido. Confirmar todavía no cambia los ratings: es la tarea 1.3.

## 2026-11-27 - Glicko-2 en SQL, un periodo por partido y RD que crece por semanas sin jugar

- **Decisión**: el algoritmo está en la función SQL `glicko2` (pura, sin tablas), probada con el ejemplo del artículo de Glickman (1500 / 200 → 1464,06 / 151,52 / 0,05999) en `supabase/tests/0008_glicko2.sql`, con τ = 0,5. `responder_partido` llama a `aplicar_glicko2(partido)` (`security definer`, no accesible desde la app) al confirmar: actualiza a los dos jugadores a la vez con los valores que tenía cada uno antes del partido y escribe dos filas en `historial_rating` (jugador, partido, fecha del partido, rating, RD, volatilidad). Cada partido es un periodo de Glicko-2. Antes del cálculo, el RD de cada jugador crece por las semanas vacías desde su último partido (`rd_tras_inactividad`: φ² + semanas · σ², sin pasar de 350). La migración cuenta una vez los partidos confirmados antes de esta tarea, en el orden en que se confirmaron.
- **Alternativas**: programar Glicko-2 en TypeScript (la app no puede escribir los ratings, así que habría que repetirlo en SQL); periodos fijos (por ejemplo, un cálculo cada mes con todos los partidos del mes); no hacer crecer el RD con la inactividad; un periodo de un mes en vez de una semana.
- **Por qué**: el cálculo tiene que hacerse donde se guardan los ratings, en una sola transacción con la confirmación: si falla, el partido tampoco se confirma. Una sola implementación evita dos códigos que se desincronicen; a cambio, sus tests son scripts SQL que no lanza la CI. Un periodo por partido es más sencillo y el jugador ve el cambio al momento. La semana coincide con la clase de los jueves: con σ = 0,06, un RD de 50 pasa a unos 90 tras un año sin jugar. Guardar el partido en el historial dice qué partido movió cada rating e impide contarlo dos veces (`unique (jugador, partido)`).

## 2026-11-27 - Validación automática sin aviso al admin

- **Decisión**: un partido sin respuesta a los 15 días pasa a "confirmado" sin enviar ningún mensaje (R8). La pregunta abierta 4 sobre el canal del aviso queda respondida.
- **Alternativas**: un email o una notificación en la app al admin por cada validación automática.
- **Por qué**: Gaël no quiere llenarse de avisos; con pocas decenas de jugadores, los casos dudosos se pueden revisar en la lista de partidos. También evita elegir y configurar un servicio de envío de emails.

## 2026-11-27 - Validación automática con pg_cron cada hora

- **Decisión**: la extensión pg_cron de Supabase llama cada hora (`0 * * * *`) a `validar_partidos_vencidos()`, que pasa a "confirmado" los partidos pendientes registrados hace 15 días o más, del más antiguo al más reciente, y aplica Glicko-2 a cada uno en la misma transacción. Una columna nueva, `partidos.validado_automaticamente`, distingue estas validaciones de una confirmación del rival; `respondido_en` guarda el momento de la validación. La función tiene un parámetro `p_ahora` para probar "el 16 de marzo" sin esperar 15 días, y la app no puede llamarla. Hasta que pasa el despertador, el rival todavía puede responder, y vale su respuesta. En "Mes matchs", un partido pendiente dice qué día se confirmará solo.
- **Alternativas**: un cron de Vercel que llame a la base de datos (necesita guardar en Vercel la clave secreta de Supabase); validar "al vuelo" cuando alguien abre la app (sin visitas, los ratings no cambian); pasar una vez al día (un partido del 1 de marzo podría validarse el 17).
- **Por qué**: pg_cron viene con Supabase (también en el plan gratuito), funciona dentro de la base de datos sin claves ni servidores nuevos y reutiliza `aplicar_glicko2`. Cada hora cumple el criterio "el 16 de marzo" con un coste insignificante. Si el proyecto gratuito está en pausa, pg_cron no se ejecuta: al reactivarlo, la primera pasada valida los partidos atrasados en orden.

## 2026-11-27 - Clasificación: consulta con `!inner`, RD de hoy calculado en TypeScript y filtro por URL

- **Decisión**: la página `/classement` (solo con sesión, R10) lee `jugadores` con `historial_rating!inner(fecha)`: `!inner` deja fuera a quien no tiene ninguna fila de historial, es decir, ningún partido confirmado. La ordenación (rating de mayor a menor, y por nombre si empatan), el número de partidos y el RD de hoy se calculan en `src/lib/clasificacion.ts`, probado con Vitest. El RD de hoy usa la fórmula de `rd_tras_inactividad` copiada en TypeScript (`rdTrasInactividad`), con los mismos casos de prueba que el script SQL. Una sola clasificación para los dos grupos con un filtro `?groupe=1` / `?groupe=2` hecho con un formulario GET (R15, pregunta abierta 11).
- **Alternativas**: una vista SQL o una función `rpc` que devuelva la clasificación ya calculada; mostrar el RD guardado (el del último partido); dos clasificaciones separadas; un filtro solo en el navegador (con JavaScript).
- **Por qué**: sin migración SQL, todo se prueba con Vitest y la CI lo comprueba. El RD que se muestra no se guarda: el que cuenta para el siguiente partido lo sigue calculando la base de datos, así que la copia en TypeScript solo afecta a lo que se ve, y los tests compartidos la mantienen igual. Con pocas decenas de jugadores, leer todas sus fechas de partido es barato. Glicko-2 ya mezcla a los dos grupos, así que una lista común es coherente, y el filtro responde a quien solo quiere ver su grupo. El formulario GET funciona sin JavaScript, deja la URL compartible y el botón "atrás" vuelve al filtro anterior.

## 2026-11-27 - Rendimiento: sesión con `getClaims()`, medición con `Server-Timing` y animaciones de Svelte

- **Decisión**: la sesión se comprueba con `supabase.auth.getClaims()` una sola vez por petición (`src/lib/sesion.ts`); el layout y la página comparten el resultado. Cada respuesta lleva la cabecera `Server-Timing` con el tiempo total y el de las consultas a Supabase (`src/lib/medicion.ts`). En la interfaz: barra de carga al cambiar de página (`navigating` de `$app/state`), botones que se hunden al tocarlos y muestran un círculo que gira mientras envían (`Boton cargando`), filtro de la clasificación marcado al instante, fundido corto entre páginas y menú que se despliega con `svelte/transition`, `touch-action: manipulation` y precarga del código de los enlaces visibles. Las animaciones de Svelte duran 0 con "reducir movimiento" (`src/lib/movimiento.ts`).
- **Alternativas**: seguir con `getUser()` (un viaje de red a Supabase en cada llamada, dos por página); medir solo en local o con una herramienta externa de monitorización; una librería de animaciones o de componentes.
- **Por qué**: `getUser()` pregunta a Supabase cada vez; `getClaims()` comprueba la firma de la sesión con la clave pública, que se descarga una vez y se guarda en memoria, y si el proyecto aún usa la clave antigua hace lo mismo que `getUser()`, así que no empeora nada. La app solo usa el id del usuario, que va en la sesión firmada. `Server-Timing` mide también en Vercel sin servicios nuevos ni datos personales. Svelte ya trae transiciones, así que no hace falta ninguna dependencia. La región de Vercel queda para la tarea 1.7, porque depende de la región del proyecto Supabase.
