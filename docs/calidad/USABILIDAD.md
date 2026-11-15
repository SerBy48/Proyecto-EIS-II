# Módulo 2 — Pruebas de usabilidad

> Materiales en [`tests/usabilidad/`](../../tests/usabilidad/) y evidencia en [`docs/evidencia/no-funcionales/usabilidad/`](../evidencia/no-funcionales/usabilidad/): 24 capturas, [`recorrido.json`](../evidencia/no-funcionales/usabilidad/recorrido.json) y [`accesibilidad-axe.json`](../evidencia/no-funcionales/usabilidad/accesibilidad-axe.json).

## 1. Alcance y método

La práctica pide tres actividades: una prueba con evaluadores de otro equipo, pensando en voz alta; el cuestionario SUS; y una evaluación heurística. Las dos primeras requieren personas. **En esta entrega no se realizaron**, por decisión del equipo (no se contó con un equipo evaluador). Quedan declaradas como limitación en la sección 8, con todos sus materiales listos para aplicarse. **No se simuló ningún dato humano.**

Para que la dimensión de usabilidad no quede sin evaluar, se aplicaron tres métodos de **inspección experta** que no dependen de usuarios, sobre la web construida (`vite preview`) y el sistema completo:

| Método | Qué aporta | Herramienta |
|---|---|---|
| **Recorrido cognitivo** (Wharton et al., 1994) | Para cada paso de cada tarea, si un usuario nuevo sabría qué hacer y si entendería la respuesta | [`recorrido.ts`](../../tests/usabilidad/recorrido.ts) con Playwright: las 8 tareas en un Chromium real |
| **Keystroke-Level Model** (Card, Moran y Newell, 1983) | Tiempo estimado de un usuario experto sin errores, a partir de los operadores de cada acción, más la respuesta real medida del sistema | El mismo recorrido registra cada operador |
| **Evaluación heurística** (Nielsen, 1994) | Problemas clasificados por heurística y severidad (0-4) | [`heuristicas.md`](../../tests/usabilidad/heuristicas.md): recorrido, 10 estados especiales y lectura del JSX |
| Accesibilidad automatizada | Incumplimientos de WCAG 2.2 A y AA | axe-core 4.10 sobre 13 pantallas |

```bash
npm run build:web && (cd clients/web && npx vite preview --host 0.0.0.0 --port 4173)
DEGRADADO=1 npm run usabilidad:recorrido   # tareas, estados, KLM, capturas y axe
npm run usabilidad:sus                      # cuando haya respuestas SUS
```

## 2. Tareas (Paso 2.2.1)

Las 8 tareas de [`tareas.md`](../../tests/usabilidad/tareas.md) cubren el flujo completo:
- **Como cliente:** entrar, buscar y filtrar, armar el carrito, aplicar un cupón, comprar, revisar y cancelar un pedido, y entender un pago rechazado.
- **Como administrador:** reponer stock y avanzar un pedido.

El archivo incluye las consignas, los criterios de éxito, los tiempos esperados, la hoja de observación y el protocolo de pensar en voz alta para la prueba con evaluadores.

**El recorrido automatizado completó las 8 tareas** con los criterios de éxito definidos.

## 3. Recorrido cognitivo

Para cada tarea se responden las cuatro preguntas del método, pensando en un usuario que conoce las tiendas en línea pero no esta en particular:

- **P1.** ¿Intentará lograr el efecto correcto?
- **P2.** ¿Notará que la acción correcta está disponible?
- **P3.** ¿Asociará la acción con el efecto que busca?
- **P4.** ¿Percibirá el progreso después de actuar?

Leyenda: ✅ sí, ⚠️ con dificultad, ❌ no.

