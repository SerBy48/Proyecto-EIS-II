# Guion de la defensa

Trabajo Final de la Electiva Ingeniería de Software II, Universidad Surcolombiana. Equipo: Sergio Augusto Garcia Murcia y Juan Pablo Parra Gutierrez. Entrega: 19 de noviembre de 2026.

Duración sugerida: 20 minutos de presentación y demo, más las preguntas.

---

## 1. Preparación (el día anterior y 30 minutos antes)

**El día anterior:**
- [ ] `git pull` en el equipo anfitrión, con la rama `main` ya fusionada.
- [ ] Ensayo completo con el túnel: `npm run prod:up`, luego `npm run tunel`, y abrir la URL desde un celular con datos móviles. **El túnel no se ha probado aún de punta a punta** (ADR-0009).
- [ ] Con el laboratorio (`docker compose up -d --build --wait`), `npm run test:e2e:ui`: los 29 criterios deben pasar. Con `GRABAR_VIDEO=1` quedan los videos del plan B en `docs/evidencia/trabajo-final/e2e-ui/video/`; copiarlos a una memoria USB.
- [ ] Volver a la semilla: `npm run infra:reset` (las suites dejan cuentas y pedidos de prueba).

**30 minutos antes:**
- [ ] Docker Desktop abierto y `.env` con los tres secretos **y las cuentas de producción** (`CORREO_*`, `CLAVE_*`, `NOMBRE_CLIENTE`, `APELLIDO_CLIENTE`; manual técnico, capítulo 5). Con `PROXIES_CONFIANZA=2` y la URL del túnel en `URL_WEB`, el límite de peticiones y el correo de recuperación funcionan por el túnel.
- [ ] Levantar el sistema en modo pruebas, para poder mostrar el rechazo de la pasarela: `MODO_VITE=pruebas npm run prod:up`. Toma unos 5 minutos en frío y uno con las imágenes ya construidas.
- [ ] `npm run tunel`, y anotar la URL para el jurado (por ejemplo, en un código QR).
- [ ] Pestañas abiertas:
  1. la tienda;
  2. Mailpit (`http://localhost:8025`);
  3. el repositorio en GitHub, en la pestaña *Actions*;
  4. `docs/c4/png/`;
  5. `docs/aceptacion/TRAZABILIDAD.md`.
- [ ] Dos navegadores, o una ventana normal y otra privada, para la disputa por la última unidad.

---

## 2. Estructura de la presentación (12 diapositivas)

| # | Diapositiva | Contenido | Fuente |
|---|---|---|---|
| 1 | Portada | Universidad, electiva, docente, integrantes, fecha | — |
| 2 | Problema | Tienda que vende más de lo que tiene, cobra dos veces y se cae completa si falla un componente | `especificacion/01-escenario-requisitos.md` |
| 3 | Requisitos y atributos de calidad | 62 RF, 12 del asistente y 23 RNF como escenarios medibles | ídem, §1.4 |
| 4 | Contexto y contenedores (C4) | 10 servicios, gateway y mensajería | `c4/png/01`, `02` |
| 5 | Una base de datos por servicio | PostgreSQL, MongoDB y Redis según el dato; saga en lugar de transacción distribuida | ADR-0002, ADR-0003 |
| 6 | La compra como saga | Pasos, compensaciones e idempotencia | `c4/png/04-dinamico-checkout.png` |
| 7 | Resiliencia | Circuit breaker, timeouts, reintentos solo en 5xx, DLQ y bus que reconecta | `calidad/RENDIMIENTO.md` §9 |
| 8 | Seguridad | JWT corto con refresh rotatorio, RBAC, cabeceras de confianza, PCI-DSS por ausencia del dato, OWASP 2025 | `calidad/SEGURIDAD.md` §10 |
| 9 | Asistente virtual | Reglas e IA opcional; consulta los pedidos con el token del usuario (invariante 15) | ADR-0007, `c4/png/03-componentes-asistente.png` |
| 10 | Despliegue y CI | Perfiles lab, prod y nube (Caddy con HTTPS, cuentas y correo por entorno), túnel, GitHub Actions | `c4/png/05-despliegue.png`, `06-despliegue-nube.png`, ADR-0009 y ADR-0010 |
| 11 | Validación | 29 criterios de aceptación en la interfaz, matriz de trazabilidad y cifras de calidad | `aceptacion/`, `calidad/MATRIZ-CALIDAD.md` |
| 12 | Cierre | Lo aprendido, riesgos aceptados (S-09) y trabajo futuro | `CLAUDE.md`, «Pendientes» |

