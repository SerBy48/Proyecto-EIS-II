# ADR-0001: Microservicios con API Gateway frente al monolito modular

**Estado:** Aceptada (Práctica de Laboratorio 2; ratificada en el Trabajo Final).

## Contexto

La empresa de retail sufre sobreventa, despliegues acoplados y la caída del sistema completo cuando solo sube el tráfico del catálogo ([escenario](../especificacion/01-escenario-requisitos.md#11-problema-y-contexto-de-negocio)). La meta es crecer de 5 000 a 100 000 clientes con picos de temporada.

## Decisión

Separar el sistema en **8 microservicios por contexto de negocio**: auth, clientes, catálogo, inventario, carrito, pedidos, pagos y notificaciones. El asistente es el noveno, en la Fase 3.

Todos van detrás de **un API Gateway**, que es el único punto de entrada. El gateway centraliza:
- la validación del JWT;
- el saneamiento de las cabeceras de confianza;
- el rate limiting;
- el `request_id`;
- la salud agregada.

Los servicios confían en las cabeceras que escribe el gateway. Además, comparten la librería `@ecommerce/shared` para no repetir la infraestructura común: errores, logs, JWT, bus de eventos y cliente HTTP.

## Consecuencias

- ✅ Cada servicio escala y se despliega por separado: el catálogo puede tener 3 réplicas sin tocar pagos.
- ✅ Los fallos quedan aislados. Si inventario cae, el catálogo sigue respondiendo sin datos de stock y el resto de la tienda funciona (pregunta 4 del análisis).
- ✅ La seguridad del borde está en un solo lugar.
- ❌ Hay más piezas que operar: 9 procesos, 4 motores de datos y un broker. Se mitiga con Compose, `/api/health` y logs con `request_id`.
- ❌ La consistencia entre servicios ya no es transaccional: exige una saga e idempotencia ([ADR-0003](0003-saga-orquestada.md)).
- ❌ El gateway es un punto único de fallo y un posible cuello de botella. Como no guarda estado, se escala horizontalmente. Limitación conocida: el rate limit se cuenta por instancia.

## Alternativas descartadas

- **Monolito modular con un solo despliegue.** Resuelve el acoplamiento del código, pero no el escalado independiente ni el aislamiento de fallos, que son dos de los tres problemas de partida.
- **Clientes que llaman a cada servicio directamente.** Duplica la autenticación en cada servicio y expone la topología interna.
- **Service mesh (Istio, Linkerd).** Resuelve mTLS y reintentos en la red, pero es desproporcionado para el tamaño del equipo y del entorno.