| Tarea | P1 | P2 | P3 | P4 | Dónde falla |
|---|---|---|---|---|---|
| T1 Iniciar sesión | ✅ | ❌ | ✅ | ✅ | El "correo" es un desplegable: quien no está en la lista no ve cómo escribir el suyo (U-01) |
| T2 Buscar y filtrar | ✅ | ✅ | ✅ | ⚠️ | La búsqueda se lanza sola, sin botón, y no dice cuántos resultados hay (U-16) |
| T3 Armar el carrito | ✅ | ✅ | ✅ | ⚠️ | El aviso muestra el SKU y puede quedar fuera de la vista; la cuenta de la cabecera sí se actualiza (U-07) |
| T4 Aplicar cupón | ✅ | ✅ | ✅ | ❌ | Si el cupón es válido, la única señal es una línea en el resumen; si no lo es, el error aparece lejos del campo (U-05) |
| T5 Pagar | ⚠️ | ✅ | ✅ | ✅ | El selector "Token de la pasarela (pruebas)" invita a creer que hay que elegir algo técnico (U-08) |
| T6 Revisar y cancelar | ✅ | ⚠️ | ✅ | ⚠️ | "Ver detalle" es un enlace pequeño y cancelar solo existe dentro del detalle. No hay confirmación antes ni mensaje después; si falla, el error queda tapado (U-03, U-04) |
| T7 Pago rechazado | ✅ | ✅ | ✅ | ✅ | Ninguno. La pantalla explica qué pasó, que no hubo cobro y qué puede hacer |
| T8 Administrador | ✅ | ⚠️ | ✅ | ✅ | El SKU se escribe de memoria (H6), aunque la tabla de alertas de la misma pantalla lo muestra |

La tarea más sólida es T7: el caso de error más delicado, un rechazo del pago, es el mejor resuelto. Las más débiles son **T1**, que impide el acceso a cualquier cuenta real, **T4** y **T6**.

## 4. Estimación KLM

Tiempos estándar de los operadores:

| Operador | Significado | Tiempo |
|---|---|---|
| K | Pulsar una tecla (mecanógrafo promedio) | 0,28 s |
| P | Apuntar con el ratón | 1,1 s |
| B | Pulsar o soltar el botón del ratón (un clic = BB) | 0,1 s |
| H | Llevar la mano del teclado al ratón o al revés | 0,4 s |
| M | Preparación mental antes de cada unidad de acción (reglas de Kieras, 2001) | 1,35 s |
| R | Respuesta del sistema, **medida** en cada paso | — |

| Tarea | Operadores | Usuario | Sistema (R) | **Total KLM** | Tiempo esperado |
|---|---|---|---|---|---|
| T1 Iniciar sesión | 3M 2P 4B | 6,6 s | 0,3 s | **6,9 s** | 30 s |
| T2 Buscar y filtrar | 3M 3P 6B 8K 2H | 11,0 s | 0,5 s | **11,5 s** | 30 s |
| T3 Armar el carrito | 4M 4P 8B | 10,6 s | 0,9 s | **11,5 s** | 60 s |
| T4 Aplicar cupón | 3M 2P 4B 12K 2H | 10,8 s | 0,8 s | **11,7 s** | 30 s |
| T5 Pagar | 2M 1P 2B | 4,0 s | 0,4 s | **4,4 s** | 45 s |
| T6 Revisar y cancelar | 5M 3P 6B | 10,7 s | 1,4 s | **12,1 s** | 60 s |
| T7 Pago rechazado | 8M 7P 14B | 19,9 s | 2,4 s | **22,3 s** | 90 s |
| T8 Administrador | 11M 11P 22B 13K 4H | 34,4 s | 1,8 s | **36,2 s** | 90 s |

El desglose paso a paso está en [`recorrido.json`](../evidencia/no-funcionales/usabilidad/recorrido.json).

> **Corrección de medición.** La R de T2 en esta tabla está subestimada en ~1 s: el recorrido daba por terminada la carga filtrada antes de que empezara (ver la sección 10.2). El tiempo del usuario (11,0 s) no se ve afectado.

**Lectura:**

- **El KLM es una cota inferior.** Supone un experto que no duda ni se equivoca. Los tiempos esperados son entre 2,5 y 10 veces mayores porque incluyen la búsqueda visual y los errores de un usuario nuevo; la diferencia real solo la daría la observación de personas (sección 8).
- **El sistema no es el cuello de botella de la experiencia.** En condiciones normales responde en 0,3 a 2,4 s por tarea, menos del 12 % del total. Incluso la compra completa (la saga de 8 pasos, T5) tarda 0,4 s. La experiencia la dominan las decisiones (M) y los apuntados (P).
- **T1 es rápida por la razón equivocada.** Son 6,9 s porque el correo se elige de una lista y la contraseña viene escrita. Con un formulario estándar (escribir los 13 caracteres del correo y los 11 de la contraseña, con una M para recordarla) el KLM sería de unos **14 s**. Ese es el costo real de corregir U-01, y sigue muy por debajo de los 30 s esperados.
- **T8 es la más larga.** Tiene 11 decisiones, entre ellas cerrar una sesión y abrir otra, y el SKU se escribe a mano (13 K). Elegirlo de la tabla de alertas, que ya está en la misma pantalla, ahorraría la escritura y el esfuerzo de recordar.
- **T5, la compra, es de un solo clic** una vez armado el carrito: no pide dirección, ni datos de pago, ni confirmación. Para el KLM es eficiente; en una tienda real faltaría el paso de revisar la dirección de envío.

