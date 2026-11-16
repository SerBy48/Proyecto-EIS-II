# 1. Escenario y requisitos

Primer documento de la especificación del Trabajo Final. Consolida el problema de negocio, los actores, los requisitos funcionales y los atributos de calidad. Los requisitos funcionales salen de los routers reales (`services/*/src/index.ts`). Los atributos de calidad se escriben como escenarios medibles: son los criterios que la Fase 4 mide con k6, ZAP y las pruebas de usabilidad.

Marcas usadas:
- 🆕 requisito nuevo del Trabajo Final. Los de las Fases 2 y 3 ya están implementados: RF-35 (correo SMTP) y RF-37 (Swagger UI) en la Fase 2, y RF-ASIS-01 a 10 en la Fase 3 ([`03-asistente-virtual.md`](03-asistente-virtual.md)). RNF-11 y RNF-23 (despliegue en frío y CI) quedan para la Fase 5.
- **F5b** requisito agregado tras la prueba del equipo en la Fase 5 (tienda **SerByTek**, solo tecnología): perfil y direcciones, eliminar la cuenta, dirección del pedido, administración de usuarios, tema oscuro y asistente reforzado. Cubiertos por `test:e2e:ui` (CA-13 a CA-18), `test:http`, `test:seguridad` y `test:unit`.
- Los demás requisitos ya están implementados y cubiertos por `test:http`, `test:e2e` o `test:concurrencia`.

---

## 1.1 Problema y contexto de negocio

Una empresa de retail vende en línea con un **sistema monolítico** que tiene tres problemas (ver `README.md` y [`PREGUNTAS-ANALISIS.md`](../PREGUNTAS-ANALISIS.md), pregunta 1):

| Problema | Consecuencia | Cómo lo resuelve la arquitectura |
|---|---|---|
| **Sobreventa** por existencias desactualizadas | Se venden unidades que no hay; devoluciones y reclamos | Inventario es el único dueño del stock y reserva con descuento condicional, versión y bloqueo por SKU (`reservar_stock`) |
| **Despliegues acoplados** | Un cambio en el catálogo obliga a redesplegar los pagos | Un servicio por contexto de negocio, cada uno con su base y su ciclo de despliegue |
| **Saturación global** cuando solo crece el tráfico del catálogo | En temporada alta cae también el checkout | Servicios que escalan por separado; el catálogo degrada sin stock si inventario falla |

El sistema objetivo es una plataforma de **alta concurrencia** (meta del análisis: pasar de 5 000 a 100 000 clientes, pregunta 9), con compra segura frente a la disputa por la última unidad y sin almacenar datos de tarjeta.

## 1.2 Actores

| Actor | Tipo | Qué hace |
|---|---|---|
| **Cliente** | Persona | Se registra, busca, mantiene un carrito, compra, consulta y cancela sus pedidos. Usa la web o la app móvil |
| **Vendedor** | Persona (rol interno; personal de la tienda, no un comerciante: SerByTek es una sola tienda) | Registra entradas de stock, consulta alertas y movimientos, crea y edita productos, cambia el estado de los pedidos |
| **Administrador** | Persona (rol interno) | Todo lo del vendedor; además crea usuarios internos, edita plantillas de notificación, consulta la bitácora de la saga y compra en nombre de un cliente (venta telefónica) |
| **Pasarela de pagos** | Sistema externo | Autoriza o rechaza el cobro con un token de tarjeta. Hoy simulada (`pasarela.ts`) |
| **Servidor de correo** | Sistema externo | Entrega los correos de confirmación y avisos. 🆕 Mailpit vía SMTP (Fase 2) |
| **Asistente virtual** | Componente nuevo 🆕 | Responde preguntas frecuentes, busca productos, informa el estado de los pedidos del usuario y escala a un humano (Fase 3) |
| **Proveedor de IA** | Sistema externo opcional 🆕 | Respaldo del asistente para preguntas generales. Apagado por defecto |

## 1.3 Requisitos funcionales

La columna **Rol** usa: *pública* (sin sesión), *sesión* (cualquier usuario autenticado, con autorización por dato), o los roles explícitos.

### Autenticación y usuarios (`auth-service`)

