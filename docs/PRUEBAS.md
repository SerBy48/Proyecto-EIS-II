# Pruebas del sistema

Plan de pruebas y **resultados obtenidos**. Documenta el paso de pruebas de
integración de la guía de laboratorio, adaptado al dominio del comercio
electrónico.

| | |
|---|---|
| **Última ejecución** | 15 de noviembre de 2026 (servicios en contenedores, base poblada con `npm run sembrar:carga` y secretos propios en `.env`) |
| **Casos ejecutados** | 316: 203 de integración (33 de concurrencia + 73 por HTTP + 51 extremo a extremo + 46 del asistente) y 113 unitarias. Además, 355 comprobaciones de cobertura de OpenAPI y 21 verificaciones de seguridad |
| **Resultado** | 316 pasan, 0 fallan; las 355 comprobaciones de OpenAPI pasan; seguridad: 1 hallazgo de 21 (S-09, aceptado). Asistente: 91,7 % de acierto de intenciones. Regresión de la Fase 4: [`no-funcionales/08-regresion-tf-fase4.txt`](evidencia/no-funcionales/08-regresion-tf-fase4.txt) |
| **Entorno** | Windows 11, Node 25, Docker: PostgreSQL 16 (puerto 5434 del host), MongoDB 7, Redis 7, RabbitMQ 3 y Mailpit 1.27. Infraestructura completa |
| **Evidencia** | [`evidencia/`](evidencia/) — salida literal de cada suite |

---

## 1. Estrategia

Cinco niveles, de más rápido a más completo. Se ejecutan en orden: si falla uno,
los siguientes no aportan información útil.

| Nivel | Qué verifica | Cómo se ejecuta | Necesita |
|---|---|---|---|
| 1. Estático | Que todo compile y los tipos cuadren | `npm run typecheck`, `npm run build:web` | nada |
| 2. Salud | Que los nueve servicios respondan | `npm run test:salud` | infraestructura + servicios |
| 3. Concurrencia | Que no haya sobreventa | `npm run test:concurrencia` | PostgreSQL |
| 4. Contrato HTTP | Códigos de estado, RBAC, idempotencia, aislamiento | `npm run test:http` | infraestructura + servicios |
| 5. Integración E2E | El flujo de compra completo de 15 pasos, incluido el correo real en Mailpit | `npm run test:e2e` | **infraestructura completa** |
| 0. Unitarias | Lógica aislada: circuit breaker, reintentos, JWT y RBAC, bus de eventos, totales del carrito, plantillas, esquema del ORM | `npm run test:unit` | nada |
| 0. Documentación | La especificación OpenAPI cubre exactamente las rutas y los roles del código | `npm run test:openapi` | nada |
| 6. Asistente | Intenciones, contexto, aislamiento entre clientes, escalamiento, degradación | `npm run test:asistente` | **infraestructura completa** |

El nivel 3 es el central del laboratorio: verifica la pregunta 5 del análisis
atacando directamente la función `reservar_stock` de PostgreSQL, sin pasar por la
API, para aislar el mecanismo de concurrencia del resto del sistema.

---

## 2. Resultados por nivel

### Nivel 1 — Verificación estática

```
npm run typecheck      →  0 errores en 12 paquetes
npm run build:web      →  compila; 176.66 kB (54.44 kB gzip)
```

### Nivel 2 — Salud del sistema

Salida de `npm run test:salud`
([`evidencia/03-salud-sistema.txt`](evidencia/03-salud-sistema.txt)):

```
  OK   auth             ok
         └─ postgres:auth_db     conectado
  OK   clientes         ok
         └─ postgres:clientes_db conectado
         └─ rabbitmq             conectado
  OK   catalogo         ok
         └─ mongo:catalogo_db    conectado
  OK   inventario       ok
         └─ postgres:inventario_db conectado
         └─ rabbitmq             conectado
  OK   carrito          ok
         └─ redis                conectado
  OK   pedidos          ok
         └─ postgres:pedidos_db  conectado
         └─ rabbitmq             conectado
  OK   pagos            ok
         └─ postgres:pagos_db    conectado
         └─ rabbitmq             conectado
  OK   notificaciones   ok
         └─ mongo:notificaciones_db conectado
         └─ rabbitmq             conectado

Los nueve servicios responden. El sistema esta listo.
```

Una ejecución anterior, en un entorno **sin MongoDB ni RabbitMQ**, mostró dos
propiedades que conviene conservar:

- **Degradación correcta.** Con RabbitMQ ausente, los cuatro servicios que
  publican eventos siguen reportándose `ok`, porque el broker está declarado como
  dependencia **no crítica**. Es la Actividad 6, punto d: su caída retrasa las
  notificaciones, no detiene la venta.
- **Aislamiento de fallos.** Catálogo y notificaciones estaban caídos (requieren
  MongoDB) y los otros siete siguieron operando con normalidad. Es la respuesta
  práctica a la pregunta 4 del análisis.

### Nivel 3 — Concurrencia sobre el inventario

`npm run test:concurrencia` → **33 comprobaciones, 33 pasan**
([`evidencia/01-concurrencia-stock.txt`](evidencia/01-concurrencia-stock.txt)).

| # | Escenario | Comprobaciones | Resultado |
|---|---|---|---|
| 1 | Dos compradores, una unidad | 5 | Exactamente uno gana; stock queda en 0 |
| 2 | Veinte compradores, cinco unidades | 4 | Exactamente cinco ganan, quince reciben `sin_stock` |
| 3 | Reintento con la misma clave | 5 | Devuelve la misma reserva; descuenta una sola vez |
| 4 | Pago rechazado (compensación) | 8 | La unidad vuelve a estar disponible; liberar dos veces no la duplica |
| 5 | Pago aprobado (confirmación) | 8 | El descuento se vuelve definitivo; confirmar dos veces es idempotente |
| 6 | Stock nunca negativo | 3 | Reserva mayor al stock se rechaza; el `CHECK` bloquea el negativo directo |

Extracto literal del escenario más importante:

