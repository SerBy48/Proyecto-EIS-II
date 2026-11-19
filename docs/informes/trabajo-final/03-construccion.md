# 3. Fase 2: construcción del núcleo

## 3.1 Tecnologías

Tabla: Tecnologías por capa

| Capa | Tecnología | Por qué |
|---|---|---|
| Servicios | Node.js 22 con TypeScript 5.6, ejecutado con `tsx` (sin compilar) | Un solo lenguaje para los diez servicios; los cambios en la librería común se reflejan sin construirla |
| HTTP y gateway | Express 4.21, `helmet`, `express-rate-limit`, `http-proxy-middleware` | Middleware maduro; proxy con *keep-alive* y tiempos máximos |
| PostgreSQL | Drizzle ORM 0.45 (auth, clientes) y `pg` con SQL nativo (inventario, pedidos, pagos) | ORM donde aporta; SQL donde está la concurrencia (ADR-0006) |
| MongoDB y Redis | Driver oficial de MongoDB 6.10 e `ioredis` 5.4 | Catálogo, notificaciones y asistente; carrito con vigencia |
| Mensajería | RabbitMQ 3.13 con `amqplib` | Eventos con cola de mensajes fallidos |
| Seguridad | `jsonwebtoken` (HS256) y `bcryptjs` en un pool de hilos | Contraseñas con bcrypt sin bloquear el hilo principal |
| Correo | `nodemailer` 10.2 | SMTP: Mailpit en el laboratorio, Gmail en producción |
| Clientes | React 18.3, Vite 5.4 y Tailwind servidos por nginx; Flutter 3 | Tienda, panel de administración y chat; app móvil |
| Documentación de la API | OpenAPI 3 con Swagger UI | Especificación centralizada en el gateway (ADR-0008) |
| Pruebas | Vitest 4.1, Playwright 1.48, k6, OWASP ZAP, axe-core | Unitarias, E2E de interfaz, carga, seguridad y accesibilidad |

El repositorio es un monorepo con npm workspaces:
- `packages/shared`: la librería común de los diez servicios;
- `services/`: el gateway y los nueve microservicios;
- `clients/`: la web y la app móvil;
- `infra/`: los esquemas de las bases;
- `tests/`: las suites de integración;
- `docs/`: toda la documentación.

## 3.2 Patrones de código

- **Librería transversal** (`packages/shared`): el arranque común de cada servicio (`crearServicio()`), los errores tipados y su traducción uniforme, el JWT y el control por rol, el cliente HTTP con tiempo máximo, reintentos y circuit breaker, y el bus de eventos.
- **Repositorio:** el acceso a datos de auth y clientes pasa por `repositorio.ts` con Drizzle; el resto del código no conoce la base.
- **Adaptador:** la pasarela de pagos (`pasarela.ts`), el canal de correo (`canales.ts`) y el proveedor de IA del asistente (`ia.ts`) se reemplazan sin tocar el resto del servicio.
- **Middleware:** `asincrono()` envuelve cada controlador para que una promesa rechazada llegue al manejador de errores; `requiereRol()` aplica el control de acceso en cada ruta.
- **Invariantes explícitas:** 18 reglas documentadas en `CLAUDE.md` (por ejemplo, «el `cliente_id` sale siempre del JWT» o «nunca compensar hacia atrás un pago aprobado»), cada una con su prueba.

## 3.3 Persistencia: ORM y SQL nativo

La decisión (ADR-0006) fue un **ORM parcial**:
- **Drizzle en auth y clientes**, donde las operaciones son CRUD con validaciones y el ORM aporta tipos y legibilidad.
- **SQL nativo parametrizado en inventario, pedidos y pagos**, donde está la concurrencia y el control fino importa más que la comodidad. La reserva de stock es una función de PostgreSQL (`reservar_stock`) con descuento condicional, número de versión y bloqueo por SKU.