## 5. Evaluación heurística (Paso 2.2.2)

El detalle completo de los 17 hallazgos, con su evidencia y recomendación, está en [`heuristicas.md`](../../tests/usabilidad/heuristicas.md).

| Severidad | Cantidad | Hallazgos |
|---|---|---|
| **4, catástrofe** | 1 | **U-01**: el inicio de sesión solo admite 4 cuentas de demostración y no hay registro |
| **3, mayor** | 3 | **U-02**: 51 de 71 productos inalcanzables navegando. **U-03**: cancelar un pedido sin confirmación. **U-04**: el error de la cancelación queda tapado por el modal |
| 2, menor | 8 | U-05 (cupón), U-06 (sesión vencida), U-07 (aviso con el SKU), U-08 (controles de prueba visibles), U-09 ("Seguir comprando"), U-10 (botones de cantidad), U-11 (sin detalle de producto), U-12 (panel de pedidos) |
| 1, cosmético | 5 | U-13 (sin tildes), U-14 (estados vacíos), U-15 (carga del carrito), U-16 (cantidad de resultados), U-17 (producto de prueba visible) |

Los hallazgos se concentran en **H1 (visibilidad del estado)**, **H9 (recuperación de errores)** y **H2 (lenguaje del usuario)**. La tienda informa bien en los casos que se diseñaron con cuidado (pago rechazado, stock, carga) y mal en los demás: la cancelación, el cupón y la sesión vencida.

**Estados especiales verificados:**

| ID | Estado | Resultado |
|---|---|---|
| E1 | Contraseña incorrecta | "Credenciales invalidas." en una alerta dentro del formulario |
| E2 | Búsqueda sin resultados | "No se encontraron productos con esos criterios.", sin acción para salir |
| E3 | Alcance del catálogo | 20 de 71 productos, sin paginación (U-02) |
| E4 | Carrito vacío | Mensaje sin enlace al catálogo |
| E5 | Cupón inválido | Error a 710 px del campo (U-05) |
| E6 | Token de acceso expirado | Se renueva solo, sin que el usuario lo note |
| E7 | Sesión imposible de renovar | Mensaje, pero la cabecera sigue mostrando la sesión (U-06) |
| E8 | La cancelación falla | El error queda tapado por el modal (U-04) |
| E9 | Móvil, 390 px | Una columna, sin desplazamiento horizontal |
| E10 | Inventario caído | El catálogo sigue en pie y 20 productos muestran "Disponibilidad no verificada" |

## 6. Accesibilidad (complemento)

axe-core analizó **13 pantallas** contra WCAG 2.2 A y AA: catálogo como visitante, como cliente y en móvil, inicio de sesión (normal y con error), carrito, compra confirmada, pago rechazado, mis pedidos, detalle del pedido y las tres vistas del panel. **No encontró ninguna regla incumplida.**

Coincide con lo que se ve en el código: etiquetas en todos los campos, regiones `aria-live`, textos para lectores de pantalla, enlace para saltar al contenido, foco gestionado en el modal y `aria-current` en la navegación.

> Las herramientas automáticas detectan solo una parte de los problemas de accesibilidad. No se hicieron pruebas manuales con lector de pantalla ni de navegación completa con teclado (sección 8). Cero violaciones de axe significa que no hay fallos detectables automáticamente, no que la web sea plenamente accesible.

## 7. Cuestionario SUS (Paso 2.2.3)

⚠️ **PENDIENTE: dato humano.** No hay respuestas SUS: el cuestionario no se aplicó a evaluadores en esta entrega.

Todo queda listo para aplicarlo:

- [`sus-cuestionario.md`](../../tests/usabilidad/sus-cuestionario.md): las 10 afirmaciones estándar en español, en versión para imprimir y para Google Forms.
- [`sus-respuestas.csv`](../../tests/usabilidad/sus-respuestas.csv): la plantilla `evaluador,p1…p10`, vacía.
- `npm run usabilidad:sus` ([`calcular-sus.ts`](../../tests/usabilidad/calcular-sus.ts)):
  - valida el archivo;
  - aplica la fórmula estándar;
  - calcula la media y la desviación;
  - interpreta el resultado con el adjetivo de Bangor et al. (2009), la nota de Sauro y Lewis (2016) y la aceptabilidad de Bangor et al. (2008);
  - y escribe `sus-resultado.json`.

  **Con el archivo vacío termina con código 1 y no produce resultados.** Se verificó con datos de control fuera del repositorio: respuestas neutras dan 50 y las mejores posibles dan 100.