```
Escenario 1: dos compradores, una sola unidad
  Stock inicial de SKU-TEC-004: 1 unidad
  Ana y Bruno pulsan "Comprar" en el mismo instante...
  Ana:   reservado
  Bruno: sin_stock
  PASA  Exactamente un comprador obtiene la unidad
  PASA  El otro comprador recibe sin_stock
  PASA  El stock disponible queda en 0, nunca negativo

Escenario 2: veinte compradores, cinco unidades
  Reservas concedidas: 5 | rechazadas: 15
  PASA  Se conceden exactamente 5 reservas
```

### Nivel 4 — Contrato HTTP

`npm run test:http` → **73 casos, 73 pasan**
([`evidencia/02-contrato-http.txt`](evidencia/02-contrato-http.txt)).

| Suite | Área | Casos |
|---|---|---|
| A | Autenticación, emisión de tokens y registro | 9 |
| B | Control de acceso, circuit breaker y validación de entradas | 20 |
| C | Inventario: reservas, idempotencia, compensación | 12 |
| D | Pagos: los cuatro desenlaces de la pasarela | 9 |
| E | Pedidos: identificadores y ciclo de vida | 16 |
| F | Limitación de peticiones y bloqueo de cuenta | informativa |
| G | Cumplimiento PCI-DSS del esquema | 1 |
| H | Aislamiento de las bases de datos | 6 |
| I | Degradación y salud del sistema | informativa |

### Nivel 5 — Integración extremo a extremo

`npm run test:e2e` → **51 comprobaciones, 51 pasan**
([`evidencia/04-e2e-compra.txt`](evidencia/04-e2e-compra.txt)).

| Escenario | Qué recorre |
|---|---|
| A | Compra exitosa: los 15 pasos del flujo, bitácora de la saga, notificación asíncrona por RabbitMQ y correo de confirmación recibido en Mailpit |
| B | Pago rechazado: la saga compensa y el stock se libera |
| C | Dos clientes disputan la última unidad: un solo ganador |
| D | Doble clic en «Pagar»: un solo pedido (idempotencia del checkout) |
| E | Cancelación de un pedido pagado: reembolso y devolución de stock |
| F | Controles de seguridad |

### Pruebas unitarias y de documentación (Trabajo Final, Fase 2)

`npm run test:unit` → **94 pruebas en 10 archivos, 94 pasan**
([`evidencia/05-pruebas-unitarias.txt`](evidencia/05-pruebas-unitarias.txt); cobertura en [`evidencia/05-cobertura-unitarias.txt`](evidencia/05-cobertura-unitarias.txt)).
No necesitan Docker.

| Archivo | Qué fija |
|---|---|
| `circuit-breaker.test.ts` | Transiciones cerrado → abierto → semiabierto → cerrado; los 4xx no cuentan (invariante 14) |
| `cliente-servicio.test.ts` | Reintentos solo ante red y 5xx, nunca 409 (invariante 7); el cobro sin reintentos; timeout → 504; cabeceras de la llamada interna |
| `autenticacion.test.ts` | Token manipulado, forjado o expirado; secretos (invariante 13); RBAC; llamada interna con dos condiciones (invariante 11) |
| `bus-eventos.test.ts` | Publicar nunca lanza (invariante 12); reintento en la propia cola; DLQ al agotar los intentos |
| `errores.test.ts`, `utilidades.test.ts` | Traducción de errores de PostgreSQL (también envueltos por Drizzle), inyección NoSQL |
| `totales.test.ts` | IVA tras el descuento, envío gratis, cupones y cuadre del total |
| `plantillas.test.ts` | Escape de HTML en el correo (S-11) y canales de envío |
| `esquema.test.ts` (auth y clientes) | El esquema de Drizzle refleja columna por columna el SQL de `infra/postgres` |

La cobertura es del 71,2 % de las líneas. Lo que queda fuera es el arranque de los servicios y la conexión a los motores (`servicio.ts`, `postgres.ts`), que ejercitan las suites de integración.

`npm run test:openapi` → **313 comprobaciones, 313 pasan** ([`evidencia/06-openapi-cobertura.txt`](evidencia/06-openapi-cobertura.txt)). Cada una de las 52 rutas del código está documentada una sola vez, con los mismos roles y el mismo carácter público, y el empaquetado que sirve el gateway corresponde a las fuentes.

---

## 3. Catálogo de casos

### Suite A — Autenticación

| ID | Caso | Esperado | Obtenido |
|---|---|---|---|
| A-01 | Login con credenciales válidas | 200 | 200 |
| A-02 | Login con contraseña incorrecta | 401 | 401 |
| A-03 | Login con usuario inexistente | 401 | 401 |
| A-04 | Login sin campos obligatorios | 400 | 400 |
| A-05 | Consulta del perfil con token válido | 200 | 200 |

A-02 y A-03 devuelven el mismo código y el mismo mensaje a propósito:
distinguirlos permitiría enumerar las cuentas registradas. El token emitido mide
212 caracteres.

### Suite B — Control de acceso

| ID | Caso | Esperado | Obtenido |
|---|---|---|---|
| B-01 | Ruta protegida sin token | 401 | 401 |
| B-02 | Ruta protegida con token inválido | 401 | 401 |
| B-03 | Ruta protegida con token válido | 200 | 200 |
| B-04 | Cliente en ruta de personal interno | 403 | 403 |
| B-05 | Administrador en la misma ruta | 200 | 200 |
| B-06 | Vendedor en la misma ruta | 200 | 200 |
| B-07 | Cliente reservando stock por su cuenta | 403 | 403 |
| B-08 | Cliente registrando entrada de mercancía | 403 | 403 |
| B-09 | Cliente consultando su propio perfil | 200 | 200 |
| B-10 | Cliente consultando el perfil de otro | 403 | 403 |
| B-11 | Cliente consultando el carrito de otro | 403 | 403 |
| B-12 | Cliente consultando la bitácora de la saga | 403 | 403 |
| **B-13** | **Inyección de cabeceras de confianza falsas** | **403** | **403** |
| B-14 | Ruta inexistente en el gateway | 404 | 404 |

**B-13 es el caso más importante de esta suite.** Envía, junto a un token válido
de cliente, las cabeceras `x-usuario-rol: administrador`,
`x-llamada-interna: 1` y el secreto interno correcto. El gateway las borra antes
de escribir las suyas, así que el intento de escalar privilegios falla. Este caso
existe porque una versión anterior del código **sí era vulnerable**: el gateway
enviaba el token interno en toda petición y `requiereRol` trataba cualquier
llamada con ese token como interna, saltándose el control de rol.

