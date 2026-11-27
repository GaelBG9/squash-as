# Hoja de ruta

Cada tarea cabe en una conversación, es vertical (datos + lógica + tests + interfaz) y tiene un criterio verificable tomado del cahier des charges.

## Fase 0 - Base

- [x] 0.0 Esqueleto SvelteKit con un test y CI
- [x] 0.1 Crear el proyecto Supabase y conectar la app (variables en `.env`, `.env.example` en el repo)
      Criterio: la página de inicio lee un dato de prueba de Supabase en local.
- [x] 0.2 Tabla `jugadores` (nombre, email, grupo, rol, rating, RD, volatilidad) con permisos por filas
      Criterio: un jugador solo puede modificar su propio perfil; el admin puede modificarlos todos.
- [x] 0.3 Login con Google y creación automática del perfil jugador
      Criterio: una cuenta Google nueva se conecta y obtiene el rol jugador sin intervención del admin; Gaël tiene el rol admin.
- [x] 0.4 Borrar la tabla `prueba_conexion` (de la tarea 0.1) cuando el login (0.3) funcione
      Criterio: la tabla ya no existe en Supabase y la página de inicio muestra el perfil del jugador conectado (sin sesión, `jugadores` no se puede leer: R10).
- [x] 0.5 Fijar los finales de línea con `.gitattributes` (`* text=auto eol=lf`)
      Criterio: en Windows, `scripts/verificar.sh` no da avisos de Prettier en archivos recién descargados de GitHub.
- [x] 0.6 Publicar la app de Google en modo producción (necesita alojar la web: pregunta abierta 10)
      Criterio: hay una página principal pública y una página de política de privacidad (qué datos guardamos y para qué); la app de Google pasa a "En producción" y cualquier cuenta Google puede conectarse sin estar en la lista de usuarios de prueba.
- [x] 0.7 Diseño base de la interfaz (hacer antes de 1.1): maquetas para elegir estilo, colores del AS, tipografía, botones y formularios para móvil, cabecera con la sesión y menú de navegación; rediseñar la página de inicio con ese estilo
      Criterio: en un móvil (375 px de ancho) la página de inicio se ve sin scroll horizontal, con la cabecera y el menú comunes, botones de al menos 44 px de alto y el estilo elegido en la maqueta; los estilos y componentes están en `src/lib` para reutilizarlos en las pantallas siguientes.
- [x] 0.8 Ocultar el email de los demás jugadores (aparecido en la tarea 0.6)
      Criterio: un jugador conectado ve el nombre, el grupo y el nivel de los demás, pero solo su propio email; el admin ve todos. Al terminar, actualizar "Qui peut les voir" en `/confidentialite`.
- [x] 0.9 Traducir toda la interfaz al francés (textos, URLs, mensajes de error, `lang="fr"`)
      Criterio: ningún texto visible de la app queda en español; la política de privacidad está en `/confidentialite`.

## Fase 1 - MVP

- [x] 1.1 Registrar un partido juego a juego
      Criterio: tras registrar 3-1 (11-7, 9-11, 11-5, 11-8), el partido aparece "pendiente" y ningún rating cambia.
- [x] 1.2 Confirmar o rechazar un partido
      Criterio: al confirmar, el estado pasa a "confirmado"; al rechazar, a "rechazado" sin cambio de rating; quien registró no ve "Confirmar".
- [x] 1.3 Cálculo Glicko-2 al confirmar un partido (función probada con los ejemplos del artículo de Glickman)
      Criterio: los ratings de ambos jugadores cambian tras la confirmación y se guarda el historial.
      Nota: rating/RD/volatilidad están protegidos por el trigger `proteger_campos_jugador`; el cálculo debe hacerse en una función `security definer` (el trigger no bloquea a las funciones internas).
      Nota: un empate (formato libre 1-1, R12) cuenta como 0,5 para cada jugador en Glicko-2.
- [x] 1.4 Validación automática a los 15 días (sin aviso al admin)
      Criterio: un partido registrado el 1 de marzo sin respuesta pasa a "confirmado" el 16 de marzo y los ratings de los dos jugadores cambian; nadie recibe ningún aviso.
      Nota: la restricción `respondido_si_no_pendiente` (tarea 1.2) obliga a rellenar `respondido_en` al cambiar el estado; decidir cómo distinguir una validación automática de una confirmación del rival.
      Nota: tras validar, llamar a `aplicar_glicko2(partido)` (tarea 1.3) para actualizar los ratings.
- [x] 1.5 Página de clasificación Glicko-2
      Criterio: lista a los jugadores con al menos un partido confirmado, ordenados por rating de mayor a menor.
      Nota: el RD guardado es el del último partido; el crecimiento por inactividad (R14) solo se aplica al jugar el siguiente. Si la clasificación debe mostrar el RD de hoy, calcularlo con `rd_tras_inactividad` al leer.
- [x] 1.6 Rendimiento y respuesta de la interfaz (la web se sentía lenta)
      Criterio: cada respuesta del servidor lleva la cabecera `Server-Timing` (tiempo total y de Supabase); la sesión se comprueba una sola vez por petición y sin viaje de red si el proyecto usa claves de firma asimétricas; al cambiar de página aparece una barra de carga, los botones reaccionan al tocarlos y muestran que trabajan, el menú y las páginas aparecen con una animación corta (desactivada con "reducir movimiento").
- [ ] 1.7 Ejecutar las páginas de Vercel en la misma región que Supabase
      Criterio: la región de las funciones de Vercel coincide con la del proyecto Supabase, y la cabecera `Server-Timing` de `/classement` muestra un tiempo de Supabase menor que antes del cambio.
      Nota: Vercel usa Washington (EE. UU.) por defecto; falta saber la región del proyecto Supabase (Project Settings → General).
      Nota: comprobar en Supabase (Authentication → JWT Keys / Signing Keys) si el proyecto usa claves asimétricas; si no, `getClaims()` sigue preguntando a Supabase en cada petición.

## Fase 2 - V2 (se detallará al terminar el MVP)

- [ ] 2.1 Crear torneo y generar cuadro de 16 con cabezas de serie
      Nota: añadir a `partidos` la columna del torneo y permitir registrar partidos de tipo torneo (en la 1.1 solo hay entrenamientos).
- [ ] 2.2 Clasificación general de torneos
- [ ] 2.3 Estadísticas por jugador
- [ ] 2.4 Emparejamiento automático de los jueves
- [ ] 2.5 Desactivar o eliminar cuentas (admin)
      Nota: hoy la base de datos impide borrar a un jugador que tiene partidos (para no perder el historial del rival); decidir qué hacer con ellos.

## Futuro

- Arbitraje en directo, guía let / no let / stroke, planificador de clases.
