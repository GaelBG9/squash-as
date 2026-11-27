# Cahier des charges - Plataforma del AS de squash (V1)

## 1. Contexto

El AS de squash tiene dos grupos de jugadores (grupo 1 y grupo 2), una clase todos los jueves y 4 torneos al año. Hoy no existe una herramienta común para la lista de miembros, los resultados, las clasificaciones y la organización de los torneos.

## 2. Objetivo

Una aplicación web simple, moderna y usable desde el móvil que centralice:

- la lista de miembros,
- los resultados de los partidos (torneos y entrenamientos),
- dos clasificaciones (torneos y nivel Glicko-2),
- la organización de los torneos con cuadros de 16,
- las estadísticas de cada jugador,
- el emparejamiento automático de los jueves.

## 3. Alcance

### Incluido en la V1

- Login con Google.
- Lista de miembros con su grupo (1 o 2).
- Registro de partidos con confirmación del rival.
- Clasificación general de torneos.
- Clasificación de nivel con Glicko-2 (torneos y entrenamientos).
- Organización de torneos con cuadros de 16.
- Estadísticas por jugador.
- Emparejamiento automático para la clase de los jueves.

### Excluido de la V1 (posibles proyectos futuros)

- Guía de decisiones let / no let / stroke.
- Planificador de clases con ejercicios.
- Arbitraje en directo (marcador punto a punto).

### Excluido definitivamente

- Control de asistencia a las clases.

## 4. Usuarios y roles

- **Jugador**: cualquier persona con cuenta Google puede conectarse y obtiene este rol automáticamente.
- **Administrador**: Gaël (responsable del proyecto). Gestiona miembros y torneos.

## 5. Funcionalidades (historias de usuario)

### MVP

1. Como jugador, quiero conectarme con mi cuenta Google para no tener que crear una contraseña.
2. Como jugador, quiero registrar el resultado de un partido para que cuente en las clasificaciones.
3. Como rival, quiero confirmar o rechazar un resultado para evitar errores o trampas.
4. Como jugador, quiero ver la clasificación Glicko-2 para conocer mi nivel respecto a los demás.

### V2

5. Como administrador, quiero crear un torneo y generar un cuadro de 16 para organizarlo.
6. Como jugador, quiero ver la clasificación general de torneos de la temporada.
7. Como jugador, quiero ver mis estadísticas (partidos, juegos y puntos ganados/perdidos, porcentajes).
8. Como administrador, quiero generar los emparejamientos del jueves automáticamente para ahorrar tiempo.

## 6. Modelo de datos

Una "entidad" es un tipo de objeto que se guarda en la base de datos (una tabla).

| Entidad             | Campos principales                                                                                                                                                                                                                             | Relaciones                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Jugador             | id, nombre, email Google (privado: R11), grupo (1/2), rol, rating, RD, volatilidad                                                                                                                                                             | -                               |
| Partido             | id, fecha, tipo (torneo/entrenamiento), formato (libre/mejor de 3/mejor de 5), jugador A (quien registra), jugador B (rival), ganador (vacío si empate), estado (pendiente/confirmado/rechazado), registrado por, registrado en, respondido en | 2 jugadores; 0 o 1 torneo       |
| Juego               | id, partido, número, puntos A, puntos B                                                                                                                                                                                                        | pertenece a un partido          |
| Torneo              | id, nombre, fecha, temporada                                                                                                                                                                                                                   | tiene un cuadro y partidos      |
| Cuadro              | id, torneo, ronda, posición, jugador                                                                                                                                                                                                           | pertenece a un torneo           |
| Historial de rating | jugador, partido, fecha del partido, rating, RD, volatilidad (valores tras cada partido confirmado)                                                                                                                                            | permite la gráfica de evolución |

RD (rating deviation) = la incertidumbre de Glicko-2 sobre el nivel del jugador.

## 7. Reglas de negocio

- R1. Un partido solo cuenta en las clasificaciones y estadísticas cuando el rival lo ha confirmado.
- R2. Quien registra el resultado no puede confirmarlo él mismo.
- R3. La clasificación de nivel usa Glicko-2 e incluye partidos de torneo y de entrenamiento.
- R4. La clasificación general solo usa los resultados de torneos.
- R5. Un cuadro de torneo tiene 16 plazas.
- R6. El marcador se guarda juego a juego (por ejemplo 11-7, 9-11, 11-5).
- R7. Cualquier persona con cuenta Google puede registrarse; no hay validación previa por un administrador.
- R8. Si el rival no confirma ni rechaza un partido en 15 días desde su registro, el partido pasa automáticamente a "confirmado", sin avisar a nadie.
- R9. Solo el administrador asigna o cambia el grupo y el rol de un jugador; el jugador solo puede cambiar su nombre.
- R10. La lista de jugadores solo es visible para usuarios conectados.
- R11. El email de un jugador solo lo ven él mismo y el administrador; los demás jugadores ven su nombre, grupo, rol y nivel.
- R12. Un partido tiene uno de tres formatos: libre (1 o 2 juegos sueltos, para los entrenamientos; un 1-1 es empate), al mejor de 3 (termina al ganar 2 juegos) o al mejor de 5 (termina al ganar 3). No se controla el tanteo de cada juego (no siempre se juega a 11), pero cada juego tiene un ganador.
- R13. Solo uno de los dos jugadores puede registrar un partido; el otro es quien lo confirma o rechaza.
- R14. Los ratings Glicko-2 de los dos jugadores se actualizan en cuanto se confirma el partido (cada partido cuenta como un periodo del algoritmo); una victoria cuenta 1, una derrota 0 y un empate 0,5. La incertidumbre (RD) de un jugador crece por cada semana sin jugar antes de su siguiente partido, sin pasar nunca de 350.
- R15. La clasificación Glicko-2 es común a los dos grupos; se puede filtrar por grupo 1 o 2 (los puestos se cuentan entonces dentro del grupo, y los jugadores sin grupo solo salen en la lista completa). Cada jugador aparece con su incertidumbre (RD) de hoy, es decir, con las semanas sin jugar ya sumadas (R14).
- Por definir: puntos por ronda en la clasificación de torneos, reglas de emparejamiento.