### Suite C — Inventario

| ID | Caso | Esperado | Obtenido |
|---|---|---|---|
| C-01 | Consulta de disponibilidad por SKU | 200 | 200 |
| C-02 | Reserva **sin** cabecera `Idempotency-Key` | 400 | 400 |
| C-03 | Reserva válida de la última unidad | 201 | 201 |
| C-04 | Reintento con la misma clave | 200 | 200 |
| C-05 | Segundo comprador: stock insuficiente | 409 | 409 |
| C-06 | Liberar la reserva (compensación) | 200 | 200 |
| C-07 | Liberar de nuevo (idempotente) | 200 | 200 |
| C-08 | Stock tras la compensación | 1 unidad | 1 unidad |
| C-09 | Registrar entrada de mercancía | 200 | 200 |
| C-10 | Entrada sobre un SKU inexistente | 404 | 404 |

C-05 devuelve **409 y no 500**: la falta de stock es un conflicto de negocio, no
un error técnico. Importa porque el cliente HTTP compartido no reintenta los 4xx,
que es el comportamiento correcto: reintentar no haría aparecer unidades.

### Suite D — Pagos

| ID | Caso | Token | Esperado | Obtenido |
|---|---|---|---|---|
| D-01 | Pago aprobado | `tok_ok_*` | 201 | 201 |
| D-02 | Reintento con la misma clave | `tok_ok_*` | 200 | 200 |
| D-03 | Rechazo por fondos insuficientes | `tok_rechazo_*` | 200 | 200 |
| D-04 | Error técnico de la pasarela | `tok_error_*` | 502 | 502 |
| D-05 | Medio de pago no soportado | — | 400 | 400 |
| D-06 | Monto inválido (cero) | — | 400 | 400 |
| D-07 | Reembolso de una transacción aprobada | — | 200 | 200 |
| D-08 | Reembolso repetido (idempotente) | — | 200 | 200 |
| D-09 | Reembolso de una referencia inexistente | — | 404 | 404 |

D-03 devuelve **200, no 4xx**: la petición se procesó correctamente y el rechazo
es el resultado legítimo de la operación. D-04 sí devuelve 502 porque la pasarela
no respondió, y en ese caso la transacción queda en estado `iniciada`, no
`rechazada`: no se sabe si alcanzó a procesarse, y eso se resuelve por
conciliación, no asumiendo un resultado.

### Suite E — Pedidos

| ID | Caso | Esperado | Obtenido |
|---|---|---|---|
| E-01 | Pedido por número inexistente (`PED-...`) | 404 | 404 |
| E-02 | Pedido por id numérico inexistente | 404 | 404 |
| E-03 | Identificador ni numérico ni `PED-` | 404 | 404 |
| E-04 | Bitácora de saga con identificador inválido | 404 | 404 |
| E-05 | Cancelación con identificador inválido | 404 | 404 |
| E-06 | Cambio de estado con identificador inválido | 404 | 404 |
| E-07 | Pedido existente por **número** | 200 | 200 |
| E-08 | El mismo pedido por **id numérico** | 200 | 200 |
| E-09 | Bitácora de la saga (administrador) | 200 | 200 |
| E-10 | Transición válida: `pagado → en_preparacion` | 200 | 200 |
| E-11 | Transición inválida: `en_preparacion → pagado` | 400 | 400 |
| E-12 | Estado inexistente | 400 | 400 |
| E-13 | Cancelación de un pedido en preparación | 200 | 200 |
| E-14 | Cancelación repetida (idempotente) | 200 | 200 |
| E-15 | El **cliente** cancela su propio pedido | 200 | 200 |
| E-16 | El **cliente** repite la cancelación (idempotente) | 200 | 200 |

Los casos E-01 a E-06 y E-16 existen porque las pruebas **encontraron defectos
reales**: ver las secciones 4.2 y 4.5.

### Suite F — Limitación de peticiones

Informativa. Catorce intentos de login fallidos seguidos:

```
401 401 401 401 401 429 429 429 429 429 429 429 429 429
```

El limitador corta al sexto intento. La cuenta queda bloqueada en el servicio de
autenticación, que es una segunda defensa independiente:

```
carla@correo.co | intentos=0 | bloqueada=true
```

Y la auditoría registra los tres tipos de evento:

```
login           | exitoso=false | n=7
login           | exitoso=true  | n=4
login_bloqueado | exitoso=false | n=2
```

### Suite G — Cumplimiento PCI-DSS

El cumplimiento no se logra cifrando bien los datos de tarjeta: se logra **no
teniéndolos**. Columnas reales de la tabla `transacciones`:

```
id, referencia, pedido_id, numero_pedido, cliente_id, monto, moneda, medio_pago,
token_medio_pago, ultimos_cuatro, marca, estado, codigo_autorizacion,
codigo_rechazo, mensaje_pasarela, clave_idempotencia, request_id, creado_en,
resuelto_en
```

| ID | Caso | Esperado | Obtenido |
|---|---|---|---|
| G-02 | Columnas de número de tarjeta, CVV o vencimiento | 0 | 0 |

Lo que no existe no se puede filtrar.

### Suite H — Aislamiento de las bases de datos

Verifica que «base de datos por servicio» no sea solo una convención. Cada caso
intenta conectarse con las credenciales de un servicio a la base de otro:

| ID | Caso | Resultado |
|---|---|---|
| H-01 | `auth_user` → `pedidos_db` | acceso denegado |
| H-02 | `auth_user` → `pagos_db` | acceso denegado |
| H-03 | `clientes_user` → `inventario_db` | acceso denegado |
| H-04 | `inventario_user` → `pagos_db` | acceso denegado |
| H-05 | `pedidos_user` → `auth_db` | acceso denegado |
| H-06 | `inventario_user` → `inventario_db` (su propia base) | acceso concedido |

El aislamiento lo impone el motor de la base de datos, no la disciplina del
código: un servicio no puede leer las tablas de otro aunque su código lo
intentara.

