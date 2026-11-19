# Matriz de trazabilidad

Trabajo Final, Fase 5. Une cada requisito de [`01-escenario-requisitos.md`](../especificacion/01-escenario-requisitos.md) con:
- su criterio de aceptación ([`CRITERIOS.md`](CRITERIOS.md));
- los casos de prueba que lo verifican;
- el resultado de la última regresión y su evidencia.

**Resultado de la regresión del 2026-11-18, ajustes de la revisión manual (F5d)** (sección 4.42 de [`PRUEBAS.md`](../PRUEBAS.md)), desde volúmenes vacíos con la web compilada en modo pruebas:

| Suite | Resultado |
|---|---|
| `test:e2e:ui` | 29/29 criterios |
| `test:e2e` | 53 comprobaciones |
| `test:http` | 73 casos |
| `test:concurrencia` | 33 comprobaciones |
| `test:asistente` | 56 comprobaciones (con la degradación) |
| `test:seguridad` | 27 verificaciones (26 seguras + S-09 aceptado) |
| `test:openapi` | 517 comprobaciones |
| `test:unit` | 160 pruebas |
| axe (temas claro y oscuro) | vistas F5c (20) y F5d (18), 0 reglas WCAG incumplidas |

**Convenciones de la tabla:**
- **Interfaz:** el número `CA-nn` es el criterio que lo verifica en la web; un guion indica que el requisito no tiene pantalla propia.
- **Evidencia:** la ruta parte de `docs/evidencia/`. Las capturas de la interfaz están en `trabajo-final/e2e-ui/CA-nn.png` y el resumen en `trabajo-final/e2e-ui/resultados.json`.

## Requisitos funcionales

