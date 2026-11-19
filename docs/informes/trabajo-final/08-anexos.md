# Anexo. Repositorio y documentación de referencia

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

Tabla: Documentos de referencia que no se reproducen en este informe

| Documento | Contenido | Ubicación |
|---|---|---|
| Decisiones de arquitectura | Los 10 ADR completos, con contexto, consecuencias y alternativas descartadas | `docs/adr/` |
| Requisitos funcionales | Los 74 requisitos con su endpoint y su rol | `docs/especificacion/01-escenario-requisitos.md` |
| Matriz de trazabilidad | Cada requisito con su criterio, sus casos de prueba, su resultado y su evidencia | `docs/aceptacion/TRAZABILIDAD.md` |
| Rutas de la API | Las 75 operaciones públicas y las internas de la saga | `/api/docs` (Swagger UI) y `docs/openapi/` |
| Diagramas C4 completos | Contexto, contenedores, componentes, dinámicos y despliegue | `docs/c4/` |
| Evaluación de calidad completa | Rendimiento, seguridad, usabilidad, controles OWASP y plan de corrección | `docs/calidad/` |
| Defectos corregidos | 44 entradas con síntoma, causa, corrección y prueba | `docs/PRUEBAS.md` |
| Guion de la defensa | Preparación, demostración, plan B y preguntas probables | `docs/defensa/GUION.md` |