### Suite I — Degradación

Informativa. Con la infraestructura completa, los cuatro servicios que publican
eventos están conectados al broker, que figura como dependencia **no crítica**:

```
clientes-service         estado=ok        rabbitmq: conectado=true critica=false
inventario-service       estado=ok        rabbitmq: conectado=true critica=false
pedidos-service          estado=ok        rabbitmq: conectado=true critica=false
pagos-service            estado=ok        rabbitmq: conectado=true critica=false
servicios caidos: ninguno
```

En la ejecución anterior sin RabbitMQ ni MongoDB los mismos servicios seguían en
`estado=ok` con `conectado=False`, y la salud agregada identificaba exactamente
qué faltaba:

```
servicios caidos: catalogo, notificaciones
auth             ok=True
clientes         ok=True
catalogo         ok=False  estado=inalcanzable
inventario       ok=True
carrito          ok=True
pedidos          ok=True
pagos            ok=True
notificaciones   ok=False  estado=inalcanzable
```

---

### Nivel 6 — Asistente virtual (Trabajo Final, Fase 3)

`npm run test:asistente` → **46 comprobaciones, 46 pasan**, con la degradación activada
([`evidencia/07-asistente.txt`](evidencia/07-asistente.txt)). El detalle y la tasa de acierto
del motor están en [`especificacion/03-asistente-virtual.md`](especificacion/03-asistente-virtual.md).

---

## 4. Defectos encontrados y corregidos

Las pruebas encontraron veinticinco defectos reales, y los veinticinco están corregidos:
- Los nueve primeros salieron de las pruebas funcionales y tienen un caso que impide que vuelvan.
- Del 4.10 al 4.12 solo aparecen bajo carga. Su verificación es la medición de antes y después de [`calidad/RENDIMIENTO.md`](calidad/RENDIMIENTO.md), que se repite con `npm run test:carga:bateria`.
- Del 4.13 al 4.22 son de seguridad o surgieron al verificar las correcciones de seguridad.
- Del 4.23 al 4.25 son de usabilidad. Se verifican con el recorrido automatizado (`npm run usabilidad:recorrido`). Tienen casos en `test:http` y en `npm run test:seguridad`, documentados en [`calidad/SEGURIDAD.md`](calidad/SEGURIDAD.md).

### 4.1 Escalada de privilegios por el token interno — **grave**

**Síntoma.** Un cliente autenticado obtenía `200` en endpoints restringidos a
personal interno (caso B-04).

**Causa.** El API Gateway enviaba el secreto interno en **toda** petición que
enrutaba, y `requiereRol` interpretaba la presencia de ese secreto como «esta
llamada viene de otro microservicio», saltándose el control de rol por completo.
Cualquier usuario con sesión válida podía mover inventario o crear productos.

**Corrección.** Una llamada se considera interna solo si cumple **dos**
condiciones: trae el secreto compartido **y** se declara explícitamente con la
cabecera `x-llamada-interna`, que el gateway no envía. Además, el gateway borra
las cabeceras de confianza que lleguen del exterior, para que nadie pueda
inyectarlas.

**Casos que lo cubren.** B-04, B-07, B-08, B-13.

### 4.2 Error 500 al consultar un pedido por su número

**Síntoma.** `GET /api/pedidos/PED-202609-001001` devolvía `500 ERROR_INTERNO`.

**Causa.** La consulta era `WHERE id = $1 OR numero = $1`. PostgreSQL evaluaba
primero `id = $1` e intentaba convertir el texto a entero:

```
invalid input syntax for type integer: "PED-202609-001001"
```

Afectaba a cuatro endpoints de `pedidos-service`.

**Corrección.** Se distingue si el parámetro es un id numérico o un número de
pedido y se ejecuta la consulta correspondiente. Las rutas que solo aceptan id
numérico validan el formato y responden 404 en lugar de dejar fallar al motor.

**Casos que lo cubren.** E-01 a E-08.

### 4.3 Código 201 en una réplica idempotente

**Síntoma.** El reintento de una reserva con la misma `Idempotency-Key` devolvía
`201 Created` sin haber creado nada (caso C-04).

**Causa.** `crearReserva` devolvía `201` siempre. Además era inconsistente con
los servicios de pagos y pedidos, que sí distinguían los dos casos (D-02).

**Corrección.** `201` solo cuando se crea la reserva; `200` en la réplica.

**Caso que lo cubre.** C-04, contrastado con C-03 y D-02.

### 4.4 La suite no era re-ejecutable

**Síntoma.** La segunda ejecución seguida fallaba 49 de 58 casos.

**Causa.** Dos efectos acumulados: el limitador de peticiones del gateway es **en
memoria y por IP** con ventana de 15 minutos, y la Suite F agota su cuota a
propósito, así que la ejecución siguiente no obtenía tokens; y las claves de
idempotencia de la ejecución anterior seguían en la base, de modo que los casos
que esperaban `201` recibían `200`.

**Corrección.** `tests/contrato-http.ts` arranca su **propio gateway temporal**
(puerto 18080) con el limitador limpio, en lugar de tocar el de `npm run dev`, y
restablece el estado de las cuatro bases antes de empezar. Al terminar apaga ese
gateway y desbloquea las cuentas que la Suite F bloqueó, para que `test:e2e`
pueda ejecutarse justo después.

**Verificación.** Ejecuciones seguidas sin intervención, intercaladas con
`test:e2e`: todas en verde.

### 4.5 Cancelación repetida por el cliente devolvía 403

**Síntoma.** Si un cliente cancelaba dos veces su propio pedido, la segunda vez
recibía `403` («El pedido ya está en preparación») en lugar de `200`.

**Causa.** La regla «un cliente solo cancela pedidos en `creado` o `pagado`» se
evaluaba **antes** de la comprobación de idempotencia, y `cancelado` no está en
esa lista. Para el administrador funcionaba (E-14) porque no pasa por esa regla.

**Corrección.** Se comprueba primero si el pedido ya estaba cancelado; la regla
de estados del cliente se aplica después.

**Casos que lo cubren.** E-15, E-16.