| Requisito | Interfaz | Casos de API e integración | Resultado | Evidencia |
|---|---|---|---|---|
| RF-01 Registro vinculado al perfil | CA-01 | `test:http` (registro con `cliente_id` ajeno → 403, hallazgo 4.14), `test:seguridad` | Pasa | `CA-01.png` |
| RF-02 Inicio de sesión | CA-02 | `test:http` (credenciales, bloqueo por *rate limit*) | Pasa | `CA-02.png` |
| RF-03 Renovación con rotación | — | `test:http` (reutilizar un refresh revocado → 401) | Pasa | `PRUEBAS.md` §3 |
| RF-04 Cierre de sesión | — | `test:http` | Pasa | `PRUEBAS.md` §3 |
| RF-05 Perfil autenticado | — | `test:http` | Pasa | `PRUEBAS.md` §3 |
| RF-06 Usuarios internos | — | `test:http` (RBAC: un cliente → 403) | Pasa | `PRUEBAS.md` §3 |
| RF-07 Crear perfil de cliente | CA-01 | `test:http` | Pasa | `CA-01.png` |
| RF-08 Perfil propio | CA-13 | `test:http` (otro cliente → 403) | Pasa | `CA-13.png` |
| RF-09 Direcciones de envío | CA-01, CA-13 | `test:http`; departamento inválido → 400 | Pasa | `CA-13.png` |
| RF-40 Departamentos (F5b) | CA-01, CA-13 | `test:openapi` | Pasa | `CA-01.png` |
| RF-10 Historial de compras | — | `test:e2e` (evento consumido por clientes) | Pasa | `PRUEBAS.md` §3 |
| RF-11 Buscar y filtrar (con subcategoría y búsqueda tolerante) | CA-03 | `test:http`, `test:seguridad` (inyección NoSQL, 4.17) | Pasa | `CA-03.png` |
| RF-12 Detalle de producto | CA-04 | `test:http` | Pasa | `CA-04.png` |
| RF-13 Categorías | CA-03 | `test:http` | Pasa | `CA-03.png` |
| RF-14 Promociones | CA-04 | `test:http` | Pasa | `CA-04.png` |
| RF-15 Crear y editar productos | CA-07 (preparación por API) | `test:http` (RBAC) | Pasa | `resultados.json` |
| RF-16 Stock por SKU | CA-06, CA-11 | `test:http` | Pasa | `CA-11.png` |
| RF-17 Entradas de stock | CA-11 | `test:http` (cliente → 403) | Pasa | `CA-11.png` |
| RF-18 Movimientos y alertas | — | `test:http`, `test:e2e` (alerta de `SKU-TEC-007`) | Pasa | `PRUEBAS.md` §3 |
| RF-19 Reserva sin sobreventa | CA-07 | `test:concurrencia` (20 por 5 → 5), `test:e2e` escenario C | Pasa | `PRUEBAS.md` §3 |
| RF-20 Reservas vencidas | — | `test:http` (barrido) | Pasa | `PRUEBAS.md` §3 |
| RF-21 Totales del carrito | CA-04 | `test:unit` (`totales.ts`), `test:http` | Pasa | `CA-04.png` |
| RF-22 Ítems con precio del catálogo | CA-04 | `test:http` (el precio del cliente se ignora, invariante 2) | Pasa | `CA-04.png` |
| RF-23 Cupón | CA-04 | `test:http`, `test:unit` | Pasa | `CA-04.png` |
| RF-24 Vaciar carrito | CA-05 (queda vacío) | `test:http` | Pasa | `CA-05.png` |
| RF-25 Checkout con saga | CA-05, CA-06, CA-07 | `test:e2e` A, B, C y D; `test:unit` (saga) | Pasa | `CA-05.png`, `CA-06.png` |
| RF-26 Listar mis pedidos | CA-05, CA-08 | `test:http` (aislamiento) | Pasa | `CA-08.png` |
| RF-27 Cancelar pedido | CA-08 | `test:e2e` E (incluye el correo al cliente, H-F5-01), `test:http` | Pasa | `CA-08.png` |
| RF-28 Cambiar estado | CA-12 | `test:http` (transiciones inválidas → 409) | Pasa | `CA-12.png` |
| RF-29 Bitácora de la saga (en la API; F5d: fuera de la interfaz) | — | `test:http` B-12 (cliente → 403), `test:e2e` (pasos y compensación) | Pasa | `PRUEBAS.md` §3 |
| RF-30 Cobro idempotente sin PAN | CA-05, CA-06 | `test:http` (cuatro desenlaces, PCI-DSS) | Pasa | `PRUEBAS.md` §3 |
| RF-31 Transacciones propias | CA-07 | `test:http` | Pasa | `resultados.json` |
| RF-32 Notificar sin duplicados | CA-09 | `test:e2e`, `test:unit` (bus y DLQ) | Pasa | `CA-09.png` |
| RF-33 Mensajes propios | — | `test:http` | Pasa | `PRUEBAS.md` §3 |
| RF-34 Plantillas | — | `test:http` (RBAC) | Pasa | `PRUEBAS.md` §3 |
| RF-35 Correo SMTP real | CA-09 | `test:e2e` (Mailpit) | Pasa | `CA-09.png` |
| RF-36 Salud agregada | — | `test:salud` | Pasa | `trabajo-final/arranque-en-frio-prod.txt` |
| RF-37 Swagger UI desactivable | — | `test:openapi`; en producción `/api/docs` no se sirve | Pasa | `PRUEBAS.md` §4.32 |
| RF-ASIS-01 Saludo y menú | CA-10 | `test:asistente` | Pasa | `CA-10.png` |
| RF-ASIS-02 Preguntas frecuentes | CA-10 | `test:asistente`, `test:unit` | Pasa | `CA-10.png` |
| RF-ASIS-03 Búsqueda en el chat | CA-10 | `test:asistente` | Pasa | `CA-10.png` |
| RF-ASIS-04 Precio y disponibilidad | — | `test:asistente` | Pasa | `PRUEBAS.md` §3 |
| RF-ASIS-05 Estado de mis pedidos | CA-10 | `test:asistente` (pedido ajeno → «no encontré», invariante 15) | Pasa | `CA-10-cliente.png` |
| RF-ASIS-06 Guía de cancelación | — | `test:asistente` | Pasa | `PRUEBAS.md` §3 |
| RF-ASIS-07 Escalamiento (F5c: con sesión, formulario de consulta, RF-53) | CA-23 | `test:asistente` (ticket del visitante y consulta del cliente) | Pasa | `PRUEBAS.md` §4.39 |
| RF-ASIS-08 Contexto de varios turnos | — | `test:asistente` | Pasa | `PRUEBAS.md` §3 |
| RF-ASIS-09 Frase no entendida | — | `test:asistente`, `asistente:metricas` | Pasa | `PRUEBAS.md` §3 |
| RF-ASIS-10 Tickets | — | `test:asistente` (RBAC) | Pasa | `PRUEBAS.md` §3 |
| RF-ASIS-11 Ofertas (F5b) | — | `test:unit` (`motor.test.ts`), `asistente:metricas` | Pasa | `trabajo-final/asistente-metricas.md` |
| RF-ASIS-12 Preguntas de tienda y cuenta (F5b) | — | `asistente:metricas` (conjunto SerByTek, 50/50) | Pasa | `trabajo-final/asistente-metricas.md` |
| RF-38 Eliminar la cuenta (F5b) | CA-15 | `test:seguridad` V-22 (rutas internas no alcanzables desde afuera) | Pasa | `CA-15.png` |
| RF-39 Administrar usuarios (F5b) | CA-17 | `test:openapi` (x-roles administrador) | Pasa | `CA-17.png` |
| RF-41 Dirección al pagar (F5b) | CA-14 | `test:e2e:ui` | Pasa | `CA-14.png` |
| RF-42 Cambiar la dirección del pedido (F5b) | CA-14 | `test:seguridad` V-23 (pedido ajeno → 404); tercer cambio → 409 | Pasa | `CA-14.png` |
| RF-43 Identidad SerByTek (F5b) | todas | `flutter analyze` (móvil) | Pasa | capturas de `docs/manuales/img/` |
| RF-44 Tema oscuro (F5b) | CA-16 | `usabilidad:recorrido` (axe en los dos temas) | Pasa | `CA-16.png` |
| RF-45 Mostrar contraseña (F5b) | CA-16 | — | Pasa | `CA-16.png` |
| RF-46 Sesión vencida (F5b, H-F5-02) | CA-18 | — | Pasa | `CA-18.png` |
| RF-47 Límite por cliente (F5c) | CA-22 | `test:unit` (`limites.test.ts`), `test:e2e:ui` (409 `LIMITE_POR_CLIENTE` sin tocar el stock) | Pasa | `CA-22-limite.png` |
| RF-48 Precio, oferta con fecha de fin e historial (F5c) | CA-19 | `test:unit` (`gestion.test.ts`), `test:seguridad` V-25 | Pasa | `CA-19-productos.png` |
| RF-49 Crear productos desde el panel (F5c) | CA-19, CA-20 | `test:openapi`, `test:http` C-10 | Pasa | `CA-20.png` |
| RF-50 Fotos por producto y subida (F5c) | CA-20 | `test:unit` (tipo por contenido, foto de cada producto de la semilla), `test:seguridad` V-24 | Pasa | `CA-20.png`, `services/catalogo-service/imagenes/CREDITOS.md` |
| RF-51 Entradas con proveedor (F5c) | CA-21 | `test:unit` (`proveedores.test.ts`) | Pasa | `CA-21.png` |
| RF-52 Campana de notificaciones (F5c) | CA-23 | `test:asistente` (no leídas y marcar), `test:seguridad` V-26 | Pasa | `CA-23-consulta.png` |
| RF-53 Consultas al vendedor (F5c) | CA-23 | `test:asistente` (aislamiento, cierre, correo a operaciones), `asistente:metricas` (validación 13/15), `test:seguridad` V-26 | Pasa | `CA-23-consulta.png` |
| RF-54 Recuperar la contraseña (F5d) | CA-24 | `test:seguridad` V-27 (sin enumeración, un solo uso, enlace no guardado, sesiones cerradas), `test:unit` (`secretos.test.ts`) | Pasa | `CA-24.png` |
| RF-55 Vista completa de notificaciones (F5d) | CA-25 | `test:openapi` (`pagina`, `solo_no_leidas`) | Pasa | `CA-25.png` |
| RF-56 Cerrar sesión y seguir como visitante (F5d) | CA-26 | axe F5d | Pasa | `CA-26.png` |
| RF-57 Salud del sistema solo del administrador, con medidas (F5d) | CA-27 | axe F5d | Pasa | `CA-27-salud.png` |
| RF-58 Detalle del pedido con su historial de estados (F5d) | CA-12 | `test:http` (transiciones) | Pasa | `CA-12.png` |
| RF-59 Vista previa del catálogo y nombres en inventario (F5d) | CA-27 | `test:openapi` (`skus`) | Pasa | `CA-27-vista-previa.png` |
| RF-60 El visitante inicia sesión para escribirle al vendedor (F5e) | CA-28 | `test:asistente` (sin ticket sin dueño, opción `retomar`) | Pasa | `CA-28-formulario.png` |
| RF-61 Los filtros no pasan de una cuenta a otra (F5e) | CA-29 | — | Pasa | `CA-29.png` |
| RF-62 Validación junto al campo y modo demostración del asistente (F5e) | — | `test:unit` (`clients/web/test/reglas.test.ts`: las reglas de la web = las del servicio), axe F5e | Pasa | `regresion-f5e/axe-f5e.json` |

