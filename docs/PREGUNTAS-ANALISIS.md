# Preguntas de análisis — Actividad 11

Las diez preguntas del documento, respondidas señalando dónde está cada cosa en
el código y cómo comprobarla.

---

## 1. ¿Por qué conviene una arquitectura de microservicios para este sistema?

Porque los módulos de un comercio electrónico tienen **cargas y ritmos de cambio
muy diferentes**. El catálogo recibe un volumen de consultas mucho mayor que el
de pagos, y las promociones cambian con más frecuencia que las reglas de
facturación.

Los microservicios permiten escalar y desplegar cada funcionalidad de forma
independiente, aislar las fallas, trabajar con equipos separados por dominio y
elegir el almacenamiento más adecuado para cada servicio. Y una falla en un
módulo secundario no detiene la venta, que es la operación que genera ingresos.

**En este proyecto** eso es literal, no retórico:

- **Escalado selectivo:** `docker compose up -d --scale catalogo-service=3`
  replica solo el catálogo.
- **Almacenamiento por necesidad:** cuatro motores distintos, cada uno donde
  aporta (ver tabla en [`ARQUITECTURA.md`](ARQUITECTURA.md)).
- **Aislamiento de fallas:** detén notificaciones y sigue vendiendo.

```bash
docker compose stop notificaciones-service
npm run test:salud     # los otros ocho siguen en OK
# compra desde la web: funciona con normalidad
```

---

## 2. ¿Qué ventajas proporciona un API Gateway?

Ofrece un **punto único de entrada** que oculta la complejidad interna: el
cliente no necesita saber cuántos servicios existen ni dónde están desplegados.
Centraliza autenticación, autorización, cifrado, limitación de peticiones y
registro de accesos, evitando duplicar esa lógica nueve veces. Permite además
enrutar, balancear la carga, versionar la API y modificar la estructura interna
sin afectar a las aplicaciones cliente.

**Comprobable:** el cliente web solo conoce rutas `/api/...`. Busca en
`clients/web/` cualquier referencia a los puertos 3001–3008: no hay ninguna. Lo
mismo en la app Flutter (`lib/config.dart` apunta únicamente al gateway).

La centralización se ve en `api-gateway/src/index.ts`: el JWT se valida **una
vez** y la identidad resuelta viaja a los servicios en cabeceras. Sin gateway,
cada servicio tendría que repetir esa validación, el rate limiting y la política
de CORS.

Un detalle que solo aparece al implementarlo: como los servicios confían en las
cabeceras de identidad, el gateway tiene que **borrar** las que lleguen del
exterior antes de escribir las suyas. De lo contrario, cualquiera podría enviar
`x-usuario-rol: administrador`. Está en la constante `CABECERAS_DE_CONFIANZA`.

---

## 3. ¿Qué problemas habría si todos los servicios usaran una única base de datos?

Se perdería la independencia que justifica la arquitectura:

- Un cambio de esquema afectaría a todos los servicios simultáneamente.
- La base sería **único punto de falla** y cuello de botella de todo el sistema.
- Sería imposible escalar o desplegar servicios de forma autónoma.
- Se generaría **acoplamiento oculto**: cualquier servicio podría modificar
  datos que no le corresponden.
- No podría elegirse el motor adecuado para cada necesidad, obligando a
  almacenar el catálogo, los carritos temporales y las transacciones de pago bajo
  el mismo modelo.

**En este proyecto** el aislamiento no depende de que el código se porte bien:
cada servicio tiene su **propio usuario** y no tiene permisos sobre las bases
ajenas. Compruébalo:

```bash
# El usuario de auth intenta leer la base de pedidos
docker compose exec postgres psql "postgresql://auth_user:auth_pass@localhost/pedidos_db" \
  -c "SELECT * FROM pedidos;"
# → permission denied / no puede conectarse
```

Consecuencia de diseño: **no hay claves foráneas entre servicios**. `pedidos`
guarda `cliente_id` como número, no como referencia. La integridad se mantiene
por contrato de API, y el precio de eso es que la validación del cliente es una
llamada de red (paso 9 de la saga) en lugar de un `JOIN`.

---

## 4. ¿Qué sucedería si el servicio de catálogo estuviera fuera de servicio?

El impacto sería **alto pero no total**. Los clientes no podrían buscar ni
consultar productos, que es la puerta de entrada a la compra. Pero la
autenticación seguiría operando, los pedidos ya generados continuarían su proceso
de pago y despacho, y el seguimiento de envíos permanecería disponible.

Mitigaciones recomendadas por el documento: réplicas del servicio, caché de las
consultas más frecuentes en el gateway o un CDN, y una versión estática del
catálogo con los productos más vendidos.

**Compruébalo:**

```bash
docker compose stop catalogo-service
npm run test:salud
```

La salida muestra `catalogo CAIDO` y los otros ocho en `OK`. Y en la práctica:

- `GET /api/pedidos` → funciona: el historial sigue consultable
- `GET /api/catalogo/productos` → 503
- `POST /api/carrito/.../items` → 503 explícito, porque el precio lo pone el
  catálogo y el carrito no se lo inventa