> Los defectos 4.6 a 4.9 se encontraron el 14 de noviembre de 2026, al preparar
> las pruebas no funcionales (Fase 1 de
> [`PLAN-ESTRATEGIAS-VALIDACION.md`](PLAN-ESTRATEGIAS-VALIDACION.md)). Fue la
> primera vez que el sistema se desplegó **completo en contenedores** y se pobló
> con volumen. Las ejecuciones anteriores usaban `npm run dev` y los diez
> productos de la semilla.

### 4.6 Los servicios no arrancaban en contenedores — **grave**

**Síntoma.** Con `docker compose up`, los nueve servicios entraban en un bucle de
reinicio:

```
Error: The package "@esbuild/linux-x64" could not be found, and is needed by esbuild.
```

Una vez corregido eso, el gateway seguía marcado como `unhealthy` aunque
respondía bien. Y en un arranque en frío, `rabbitmq` fallaba su healthcheck y
arrastraba a los servicios que dependen de él.

**Causa.** Tres problemas de despliegue:

- `infra/Dockerfile.servicio` instalaba con `npm install --omit=optional`. Así
  se excluía el binario nativo de esbuild, del que depende `tsx`.
- El `HEALTHCHECK` de la imagen consulta `/health`, pero el gateway solo
  exponía `/api/health` y respondía 404.
- El healthcheck de RabbitMQ daba 5 s de timeout y 25 s de gracia. Con nueve
  servicios compilando TypeScript al mismo tiempo, el broker tardó 75 s en
  arrancar.
- Además, ese healthcheck usaba `rabbitmq-diagnostics ping`, que da sano en
  cuanto el nodo responde, **antes** de que el listener AMQP acepte
  conexiones. `notificaciones` se conectaba en ese hueco, recibía
  `ECONNREFUSED` y, como `BusEventos` no reintenta la primera conexión
  (sección 5), quedaba caído.

**Corrección.**

- Se quita `--omit=optional`.
- El gateway tiene un `GET /health` de *liveness*. No consulta a los demás
  servicios a propósito: si uno cae, no se debe reiniciar el gateway.
- El healthcheck de RabbitMQ pasa a 15 s de timeout y 90 s de gracia, y usa
  `check_port_connectivity`, que espera a que los listeners estén arriba. Con
  eso, un arranque en frío (`docker compose down` seguido de `up --wait`) deja
  los 13 contenedores sanos al primer intento.

**Evidencia.** `evidencia/no-funcionales/00-salud-previa.txt` (los 13
contenedores `healthy`).

### 4.7 Error 500 al listar las direcciones de un cliente

**Síntoma.** `GET /api/clientes/:id/direcciones` devolvía siempre
`500 ERROR_INTERNO`, también para el propio dueño.

**Causa.** El `SELECT id, …` hace `JOIN` de `clientes` con `direcciones`, y las
dos tablas tienen columna `id`:

```
column reference "id" is ambiguous
```

Ningún cliente (web ni móvil) ni ninguna suite usaba la ruta, y por eso no se
había detectado.

**Corrección.** Las columnas se califican con el alias `d.`.

**Casos que lo cubren.** B-15, B-16.

### 4.8 Un producto nuevo no se podía abastecer nunca

**Síntoma.** Un producto creado con `POST /api/catalogo/productos` (o desde el
panel de administración) quedaba agotado para siempre. La entrada de mercancía
respondía `404 No hay registro de inventario`. Al poblar 60 productos, la primera
página del catálogo quedó entera sin stock y `test:e2e` falló en «Hay al menos un
producto con existencias».

**Causa.** `registrarEntrada` solo hacía `UPDATE` sobre filas existentes de
`stock`, y ningún endpoint creaba la fila. Solo existían las diez de
`06-datos-prueba.sql`.

**Corrección.** La entrada hace un *upsert* (`INSERT … ON CONFLICT DO UPDATE`).
La fila la sigue escribiendo inventario, su único propietario (invariante 3).
Las condiciones son:

- El registro nuevo solo se abre si el catálogo confirma que el producto
  existe. Así un SKU mal escrito no deja filas huérfanas.
- Una `bodega_id` inexistente responde `400`.

**Casos que lo cubren.** C-10, C-11, C-12.

### 4.9 Una entrada sin bodega se sumaba en todas las bodegas del SKU

**Síntoma.** Un defecto latente que ningún dato de prueba activaba: todos los
SKU de la semilla están en una sola bodega. Una entrada de 5 unidades sin
`bodega_id`, sobre un SKU con stock en dos bodegas, sumaba 10.

**Causa.** El `UPDATE … WHERE sku = $1 AND ($3 IS NULL OR bodega_id = $3)`
alcanzaba todas las filas del SKU. La respuesta mostraba solo la primera, así que
el efecto no se veía. `pedidos-service` usa esta misma ruta para devolver
inventario al cancelar, de modo que una cancelación habría devuelto unidades de
más.

**Corrección.** Sin `bodega_id`, la entrada va a una sola bodega: la que ya
tiene el SKU (la de menor id) o, si el SKU es nuevo, la primera bodega activa.
Es la misma corrección que la del defecto 4.8.

**Caso que lo cubre.** C-09 (ruta sin `bodega_id`). E-14 y E-15 validan la
devolución de stock al cancelar.

### 4.10 El login no pasaba de ~10 por segundo — **grave bajo carga**

Encontrado con las pruebas de carga del Módulo 1 (hallazgos R1 y R2 de
[`calidad/RENDIMIENTO.md`](calidad/RENDIMIENTO.md)).

**Síntoma.**
- Con 50 usuarios, el p95 del login fue de 4,3 s.
- Con 200 usuarios, el 96 % de los logins no respondía.
- Al terminar la carga, auth tardaba 30–40 s en volver a responder.

**Causa.**
- `bcryptjs` es JavaScript puro: cada comparación ocupaba el hilo principal de Node unos 100 ms. El contenedor usaba un solo núcleo (99,5 % de CPU) aunque tuviera ocho disponibles.
- Sin límite de cola, el servicio seguía calculando hashes de clientes que ya habían abandonado.

