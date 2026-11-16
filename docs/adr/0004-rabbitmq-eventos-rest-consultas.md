# ADR-0004: RabbitMQ para eventos; REST para consultas que exigen consistencia

**Estado:** Aceptada.

## Contexto

Hay dos tipos de interacción entre servicios:
- **Las que necesitan la respuesta para continuar.** Por ejemplo: ¿hay stock?, ¿se aprobó el pago?
- **Las que solo avisan de algo que ya ocurrió.** Por ejemplo: enviar el correo de confirmación o actualizar el historial.

Si el correo fuera síncrono, una demora del proveedor bloquearía la compra.

## Decisión

- **REST síncrono donde la respuesta decide el siguiente paso.** Aplica a catálogo → inventario, carrito → catálogo, auth → clientes y a todos los pasos de la saga. Cada llamada tiene:
  - un timeout por dependencia;
  - reintentos solo ante errores de red o 5xx (invariante 7);
  - un circuit breaker que cuenta solo los fallos del servicio (invariante 14).
- **AMQP asíncrono con RabbitMQ para hechos consumados:**
  - un exchange `topic` llamado `ecommerce.eventos`;
  - una cola durable por consumidor;
  - una **dead letter queue** (`ecommerce.eventos.dlq`) que recibe los mensajes después de 3 intentos fallidos.
- Publicar un evento **nunca tumba la operación** (invariante 12).

## Consecuencias

- ✅ Notificaciones puede caer sin afectar las compras: los eventos esperan en la cola.
- ✅ Se pueden agregar consumidores nuevos (facturación, analítica) sin tocar a los publicadores.
- ❌ El historial y las notificaciones son eventualmente consistentes.
- ❌ La entrega es *al menos una vez*, así que los consumidores deben ser idempotentes. Notificaciones lo resuelve con una `clave_dedupe` única.

## Alternativas descartadas

- **Todo síncrono.** La disponibilidad de la compra dependería de la del correo.
- **Kafka.** Ofrece retención y reproceso de eventos, que este volumen no necesita, y su operación es más pesada. RabbitMQ trae de forma nativa el enrutamiento por patrones y la DLQ.
- **Redis Pub/Sub.** No tiene persistencia ni confirmación de entrega: un consumidor caído pierde los mensajes.