| ID | Requisito | Endpoint | Rol |
|---|---|---|---|
| RF-01 | Registrar una cuenta de cliente vinculada a su perfil (verificando correo y `cliente_id` con clientes-service) | `POST /api/auth/registro` | pública |
| RF-02 | Iniciar sesión y recibir un JWT de 15 min y un refresh token de 7 días | `POST /api/auth/login` | pública |
| RF-03 | Renovar la sesión con rotación del refresh token (el anterior queda revocado) | `POST /api/auth/renovar` | pública |
| RF-04 | Cerrar sesión revocando el refresh token | `POST /api/auth/logout` | sesión |
| RF-05 | Consultar el perfil del usuario autenticado | `GET /api/auth/perfil` | sesión |
| RF-06 | Crear usuarios internos (vendedor, administrador) | `POST /api/auth/usuarios` | administrador |
| RF-38 F5b | Eliminar la propia cuenta confirmando la contraseña: se rechaza si hay pedidos creados, pagados, en preparación o enviados; si procede, se **anonimiza** (perfil sin datos personales ni direcciones, cuenta inactiva, sesiones revocadas) y los pedidos se conservan sin datos personales | `DELETE /api/auth/cuenta` | cliente |
| RF-39 F5b | Listar usuarios, cambiar el rol de una cuenta interna (vendedor ↔ administrador) y activarla o desactivarla, revocando sus sesiones; nadie se cambia ni se desactiva a sí mismo | `GET /api/auth/usuarios`, `PATCH /api/auth/usuarios/:id` | administrador |

### Clientes (`clientes-service`)

| ID | Requisito | Endpoint | Rol |
|---|---|---|---|
| RF-07 | Crear el perfil de cliente | `POST /api/clientes` | pública |
| RF-08 | Consultar y actualizar el propio perfil (nombre, apellido, teléfono y documento; F5b) | `GET`, `PATCH /api/clientes/:id` | sesión (solo el propio) |
| RF-09 | Gestionar direcciones de envío: agregar, editar, eliminar y elegir la predeterminada, con departamento de la lista oficial y ciudad (F5b: edición, eliminación y departamento obligatorio) | `GET`, `POST /api/clientes/:id/direcciones`, `PATCH`, `DELETE /api/clientes/:id/direcciones/:direccionId` | sesión (solo el propio) |
| RF-40 F5b | Consultar los departamentos de Colombia (lista única que usan la web y la validación) | `GET /api/clientes/departamentos` | pública |
| RF-10 | Consultar el historial de compras (alimentado por eventos) | `GET /api/clientes/:id/historial` | sesión (solo el propio) |

### Catálogo (`catalogo-service`)

| ID | Requisito | Endpoint | Rol |
|---|---|---|---|
| RF-11 | Buscar y filtrar productos (texto, categoría, subcategoría, precio, ofertas) con disponibilidad. F5b: si el índice de texto no encuentra nada, búsqueda tolerante a palabras incompletas, plural y tildes | `GET /api/catalogo/productos` | pública |
| RF-12 | Ver el detalle de un producto | `GET /api/catalogo/productos/:sku` | pública |
| RF-13 | Listar categorías con sus subcategorías, conteos y sinónimos (F5b: 1 categoría, tecnología, y 10 subcategorías) | `GET /api/catalogo/categorias` | pública |
| RF-14 | Consultar una promoción por código | `GET /api/catalogo/promociones/:codigo` | sesión |
| RF-15 | Crear y editar productos | `POST`, `PATCH /api/catalogo/productos` | administrador, vendedor |

### Inventario (`inventario-service`)

| ID | Requisito | Endpoint | Rol |
|---|---|---|---|
| RF-16 | Consultar disponibilidad y stock por SKU | `GET /api/inventario/disponibilidad`, `/stock/:sku` | sesión |
| RF-17 | Registrar entradas de stock | `POST /api/inventario/stock/:sku/entrada` | administrador, vendedor |
| RF-18 | Consultar movimientos y alertas de stock mínimo | `GET /api/inventario/movimientos/:sku`, `/alertas` | administrador, vendedor |
| RF-19 | Reservar stock con vigencia (15 min) sin sobreventa; confirmar o liberar la reserva | `/api/inventario/reservas*` | interno (saga) |
| RF-20 | Liberar automáticamente las reservas vencidas y publicar `inventario.reserva_expirada` | barrido cada 60 s | sistema |

### Carrito (`carrito-service`)

