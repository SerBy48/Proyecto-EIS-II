# Plan de corrección

Todos los hallazgos de las tres dimensiones, con su acción, responsable, esfuerzo y prioridad. La prioridad sale de la fórmula de la [matriz de calidad](MATRIZ-CALIDAD.md#1-cómo-se-calcula-la-prioridad): **Severidad (0-4) × Alcance (1-3)**.

| Columna | Valores |
|---|---|
| **Responsable** | Rol que debe ejecutar la acción: *Backend* (servicios y librería compartida), *Frontend* (web), *Infraestructura* (Compose, despliegue y secretos) o *QA* (pruebas) |
| **Esfuerzo** | Estimado: **S** hasta 2 h · **M** de 2 a 8 h · **L** más de 8 h |
| **Estado** | ✅ corregido y verificado en esta entrega (con su commit `fix(...)`) · ⚠️ riesgo aceptado · 🔜 siguiente iteración |

## Rendimiento

| ID | Hallazgo | Sev × Alc | Prioridad | Acción | Responsable | Esfuerzo | Estado |
|---|---|---|---|---|---|---|---|
| R1 | Login limitado a ~10/s por bcryptjs en el hilo principal | 4 × 3 | **P1 (12)** | Pool de `worker_threads` para bcrypt (`pool-hash.ts`) | Backend (auth) | M | ✅ 9,5 → 23,4 logins/s; p95 de 4,3 → 1,3 s |
| R2 | Sin descarte de carga: trabajo huérfano y 30-40 s de recuperación | 2 × 3 | P2 (6) | Cola acotada con 503 y `Retry-After`; descartar tareas de clientes desconectados | Backend (auth) | S | ✅ 503 en ~100 ms; auth sano al terminar |
| R5 | Checkout saturado desde 100 VU, con PostgreSQL al 97 % de CPU | 2 × 3 | P2 (6) | Medir primero cuánto pesan el pool (`DB_POOL_MAX=10`), la serialización por SKU y la CPU de Postgres; luego escalar `pedidos-service` o ajustar el pool | Backend (pedidos) e Infraestructura | L | 🔜 Hoy sin errores; solo latencia |
| R4 | Gateway corta con EOF en lugar de responder 504 | 2 × 2 | P3 (4) | Quitar la opción `timeout` de http-proxy; 504 `TIEMPO_AGOTADO` | Backend (gateway) | S | ✅ 0 EOF en las corridas del después |
| R6 | Notificaciones consume ~10 eventos/s (`prefetch(1)` y 100 ms por envío) | 2 × 2 | P3 (4) | Subir el `prefetch` del consumidor para procesar envíos en paralelo | Backend (notificaciones) | S | 🔜 |
| R3 | Gateway sin keep-alive (`Connection: close`) | 1 × 3 | P3 (3) | `http.Agent` con keep-alive y `keepAliveTimeout` de 65 s en los servicios | Backend (gateway y shared) | S | ✅ 14 % → 0 % de errores con 300 VU; p95 del checkout reducido a la mitad (A/B) |

## Seguridad

| ID | Hallazgo | CVSS v3.1 | Sev × Alc | Prioridad | Acción | Responsable | Esfuerzo | Estado |
|---|---|---|---|---|---|---|---|---|
| S-02 | Secreto JWT por defecto y público | 9,8 | 4 × 3 | **P1 (12)** | Secretos obligatorios, sin valor por defecto; `verificarSecretos()` al arrancar | Backend e Infraestructura | M | ✅ Token forjado → 401 |
| S-03 | Token interno por defecto y puertos internos publicados | 8,3 | 3 × 3 | **P1 (9)** | El mismo arreglo de secretos, y los puertos en `127.0.0.1` | Infraestructura | S | ✅ Reserva directa → 401 |
| S-01 | Registro con el `cliente_id` de otra persona | 8,2 | 3 × 3 | **P1 (9)** | Verificar con clientes-service el correo y la unicidad; índice único parcial | Backend (auth) | M | ✅ → 403 |
| S-04 | Los 4xx de un cliente abren el circuit breaker de todos | 6,5 | 2 × 3 | P2 (6) | `esFalloDelServicio()`: solo red, 5xx y timeouts | Backend (shared) | S | ✅ 1 030 → 0 respuestas 503 en ZAP |
| S-09 | JWT y refresh token en `localStorage` | 6,9 | 2 × 3 | P2 (6) | Refresh token en cookie `HttpOnly`, almacenamiento seguro en la app móvil y protección CSRF | Backend, Frontend y app móvil | L | ⚠️ Aceptado (ver la sección 9.4 de SEGURIDAD.md); mitigado con CSP |
| S-06 | Entradas inválidas que daban 500 | 4,3 | 2 × 2 | P3 (4) | `traducirErrorDeEntrada()`: 400 sin revelar la columna | Backend (shared) | S | ✅ 781 → 0 respuestas 500 |
| S-08 | La web sin cabeceras de seguridad | 4,3 | 2 × 2 | P3 (4) | CSP estricta y cabeceras (`cabeceras-seguridad.js`) | Frontend | S | ✅ 8 → 2 advertencias informativas |
| S-05 | Inyección de operadores NoSQL | 5,3 | 2 × 1 | P4 (2) | `textoDeConsulta()` en los filtros del catálogo | Backend (catálogo) | S | ✅ → 400 |
| S-07 | El rechazo de CORS respondía 500 | Bajo | 1 × 1 | P4 (1) | 403 `ORIGEN_NO_PERMITIDO` | Backend (gateway) | S | ✅ |
| S-10 | Correo sin validar | Bajo | 1 × 1 | P4 (1) | Formato y longitud en el registro y en `/usuarios` | Backend (auth) | S | ✅ |
| S-11 | XSS latente en los correos | Informativo | 0 × 1 | P4 (0) | Escapar el HTML en el canal de correo | Backend (notificaciones) | S | ✅ |

Riesgos residuales que no son hallazgos de la evaluación, pero quedan anotados en la sección 8.3 de [`SEGURIDAD.md`](SEGURIDAD.md):
- Las contraseñas de PostgreSQL y RabbitMQ siguen siendo las de laboratorio. Ahora solo se alcanzan desde el propio equipo.
- Un cliente sin cuenta podría ser reclamado por quien conozca su correo, mientras no haya verificación por correo.

## Usabilidad

| ID | Hallazgo | Nielsen | Sev × Alc | Prioridad | Acción | Responsable | Esfuerzo | Estado |
|---|---|---|---|---|---|---|---|---|
| U-01 | Inicio de sesión solo con 4 cuentas de demostración | 4 | 4 × 3 | **P1 (12)** | Correo y contraseña; cuentas de prueba como ayuda | Frontend | S | ✅ Carla entra (E11) |
| U-02 | 51 de 71 productos inalcanzables navegando | 3 | 3 × 3 | **P1 (9)** | Paginación con el total de resultados | Frontend | S | ✅ 71 de 71 (E3) |
| U-03 | Cancelar un pedido sin confirmación | 3 | 3 × 2 | P2 (6) | Confirmación en dos pasos y aviso de éxito | Frontend | S | ✅ |
| U-04 | El error de la cancelación queda tapado por el modal | 3 | 3 × 2 | P2 (6) | Error dentro del diálogo, con foco y desplazamiento | Frontend | S | ✅ Visible y completo (E8) |
| U-07 | El aviso de "agregado" muestra el SKU y puede quedar fuera de la vista | 2 | 2 × 3 | P2 (6) | Nombre del producto en un aviso flotante | Frontend | S | 🔜 |
| U-08 | Controles de prueba de la pasarela visibles al cliente | 2 | 2 × 3 | P2 (6) | Mostrarlos solo en desarrollo (`import.meta.env.DEV`) y explicar el pago en lenguaje de cliente | Frontend | S | 🔜 |
| U-11 | Sin vista de detalle del producto | 2 | 2 × 3 | P2 (6) | Página o panel de detalle con la descripción | Frontend | M | 🔜 |
| U-05 | Error del cupón lejos del campo, sin confirmación ni forma de quitarlo | 2 | 2 × 2 | P3 (4) | Mensaje junto al campo, confirmación y "Quitar cupón" | Frontend | S | 🔜 |
| U-06 | Sesión vencida: la cabecera sigue mostrando la sesión abierta | 2 | 2 × 2 | P3 (4) | Ante `SESION_EXPIRADA`, limpiar el estado y llevar al inicio de sesión | Frontend | S | 🔜 |
| U-09 | "Seguir comprando" deja al usuario en el carrito vacío | 2 | 2 × 2 | P3 (4) | Navegar al catálogo | Frontend | S | 🔜 |
| U-10 | Botones de cantidad sin estado de carga | 2 | 2 × 2 | P3 (4) | Deshabilitar durante la petición; deshacer al quitar | Frontend | S | 🔜 |
| U-13 | Textos de la interfaz sin tildes ni eñes | 1 | 1 × 3 | P3 (3) | Corregir la ortografía de los textos visibles | Frontend | M | 🔜 |
| U-16 | La búsqueda no indica cuántos resultados hay | 1 | 1 × 3 | P3 (3) | "Mostrando X-Y de Z productos" | Frontend | S | ✅ Con U-02 |
| U-17 | Un producto de prueba aparece en el catálogo | 1 | 1 × 3 | P3 (3) | Que `test:http` desactive su producto al terminar | QA | S | 🔜 |
| U-12 | El panel de pedidos muestra el id del cliente y no pide confirmación | 2 | 2 × 1 | P4 (2) | Nombre del cliente y confirmación | Frontend y Backend | M | 🔜 |
| U-14 | Estados vacíos sin acción para salir | 1 | 1 × 2 | P4 (2) | "Limpiar filtros" y enlace al catálogo | Frontend | S | 🔜 |
| U-15 | "Carrito vacío" mientras el carrito se carga | 1 | 1 × 2 | P4 (2) | Estado de carga | Frontend | S | 🔜 |

## Pendientes que requieren personas

| Actividad | Estado | Material listo |
|---|---|---|
| Prueba con evaluadores de otro equipo (pensando en voz alta) | ⚠️ PENDIENTE: dato humano | [`tareas.md`](../../tests/usabilidad/tareas.md): tareas, hoja de observación y protocolo |
| Cuestionario SUS | ⚠️ PENDIENTE: dato humano | [`sus-cuestionario.md`](../../tests/usabilidad/sus-cuestionario.md) y `npm run usabilidad:sus` |

## Siguiente iteración, en orden de prioridad

1. **R5** (P2): diagnosticar la saturación del checkout antes de cambiar nada. Es la única P2 de capacidad abierta.
2. **U-07 y U-08** (P2, esfuerzo S): avisos con el nombre del producto y ocultar los controles de prueba. Son las mejoras de usabilidad más baratas con alcance a todos los clientes.
3. **U-11** (P2, esfuerzo M): detalle del producto.
4. **R6, U-05, U-06, U-09 y U-10** (P3, esfuerzo S): una tanda corta.
5. **S-09** (P2 aceptado): revisar si se agrega contenido de terceros a la web o si se relaja la CSP.
6. Aplicar el SUS y la prueba con evaluadores en cuanto haya un equipo disponible.
