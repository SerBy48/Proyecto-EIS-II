# Pruebas del sistema

Plan de pruebas y **resultados obtenidos**. Documenta el paso de pruebas de
integración de la guía de laboratorio, adaptado al dominio del comercio
electrónico.

| | |
|---|---|
| **Última ejecución** | 1 de octubre de 2026 |
| **Casos ejecutados** | 142 (33 de concurrencia + 60 por HTTP + 49 extremo a extremo) |
| **Resultado** | 142 pasan, 0 fallan |
| **Entorno** | Windows 11, Node 25, Docker: PostgreSQL 16 (puerto 5434 del host), MongoDB 7, Redis 7, RabbitMQ 3. Infraestructura completa |
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
| 5. Integración E2E | El flujo de compra completo de 15 pasos | `npm run test:e2e` | **infraestructura completa** |

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

`npm run test:http` → **60 casos, 60 pasan**
([`evidencia/02-contrato-http.txt`](evidencia/02-contrato-http.txt)).

| Suite | Área | Casos |
|---|---|---|
| A | Autenticación y emisión de tokens | 5 |
| B | Control de acceso: RBAC y propiedad del dato | 14 |
| C | Inventario: reservas, idempotencia, compensación | 9 |
| D | Pagos: los cuatro desenlaces de la pasarela | 9 |
| E | Pedidos: identificadores y ciclo de vida | 16 |
| F | Limitación de peticiones y bloqueo de cuenta | informativa |
| G | Cumplimiento PCI-DSS del esquema | 1 |
| H | Aislamiento de las bases de datos | 6 |
| I | Degradación y salud del sistema | informativa |

### Nivel 5 — Integración extremo a extremo

`npm run test:e2e` → **49 comprobaciones, 49 pasan**
([`evidencia/04-e2e-compra.txt`](evidencia/04-e2e-compra.txt)).

| Escenario | Qué recorre |
|---|---|
| A | Compra exitosa: los 15 pasos del flujo, bitácora de la saga y notificación asíncrona por RabbitMQ |
| B | Pago rechazado: la saga compensa y el stock se libera |
| C | Dos clientes disputan la última unidad: un solo ganador |
| D | Doble clic en «Pagar»: un solo pedido (idempotencia del checkout) |
| E | Cancelación de un pedido pagado: reembolso y devolución de stock |
| F | Controles de seguridad |

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

## 4. Defectos encontrados y corregidos

Las pruebas encontraron cinco defectos reales. Los cinco están corregidos y
tienen un caso que impide que vuelvan.

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

---

## 5. Lo que queda por probar

La ejecución del 1 de octubre de 2026 tuvo la infraestructura completa, así que
el checkout de 15 pasos, catálogo, notificaciones, publicación y consumo de
eventos y la proyección del historial ya están verificados por `test:e2e`.
Quedan las pruebas que requieren provocar fallos a mano:

| Sin verificar en ejecución | Cómo verificarlo |
|---|---|
| Caída y recuperación del broker | escenario 5.1 de [`../PLAN.md`](../PLAN.md) |
| Circuit breaker abriéndose por fallos reales | escenario 5.3 de `PLAN.md` |

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