| ID | Requisito | Endpoint | Rol |
|---|---|---|---|
| RF-21 | Ver el carrito con totales (descuento antes del IVA del 19 %, envío de $15 000 gratis desde $500 000) | `GET /api/carrito/:clienteId` | sesión (solo el propio) |
| RF-22 | Agregar, cambiar la cantidad y quitar productos con el precio vigente del catálogo | `POST`, `PATCH`, `DELETE /api/carrito/:clienteId/items*` | sesión (solo el propio) |
| RF-23 | Aplicar y quitar un cupón | `POST`, `DELETE /api/carrito/:clienteId/cupon` | sesión (solo el propio) |
| RF-24 | Vaciar el carrito; expira por 7 días de inactividad | `DELETE /api/carrito/:clienteId` | sesión (solo el propio) |

### Pedidos (`pedidos-service`)

| ID | Requisito | Endpoint | Rol |
|---|---|---|---|
| RF-25 | Comprar el carrito con clave de idempotencia: saga validar → precios → reservar → crear → cobrar → confirmar, con compensación si falla | `POST /api/pedidos/checkout` | cliente; administrador y vendedor en nombre de un cliente |
| RF-26 | Listar y ver los pedidos propios (todos, para el personal interno) | `GET /api/pedidos`, `/:id` | sesión |
| RF-27 | Cancelar un pedido `creado` o `pagado` (el cliente, solo los suyos) | `POST /api/pedidos/:id/cancelar` | sesión |
| RF-28 | Cambiar el estado según las transiciones permitidas y notificar | `PATCH /api/pedidos/:id/estado` | administrador, vendedor |
| RF-29 | Consultar la bitácora de la saga de un pedido | `GET /api/pedidos/:id/saga` | administrador |
| RF-41 F5b | Elegir al pagar la dirección de envío entre las guardadas o agregar una nueva | `POST /api/pedidos/checkout` (`direccion_id`) | cliente |
| RF-42 F5b | Cambiar la dirección de envío de un pedido como máximo 2 veces, mientras esté creado, pagado o en preparación, con aviso por correo | `PATCH /api/pedidos/:id/direccion` | cliente (solo el propio) |

### Pagos (`pagos-service`)

| ID | Requisito | Endpoint | Rol |
|---|---|---|---|
| RF-30 | Cobrar de forma idempotente con un token, sin guardar número de tarjeta, CVV ni vencimiento | `POST /api/pagos/cobros` | interno (saga) |
| RF-31 | Consultar las transacciones propias | `GET /api/pagos/transacciones*` | sesión |

### Notificaciones (`notificaciones-service`)

| ID | Requisito | Endpoint | Rol |
|---|---|---|---|
| RF-32 | Notificar al cliente los eventos de su pedido y al personal las alertas de stock, sin duplicados | consumo de la cola `notificaciones.envio` | sistema |
| RF-33 | Consultar los mensajes propios | `GET /api/notificaciones/mensajes` | sesión |
| RF-34 | Editar las plantillas de notificación | `GET`, `PATCH /api/notificaciones/plantillas*` | administrador |
| RF-35 🆕 | Enviar los correos por SMTP real (Mailpit); un fallo de SMTP se reintenta y termina en la DLQ, nunca se pierde | adaptador `CanalCorreo` | sistema |

### Plataforma y documentación

| ID | Requisito | Endpoint | Rol |
|---|---|---|---|
| RF-36 | Salud agregada de todos los servicios | `GET /api/health` | pública |
| RF-37 🆕 | Documentación interactiva de la API (OpenAPI 3 + Swagger UI), desactivable en producción | `GET /api/docs` | pública si `EXPONER_DOCS=true` |

### Interfaz web (F5b)

| ID | Requisito | Dónde | Rol |
|---|---|---|---|
| RF-43 F5b | Identidad SerByTek (nombre, logotipo y paleta verde) en la web y la app móvil | `clients/web`, `clients/mobile` | pública |
| RF-44 F5b | Tema claro u oscuro, que sigue al sistema operativo y recuerda la elección | cabecera de la web | pública |
| RF-45 F5b | Mostrar u ocultar la contraseña con un botón accesible en el inicio de sesión, el registro y la eliminación de la cuenta | formularios | pública |
| RF-46 F5b | Si el servidor rechaza la sesión guardada, la web vuelve al modo visitante y lo avisa; el catálogo y el chat siguen respondiendo (H-F5-02) | `servicios/api.js` | pública |

### Asistente virtual (`asistente-service`, Fase 3) 🆕

