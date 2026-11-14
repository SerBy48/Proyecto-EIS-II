# Flujo de compra — Actividad 4

Diagrama de secuencia del escenario completo: un cliente inicia sesión, consulta
productos, agrega uno al carrito, confirma la compra y paga.

La implementación está en
[`services/pedidos-service/src/saga-checkout.ts`](../services/pedidos-service/src/saga-checkout.ts).

---

## Camino feliz: compra completada

```mermaid
sequenceDiagram
    autonumber
    actor C as Cliente
    participant G as API Gateway
    participant A as auth
    participant K as catálogo
    participant I as inventario
    participant R as carrito
    participant P as PEDIDOS<br/>(orquestador)
    participant $ as pagos
    participant B as RabbitMQ
    participant N as notificaciones

    rect rgb(238, 242, 255)
    note over C,A: Pasos 1-4 · Autenticación
    C->>G: POST /api/auth/login
    G->>A: credenciales
    A->>A: bcrypt.compare
    A-->>G: JWT {sub, rol, cliente_id}
    G-->>C: token + refresh_token
    end

    rect rgb(240, 253, 244)
    note over C,I: Pasos 5-6 · Consulta del catálogo
    C->>G: GET /api/catalogo/productos
    G->>K: enruta con identidad
    K->>I: GET /disponibilidad?skus=...
    note right of I: SÍNCRONO: la disponibilidad<br/>mostrada debe ser la real
    I-->>K: stock por SKU
    K-->>G: productos + precio + disponibilidad
    G-->>C: catálogo
    end

    rect rgb(255, 251, 235)
    note over C,K: Paso 7 · Agregar al carrito
    C->>G: POST /api/carrito/:id/items
    G->>R: {sku, cantidad}
    R->>K: GET /productos/:sku/precio
    note right of K: El precio lo pone el catálogo,<br/>NUNCA el cliente
    K-->>R: precio vigente
    R->>R: calcula subtotal, IVA, envío
    R-->>G: carrito actualizado
    G-->>C: totales
    end

    rect rgb(253, 242, 248)
    note over C,N: Pasos 8-15 · Checkout (saga)
    C->>G: POST /api/pedidos/checkout<br/>Idempotency-Key
    G->>P: inicia la saga

    P->>P: ¿la clave ya produjo un pedido?
    note right of P: Idempotencia: un doble clic<br/>no crea dos pedidos

    P->>R: GET /:id/checkout
    R-->>P: ítems + totales

    P->>+P: PASO 9
    P->>C: (vía clientes) GET /:id/validar
    note right of P: valida cliente activo<br/>y dirección de envío
    P->>-P: ok

    P->>K: PASO 10 · GET /productos/:sku/precio
    K-->>P: precio vigente
    note right of P: si cambió respecto al carrito,<br/>se aborta con 409

    P->>I: PASO 11 · POST /reservas<br/>Idempotency-Key: clave:sku
    note right of I: descuento condicional atómico<br/>+ bloqueo por SKU
    I-->>P: reserva_id, expira en 15 min
    note over P: COMPENSACIÓN REGISTRADA:<br/>liberar_reserva

    P->>P: INSERT pedido (estado=creado)
    note over P: COMPENSACIÓN REGISTRADA:<br/>cancelar_pedido

    P->>$: PASO 12 · POST /cobros<br/>Idempotency-Key: clave:pago
    $->>$: pasarela externa
    $-->>P: aprobado + referencia
    note over P: COMPENSACIÓN REGISTRADA:<br/>reembolsar

    P->>I: PASO 13 · POST /reservas/:id/confirmar
    note right of I: el descuento se vuelve<br/>definitivo
    I-->>P: confirmada

    P->>P: PASO 14 · UPDATE estado = 'pagado'
    P->>R: DELETE /:id (vaciar carrito)

    P->>B: PASO 15 · publica pedido.confirmado
    note right of B: ASÍNCRONO: el cliente ya<br/>tiene su pedido confirmado
    P-->>G: 201 + número de pedido
    G-->>C: compra confirmada
    end

    rect rgb(245, 245, 245)
    note over B,N: En segundo plano
    B->>N: consume pedido.confirmado
    N->>N: renderiza plantilla
    N->>C: correo de confirmación
    B->>A: clientes actualiza su historial
    end
```

---

## Camino de fallo: pago rechazado y compensación

Este es el escenario que justifica la saga. El pago se rechaza **después** de
haber reservado el stock, así que hay efectos laterales que deshacer.

