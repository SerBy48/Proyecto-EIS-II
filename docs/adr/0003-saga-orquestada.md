# ADR-0003: Saga orquestada (no coreografiada) para el checkout

**Estado:** Aceptada.

## Contexto

Una compra toca cinco servicios con datos propios: clientes, carrito, catálogo, inventario y pagos.
- No hay transacción distribuida. Un commit en dos fases (2PC) no es viable entre PostgreSQL, Redis y una pasarela externa.
- Si el cobro falla después de reservar, el stock reservado tiene que volver.
- El orden importa: no se cobra sin tener el stock reservado.

## Decisión

Una **saga orquestada** por `pedidos-service` (`saga-checkout.ts`), con estos pasos:
1. validar el cliente;
2. leer el carrito;
3. verificar los precios;
4. reservar el stock;
5. crear el pedido;
6. cobrar;
7. confirmar la reserva;
8. marcar el pedido como pagado;
9. publicar `pedido.confirmado`.

Reglas de la saga:
- Cada paso con efecto lateral **registra su compensación inmediatamente** después de ejecutarse (invariante 5).
- Cada paso queda en la bitácora `saga_pasos`, que se consulta con `GET /api/pedidos/:id/saga`.
- Las llamadas usan **claves de idempotencia** derivadas de la del checkout. Repetir la saga no duplica ni reservas ni cobros (invariante 4).
- **Nunca se compensa hacia atrás un pago aprobado** (invariante 6). Si falla la confirmación de la reserva después de cobrar, se registra el fallo y se resuelve hacia adelante.

## Consecuencias

- ✅ El flujo completo se lee en un solo archivo y se audita en una tabla.
- ✅ Las compensaciones son explícitas y están probadas: en `test:e2e`, un pago rechazado devuelve el stock.
- ❌ El orquestador conoce a todos sus participantes, así que pedidos queda acoplado a cinco servicios.
- ❌ La saga es síncrona: la latencia del checkout es la suma de sus pasos. Bajo carga, el checkout es el cuello de botella (hallazgo R5).

## Alternativas descartadas

- **Saga coreografiada por eventos**, en la que cada servicio reacciona al anterior. Acopla menos, pero tiene tres problemas:
  - el flujo queda repartido entre cinco servicios;
  - las compensaciones son difíciles de seguir y de depurar;
  - el cliente no recibe una respuesta síncrona de "pagado".
- **Transacción distribuida (2PC/XA).** Ni Redis ni la pasarela la soportan, y bloquearía los recursos durante toda la compra.