| ID | Requisito | Rol |
|---|---|---|
| RF-ASIS-01 | Saludar, ofrecer ayuda y un menú de opciones rápidas | pública |
| RF-ASIS-02 | Responder preguntas frecuentes (envío, envío gratis, IVA, medios de pago, entrega, devoluciones, horario). Los valores numéricos salen de la configuración, nunca escritos a mano | pública |
| RF-ASIS-03 | Buscar productos por nombre, sección o rango de precio ("portátiles de menos de 3 millones", "algo barato") y mostrarlos como tarjetas con "agregar al carrito". F5b: entiende plural y errores de tipeo, y las secciones y sus sinónimos salen del catálogo en vivo (un producto o una sección nueva no exige cambiar el asistente) | pública |
| RF-ASIS-04 | Informar el precio vigente y la disponibilidad de un SKU o producto | pública |
| RF-ASIS-05 | Informar el estado de **mis** pedidos o de uno concreto, con la identidad del usuario: un pedido ajeno responde "no encontrado" | sesión |
| RF-ASIS-06 | Guiar la cancelación de un pedido según su estado | sesión |
| RF-ASIS-07 | Escalar a un humano: registrar un ticket y avisar a operaciones (evento `asistente.escalamiento`) | pública |
| RF-ASIS-08 | Mantener el contexto de varios turnos (p. ej., pedir el número de pedido y usarlo en la respuesta siguiente) | pública |
| RF-ASIS-09 | Ante una frase no entendida: con la IA activa, usarla como respaldo para preguntas generales; F5b: si no, buscar en el catálogo con las palabras del mensaje, luego sugerir las intenciones más cercanas y solo al final mostrar el menú | pública |
| RF-ASIS-10 | Consultar los tickets de escalamiento | administrador, vendedor |
| RF-ASIS-11 F5b | Mostrar las ofertas vigentes, de una sección o de todo el catálogo, con el mayor descuento primero | pública |
| RF-ASIS-12 F5b | Responder preguntas de la tienda y de la cuenta: secciones del catálogo, cupones, crear cuenta, contraseña, dirección, eliminar cuenta, seguridad de los pagos, factura y quiénes somos | pública |

## 1.4 Atributos de calidad como escenarios medibles

Cada escenario sigue la plantilla del SEI: **fuente y estímulo → entorno → respuesta → medida**. La columna **Verificación** dice qué prueba lo mide. Los umbrales de rendimiento son los mismos de k6 ([`RENDIMIENTO.md`](../calidad/RENDIMIENTO.md), sección 3.3), para que la Fase 4 los evalúe sin reinterpretarlos.

### Rendimiento

| ID | Estímulo | Entorno | Respuesta | Medida | Verificación |
|---|---|---|---|---|---|
| RNF-01 | 50 usuarios navegan y buscan en el catálogo | Carga sostenida, perfil `infra:carga` | Resultados con disponibilidad | p95 < 500 ms; errores < 1 % | k6 `catalogo-busqueda.js` |
| RNF-02 | 100 compradores concurrentes hacen checkout | Carga sostenida | Pedido `pagado` | p95 < 1 500 ms; errores < 1 % (los 402/409 de negocio no cuentan) | k6 `checkout.js` |
| RNF-03 | 50 usuarios inician sesión | Carga sostenida | JWT emitido | p95 < 1 000 ms | k6 `login.js` |
| RNF-04 | Agregar al carrito y listar mis pedidos | Carga sostenida | Respuesta correcta | p95 < 500 ms | k6 `flujo-completo.js` |

### Escalabilidad

| ID | Estímulo | Entorno | Respuesta | Medida | Verificación |
|---|---|---|---|---|---|
| RNF-05 | La carga sube por escalones de 50 a 300 VU | Estrés | El sistema degrada sin caerse; ningún servicio queda inalcanzable al terminar | 0 respuestas sin código (EOF); salud verde tras la corrida | k6 estrés + `/api/health` |
| RNF-06 | Crece solo el tráfico del catálogo | Producción | Se escala el servicio afectado sin tocar los demás | Throughput con 1 frente a N réplicas (opcional en F4) | `docker compose --scale` |

### Disponibilidad y tolerancia a fallos

