# Resumen ejecutivo

**SerByTek** es una tienda en línea de tecnología construida con una arquitectura de microservicios. Resuelve los tres problemas que motivaron el proyecto en una empresa de retail con un sistema monolítico: la **sobreventa** por existencias desactualizadas, los **despliegues acoplados** (un cambio en el catálogo obligaba a redesplegar los pagos) y la **saturación global** cuando solo crecía el tráfico del catálogo.

**La solución.** Un API Gateway como único punto de entrada y nueve microservicios, cada uno con su propia base de datos (PostgreSQL, MongoDB o Redis según la necesidad):
- **La compra** es una saga orquestada con compensaciones, idempotencia, circuit breakers y reintentos selectivos.
- **El inventario** es el único dueño del stock y reserva con descuento condicional y bloqueo por SKU.
- **Los eventos** de dominio viajan por RabbitMQ, con cola de mensajes fallidos.
- **El asistente virtual** responde preguntas, busca productos, consulta los pedidos del usuario con su propia identidad y le permite escribirle al vendedor.
- **Los clientes** son una web en React, servida por nginx, y una app móvil en Flutter.
- **El despliegue** es con Docker Compose en tres perfiles (laboratorio, producción y nube), con integración continua en GitHub Actions.

Tabla: Resultados clave de la versión final

| Dimensión | Resultado |
|---|---|
| Concurrencia | 20 compradores simultáneos por las últimas 5 unidades: **exactamente 5 compran**, ninguna sobreventa (33 comprobaciones) |
| Rendimiento (50 usuarios) | p95 del catálogo **74 ms**, del checkout **621 ms**, del asistente **36 ms** y del login **981 ms**: todos dentro de su meta |
| Tolerancia a fallos | Con inventario detenido 61 s en plena carga: **0 errores** en el catálogo (degrada sin stock). Con notificaciones detenido 62 s: **7 429 compras, 0 fallidas**, y los 2 233 eventos en cola se entregaron después |
| Seguridad | 12 hallazgos de OWASP Top 10 2025 (3 graves, entre ellos un secreto JWT público con CVSS 9,8): **11 corregidos** y 1 riesgo aceptado con argumentos (más un aviso de dependencias que no aplica, aceptado con fecha de revisión). Escaneo activo de ZAP sobre 174 URL: 0 fallos. 27 verificaciones manuales automatizadas |
| Usabilidad | 9/9 tareas completadas; **0 incumplimientos de WCAG 2.2 AA** en 48 pantallas (temas claro y oscuro); ningún hallazgo de severidad 3 o 4 abierto |
| Asistente virtual | **91,7 %** de acierto de intenciones en el conjunto de evaluación (meta: 85 %); 50/50 en las frases de la tienda y 27/27 en las de marcas |
| Aceptación | **29/29 criterios de aceptación** verificados en la interfaz con Playwright, trazados a los 62 requisitos funcionales |
| Pruebas automáticas | 187 unitarias y 216 casos de integración (HTTP, concurrencia, E2E y asistente), todos pasan; la especificación OpenAPI cubre exactamente las 86 rutas del código (517 comprobaciones) |

**Lo que queda abierto.**
- **Capacidad:** el login y el checkout desde 100 usuarios cumplen su meta, pero en el límite. El siguiente paso es escalar horizontalmente auth y pedidos.
- **Medición con usuarios reales:** el cuestionario SUS y la prueba con evaluadores están preparados, pero no se aplicaron.
- **Publicación en la nube:** está preparada y verificada en local, con HTTPS, cuentas de producción, correo real y límites por persona. Falta crear la máquina virtual: no fue posible abrir la cuenta en Azure ni en Oracle Cloud a tiempo. Hoy la tienda se publica con un túnel durante la demostración.