## 8. Limitaciones

- **Sin evaluadores humanos.** La prueba cruzada con otro equipo, la observación con pensamiento en voz alta y el SUS quedan ⚠️ **PENDIENTES: dato humano**, con todos sus materiales listos. Los métodos aplicados son de inspección experta: encuentran problemas de diseño, pero no miden la satisfacción ni los tropiezos reales de las personas.
- **El KLM modela a un experto sin errores.** Sus tiempos son cotas inferiores y no reemplazan los tiempos observados.
- **Un solo navegador** (Chromium, 1280 × 800 y 390 × 844). No se probaron Firefox ni Safari.
- **Accesibilidad solo automatizada.** No se hizo una prueba manual con lector de pantalla ni de navegación completa con teclado.
- **Contexto de laboratorio.** Algunos hallazgos (U-01 y U-08) son atajos de demostración deliberados. Se clasificaron con la severidad que tendrían en una tienda real, porque esa es la pregunta que responde la evaluación.

## 9. Conclusiones y propuestas para la Fase 3

La tienda es **accesible, adaptable y honesta con el estado del sistema** en sus flujos centrales: la compra, el pago rechazado, el stock y la degradación. Sus problemas están en los bordes: **el acceso** (U-01), **lo que no se ve del catálogo** (U-02) y **las acciones irreversibles y sus errores** (U-03, U-04).

Candidatos a corrección en la Fase 3, que se confirmarán con el equipo antes de implementarlos:

| Prioridad | Hallazgos | Severidad | Corrección |
|---|---|---|---|
| 1 | U-01 | 4 | Formulario de inicio de sesión real: correo y contraseña, con las cuentas de prueba como ayuda |
| 2 | U-03 y U-04 | 3 | Confirmar antes de cancelar, mostrar los errores dentro del diálogo y confirmar el resultado |
| 3 | U-02 | 3 | Paginación del catálogo con el total de resultados |

Cada corrección se verificará volviendo a ejecutar el recorrido (`npm run usabilidad:recorrido`) y comparando el antes y el después de los estados E3 y E8, y del KLM de T1.

## 10. Correcciones de la Fase 3: antes y después

El equipo confirmó las tres correcciones propuestas en la sección 9 antes de implementarlas. Cada una se verificó **volviendo a ejecutar el mismo recorrido** (`ETIQUETA=despues npm run usabilidad:recorrido`) y comparando los estados y el KLM. La evidencia del antes se conserva:

| | Antes | Después |
|---|---|---|
| Datos del recorrido | [`recorrido.json`](../evidencia/no-funcionales/usabilidad/recorrido.json) | [`recorrido-despues.json`](../evidencia/no-funcionales/usabilidad/recorrido-despues.json) |
| Capturas | [`capturas/`](../evidencia/no-funcionales/usabilidad/capturas/) | [`capturas-despues/`](../evidencia/no-funcionales/usabilidad/capturas-despues/) |

### 10.1 Qué se cambió

| Hallazgo | Corrección | Archivo |
|---|---|---|
| **U-01** (sev. 4): acceso solo con 4 cuentas de demostración | Campo de correo (`type="email"`, `autocomplete="username"`) y contraseña vacía, ambos obligatorios. Las cuentas de prueba quedan como ayuda plegable ("Cuentas de prueba"), ahora con Carla incluida | `clients/web/src/App.jsx` |
| **U-02** (sev. 3): 51 de 71 productos inalcanzables | Paginación de 20 productos con "Anterior", páginas numeradas (`aria-current`) y "Siguiente". Sobre la grilla, "Mostrando 1–20 de 71 productos". Un filtro nuevo vuelve a la página 1. Resuelve de paso **U-16** (la cantidad de resultados) | `clients/web/src/paginas/Catalogo.jsx` |
| **U-03** (sev. 3): cancelar sin confirmación | Dos pasos: "Cancelar pedido" muestra "¿Cancelar el pedido PED-…? Esta acción no se puede deshacer" con "Sí, cancelar pedido" y "No, conservarlo". Al terminar, un aviso de éxito: "El pedido … fue cancelado. Si ya se había cobrado, el reembolso se procesa automáticamente" | `clients/web/src/paginas/MisPedidos.jsx` |
| **U-04** (sev. 3): el error quedaba tapado | El error se muestra **dentro del diálogo**, recibe el foco y se lleva a la vista. El detalle se recarga para mostrar el estado real del pedido; si ya no se puede cancelar, el botón desaparece | `clients/web/src/paginas/MisPedidos.jsx` |