## 8. Criterios de aceptación

- Historia 1: un usuario que pulsa "Conectarse con Google" y acepta llega a su perfil; un usuario no conectado no puede registrar partidos.
- Historia 2: tras registrar 3-1 con juegos 11-7, 9-11, 11-5, 11-8, el partido aparece con estado "pendiente" y no cambia ningún rating.
- Historia 2: en formato libre, un 1-1 se guarda como empate; al mejor de 3, un 1-1 no se puede registrar porque el partido no ha terminado.
- Historia 3: cuando el rival confirma, el estado pasa a "confirmado" y los ratings de ambos jugadores cambian; si rechaza, el estado pasa a "rechazado" y los ratings no cambian.
- Historia 3: quien registró el partido no ve el botón "Confirmar".
- Historia 3: un partido registrado el 1 de marzo y sin respuesta pasa a "confirmado" el 16 de marzo y los ratings se actualizan, sin enviar ningún aviso.
- Historia 1: una cuenta Google nueva puede conectarse y registrar un partido sin intervención del administrador.
- Historia 4: la clasificación lista a todos los jugadores con al menos un partido confirmado, ordenados por rating de mayor a menor.
- Historia 4: con el filtro "Groupe 1", solo salen los jugadores del grupo 1, numerados desde 1; un jugador que no juega desde hace un año muestra un RD mayor que el guardado tras su último partido.
- Historia 5: con 16 inscritos, el cuadro tiene 8 partidos en primera ronda y los cabezas de serie 1 y 2 solo pueden enfrentarse en la final.
- Historia 7: un jugador con 3 partidos confirmados, 2 ganados, ve "2 victorias / 1 derrota - 67 %".
- Historia 8: con un número par de jugadores presentes, cada uno recibe exactamente un rival.

## 9. Restricciones técnicas

- Frontend: SvelteKit (framework de JavaScript para webs interactivas).
- Backend y base de datos: Supabase (PostgreSQL + login + API automática).
- Presupuesto: 0 euros, plan gratuito de Supabase (500 MB de BD, 2 proyectos activos, pausa tras 1 semana sin actividad).
- Uso principal en móvil.
- Idioma de la interfaz: francés (todo el texto que ven los usuarios, incluidas las URLs y los mensajes de error). El código y la documentación siguen en español.
- Volumen: los miembros de un AS (unas decenas de usuarios).
- Alojamiento del frontend: Vercel (plan Hobby gratuito), desplegado automáticamente en cada merge a `main`.

## 10. Decisiones y su porqué

| Decisión                                       | Razón                                                                                               |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| SvelteKit                                      | Buen equilibrio entre simplicidad y aspecto moderno; buen proyecto para el CV.                      |
| Supabase                                       | Login con Google integrado, PostgreSQL, permisos por filas, plan gratuito suficiente y open source. |
| Glicko-2 en vez de ELO                         | Más justo con jugadores que juegan poco o que son nuevos gracias a la incertidumbre (RD).           |
| Confirmación de resultados                     | Evitar errores y trampas.                                                                           |
| Registro abierto con Google                    | Simplicidad: nadie tiene que validar nuevas cuentas.                                                |
| Validación automática a los 15 días, sin aviso | Ningún resultado queda bloqueado, y sin avisos que acaben ignorados.                                |
| Sin asistencia a clases                        | Decisión del responsable del proyecto.                                                              |
| Guía let/stroke y planificador fuera de la V1  | Mantener un alcance realista; quedan como proyectos futuros.                                        |

## 11. Etapas

- **MVP**: login Google, miembros, registro y confirmación de partidos, ranking Glicko-2 (historias 1-4).
- **V2**: torneos con cuadros de 16, clasificación general, estadísticas, emparejamiento de los jueves (historias 5-8).
- **Futuro**: arbitraje en directo, guía let/no let/stroke, planificador de clases.

## 12. Preguntas abiertas

1. ¿Puede haber más de un administrador en el futuro?
2. ¿Cuántos puntos da cada ronda en la clasificación general de torneos?
3. ~~¿Los partidos se juegan al mejor de 3 o de 5 juegos? ¿Depende del contexto?~~ Respondida: se elige al registrar (libre, mejor de 3 o mejor de 5; ver R12).
4. ~~¿Por qué canal llega el mensaje al admin?~~ Respondida: no hay mensaje, la validación automática es silenciosa (ver R8). Sigue abierto: ¿puede el admin anular un partido validado automáticamente?
5. ¿Cómo se empareja el jueves: por grupo, por nivel Glicko-2 cercano, evitando repetir rivales?
6. ¿Se incluye un cuadro de consolación (plate) para los eliminados en primera ronda?
7. ¿Cómo se eligen los cabezas de serie: por rating Glicko-2 o por la clasificación de torneos?
8. ¿Qué pasa si hay menos o más de 16 inscritos en un torneo?
9. ¿Los partidos de torneo deben pesar más en Glicko-2 que los de entrenamiento?
10. ~~¿Dónde se aloja el frontend (Vercel, Netlify, VPS)?~~ Respondida: Vercel (ver sección 9).
11. ~~¿Los grupos 1 y 2 tienen clasificaciones separadas o una común?~~ Respondida: una común con filtro por grupo (ver R15).