---

## 3. Demo en vivo (8 minutos)

Cuentas: las de producción del `.env` (administrador, vendedor y el cliente); la del paso 3 se crea en vivo. Las cuentas de prueba con `Password123` solo existen en el laboratorio.

| Paso | Quién | Acción | Qué señalar |
|---|---|---|---|
| 1 | Visitante | Abrir la URL del túnel desde el celular de un jurado | Solo se publica la web; la API va por el mismo origen |
| 2 | Visitante | Asistente: «¿cuánto cuesta el envío?», «¿hay audífonos disponibles?» y «portátiles de menos de 3 millones» | La cifra sale de la misma configuración que el carrito; el motor de reglas entiende frases compuestas y precios, y lee las secciones del catálogo en vivo |
| 3 | Visitante | **Crear cuenta** con un correo nuevo | Sesión iniciada y dirección guardada: ya puede comprar |
| 4 | Cliente | Buscar «portátil», agregarlo, aplicar `BIENVENIDA10` y pagar | Descuento antes del IVA; el botón se bloquea contra el doble clic |
| 5 | — | Mailpit: el correo de confirmación | Llegó por un evento asíncrono (RabbitMQ) |
| 6 | Cliente | Agregar otro producto, elegir «Pago rechazado» y pagar | «No se realizó ningún cobro» y el stock vuelve (saga compensada) |
| 7 | Cuenta del paso 3 | Asistente: «estado del pedido PED-…» con el número del pedido del cliente (paso 4) | «No encontré el pedido»: el chat respeta el aislamiento |
| 8 | Cliente | **Mis pedidos → Cancelar pedido** | Reembolso y correo de cancelación al cliente (H-F5-01) |
| 8b *(opcional)* | Cliente | **Mi perfil**: «Eliminar mi cuenta» con un pedido pagado; luego el botón de la luna | Bloqueado y con el número del pedido (se anonimiza, no se borra); el tema oscuro se recuerda |
| 9 | Vendedor | Inventario: entrada de 5 unidades de `SKU-TEC-007`, con su proveedor | Alerta de reposición con el nombre del producto; el vendedor no ve la salud del sistema |
| 10 | Administrador | Salud del sistema → Pedidos → **Detalle** de la compra del paso 4 | Historial de estados con fecha y hora; la bitácora de la saga sigue en la API (`GET /api/pedidos/:id/saga`) |
| 11 *(opcional)* | Terminal | `docker stop ecom_notificaciones` y comprar otra vez | La compra se confirma; el correo espera en la cola y llega al hacer `docker start` |

---

## 4. Plan B si falla la demo

| Falla | Respuesta |
|---|---|
| El túnel no abre o la red del aula lo bloquea | Demo en `http://localhost:8081` proyectada desde el equipo anfitrión |
| Docker no levanta | Videos de `GRABAR_VIDEO=1` (un .webm por criterio) y capturas de `docs/evidencia/trabajo-final/e2e-ui/` |
| Un paso concreto falla en vivo | Mostrar su captura en `e2e-ui/CA-nn.png` y la ejecución verde más reciente del CI |
| Se agota el tiempo | Saltar a los pasos 6, 7 y 10, que son los que muestran la arquitectura |

---

## 5. Preguntas probables del jurado

**¿Por qué microservicios y no un monolito?**
- El escenario pide escalar y fallar por partes. El catálogo recibe la mayor parte del tráfico y la compra es crítica.
- Lo medimos: con inventario caído, el catálogo sigue respondiendo con el circuit breaker abierto (RNF-07).
- El costo es la complejidad: saga, consistencia eventual y más piezas que operar (ADR-0001).