## Requisitos no funcionales

Las cifras de rendimiento y seguridad se midieron en la Fase 4 y no se repiten en cada regresión, porque requieren el perfil de carga y unos 40 minutos. Su fuente es [`docs/calidad/MATRIZ-CALIDAD.md`](../calidad/MATRIZ-CALIDAD.md).

| Requisito | Verificación | Resultado | Evidencia |
|---|---|---|---|
| RNF-01 a RNF-04 Rendimiento | k6 (Fase 4) | Cumplen; R5 y R1 en el límite | `calidad/RENDIMIENTO.md` §9 |
| RNF-05 Estrés | k6 escalones | Cumple | `calidad/RENDIMIENTO.md` §9 |
| RNF-06 Escalado horizontal | Opcional | No medido | `calidad/RENDIMIENTO.md` |
| RNF-07, RNF-08 Degradación | Fallos inyectados | Cumplen | `calidad/RENDIMIENTO.md` §9 |
| RNF-09 Compensación | CA-06, `test:e2e` B | Cumple | `CA-06.png` |
| RNF-10 504 sin EOF | `docker pause` (Fase 4) | Cumple | `PRUEBAS.md` §4.12 |
| **RNF-11 Arranque en frío** | `down -v` y `prod:up` | **Cumple: 16/16 contenedores sanos en 276 s, sin intervención** | `trabajo-final/arranque-en-frio-prod.txt` |
| RNF-12 Sin sobreventa | `test:concurrencia` | Cumple | `PRUEBAS.md` §3 |
| RNF-13 Idempotencia | `test:e2e` D, `test:http` | Cumple | `PRUEBAS.md` §3 |
| RNF-14 Aislamiento | `test:http`, `test:asistente`, CA-10 | Cumple | `CA-10-cliente.png` |
| RNF-15 Cabeceras y tokens forjados | `test:seguridad` | Cumple | `calidad/SEGURIDAD.md` §10 |
| RNF-16 OWASP / ZAP | ZAP baseline y activo (Fase 4) | Cumple | `calidad/SEGURIDAD.md` §10 |
| RNF-17 PCI-DSS | `test:http` | Cumple | `PRUEBAS.md` §3 |
| RNF-18 Usabilidad con evaluadores | Prueba con usuarios y SUS | ⚠️ PENDIENTE: dato humano | `calidad/USABILIDAD.md` §11 |
| RNF-19 Accesibilidad | `usabilidad:recorrido` (axe) | Cumple | `calidad/USABILIDAD.md` §11 |
| RNF-20 Acierto del asistente | `test:asistente`, `asistente:metricas` (SerByTek: 50/50; primera medición 49/50) | Cumple | `calidad/MATRIZ-CALIDAD.md` |
| RNF-21 Servicio nuevo | Revisión con el checklist de `CLAUDE.md` | Cumple | `CLAUDE.md` |
| RNF-22 Documentación alineada | `test:openapi` | Cumple | `PRUEBAS.md` §3 |
| **RNF-23 Detección en CI** | `test:unit:cobertura` y GitHub Actions en cada PR | **Cumple: `.github/workflows/ci.yml`** | Pestaña *Actions* del repositorio |
