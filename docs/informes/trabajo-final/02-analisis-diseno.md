# 2. Fase 1: análisis y diseño arquitectónico

Este capítulo resume la especificación del sistema (`docs/especificacion/`), el modelo C4 (`docs/c4/`) y las decisiones de arquitectura (`docs/adr/`). Los diagramas C4 se escriben en PlantUML y se renderizan con `npm run docs:c4`.

## 2.1 Escenario y problema de negocio

<!-- incluir: docs/especificacion/01-escenario-requisitos.md :: 1.1 Problema y contexto de negocio -->

## 2.2 Actores

<!-- incluir: docs/especificacion/01-escenario-requisitos.md :: 1.2 Actores -->

## 2.3 Requisitos funcionales

La especificación define **74 requisitos funcionales**: RF-01 a RF-62 para la plataforma y RF-ASIS-01 a RF-ASIS-12 para el asistente. Cada uno nombra su endpoint y el rol que puede usarlo. Los requisitos marcados F5b a F5e surgieron de las revisiones de la tienda por el equipo en la Fase 5. La lista completa está en el anexo E.

Tabla: Requisitos funcionales por área

| Área | Servicio | Requisitos | Ejemplos |
|---|---|---|---|
| Autenticación y usuarios | auth-service | 9 | Registro, login con JWT y refresh rotatorio, usuarios internos, eliminar la cuenta, recuperar la contraseña por correo |
| Clientes | clientes-service | 5 | Perfil, direcciones con departamento oficial, historial |
| Catálogo | catalogo-service | 8 | Búsqueda tolerante, secciones, ofertas con fecha de fin, fotos, creación de productos |
| Inventario | inventario-service | 6 | Stock por bodega, reservas, alertas de reposición, proveedores y entradas de mercancía |
| Carrito | carrito-service | 4 | Carrito con vigencia, cupones y totales con IVA y envío |
| Pedidos | pedidos-service | 8 | Checkout con saga, límite de compra por cliente, cancelación, cambio de dirección, bitácora |
| Pagos | pagos-service | 2 | Cobro idempotente y reembolso |
| Notificaciones | notificaciones-service | 6 | Correos por plantilla, campana con bandeja, registro de envíos |
| Plataforma | gateway | 2 | Salud agregada y documentación OpenAPI |
| Interfaz web | web | 11 | Identidad visual, tema oscuro, salud del sistema para el administrador, validación junto al campo |
| Asistente virtual | asistente-service | 13 | Preguntas frecuentes, búsqueda de productos, estado de mis pedidos, consultas al vendedor |

## 2.4 Atributos de calidad

<!-- incluir: docs/especificacion/01-escenario-requisitos.md :: 1.4 Atributos de calidad -->

## 2.5 Estilo arquitectónico y contexto

<!-- incluir: docs/especificacion/02-especificacion-arquitectura.md :: 2.1 Estilo arquitectónico -->

## 2.6 Descomposición en servicios

<!-- incluir: docs/especificacion/02-especificacion-arquitectura.md :: 2.2 Descomposición en servicios -->

## 2.7 Comunicación síncrona y asíncrona

<!-- incluir: docs/especificacion/02-especificacion-arquitectura.md :: 2.3 Comunicación -->

## 2.8 Persistencia y consistencia

<!-- incluir: docs/especificacion/02-especificacion-arquitectura.md :: 2.4 Persistencia -->

## 2.9 Patrones de diseño y de resiliencia

<!-- incluir: docs/especificacion/02-especificacion-arquitectura.md :: 2.5 Patrones aplicados -->

## 2.10 Seguridad de la arquitectura

<!-- incluir: docs/especificacion/02-especificacion-arquitectura.md :: 2.6 Seguridad de la arquitectura -->

## 2.11 Decisiones de arquitectura

Cada decisión importante se registró como un ADR con el formato de Michael Nygard: contexto, decisión, consecuencias y alternativas descartadas. Los diez ADR completos están en el anexo B.

<!-- incluir: docs/adr/README.md :: * -->