**¿Por qué una saga orquestada y no coreografiada?**
- La compra tiene un orden estricto y compensaciones específicas.
- Un orquestador, `saga-checkout.ts`, deja todo el flujo en un archivo y una bitácora (`saga_pasos`) que se consulta por la API (ADR-0003).

**¿Qué pasa si se cae RabbitMQ?**
- Las compras siguen: publicar un evento nunca tumba la operación (invariante 12).
- Los servicios reconectan solos con espera exponencial y vuelven a declarar sus colas.
- Los eventos publicados mientras el broker estaba caído se pierden, porque no hay *outbox*. Es una limitación conocida; la mitigación sería el patrón *transactional outbox*.

**¿Y si falla el cobro después de reservar?**
- Se libera la reserva y se cancela el pedido.
- Si el cobro se aprobó y lo que falla es la confirmación, **no** se devuelve el dinero: se registra para resolverlo hacia adelante (invariante 6).

**¿Cómo evitan la sobreventa?**
- `reservar_stock` en PostgreSQL reserva con **una sola sentencia `UPDATE` condicional** (`… WHERE cantidad_disponible >= p_cantidad`). Dos compras simultáneas del mismo SKU se serializan sobre la fila bloqueada, y la segunda vuelve a evaluar la condición con el valor ya descontado.
- Una restricción `CHECK (cantidad_disponible >= 0)` es la última defensa.
- Con 20 compradores simultáneos por 5 unidades, ganan exactamente 5 (`test:concurrencia`).

**¿Por qué no usaron un ORM en inventario, pedidos y pagos?**
- Allí importan el bloqueo de filas, las funciones de PostgreSQL y el SQL de la saga, que el ORM ocultaría.
- En auth y clientes, que son CRUD, sí se usa Drizzle (ADR-0006). Todas las consultas son parametrizadas.

**¿Cómo protegen los datos de tarjeta?**
- No los tenemos: la base de pagos no tiene columnas de número, CVV ni vencimiento (PCI-DSS por ausencia).
- La pasarela simulada recibe un token.

**¿Puede un cliente ver los pedidos de otro, por ejemplo por el chat?**
- No. El `cliente_id` sale del JWT, nunca del cuerpo de la petición.
- El asistente consulta pedidos con el token del usuario, no como llamada interna (invariante 15).
- `test:http`, `test:asistente` y CA-10 lo verifican.

**¿Qué riesgos quedan abiertos?**
- **S-09:** el token vive en `localStorage`, mitigado con CSP. La solución sería una cookie `HttpOnly` con protección CSRF.
- **R5 y R1:** dos escenarios de rendimiento en el límite.
- **Usabilidad:** la prueba con evaluadores y el SUS (⚠️ PENDIENTE: dato humano).

**¿El asistente es una inteligencia artificial?**
- No: es un motor de reglas determinista (ADR-0007), con IA opcional apagada.
- Entiende plural, errores de tipeo y rangos de precio, y lee las secciones del catálogo en vivo: un producto nuevo se entiende sin cambiar el asistente.
- Se mide: 50/50 frases de SerByTek, escritas antes del motor nuevo (la primera medición dio 49/50 y reveló un defecto que se corrigió).

**¿Es un marketplace?**
- No: SerByTek es una sola tienda. El vendedor es personal interno; el administrador crea y desactiva sus cuentas desde «Usuarios».
- Un marketplace exigiría stock y catálogo por comerciante, pagos divididos y comisiones: otra arquitectura.

**¿Por qué un túnel y no la nube?**
- El despliegue en una VM está preparado y verificado en local: Caddy con HTTPS, cuentas y correo por entorno y límite de peticiones por persona (ADR-0010, `docs/manuales/DESPLIEGUE.md`).
- No se pudo abrir la cuenta del proveedor a tiempo (Azure no aceptó el correo institucional y Oracle rechazó la verificación de la tarjeta). Es el mismo perfil: falta solo la máquina.

**¿Cómo saben que funciona?**
- Matriz de trazabilidad: cada requisito tiene su prueba.
- El CI corre en cada PR: tipos, 187 pruebas unitarias, suites de integración y los 29 criterios de aceptación en la interfaz.
- Ver la sección 4.44 de `PRUEBAS.md`.