| ID | Estímulo | Entorno | Respuesta | Medida | Verificación |
|---|---|---|---|---|---|
| RNF-07 | Inventario se detiene durante la carga del catálogo | Carga | El catálogo sigue respondiendo sin stock; el circuit breaker se abre y se cierra al volver | 0 errores 5xx del catálogo; recuperación < 30 s tras el arranque | F4: carga con fallo inyectado |
| RNF-08 | Notificaciones se detiene durante el checkout | Carga | Las compras siguen confirmándose; los eventos esperan en RabbitMQ | 0 compras fallidas por notificaciones; todos los eventos consumidos al volver | F4: carga con fallo inyectado |
| RNF-09 | La pasarela rechaza o falla | Normal | La saga compensa: libera el stock y cancela el pedido | Stock igual al de antes; pedido `cancelado` | `test:e2e`, `test:http` |
| RNF-10 | Un servicio dependiente no responde | Normal | El gateway responde 504 `TIEMPO_AGOTADO`, sin cortar la conexión | 504 en ≤ 15,1 s; 0 EOF | `docker pause` + curl |
| RNF-11 | Arranque en frío del despliegue completo | `down -v` y `up` | Todos los servicios quedan sanos sin intervención | 10/10 servicios sanos | `down -v` y `npm run prod:up`: 16/16 contenedores sanos en 276 s (F5, `PRUEBAS.md` 4.32) |

### Consistencia

| ID | Estímulo | Entorno | Respuesta | Medida | Verificación |
|---|---|---|---|---|---|
| RNF-12 | 20 compradores simultáneos por 5 unidades | Concurrencia | Exactamente 5 compras ganan | 0 unidades sobrevendidas | `test:concurrencia` |
| RNF-13 | El cliente repite el checkout con la misma clave (doble clic, reintento) | Normal | Una sola compra y un solo cobro | 1 pedido, 1 transacción | `test:e2e`, `test:http` |

### Seguridad

| ID | Estímulo | Entorno | Respuesta | Medida | Verificación |
|---|---|---|---|---|---|
| RNF-14 | Un cliente intenta leer datos de otro (perfil, carrito, pedido; también por el chat 🆕) | Normal | Acceso denegado | 403/404 en el 100 % de los intentos | `test:http` suite B, `test:asistente` |
| RNF-15 | Un atacante inyecta cabeceras de confianza o forja un token | Normal | Las cabeceras se descartan; el token se rechaza | 401/403; 0 escaladas | `test:seguridad` |
| RNF-16 | Escaneo automatizado del OWASP Top 10 2025 | Laboratorio | Sin vulnerabilidades altas abiertas | 0 alertas altas en ZAP; 0 respuestas 500 en el escaneo activo | `test:zap:*` |
| RNF-17 | Auditoría de la base de pagos | Cualquiera | No hay datos de tarjeta | 0 columnas de número, CVV o vencimiento | `test:http` (PCI-DSS) |

### Usabilidad

| ID | Estímulo | Entorno | Respuesta | Medida | Verificación |
|---|---|---|---|---|---|
| RNF-18 | Un usuario nuevo completa una compra | Primera visita | Termina sin ayuda externa | ≥ 90 % de las tareas completadas; SUS ≥ 68 | Prueba con evaluadores (⚠️ PENDIENTE: dato humano) |
| RNF-19 | Auditoría de accesibilidad | Web | Sin violaciones WCAG 2.2 AA graves | 0 violaciones *serious* o *critical* de axe | `usabilidad:recorrido` |
| RNF-20 🆕 | Preguntas al asistente en lenguaje natural | Frases de prueba | Intención correcta | Tasa de acierto ≥ 85 % sobre ≥ 40 frases (F5b: ≥ 90 % sobre las 50 frases de SerByTek, escritas antes del motor nuevo) | `test:asistente`, `test:unit` + matriz de confusión |

### Mantenibilidad

| ID | Estímulo | Entorno | Respuesta | Medida | Verificación |
|---|---|---|---|---|---|
| RNF-21 | Se agrega un servicio nuevo | Desarrollo | Se registra siguiendo el checklist de `CLAUDE.md` | Cambios solo en el servicio y los 5 puntos de registro | Revisión del PR de la Fase 3 |
| RNF-22 | Se cambia una ruta de la API | Desarrollo | La documentación queda desalineada y se detecta | `test:openapi` falla ante rutas sin documentar 🆕 | `test:openapi` |
| RNF-23 | Un cambio rompe un componente compartido | Desarrollo / CI | Las pruebas lo detectan antes de integrar | Cobertura de `packages/shared` medida 🆕; CI en cada PR 🆕 | `test:unit:cobertura`; GitHub Actions (`.github/workflows/ci.yml`) en cada push y PR, con `test:e2e:ui` |
