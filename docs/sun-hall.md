# Salón de la Fama

Clasificación histórica pública de diez resultados, ordenados por puntos, precisión,
mejor racha y antigüedad. El apodo no identifica una cuenta: puede repetirse.
Los modos local y práctica conservan sus propios resultados y comportamiento.
El botón flotante «Jugar» abre el menú de modos y permite
consultar las medallas y mejores partidas locales sin completar una partida nueva.

En «Contra la IA», cada jugador suma un punto si su rival pierde la devolución.
La partida termina a 11 o 21 puntos, según la opción elegida, con dos de ventaja.
La dificultad ajusta la velocidad de la pelota y la reacción de la pala rival.
El jugador puede seleccionar golpe plano, liftado o cortado. Con el teclado,
↑ ejecuta un liftado y ↓ un cortado durante una devolución.
El marcador es independiente de los retos de devoluciones y del Salón de la Fama.

## Identidad y mecánica de tenis de mesa

El minijuego es un reto de reflejos del Club Esportiu Joventut TT: mesa con red,
pelota blanca, pala roja del visitante y pala negra del rival virtual. Mover el
puntero desplaza la pala; pulsar o tocar la pelota la devuelve hacia el rival.
El contacto horizontal añade una pequeña variación de dirección. En móvil basta
con tocar la pelota y se conserva la activación de la devolución por teclado.
El puntero coincide con el centro de la goma; el cursor nativo se oculta dentro
de la mesa durante el juego. Los golpes se detectan por contacto entre la cara
de la pala y la pelota, incluso si el centro de la pala queda fuera del botón de
la pelota. En el Salón se registran las coordenadas efectivas de la pala, también
al alcanzar los bordes. La pala del botón de portada bota respetando la
preferencia de movimiento reducido y se detiene mientras el menú está abierto.
Los puntos, bonos, niveles y objetivos se mantienen como reglas del reto arcade.
Los registros y medallas existentes se conservan en sus claves y tablas originales.

La simulación compartida usa `rulesVersion: 4`. La pelota recorre el tablero en
tres dimensiones y rebota con gravedad. En «Competir», «Practicar» y la partida
de 30 segundos, la recepción se extiende por detrás del borde cercano y el
aumento de velocidad se atenúa al llegar al lado del jugador. En «Competir», el
servidor reproduce esa trayectoria y proyecta la pelota a las coordenadas de
pantalla para validar cada devolución.
Los desafíos se vinculan a su versión al calcular el hash del token. La
clasificación histórica se mantiene en la misma tabla.

## Partidas y publicación

- `GET /api/sun-hall`: devuelve únicamente los campos públicos del top 10.
- `POST /api/sun-hall/challenge`: solicita un recorrido para un tablero de tamaño
  acotado. El servidor genera una semilla y un token aleatorio de 256 bits. Solo
  guarda el hash del token, junto con el tablero, la fecha y el identificador
  de red resumido mediante SHA-256. Límite: doce inicios por hora e identificador.
- Antes de cada partida se muestra una cuenta atrás de tres segundos. El reloj
  de juego y los tiempos de pulsación empiezan después de esta preparación.
  Ocultar la pestaña durante la preparación la cancela.
- La partida dura 30 segundos activos, sin pausas. Ocultar la pestaña o cambiar
  el tamaño interrumpe la partida; también se comprueba una respuesta de inicio
  que llega después de ocultar la pestaña. Se mantiene el acceso por teclado.
- Al terminar se solicita, de forma opcional, un apodo de 3–20 caracteres y una
  aceptación explícita de publicación. No se envía automáticamente el resultado.
- `POST /api/sun-hall/publish`: recibe token, apodo, consentimiento y pulsaciones
  con coordenadas y tiempos. Rechaza campos como `points`. Reconstruye el juego
  usando la misma simulación de pasos fijos que el cliente; calcula aciertos,
  fallos, puntos y rachas. Valida duración, caducidad, límites de coordenadas,
  orden de eventos, separación mínima y un máximo de 300 pulsaciones.
- La transacción SQL bloquea la sesión y publica una sola vez. Los reintentos
  devuelven la entrada existente y no permiten cambiar el apodo ni el resultado.
  El token caduca a los quince minutos. Las sesiones abandonadas caducadas hace
  más de un día se eliminan al crear nuevas sesiones. Las sesiones publicadas
  se conservan como identidad de su resultado; los eventos no se almacenan.

La validación evita aceptar puntuaciones arbitrarias, sesiones inventadas y
publicaciones repetidas. **No demuestra que juegue una persona**: un bot que
reproduzca un recorrido válido puede competir. No se implementan autenticación,
verificación humana, moderación de apodos ni clasificación semanal en esta versión.

## Activación

Requiere el Supabase del proyecto y sus variables de servidor ya admitidas en
`lib/supabase/env.ts`: URL y service role. La clave service role nunca se importa
en componentes del navegador. No necesita Redis ni una clave de firma adicional.

Aplicar la migración `supabase/migrations/20261116120000_sun_hall_of_fame.sql`
primero al entorno de pruebas y después mediante el proceso habitual de despliegue.
La implementación no aplica migraciones remotas ni despliega automáticamente.

Estado del 16 de noviembre de 2026: migración aplicada y registrada en el Supabase
configurado en `.env`, tras autorización explícita. Se ejecutó únicamente esta
migración en una transacción y se verificó que el registro coincide con el archivo.
RLS, permisos de tablas y funciones, y `search_path` de las funciones quedaron
comprobados. PostgREST devuelve 200 con service role y deniega la lectura directa
con anon. La API local `/api/sun-hall` devuelve 200 usando el mismo proyecto.
No se insertaron partidas ni resultados de prueba. El código aún no se ha desplegado.

Las dos tablas tienen RLS y no conceden acceso a `anon` o `authenticated`;
las funciones de escritura solo pueden ejecutarse con `service_role`.
La API exige mismo origen para POST, limita el cuerpo y devuelve errores públicos
sin detalles internos. Si falta configuración o la migración, responde 503 y
la interfaz indica que el Salón no está disponible; los otros modos siguen activos.

## Verificación

Pruebas de simulación, contratos, API, servicio e interfaz:

```sh
npx jest tests/jest/sun-hall-game.test.ts tests/jest/sun-hall-routes.test.ts tests/jest/sun-hall-server.test.ts tests/jest/sun-hall-ui.test.tsx --runInBand
```

En una base **aislada** con la migración aplicada y los roles de Supabase,
ejecutar `tests/sql/sun-hall.sql` con `psql -v ON_ERROR_STOP=1 -f ...`.
Comprueba permisos, publicación anticipada, exactitud de estadísticas,
caducidad, límites e idempotencia; revierte todas sus filas de prueba.

La revisión de navegador usa respuestas aisladas de la API y el motor real para
reconstruir el resultado, sin insertar puntuaciones de prueba en servicios remotos.
Debe repetirse contra el Supabase de pruebas tras aplicar la migración para
verificar también el transporte PostgREST y la configuración del entorno.
