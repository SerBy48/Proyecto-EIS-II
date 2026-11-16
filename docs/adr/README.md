# Registros de decisiones de arquitectura (ADR)

Formato de Michael Nygard: **estado, contexto, decisión, consecuencias y alternativas descartadas**. Un ADR aceptado no se edita para cambiar la decisión: se escribe uno nuevo que lo sustituye y se marca el anterior como *sustituido*.

| ADR | Decisión | Estado |
|---|---|---|
| [0001](0001-microservicios-con-api-gateway.md) | Microservicios con API Gateway frente al monolito modular | Aceptada |
| [0002](0002-base-de-datos-por-servicio.md) | Base de datos por servicio y motor por necesidad | Aceptada |
| [0003](0003-saga-orquestada.md) | Saga orquestada (no coreografiada) para el checkout | Aceptada |
| [0004](0004-rabbitmq-eventos-rest-consultas.md) | RabbitMQ para eventos; REST para consultas que exigen consistencia | Aceptada |
| [0005](0005-jwt-corto-refresh-rotatorio.md) | JWT de vida corta + refresh rotatorio | Aceptada |
| [0006](0006-estrategia-orm.md) | ORM parcial con Drizzle; SQL nativo donde hay concurrencia | Aceptada; se implementa en la Fase 2 |
| [0007](0007-asistente-reglas-ia-opcional.md) | Asistente: microservicio con motor de reglas e IA opcional | Aceptada; se implementa en la Fase 3 |
| [0008](0008-openapi-centralizada-gateway.md) | Documentación OpenAPI centralizada en el gateway | Aceptada; se implementa en la Fase 2 |
| [0009](0009-entorno-de-despliegue.md) | Compose con perfil prod, CI en GitHub Actions y túnel para la defensa | Aceptada; se implementa en la Fase 5 |