**Corrección** (`auth-service/src/pool-hash.ts`):
- Los hashes corren en un pool de `worker_threads` (`AUTH_HILOS_HASH`, por defecto hasta 4 hilos).
- La cola está acotada (`AUTH_COLA_HASH`). Si se llena, se responde `503 SERVICIO_SATURADO` con `Retry-After`.
- Las tareas de clientes que cerraron la conexión se descartan sin calcularse.
- El estado del pool se publica en `/health`.
- No cambia el formato de los hashes guardados.

**Verificación.**
- Con 50 usuarios, el throughput pasó de 9,5 a 23,4 logins/s y el p95 de 4 294 a 1 280 ms.
- En estrés, los logins exitosos se multiplicaron por cuatro. El exceso recibe un 503 en ~100 ms, en lugar de esperar 15 s y recibir un EOF.

### 4.11 El gateway abría dos conexiones TCP por petición

**Síntoma.** Con 300 usuarios, el 14 % de las búsquedas en el catálogo fallaba con `connectex: Only one usage of each socket address`: el equipo cliente se quedaba sin puertos.

**Causa.** Sin un `agent`, `http-proxy` fuerza `Connection: close` hacia el servicio y reenvía esa cabecera al cliente. Cada petición abría por tanto dos conexiones nuevas.

**Corrección.**
- El gateway usa un `http.Agent` con keep-alive y no reenvía la cabecera de salto `Keep-Alive`.
- Los servicios mantienen las conexiones ociosas 65 s (`keepAliveTimeout`, en `shared/src/servicio.ts`), para que el gateway nunca reutilice un socket que el servicio está cerrando.

**Verificación.**
- Tres peticiones seguidas con curl usan una sola conexión (`num_connects` 1, 0, 0).
- El estrés del catálogo pasó del 5,3 % al 0 % de errores.
- El p95 a 100 VU bajó de 193 a 79 ms.

### 4.12 El gateway cortaba la conexión en lugar de responder 504

**Síntoma.** Cuando un servicio no respondía, el cliente recibía un cierre abrupto (EOF) a los 15 s, sin código ni mensaje.

**Causa.** La opción `timeout` de `http-proxy` se aplica al socket **del cliente**, y al vencer lo destruye. El manejador de errores, que tenía programado un 503 en español, nunca llegaba a ejecutarse.

**Corrección.** Solo se usa `proxyTimeout`, que es la espera por el servicio. Si vence, el cliente recibe `504 TIEMPO_AGOTADO` con un mensaje en español; los demás errores de conexión siguen respondiendo `503 SERVICIO_NO_DISPONIBLE`.

**Verificación.** Con auth congelado (`docker pause`), el login responde 504 con el mensaje a los 15,07 s. En la batería del después no hubo ni un solo estado 0 (EOF).

### 4.13 Secretos por defecto: tokens de administrador forjables — **crítico**

Encontrado con las verificaciones de seguridad (S-02 y S-03 de [`calidad/SEGURIDAD.md`](calidad/SEGURIDAD.md)).

**Síntoma.**
- Un JWT de administrador firmado con `FirmaSecretaEcommerceDesarrollo`, para un usuario inexistente, leía todos los pedidos.
- Directo al puerto 3004, con `x-internal-token: secreto-interno-desarrollo` y sin ningún JWT, se reservaba stock.

**Causa.**
- Los tres secretos tenían un valor de respaldo publicado en el código, en `docker-compose.yml` y en `.env.example`, y ese valor era el que corría.
- Los puertos de los servicios estaban publicados en todas las interfaces.

**Corrección.**
- Sin valores por defecto. `verificarSecretos()` (`shared/src/autenticacion.ts`) detiene cada servicio y el gateway si un secreto falta, si tiene menos de 32 caracteres o si es uno de los valores publicados.
- `docker compose` exige las variables (`${VAR:?…}`).
- `.env.example` las deja vacías, con la instrucción `openssl rand -hex 32`.
- Los servicios y los motores de datos se publican solo en `127.0.0.1`.

**Caso que lo cubre.** V-10 y V-16 de `test:seguridad`. Además, un servicio arrancado con el secreto publicado termina con código 1 y enumera los problemas.

### 4.14 Registro con el cliente_id de otra persona — **grave**

**Síntoma.** `POST /auth/registro` con `cliente_id: 1` y cualquier correo creaba una cuenta vinculada a Ana, y esa cuenta leía su perfil y sus direcciones. Rompía el invariante 1.

**Causa.** El `cliente_id` del cuerpo se guardaba sin comprobar a quién pertenecía.

**Corrección.**
- Auth consulta a clientes-service y exige que el correo del cliente sea el de la cuenta (si no, 403) y que el cliente no tenga ya una cuenta (si la tiene, 409).
- Un índice único parcial (`uq_usuarios_cliente`) cierra la carrera entre dos registros simultáneos.

**Casos que lo cubren.** A-07, A-08 y A-09 de `test:http`, y V-01.

### 4.15 Seis 404 de un cliente dejaban a todos sin carrito

**Síntoma.** Seis peticiones de Ana con SKU inexistentes hacían que, durante 15 s, el carrito de cualquier cliente respondiera 503. Durante el escaneo activo de ZAP, el gateway devolvió 1 030 respuestas 503 por este motivo.

**Causa.** `CircuitBreaker.ejecutar()` contaba como fallo cualquier error, incluidos los 4xx de negocio.

**Corrección.** `esFalloDelServicio()` (`shared/src/errores.ts`) solo considera fallos los errores de red, los 5xx y los timeouts. Es el mismo criterio que ya decidía los reintentos (invariante 7). Un 4xx cuenta como éxito para el circuito.

**Caso que lo cubre.** B-17 de `test:http` y V-14. En el escaneo de ZAP repetido hubo 0 respuestas 503 y ningún circuito se abrió.

### 4.16 El correo no se validaba

**Síntoma.** El registro aceptaba `no-es-un-correo`, y el escaneo activo creó 115 administradores con "correos" como `http://www.google.com/`.

**Corrección.** Formato y longitud máxima (150) en `/auth/registro` y `/auth/usuarios`, que también exige una contraseña de 8 caracteres como mínimo.

**Caso que lo cubre.** A-10 de `test:http` y V-15.

### 4.17 Inyección de operadores NoSQL en los filtros del catálogo

