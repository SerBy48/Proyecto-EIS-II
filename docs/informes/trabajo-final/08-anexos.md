# Anexo A. Repositorio y historial de entregas

**Repositorio:** <https://github.com/SerBy48/Proyecto-EIS-II>. La rama `main` tiene la versión estable; `develop` integra cada fase.

Tabla: Pull requests fusionados, por fase

| PR | Rama | Fecha | Contenido |
|---|---|---|---|
| #1 | `feature/fase1-preparacion` | 2026-11-14 | Práctica de Estrategias de validación: preparación, poblado de datos e inventario de rutas |
| #2 | `feature/fase2-rendimiento` | 2026-11-14 | Pruebas de rendimiento con k6 |
| #3 | `feature/fase3-correcciones-rendimiento` | 2026-11-15 | Pool de hilos para bcrypt, cola acotada, keep-alive y 504 del gateway |
| #4 | `feature/fase2-seguridad` | 2026-11-15 | ZAP y verificaciones manuales de seguridad |
| #5 | `feature/fase3-correcciones-seguridad` | 2026-11-15 | Secretos obligatorios, registro seguro y circuit breaker |
| #6 | `feature/fase3-correcciones-seguridad-2` | 2026-11-15 | Validación de entradas, CORS, cabeceras y correos escapados |
| #7 | `feature/fase2-usabilidad` | 2026-11-15 | Tareas, recorrido cognitivo, KLM, heurísticas y axe |
| #8 | `feature/fase3-correcciones-usabilidad` | 2026-11-15 | Inicio de sesión real, paginación y cancelación con confirmación |
| #9 | `feature/fase3-matriz-calidad` | 2026-11-15 | Matriz de calidad y plan de corrección |
| #10 | `feature/fase4-informe` | 2026-11-15 | Informe de la práctica |
| #11 | `feature/f1-c4-especificacion` | 2026-11-15 | Trabajo Final, Fase 1: especificación, C4 y ADR |
| #12 | `feature/f2-nucleo` | 2026-11-15 | Fase 2: Drizzle, OpenAPI y Swagger UI, correo SMTP, pruebas unitarias |
| #13 | `feature/f3-asistente` | 2026-11-15 | Fase 3: asistente virtual |
| #14 | `feature/f4-calidad` | 2026-11-16 | Fase 4: re-medición con el asistente y fallos inyectados |
| #15 | `feature/f5-despliegue` | 2026-11-16 | Fase 5: web en contenedor, perfil prod, CI, criterios de aceptación y manuales |
| #16 | `feature/f5b-mejoras-tienda` | 2026-11-17 | SerByTek: identidad, perfil, tema oscuro y asistente reforzado |
| #17 | `feature/f5c-gestion-tienda` | 2026-11-18 | Gestión de la tienda: productos, proveedores, campana y consultas |
| #18 | `feature/f5c-limpieza-pruebas` | 2026-11-18 | Búsqueda del panel y pruebas que no dejan datos en la tienda |
| #19 | `feature/f5d-ajustes-revision` | 2026-11-18 | Revisión manual: recuperación de contraseña, notificaciones y salud |
| #20 | `feature/f5e-ajustes-revision` | 2026-11-18 | Segunda revisión: asesor para visitantes, filtros y validaciones |
| #21 | `feature/despliegue-nube` | 2026-11-19 | Despliegue en la nube con Caddy, cuentas y correo por entorno |

Tabla: Dónde está cada entregable

| Entregable | Ubicación |
|---|---|
| Especificación, C4 y ADR | `docs/especificacion/`, `docs/c4/`, `docs/adr/` |
| Código | `services/`, `packages/shared/`, `clients/` |
| Scripts de base de datos | `infra/postgres/`, `infra/mongo/` |
| Especificación OpenAPI | `docs/openapi/` (servida en `/api/docs`) |
| Calidad: rendimiento, seguridad y usabilidad | `docs/calidad/`, evidencia en `docs/evidencia/no-funcionales/` |
| Aceptación y trazabilidad | `docs/aceptacion/`, evidencia en `docs/evidencia/trabajo-final/e2e-ui/` |
| Pruebas y defectos corregidos | `tests/`, `docs/PRUEBAS.md` |
| Manuales y guía de despliegue | `docs/manuales/` |
| Este informe y los manuales en .docx | `docs/informes/` (`npm run informe:trabajo-final`) |

# Anexo B. Decisiones de arquitectura (ADR)

## ADR-0001: Microservicios con API Gateway frente al monolito modular

<!-- incluir: docs/adr/0001-microservicios-con-api-gateway.md :: * -->

## ADR-0002: Base de datos por servicio y motor por necesidad

<!-- incluir: docs/adr/0002-base-de-datos-por-servicio.md :: * -->

## ADR-0003: Saga orquestada para el checkout

<!-- incluir: docs/adr/0003-saga-orquestada.md :: * -->

## ADR-0004: RabbitMQ para eventos; REST para consultas que exigen consistencia

<!-- incluir: docs/adr/0004-rabbitmq-eventos-rest-consultas.md :: * -->

## ADR-0005: JWT de vida corta y refresh token rotatorio

<!-- incluir: docs/adr/0005-jwt-corto-refresh-rotatorio.md :: * -->

## ADR-0006: ORM parcial con Drizzle; SQL nativo donde hay concurrencia

<!-- incluir: docs/adr/0006-estrategia-orm.md :: * -->

## ADR-0007: Asistente virtual con motor de reglas e IA opcional

<!-- incluir: docs/adr/0007-asistente-reglas-ia-opcional.md :: * -->

## ADR-0008: Documentación OpenAPI centralizada en el gateway

<!-- incluir: docs/adr/0008-openapi-centralizada-gateway.md :: * -->

## ADR-0009: Despliegue con Compose, CI y túnel para la defensa

<!-- incluir: docs/adr/0009-entorno-de-despliegue.md :: * -->

## ADR-0010: Despliegue en una máquina virtual de la nube

<!-- incluir: docs/adr/0010-despliegue-en-una-vm.md :: * -->

# Anexo C. Rutas de la API

Generado de la especificación OpenAPI que sirve el gateway (`services/api-gateway/especificacion/openapi.json`). Las rutas internas de la saga, que solo usan los servicios entre sí, están en `docs/openapi/openapi-interna.yaml`.

<!-- incluir: docs/informes/trabajo-final/generado/rutas-api.md :: * -->

# Anexo D. Matriz de trazabilidad

<!-- incluir: docs/aceptacion/TRAZABILIDAD.md :: * -->

# Anexo E. Requisitos funcionales

<!-- incluir: docs/especificacion/01-escenario-requisitos.md :: 1.3 Requisitos funcionales -->

# Anexo F. Guion de la defensa

<!-- incluir: docs/defensa/GUION.md :: * -->