El caso inverso es más interesante. Si cae **inventario**, el catálogo **no**
cae con él: muestra los productos con la disponibilidad marcada como *no
verificada*. Eso es degradación elegante, y está en la `alternativa` que recibe
el circuit breaker en `catalogo-service/src/controlador.ts`.

---

## 5. ¿Cómo garantizar que dos clientes no compren la última unidad?

Esta es la condición de carrera clásica del comercio electrónico. La respuesta
tiene dos partes: **quién** resuelve la concurrencia y **con qué mecanismos**.

El **quién**: el servicio de inventario es el único propietario del stock.
Ningún otro servicio escribe en esas tablas. Sin esa exclusividad, ningún
mecanismo funciona.

Los **mecanismos**, los cinco que enumera el documento, todos implementados en la
función SQL `reservar_stock` de
[`infra/postgres/03-inventario.sql`](../infra/postgres/03-inventario.sql):

### a. Operación atómica: descuento condicional

```sql
UPDATE stock
   SET cantidad_disponible = cantidad_disponible - p_cantidad,
       cantidad_reservada  = cantidad_reservada  + p_cantidad,
       version             = version + 1
 WHERE sku = p_sku
   AND cantidad_disponible >= p_cantidad;   -- ← la condición decide
```

Si no hay unidades suficientes, el `WHERE` no encuentra fila y no se actualiza
nada. El motor evalúa el predicado sobre la fila ya bloqueada, así que la segunda
transacción lo reevalúa sobre el valor **ya actualizado** por la primera.

### b. Bloqueo optimista con número de versión

La columna `version` se incrementa en cada escritura. Permite detectar que el
registro cambió entre una lectura y una escritura posterior.

### c. Reserva temporal

Al iniciar el pago se reserva la unidad por quince minutos. Si el pago no se
completa en ese plazo, `expirar_reservas()` la devuelve automáticamente (barrido
cada minuto, con `FOR UPDATE SKIP LOCKED` para que varias instancias del servicio
no se pisen).

### d. Serialización por producto

```sql
PERFORM pg_advisory_xact_lock(hashtext(p_sku));
```

Ordena las solicitudes sobre el **mismo** SKU sin bloquear las de otros
productos. Útil en lanzamientos y ventas de alta demanda.

### e. Idempotencia

`clave_idempotencia` es `UNIQUE`. Si el orquestador reintenta tras un timeout, la
función detecta la clave existente y devuelve **la misma reserva** en lugar de
descontar dos veces.

### Verificación

```bash
npm run test:concurrencia
```

Resultado real de la ejecución:

```
Escenario 1: dos compradores, una sola unidad
  Ana:   reservado
  Bruno: sin_stock
  PASA  Exactamente un comprador obtiene la unidad
  PASA  El stock disponible queda en 0, nunca negativo

Escenario 2: veinte compradores, cinco unidades
  Reservas concedidas: 5 | rechazadas: 15
  PASA  Se conceden exactamente 5 reservas
```

El cliente que llega segundo recibe un `409 STOCK_INSUFICIENTE` con un mensaje
claro, y **su carrito se conserva**.

---

## 6. ¿Qué servicio debe registrar un pedido?

El **servicio de pedidos**. Es el propietario del dato y el orquestador de la
transacción: recibe la solicitud, coordina las validaciones con clientes,
catálogo, inventario y pagos, y es el único que escribe en `pedidos_db`.

Ningún otro servicio crea ni modifica pedidos directamente; los demás participan
aportando información o ejecutando su parte del proceso.

**En el código:** solo `pedidos-service` tiene credenciales de `pedidos_db`. Los
demás servicios no podrían escribir ahí aunque su código lo intentara.

---

## 7. ¿Qué información intercambian pedidos e inventario?

**Pedidos envía:** el SKU, la cantidad solicitada, el identificador del pedido y
una **clave de idempotencia** que permite reintentar sin duplicar el descuento.

```http
POST /reservas
Idempotency-Key: checkout-1234:SKU-TEC-004

{ "sku": "SKU-TEC-004", "cantidad": 1, "pedido_id": "checkout-1234" }
```

**Inventario responde:** la disponibilidad real, el identificador y la vigencia
de la reserva, y el resultado de la operación.

```json
{
  "reserva_id": "44c723d7-0fde-4a64-b49e-2090737c57e4",
  "disponible_restante": 0,
  "expira_en": "2026-09-24T19:03:58.493Z",
  "idempotente": false
}
```

O bien, si no alcanza:

```json
{ "codigo": "STOCK_INSUFICIENTE", "detalle": { "sku": "...", "solicitado": 1, "disponible": 0 } }
```

Al confirmarse el pago, pedidos solicita convertir la reserva en descuento
definitivo (`POST /reservas/:id/confirmar`); si el pago falla, solicita liberarla
(`POST /reservas/:id/liberar`). Ambas son idempotentes.

Nota de diseño: la clave de idempotencia incluye el SKU
(`${clave}:${item.sku}`), de modo que cada ítem del pedido tiene su reserva
independiente. Si el tercer ítem falla, los dos primeros ya tienen su
compensación registrada y se liberan.