**Síntoma.** `?categoria[$ne]=tecnologia` devolvía los 45 productos de las otras categorías, y `?marca[$regex]=.*` los 70. MongoDB ejecutaba el operador.

**Causa.** Express convierte `categoria[$ne]=x` en el objeto `{ $ne: 'x' }`, y el controlador lo pasaba al filtro tal cual.

**Corrección.** `textoDeConsulta()` (`shared/src/utilidades.ts`) rechaza con 400 cualquier parámetro que no sea una cadena.

**Caso que lo cubre.** B-18 de `test:http` y V-02.

### 4.18 Entradas inválidas que respondían 500

**Síntoma.** Durante el escaneo activo de ZAP hubo 781 respuestas 500, por textos más largos que la columna, `NaN` en un entero, `"1"` como UUID, un byte nulo, un ID fuera de rango o un JSON mal formado. Esos 500 además abrían los circuit breakers.

**Causa.** No había validación en la entrada; el error de PostgreSQL o de body-parser llegaba al manejador como un error no controlado.

**Corrección.** `traducirErrorDeEntrada()` (`shared/src/errores.ts`) responde 400 para los errores de body-parser y para los códigos de PostgreSQL que solo provoca una entrada mal formada (22001, 22003, 22007, 22008, 22021, 22P02, 23502 y 23514), sin revelar la columna. Cada caso queda registrado como advertencia con su código de origen.

**Verificación.** En el escaneo repetido, **0 respuestas 500 y 0 errores no controlados**. Casos: B-19 y V-03/V-07.

### 4.19 El rechazo de CORS respondía 500

**Corrección.** El origen no permitido se responde con `403 ORIGEN_NO_PERMITIDO`.

**Caso que lo cubre.** B-20 y V-11.

### 4.20 La web se servía sin cabeceras de seguridad

**Síntoma.** ZAP marcó la ausencia de CSP, de protección contra clickjacking, de `nosniff`, de `Permissions-Policy` y de COOP, COEP y CORP.

**Corrección.** `clients/web/cabeceras-seguridad.js`, que aplica `vite preview` (con CSP estricta) y el servidor de desarrollo (sin CSP).

**Verificación.** El baseline de ZAP baja de 8 a 2 advertencias, ambas informativas. Playwright recorre la tienda e inicia sesión con la CSP activa, sin violaciones.

### 4.21 Los correos interpolaban HTML del usuario sin escapar

**Corrección.** `notificaciones-service/src/plantillas.ts` escapa los valores en el canal de correo.

**Caso que lo cubre.** V-05.

### 4.22 El build de producción no podía iniciar sesión

**Síntoma.** Encontrado al verificar 4.20 con Playwright: desde la web servida en el 4173, el login respondía 500.

**Causa.** `CORS_ORIGENES` solo incluía el 5173 de desarrollo, y el rechazo se respondía como 500 (4.19).

**Corrección.** Se agregó `http://localhost:4173` en `docker-compose.yml`, `.env.example` y el valor por defecto del gateway.

### 4.23 El inicio de sesión solo admitía cuatro cuentas de demostración

Encontrado con la evaluación heurística (U-01 de [`calidad/USABILIDAD.md`](calidad/USABILIDAD.md), severidad 4).

**Síntoma.** El correo se elegía en un desplegable con 4 cuentas y la contraseña venía escrita: ningún otro usuario podía entrar (E11, Carla).

**Corrección.** Campo de correo y contraseña vacía; las cuentas de prueba quedan como ayuda plegable.

**Verificación.** E11 de `npm run usabilidad:recorrido`: Carla entra escribiendo sus credenciales.

### 4.24 El catálogo solo mostraba 20 de 71 productos

**Corrección.** Paginación con el total de resultados (U-02).

**Verificación.** E3: 71 de 71 productos alcanzables en 4 páginas.

### 4.25 Cancelar un pedido sin confirmación, con el error tapado por el modal

**Corrección.** Confirmación en dos pasos, aviso de éxito y error dentro del diálogo, con foco y desplazamiento (U-03 y U-04).

**Verificación.** T6 y E8: el error queda visible y completo, y el detalle muestra el estado real.

### 4.26 Un correo que fallaba se perdía en el reintento — **grave**

Lo encontró el diseño del envío real por SMTP (Trabajo Final, Fase 2).

**Síntoma.** Si el envío fallaba, el bus reintentaba el evento. Pero el segundo intento chocaba con el índice único de `clave_dedupe` y `procesarEvento` lo trataba como un duplicado del broker. El mensaje quedaba `pendiente` para siempre, sin correo y sin llegar a la DLQ.

Con el envío simulado no se veía, porque nunca fallaba.

**Corrección.** Ante el duplicado se consulta el estado: solo se ignora si ya está `enviado`. Un fallo de envío se registra (`fallido`, `intentos`, `ultimo_error`) y se relanza para que el bus reintente.

**Verificación.**
- Con Mailpit detenido, una compra se confirma igual.
- El aviso queda `fallido` tras 3 intentos y llega a `notificaciones.envio.fallidos`.
- Notificaciones sigue sano, con la dependencia `correo` caída marcada como no crítica.

### 4.27 El reintento de un evento llegaba también a otros consumidores

**Síntoma.** El bus reencolaba un evento fallido publicándolo **otra vez en el exchange**. El reintento de notificaciones le llegaba también a `clientes.historial`, que lo procesaba de nuevo. Era inocuo solo porque esa proyección es idempotente.

**Corrección.** El reintento va directo a la cola del consumidor que falló (`sendToQueue`).

**Verificación.** Prueba unitaria `bus-eventos.test.ts`: el reintento usa `sendToQueue` hacia su propia cola y nunca `publish`.

### 4.28 Todos los escalamientos de visitantes compartían la misma clave de deduplicación

Lo encontró el diseño del escalamiento del asistente (Fase 3).

**Síntoma.** Notificaciones arma `clave_dedupe` con el evento y el primer identificador disponible (`pedido_id`, `sku` o `cliente_id`). Un escalamiento de un visitante no trae ninguno, así que su clave era siempre `asistente.escalamiento::`. Solo se avisaba a operaciones del **primero**; los siguientes se descartaban como duplicados.

**Corrección.** El número de ticket entra en la clave.

