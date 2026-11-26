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
- [ ] 0.4 Borrar la tabla `prueba_conexion` (de la tarea 0.1) cuando el login (0.3) funcione
      Criterio: la tabla ya no existe en Supabase y la página de inicio muestra el perfil del jugador conectado (sin sesión, `jugadores` no se puede leer: R10).
- [ ] 0.5 Fijar los finales de línea con `.gitattributes` (`* text=auto eol=lf`)
      Criterio: en Windows, `scripts/verificar.sh` no da avisos de Prettier en archivos recién descargados de GitHub.

## Fase 1 - MVP

- [ ] 1.1 Registrar un partido juego a juego
      Criterio: tras registrar 3-1 (11-7, 9-11, 11-5, 11-8), el partido aparece "pendiente" y ningún rating cambia.
- [ ] 1.2 Confirmar o rechazar un partido
      Criterio: al confirmar, el estado pasa a "confirmado"; al rechazar, a "rechazado" sin cambio de rating; quien registró no ve "Confirmar".
- [ ] 1.3 Cálculo Glicko-2 al confirmar un partido (función probada con los ejemplos del artículo de Glickman)
      Criterio: los ratings de ambos jugadores cambian tras la confirmación y se guarda el historial.
      Nota: rating/RD/volatilidad están protegidos por el trigger `proteger_campos_jugador`; el cálculo debe hacerse en una función `security definer` (el trigger no bloquea a las funciones internas).
- [ ] 1.4 Validación automática a los 15 días con aviso al admin
      Criterio: un partido registrado el 1 de marzo sin respuesta pasa a "confirmado" el 16 de marzo y el admin recibe un aviso (canal por definir).
- [ ] 1.5 Página de clasificación Glicko-2
      Criterio: lista a los jugadores con al menos un partido confirmado, ordenados por rating de mayor a menor.

## Fase 2 - V2 (se detallará al terminar el MVP)

- [ ] 2.1 Crear torneo y generar cuadro de 16 con cabezas de serie
- [ ] 2.2 Clasificación general de torneos
- [ ] 2.3 Estadísticas por jugador
- [ ] 2.4 Emparejamiento automático de los jueves
- [ ] 2.5 Desactivar o eliminar cuentas (admin)

## Futuro

- Arbitraje en directo, guía let / no let / stroke, planificador de clases.
