# Tareas de la prueba de usabilidad

Material para una sesión de observación con evaluadores externos (prueba cruzada), y guion del recorrido cognitivo automatizado ([`recorrido.ts`](recorrido.ts)), que ejecuta exactamente estas tareas.

**Entorno:** la web construida y servida con `vite preview` (`http://localhost:4173`) y el sistema completo en contenedores. Todas las cuentas usan la contraseña `Password123`.

## 1. Tareas

Las tareas se leen al evaluador **una por una**, tal como están en la columna "Consigna", sin decir dónde está cada cosa. El tiempo esperado es el de un usuario que conoce las tiendas en línea pero no esta en particular. Es la referencia para marcar una tarea como "lenta", no un límite.

| # | Consigna para el evaluador | Rol | Criterio de éxito | Tiempo esperado |
|---|---|---|---|---|
| T1 | "Entre a la tienda con la cuenta de Ana." | Cliente | Ve su correo junto al botón Salir | 30 s |
| T2 | "Busque un portátil y quédese solo con los productos de tecnología." | Cliente | La lista muestra solo portátiles de la categoría tecnología | 30 s |
| T3 | "Agregue dos portátiles distintos al carrito y luego lleve uno de ellos a dos unidades." | Cliente | El carrito tiene dos productos, uno con cantidad 2 | 60 s |
| T4 | "Tiene el cupón BIENVENIDA10. Úselo." | Cliente | El resumen muestra la línea de descuento | 30 s |
| T5 | "Termine la compra con la tarjeta de prueba que aprueba el pago." | Cliente | Ve "Compra confirmada" con un número de pedido | 45 s |
| T6 | "Revise el estado del pedido que acaba de hacer y cancélelo." | Cliente | El pedido aparece como cancelado en "Mis pedidos" | 60 s |
| T7 | "Compre otro producto, ahora con la tarjeta que rechaza el pago, y cuénteme qué pasó con su compra." | Cliente | Explica con sus palabras que no se cobró y que el pedido quedó cancelado | 90 s |
| T8 | "Entre como administrador, registre 10 unidades del producto SKU-HOG-002 y pase un pedido pagado a preparación." | Administrador | Ve el mensaje con las unidades nuevas y el pedido en "en preparación" | 90 s |

Preparación antes de cada sesión: el carrito de Ana vacío y SKU-HOG-002 por debajo del mínimo (`npm run sembrar:carga` deja los datos en ese estado).

## 2. Protocolo de pensar en voz alta (*think-aloud*)

Lo lee el moderador al empezar:

> "Gracias por ayudarnos. Vamos a evaluar la tienda, no a usted: si algo le cuesta, es un problema de la tienda y eso es justo lo que buscamos. Le voy a leer unas tareas. Mientras las hace, por favor diga en voz alta lo que piensa: qué está buscando, qué espera que pase, qué le sorprende. No le voy a ayudar durante la tarea; si se queda bloqueado, avíseme y pasamos a la siguiente. ¿Tiene alguna pregunta antes de empezar?"

Reglas para el moderador:

- **No guiar.** No decir "haga clic en…" ni señalar la pantalla. Si el evaluador pregunta, responder con otra pregunta: "¿Dónde cree que estaría?".
- **Recordar que piense en voz alta** si se queda en silencio más de 10 segundos: "¿Qué está pensando ahora?".
- **Abandono:** si el evaluador lo pide o pasan 3 veces el tiempo esperado, la tarea se marca como fallida y se pasa a la siguiente.
- **Al final:** se aplica el cuestionario SUS ([`sus-cuestionario.md`](sus-cuestionario.md)) **antes** de cualquier conversación sobre la tienda, para no sesgar las respuestas.

## 3. Hoja de observación

Una por evaluador. La llena el observador, que mira en silencio y **no** es el moderador.

Evaluador: ______ Fecha: ______ Observador: ______ Dispositivo y navegador: ______

| Tarea | Éxito (sí / con ayuda / no) | Tiempo (s) | Errores (clics o caminos equivocados) | Dónde se tropezó | Comentarios en voz alta (literales) |
|---|---|---|---|---|---|
| T1 | | | | | |
| T2 | | | | | |
| T3 | | | | | |
| T4 | | | | | |
| T5 | | | | | |
| T6 | | | | | |
| T7 | | | | | |
| T8 | | | | | |

Para T7 se anota además la explicación del evaluador sobre lo ocurrido con su compra (¿entendió que no hubo cobro?).

Observaciones generales (expresiones de frustración o satisfacción, cosas que buscó y no encontró):

______________________________________________________________________

______________________________________________________________________

## 4. Estado de la prueba con evaluadores

⚠️ **PENDIENTE: dato humano.** La prueba cruzada con otro equipo no se realizó en esta entrega (ver la sección de limitaciones de [`docs/calidad/USABILIDAD.md`](../../docs/calidad/USABILIDAD.md)). Las tareas se evaluaron con una inspección experta: el recorrido cognitivo y la estimación KLM automatizados, más la evaluación heurística de Nielsen.