**Verificación.** `test:asistente`, sección 4: el correo de cada ticket llega a Mailpit.

### Defectos del código nuevo que encontraron sus propias pruebas

No llegaron a integrarse, pero se documentan porque muestran qué detectó cada prueba:

| Prueba | Defecto | Corrección |
|---|---|---|
| Frases de desarrollo (`asistente:metricas`) | Un número de pedido suelto, como respuesta a «¿cuál quieres ver?», se clasificaba como cancelación: los refuerzos por entidad contaban como palabras | El contexto solo mira los términos |
| Unitaria del enmascarado | `PED-202611-001105` se ocultaba como si fuera una tarjeta | El patrón excluye los números precedidos de letras y guion |
| axe en el recorrido de la interfaz | Contraste insuficiente (`text-gray-400`) en el SKU y la fecha de las tarjetas | `text-gray-500` (4,8:1) |
| `npm run test:seguridad` (V-05) | Falso positivo: un comentario mencionaba la API de HTML crudo de React | Se reformuló el comentario; la verificación no se tocó |

### 4.29 Dependencias de producción vulnerables (S-12)

Lo encontró la auditoría de dependencias de la Fase 4 (`npm audit --omit=dev`): `body-parser` y `follow-redirects` (altas) y `qs` (moderada), todas transitivas.

**Corrección.** `npm audit fix`, que solo cambia el `package-lock.json`.

**Verificación.** 0 vulnerabilidades de producción y la regresión completa en verde ([`calidad/SEGURIDAD.md`](calidad/SEGURIDAD.md), sección 10.3).

### 4.30 El circuit breaker en semiabierto dejaba pasar todas las peticiones (R7)

Lo encontró la carga con fallo inyectado: inventario detenido durante la búsqueda en el catálogo.

**Síntoma.** En cada paso a semiabierto, las ~40 peticiones por segundo del catálogo iban contra inventario caído, y el p95 subía a 6,4 s.

**Corrección.** Una sola llamada de prueba a la vez; las demás reciben la alternativa al instante.

**Verificación.**
- Pruebas unitarias en `circuit-breaker.test.ts`.
- La misma carga con fallo: p99 de 6 373 a 76 ms, con 0 errores ([`calidad/RENDIMIENTO.md`](calidad/RENDIMIENTO.md), sección 9.6).

---

## 5. Lo que queda por probar

La ejecución del 1 de octubre de 2026 tuvo la infraestructura completa, así que
el checkout de 15 pasos, catálogo, notificaciones, publicación y consumo de
eventos y la proyección del historial ya están verificados por `test:e2e`.
Quedan las pruebas que requieren provocar fallos a mano:

| Sin verificar en ejecución | Cómo verificarlo |
|---|---|
| Caída y recuperación del broker | escenario 5.1 de [`../PLAN.md`](../PLAN.md) |

El circuit breaker abriéndose por fallos reales ya está verificado, y bajo carga: la Fase 4 detuvo inventario y notificaciones en plena corrida ([`calidad/RENDIMIENTO.md`](calidad/RENDIMIENTO.md), secciones 9.3, 9.4 y 9.6).

### Limitación conocida: arranque antes que el broker

`BusEventos` reintenta la conexión cuando una conexión **ya establecida** se
cierra, pero no cuando el **primer** intento falla. Si los servicios arrancan
mientras RabbitMQ aún se está iniciando, notificaciones queda sin suscripción y
`test:salud` lo reporta caído hasta reiniciar `npm run dev`. Se mitiga con
`npm run infra:up`, que usa `docker compose up --wait` y no termina hasta que los
cuatro contenedores están sanos.

### Observación sobre el control de rol

Un detalle que salió al construir la Suite B. El gateway valida el **token**,
pero el control de **rol** vive en cada servicio. Si el servicio destino está
caído, un intento no autorizado recibe `503` en lugar de `403`. No es un agujero
—nada se ejecuta— pero la respuesta es menos precisa. Por eso el caso B-08 se
plantea contra un servicio que sí está en pie.

---

## 6. Cómo reproducir estas pruebas

```bash
# Infraestructura (espera a que los cuatro contenedores esten sanos)
npm run infra:up

# Niveles 1 y 2
npm run typecheck
npm run build:web
npm run dev                   # en otra terminal
npm run test:salud

# Nivel 3 — no necesita los servicios, solo PostgreSQL
npm run test:concurrencia

# Nivel 4 — necesita la infraestructura y los servicios
npm run test:http

# Nivel 5 — necesita la infraestructura completa
npm run test:e2e
```

Para guardar la evidencia:

```bash
npm run test:concurrencia > docs/evidencia/01-concurrencia-stock.txt
npm run test:http         > docs/evidencia/02-contrato-http.txt
npm run test:salud        > docs/evidencia/03-salud-sistema.txt
npm run test:e2e          > docs/evidencia/04-e2e-compra.txt
```

Las pruebas manuales dirigidas —caída del broker, degradación del catálogo,
circuit breaker, expiración de reservas y trazabilidad por `request_id`— están en
la Parte 2, nivel 5 de [`../PLAN.md`](../PLAN.md).

---

## 7. Correspondencia con el documento del laboratorio

| Concepto del documento | Casos que lo verifican |
|---|---|
| Pregunta 5 — evitar la sobreventa | Concurrencia 1 a 6 (33 comprobaciones); C-03, C-05 |
| Pregunta 4 — caída del servicio de catálogo | Nivel 2, Suite I |
| Pregunta 7 — intercambio pedidos ↔ inventario | C-02 a C-07 |
| Pregunta 10 — mecanismos de seguridad | Suites A, B, F, G |
| Pregunta 3 — problemas de una base de datos única | Suite H |
| Actividad 6.b — independencia de los servicios | Nivel 2, Suite I |
| Actividad 6.d — disponibilidad | Suite I |
| Actividad 6.f — tolerancia a fallos | Concurrencia 4; D-04; C-06, C-07 |
| Patrón Saga con compensación | Concurrencia 4; E-13, E-14 |
| Idempotencia | C-04, D-02, D-08, E-14, E-16; E2E escenario D |
| Flujo de compra de 15 pasos (Actividad 4) | E2E escenario A |