```mermaid
sequenceDiagram
    autonumber
    actor C as Cliente
    participant P as PEDIDOS
    participant I as inventario
    participant $ as pagos
    participant B as RabbitMQ
    participant N as notificaciones

    C->>P: POST /checkout (tarjeta sin fondos)

    P->>I: POST /reservas
    I-->>P: reserva_id
    note over I: disponible: 5 → 4<br/>reservado: 0 → 1

    P->>P: INSERT pedido (estado=creado)

    P->>$: POST /cobros
    $->>$: la pasarela rechaza
    $-->>P: aprobado=false<br/>FONDOS_INSUFICIENTES

    rect rgb(254, 242, 242)
    note over P,I: COMPENSACIÓN · orden inverso
    P->>P: UPDATE pedido → 'cancelado'
    P->>I: POST /reservas/:id/liberar
    I->>I: disponible: 4 → 5<br/>reservado: 1 → 0
    note right of I: la unidad vuelve a estar<br/>disponible para otro cliente
    I-->>P: liberada
    end

    P->>B: publica pedido.cancelado
    P-->>C: 402 PAGO_RECHAZADO<br/>+ número de pedido

    B->>N: consume pedido.cancelado
    N->>C: correo: "no pudimos procesar tu pago"

    note over C: El carrito SE CONSERVA:<br/>puede reintentar con otra tarjeta
```

Lo importante del resultado: el cliente recibe un `402` con el número de pedido,
sabe que no se le cobró nada, su carrito sigue intacto, y las unidades ya están
disponibles para quien las quiera.

---

## Los quince pasos y su implementación

| # | Paso del documento | Servicio | Dónde |
|---|---|---|---|
| 1 | El cliente inicia sesión | web / móvil | `Login.jsx`, `login_pantalla.dart` |
| 2 | Envía credenciales al gateway | gateway | ruta pública `/api/auth/login` |
| 3 | El gateway solicita la validación | gateway | proxy a `auth-service` |
| 4 | Se valida y se emite el token | auth | `controlador.ts → login` |
| 5 | Consulta del catálogo | catálogo | `listarProductos` |
| 6 | El catálogo consulta existencias | catálogo → inventario | `consultarDisponibilidad` (síncrono) |
| 7 | Agrega un producto al carrito | carrito | `agregarItem`, precio releído del catálogo |
| 8 | Confirma la compra | pedidos | `checkout` → `ejecutarCheckout` |
| 9 | Valida cliente y dirección | pedidos → clientes | paso `validar_cliente` |
| 10 | Verifica el precio vigente | pedidos → catálogo | paso `verificar_precios` |
| 11 | Verifica y reserva el stock | pedidos → inventario | paso `reservar_stock` |
| 12 | Solicita el cobro | pedidos → pagos | paso `cobrar` |
| 13 | Registra el pedido y descuenta | pedidos + inventario | paso `confirmar_reserva` |
| 14 | Actualiza el estado y publica | pedidos | `UPDATE estado='pagado'` |
| 15 | Envía la notificación | broker → notificaciones | evento `pedido.confirmado` |

---

## Por qué este orden

**Reservar antes de cobrar.** Cobrar y luego descubrir que no hay unidades
obliga a un reembolso. Para el cliente es mucho mejor un "producto agotado"
antes de pedirle la tarjeta que un cobro seguido de una devolución que tarda
días en reflejarse.

**Releer el precio del catálogo.** Si el precio viniera del carrito o del
cliente, cualquiera podría comprar un portátil por mil pesos manipulando la
petición. Y si cambió desde que lo agregó, se le muestra el nuevo en lugar de
cobrarle algo que no aceptó.

**Reserva con vigencia, no descuento directo.** Mientras el cliente introduce su
tarjeta, las unidades están apartadas: nadie más puede comprarlas. Si abandona
el pago, el barrido automático las devuelve al minuto. Sin la vigencia, un
carrito abandonado dejaría producto bloqueado indefinidamente.

**Confirmar la reserva después del pago.** Hasta ese momento el descuento es
reversible. Esa reversibilidad es exactamente lo que hace posible la
compensación.

---

## Bitácora de la saga

Cada paso se registra en la tabla `saga_pasos` con su estado (`iniciado`,
`completado`, `fallido`, `compensado`). Consultable:

```bash
curl -s localhost:8080/api/pedidos/42/saga \
  -H "Authorization: Bearer $TOKEN_ADMIN" | python3 -m json.tool
```

Salida de una compra con pago rechazado:

```
validar_cliente               completado
leer_carrito                  completado
verificar_precios             completado
reservar_stock                completado
crear_pedido                  completado
cobrar                        fallido      {"codigo": "FONDOS_INSUFICIENTES"}
cancelar_pedido               compensado   {"motivo": "pago_rechazado"}
liberar_reserva:SKU-TEC-004   compensado   {"motivo": "pago_rechazado"}
```

Esta bitácora es la respuesta práctica a la mayor desventaja que el documento
atribuye a la arquitectura distribuida: la dificultad de depuración. Junto con
el `request_id` propagado en los registros de los seis servicios, permite
reconstruir con precisión qué pasó en una compra concreta.
