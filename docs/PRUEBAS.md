# Pruebas del sistema

Plan de pruebas y **resultados obtenidos**. Documenta el paso de pruebas de
integración de la guía de laboratorio, adaptado al dominio del comercio
electrónico.

| | |
|---|---|
| **Última ejecución** | 15 de noviembre de 2026 (servicios en contenedores, base poblada con `npm run sembrar:carga` y secretos propios en `.env`) |
| **Casos ejecutados** | 152 (33 de concurrencia + 70 por HTTP + 49 extremo a extremo) |
| **Resultado** | 152 pasan, 0 fallan |
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

`npm run test:http` → **70 casos, 70 pasan**
([`evidencia/02-contrato-http.txt`](evidencia/02-contrato-http.txt)).

| Suite | Área | Casos |
|---|---|---|
| A | Autenticación, emisión de tokens y registro | 9 |
| B | Control de acceso: RBAC, propiedad del dato y circuit breaker | 17 |
| C | Inventario: reservas, idempotencia, compensación | 12 |
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

Las pruebas encontraron dieciséis defectos reales, y los dieciséis están corregidos:
- Los nueve primeros salieron de las pruebas funcionales y tienen un caso que impide que vuelvan.
- Del 4.10 al 4.12 solo aparecen bajo carga. Su verificación es la medición de antes y después de [`calidad/RENDIMIENTO.md`](calidad/RENDIMIENTO.md), que se repite con `npm run test:carga:bateria`.
- Del 4.13 al 4.16 son de seguridad. Tienen casos en `test:http` y en `npm run test:seguridad`, documentados en [`calidad/SEGURIDAD.md`](calidad/SEGURIDAD.md).

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