El esquema lo definen solo los scripts de `infra/postgres`, que se ejecutan en orden al crear el volumen; cada servicio tiene su base y su usuario, y no puede leer las de los demás. Una prueba unitaria compara el esquema de Drizzle con los scripts SQL. La medición mostró que el ORM no empeoró el login: su p95 pasó de 1 280 a 981 ms, porque bcrypt domina el costo.

## 3.4 Seguridad de las sesiones

- **JWT de 15 minutos y refresh token rotatorio de 7 días** (ADR-0005). Cada renovación revoca el anterior, así que un refresh robado y reutilizado se detecta.
- **Autorización a nivel de dato:** el `cliente_id` sale del token y nunca del cuerpo de la petición, así que un cliente solo ve lo suyo.
- **Llamadas internas:** exigen el secreto compartido **y** la cabecera `x-llamada-interna`. El gateway envía solo la primera, así que el tráfico de un usuario nunca pasa por interno.
- **Secretos obligatorios:** sin `JWT_SECRET`, `JWT_REFRESH_SECRET` e `INTERNAL_TOKEN` de 32 caracteres o más, ningún servicio arranca. Antes había un valor de respaldo publicado con el que se forjaba un token de administrador (hallazgo S-02).
- **Recuperación de contraseña:** enlace de un solo uso que vence en 30 minutos; auth guarda solo su hash y notificaciones lo envía sin guardarlo.

## 3.5 Integraciones externas

**Pasarela de pagos.** pagos-service cobra con un *token* de tarjeta, nunca con el número: `pagos_db` no tiene columnas de número, CVV ni vencimiento (PCI-DSS por ausencia del dato). La pasarela simulada responde de forma determinista según el token, para poder probar los cuatro desenlaces. Reemplazarla por una real (Wompi o Stripe) solo cambia `pasarela.ts`.

Tabla: Tokens de la pasarela simulada

| Token | Resultado | Qué prueba |
|---|---|---|
| `tok_ok_*` | Aprobado | La compra feliz |
| `tok_rechazo_*` | Rechazado por fondos insuficientes | La compensación: se liberan las reservas y no se cobra |
| `tok_error_*` | Error técnico (502) | El cobro no se reintenta y la saga compensa |
| `tok_lento_*` | Aprobado tras 5 segundos | Los tiempos máximos de cada dependencia |

**Correo.** notificaciones-service consume los eventos de RabbitMQ, elige la plantilla y envía por SMTP. Si el envío falla, el mensaje se reintenta en su cola y, al tercer intento, pasa a la cola de mensajes fallidos: nunca se pierde.

## 3.6 Documentación de la API

La especificación OpenAPI 3 está dividida por servicio en `docs/openapi/`:
- `npm run docs:openapi` la valida con Redocly y la empaqueta para el gateway, que la sirve con Swagger UI en `/api/docs` (apagada en producción).
- `npm run test:openapi` la compara con las rutas reales del código: **86 rutas y 517 comprobaciones**. Una ruta sin documentar, o con un rol distinto del que exige el código, hace fallar la prueba.

![Swagger UI servido por el gateway en /api/docs](../../evidencia/trabajo-final/swagger-ui.png)

## 3.7 Pruebas unitarias

**187 pruebas unitarias** en 18 archivos, con Vitest (`npm run test:unit`), sin Docker ni servicios en marcha. Cubren:
- la saga y sus compensaciones;
- el circuit breaker, incluido el estado semiabierto;
- el bus de eventos y su reconexión;
- los totales del carrito;
- el motor del asistente y la búsqueda tolerante;
- el límite de compra por cliente;
- la coherencia de la semilla y del esquema;
- los proxies de confianza;
- que las validaciones de la web sean las del servidor.

La cobertura de la librería común y de los módulos de cálculo medidos es de **75,7 % de líneas, 70,2 % de funciones y 65,5 % de ramas**. La lógica que coordina servicios se verifica además con las suites de integración del capítulo 6.