### 10.2 Resultados

| Verificación | Antes | Después |
|---|---|---|
| **E3**: productos alcanzables navegando | 20 de 71, sin paginación | **71 de 71 en 4 páginas**, con "Mostrando 61–71 de 71 productos" en la última |
| **E8**: error al cancelar un pedido ya despachado | **Tapado por el velo del modal**; el modal sigue abierto con el mismo botón | **Visible y completo** dentro del diálogo; el botón desaparece y el detalle muestra el estado actual (enviado) |
| **E11**: Carla inicia sesión (no estaba en la lista) | **Imposible**: el desplegable solo ofrecía 4 cuentas | **Entra** escribiendo su correo y su contraseña |
| **T6**: cancelar un pedido | Un clic, sin confirmación ni aviso | Confirmación explícita y aviso de éxito |
| axe (WCAG 2.2 AA) | 0 incumplimientos en 13 pantallas | **0** en 13 pantallas, incluidos el formulario nuevo, la paginación y el diálogo de confirmación |
| Las 8 tareas | Se completan | Se completan |

Durante la verificación apareció un detalle que la primera versión de la corrección no cubría. El error de U-04 se mostraba dentro del diálogo, pero **cortado por su borde inferior**: al recargar el detalle, el historial crecía y empujaba el aviso hacia abajo. Por eso el recorrido ahora comprueba que el aviso se vea *completo* y no solo que esté encima del velo, y el diálogo vuelve a llevar el aviso a la vista cada vez que cambia el detalle.

**KLM, el costo de las correcciones:**

| Tarea | Antes | Después | Por qué cambia |
|---|---|---|---|
| T1 Iniciar sesión | 6,9 s | **17,8 s** | Ahora se escriben el correo (13 K) y la contraseña (11 K). El antes era rápido porque **no** era un inicio de sesión real. Con Tab entre campos, en lugar de apuntar al segundo con el ratón, el KLM sería de unos 14 s |
| T6 Revisar y cancelar | 12,1 s | **15,2 s** | Un paso más: leer la pregunta (M) y confirmar (P B B). Es el costo deliberado de prevenir un error irreversible (H5) |
| T8 Administrador | 36,2 s | **44,6 s** | Su inicio de sesión también se escribe |
| T2 Buscar y filtrar | 11,5 s | 12,4 s | Corrección de la medición, no de la web. El recorrido del antes daba por terminada la carga filtrada antes de que empezara (el *debounce* de 350 ms) y registraba una R de 0,03 s; ahora espera la respuesta real y mide 1,0 s. El tiempo del usuario es idéntico (11,0 s) |
| T3, T4, T5, T7 | 4,4 a 22,3 s | Sin cambios (±0,7 s de respuesta del sistema) | — |

Todas las tareas siguen muy por debajo de su tiempo esperado; la mayor es T8, con el 50 %. Las tres correcciones **aumentan** el KLM porque añaden pasos que faltaban: escribir credenciales reales y confirmar antes de destruir. El KLM mide la eficiencia de un experto. La prevención de errores y el acceso universal no aparecen en él, y por eso se evalúan con los estados E3, E8 y E11.

### 10.3 Estado de los hallazgos

| Estado | Hallazgos |
|---|---|
| ✅ Corregidos | U-01, U-02, U-03, U-04 y U-16 (resuelto por la paginación) |
| Pendientes (sev. 2) | U-05 (cupón), U-06 (sesión vencida), U-07 (aviso con el SKU), U-08 (controles de prueba visibles), U-09 ("Seguir comprando"), U-10 (botones de cantidad), U-11 (detalle de producto), U-12 (panel de pedidos) |
| Pendientes (sev. 1) | U-13 (tildes), U-14 (estados vacíos), U-15 (carga del carrito), U-17 (producto de prueba visible) |

No queda ningún hallazgo de severidad 3 o 4.

Regresión completa ([`07-regresion-fase3-usabilidad.txt`](../evidencia/no-funcionales/07-regresion-fase3-usabilidad.txt)): typecheck, salud, 73/73 casos HTTP, concurrencia, 49/49 comprobaciones e2e y build de la web.