---

## 8. ¿Cuándo conviene usar comunicación asíncrona?

Cuando la operación **no condiciona la respuesta inmediata** que espera el
usuario y puede completarse en segundo plano: envío de correos y notificaciones
push, generación de la factura electrónica, actualización de tableros de
analítica y del motor de recomendaciones, sincronización con el operador
logístico, indexación del catálogo y alertas de reposición.

También cuando **varios servicios necesitan reaccionar al mismo hecho de
negocio** —por ejemplo el evento «pedido confirmado»— o cuando hay que absorber
picos de carga sin degradar la experiencia de compra.

**En este proyecto** `pedido.confirmado` tiene dos consumidores que no se conocen
entre sí: notificaciones (envía el correo) y clientes (actualiza su historial).
Agregar mañana un servicio de analítica no requiere tocar el de pedidos: declara
su cola, la enlaza al patrón y empieza a recibir.

Detalle completo y topología del broker: [`COMUNICACION.md`](COMUNICACION.md).

---

## 9. ¿Cómo escalar de 5.000 a 100.000 clientes?

La estrategia es escalar **de forma selectiva, no uniforme**:

| Medida | Estado en este proyecto |
|---|---|
| Escalado horizontal automático de catálogo, carrito e inventario | Posible: `docker compose up -d --scale catalogo-service=3`. Los servicios son sin estado, así que replicar funciona sin cambios |
| Caché distribuida (Redis) para consultas frecuentes del catálogo | Redis ya está desplegado (lo usa el carrito); falta la capa de caché en catálogo |
| CDN para imágenes y contenido estático | No aplica en local; las imágenes son rutas simuladas |
| Réplicas de lectura en catálogo y clientes | Requiere configuración de PostgreSQL, no implementada |
| Particionamiento de pedidos por fecha o región | El esquema lo admite (`creado_en` indexado); no particionado aún |
| Message broker para desacoplar procesos posteriores | **Implementado** |
| Balanceo de carga y varias zonas de disponibilidad | El `HEALTHCHECK` de cada imagen y `/health` de cada servicio son lo que un balanceador necesita |
| Monitoreo con métricas, trazas y alertas | Parcial: `request_id` propagado, `/health` agregado y estado de los circuitos. Faltarían Prometheus y trazas distribuidas |

Lo que **ya está resuelto** y es la condición previa a todo lo demás: los
servicios no guardan estado en memoria. El carrito, que parecería la excepción,
tiene su estado en Redis. Por eso levantar tres réplicas del catálogo no requiere
tocar una línea de código.

---

## 10. ¿Qué mecanismos de seguridad protegerían la información de los clientes?

| Medida del documento | Implementación |
|---|---|
| Cifrado TLS en todas las comunicaciones | Terminación en el gateway (en producción, tras el balanceador). En local, HTTP |
| JWT de vigencia corta con renovación y revocación | 15 min de acceso; refresh de 7 días **rotatorio** y revocable; se guarda el hash, no el token |
| Autorización por rol y mínimo privilegio | `requiereRol()` en las rutas + `exigirPropiedad()` a nivel de dato |
| Contraseñas con hash y sal | bcrypt, 10 rondas |
| Cumplimiento PCI-DSS | La tabla `transacciones` **no tiene** columnas de número de tarjeta, CVV ni vencimiento |
| Cifrado en reposo y enmascaramiento en registros | Enmascaramiento implementado en `shared/src/logger.ts`; el cifrado en reposo se configura en el motor |
| Rate limiting y protección contra fuerza bruta | Tres niveles en el gateway + bloqueo de cuenta tras 5 intentos |
| Validación estricta de entradas | `exigirCampos()` y consultas parametrizadas en todo el código |
| Registros de auditoría inmutables | `auditoria_accesos`, `auditoria_pasarela`, `movimientos`: solo inserción |

### Sobre el mínimo privilegio

No basta con el rol: un cliente autenticado no debe ver los pedidos de otro
cliente. Eso se comprueba **a nivel de dato**:

```bash
# Ana (cliente_id 1) intenta ver el perfil de Bruno (cliente_id 2)
curl -s localhost:8080/api/clientes/2 -H "Authorization: Bearer $TOKEN_ANA"
# → 403 "Solo puede consultar su propia informacion."
```

En pedidos se devuelve **404 en lugar de 403** deliberadamente: confirmar que el
pedido existe pero es de otro ya filtra información.

### Sobre PCI-DSS

El cumplimiento no se logra cifrando bien los datos de tarjeta: se logra **no
teniéndolos**. El cliente entrega su tarjeta directamente a la pasarela, que
devuelve un token; la plataforma solo maneja ese token, más los últimos cuatro
dígitos y la marca para que el cliente reconozca su medio de pago.

```bash
docker compose exec postgres psql -U postgres -d pagos_db \
  -c "\d transacciones" | grep -iE "numero|cvv|vencim"
# → sin resultados: esas columnas no existen
```

Lo que no existe no se puede filtrar.

### Verificación de los controles

```bash
npm run test:e2e     # el escenario F cubre 401, 403, RBAC y aislamiento entre clientes
```
