# Manual técnico

**Plataforma de comercio electrónico con microservicios.** Trabajo Final de la Electiva Ingeniería de Software II, Universidad Surcolombiana.

Este manual está dirigido a quien instala, opera, prueba o extiende el sistema. Para el diseño, ver la [especificación de arquitectura](../especificacion/02-especificacion-arquitectura.md), los [diagramas C4](../c4/README.md) y los [ADR](../adr/README.md). Las reglas de trabajo del repositorio y sus invariantes están en [`CLAUDE.md`](../../CLAUDE.md).

---

## 1. Componentes

| Componente | Tecnología | Puerto (laboratorio) | Datos |
|---|---|---|---|
| web | React 18, Vite y Tailwind, servida por nginx | 8081 (5173 con `dev:web`) | — |
| api-gateway | Node 22, Express y http-proxy-middleware | 8080 | — |
| auth-service | Node 22 y Drizzle | 3001 | PostgreSQL `auth_db` |
| clientes-service | Node 22 y Drizzle | 3002 | PostgreSQL `clientes_db` |
| catalogo-service | Node 22 | 3003 | MongoDB `catalogo_db` |
| inventario-service | Node 22, SQL nativo | 3004 | PostgreSQL `inventario_db` |
| carrito-service | Node 22 | 3005 | Redis |
| pedidos-service | Node 22, SQL nativo (saga) | 3006 | PostgreSQL `pedidos_db` |
| pagos-service | Node 22, SQL nativo | 3007 | PostgreSQL `pagos_db` |
| notificaciones-service | Node 22 | 3008 | MongoDB `notificaciones_db` |
| asistente-service | Node 22 | 3009 | MongoDB `asistente_db` |
| RabbitMQ | 3.13-management | 5672 / 15672 | eventos y DLQ |
| Mailpit | v1.27 | 8025 / 1025 | correos de prueba |
| App móvil | Flutter (`clients/mobile/`) | — | — |

Todos los servicios se ejecutan con `tsx` directamente sobre TypeScript: no hay paso de compilación. `@ecommerce/shared` (`packages/shared/`) agrupa el arranque común, JWT y RBAC, el cliente HTTP con circuit breaker, el bus de eventos y los errores.

---

### Estructura del repositorio

```
packages/shared/        libreria comun de los diez servicios
services/               api-gateway y los 9 microservicios (incluido el asistente)
clients/web/            React + Vite + Tailwind; Dockerfile y nginx.conf
clients/mobile/         Flutter (lib/ y pubspec.yaml)
infra/                  esquemas de PostgreSQL, inicio de Mongo, Dockerfile de los servicios
tests/                  salud, http, concurrencia, e2e, e2e-ui, asistente, seguridad, rendimiento (k6)
scripts/                tunel, capturas, sembrado de carga, informes
docs/                   especificacion, c4, adr, openapi, calidad, aceptacion, manuales, evidencia
.github/workflows/      CI
```

## 2. Requisitos del equipo

- Docker Desktop o Docker Engine con Compose v2.24 o superior (el perfil de producción usa `!reset`).
- Node.js 22.9 o superior (`--env-file-if-exists`) y npm 10.
- Unos 6 GB de RAM libres para el sistema completo.
- Para el túnel: solo Docker; cloudflared corre en un contenedor.
- Para la app móvil: Flutter 3.

---

## 3. Instalación

```bash
git clone <repositorio> && cd <repositorio>
npm install                       # todos los workspaces
cp .env.example .env
```

Llene en `.env` los tres secretos **obligatorios**, cada uno con un valor nuevo:

```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # JWT_REFRESH_SECRET
openssl rand -hex 32   # INTERNAL_TOKEN
```

Sin ellos, con menos de 32 caracteres o con un valor publicado, **ningún servicio arranca** (`verificarSecretos()`, invariante 13). Si ya hay un PostgreSQL local en 5432, use `POSTGRES_PUERTO_HOST=5434`.

---

## 4. Formas de ejecutar el sistema

### 4.1 Desarrollo: servicios en el host y recarga en caliente

```bash
npm run infra:up       # PostgreSQL, MongoDB, Redis, RabbitMQ y Mailpit en Docker
npm run dev            # los diez servicios con recarga (o dev:pedidos, dev:catalogo…)
npm run dev:web        # web en http://localhost:5173
```

### 4.2 Laboratorio: todo en contenedores, con puertos publicados

```bash
docker compose up -d --build --wait
```

- La web queda en `http://localhost:8081`, compilada en modo *pruebas*.
- El gateway queda en `http://localhost:8080`, con Swagger UI en `/api/docs`.
- Los servicios publican puertos en `127.0.0.1`.

Es el perfil que usan el CI y las suites de pruebas.

### 4.3 Producción: perfil `prod`

```bash
npm run prod:up        # docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --wait
npm run prod:logs      # registros en JSON
npm run prod:down
```

Diferencias con el laboratorio (`docker-compose.prod.yml`):

| Aspecto | Producción |
|---|---|
| Puertos publicados | **Solo la web** (`WEB_PUERTO`, 8081). El gateway, los servicios y los motores quedan en la red interna; la interfaz de Mailpit, solo en `127.0.0.1:8025` |
| API | Por el proxy `/api` de nginx, en el mismo origen que la web |
| Servicios | `NODE_ENV=production`, `LOG_FORMATO=json`, `EXPONER_DOCS=false` |
| Recursos | Límites de CPU y memoria por contenedor (auth tiene 2 CPU por bcrypt) |
| Web | Compilada en modo `production`: sin el selector de la pasarela simulada |

Para ejecutar `test:e2e:ui` contra este perfil, compile la web en modo pruebas:

```bash
MODO_VITE=pruebas npm run prod:up
```

**Arranque en frío (RNF-11).** Se probó con `docker compose down -v` y luego `npm run prod:up`: los 16 contenedores quedaron sanos en 276 s, compilando las imágenes y sin intervención (`docs/evidencia/trabajo-final/arranque-en-frio-prod.txt`). Los servicios toleran que RabbitMQ tarde, por tres mecanismos:
- el bus reintenta con espera exponencial;
- al reconectar, vuelve a declarar sus consumidores;
- si un servicio falla al iniciar, termina el proceso y Docker lo reinicia.

### 4.4 Publicación temporal con túnel (defensa)

```bash
npm run prod:up
npm run tunel          # imprime https://<palabras>.trycloudflare.com
```

- `scripts/tunel.sh` corre `cloudflare/cloudflared` dentro de la red de Compose, apuntando a `web:8080`.
- La URL cambia en cada ejecución y deja de existir con Ctrl+C.
- No hay que tocar CORS: nginx quita la cabecera `Origin` cuando coincide con el `Host` de la petición (mismo origen), y deja que el gateway rechace los orígenes ajenos.

> Mientras el túnel está abierto, cualquiera con la URL puede entrar con las cuentas de prueba. Ábralo solo durante la demostración.

Alternativa con ngrok: `ngrok http 8081`, con su cuenta y su token.

---

## 5. Variables de entorno

La lista completa y comentada está en [`.env.example`](../../.env.example). Las principales:

| Variable | Para qué | Valor por defecto |
|---|---|---|
| `JWT_SECRET`, `JWT_REFRESH_SECRET`, `INTERNAL_TOKEN` | Firmas y autenticación entre servicios | **ninguno: obligatorios** |
| `POSTGRES_PUERTO_HOST` | Puerto de PostgreSQL en el host | 5432 |
| `WEB_PUERTO` | Puerto de la web en contenedor | 8081 |
| `MODO_VITE` | `pruebas` o `production` | pruebas (lab) / production (prod) |
| `CORS_ORIGENES` | Orígenes permitidos (laboratorio) | 5173, 4173 y 8081 |
| `CORS_ORIGENES_PROD` | Orígenes permitidos (producción) | `http://localhost:${WEB_PUERTO}` |
| `EXPONER_DOCS` | Swagger UI en `/api/docs` | true (prod: false) |
| `LIMITE_GENERAL`, `LIMITE_LOGIN`, `LIMITE_CHECKOUT`, `LIMITE_ASISTENTE` | Límites de peticiones por minuto en el gateway | 300, 10, 10, 30 |
| `PROXY_TIMEOUT_MS` | Tiempo máximo del gateway antes de responder 504 | 15000 |
| `HTTP_TIMEOUT_MS`, `HTTP_REINTENTOS` | Cliente HTTP entre servicios | 3000, 2 |
| `CB_UMBRAL_FALLOS`, `CB_ESPERA_MS` | Circuit breaker | 5, 15000 |
| `PORCENTAJE_IVA`, `COSTO_ENVIO_BASE`, `UMBRAL_ENVIO_GRATIS` | Reglas del carrito (y respuestas del asistente) | 19, 15000, 500000 |
| `MINUTOS_RESERVA` | Vigencia de una reserva de stock | 15 |
| `STOCK_RESERVA_CLIENTE` | Unidades que cada cliente debe dejar para los demás (límite por cliente, RF-47; mínimo 1 por cliente). La leen inventario y pedidos | 5 |
| `CANAL_CORREO`, `SMTP_*` | `smtp` (Mailpit o un proveedor real) o `registro` | smtp |
| `ASISTENTE_IA`, `ANTHROPIC_API_KEY` | IA opcional del asistente (`desactivada` o `anthropic`) | desactivada |

Los archivos `.env.carga` (`npm run infra:carga`) suben los límites del gateway para las pruebas de rendimiento.

---

### 5.1 Rotación de secretos

1. Genere valores nuevos con `openssl rand -hex 32` y reemplácelos en `.env`.
2. Recree los servicios con `npm run prod:up` (o `docker compose up -d`).

Al cambiar `JWT_SECRET` o `JWT_REFRESH_SECRET`, todas las sesiones abiertas dejan de valer y los usuarios deben volver a iniciar sesión. `INTERNAL_TOKEN` debe ser el mismo en todos los servicios: `.env` lo garantiza.

---

## 6. API

- La especificación OpenAPI 3 está en `docs/openapi/`, dividida por servicio; las rutas internas de la saga están en `openapi-interna.yaml`.
- `npm run docs:openapi` la valida y la empaqueta para el gateway, que la sirve con Swagger UI en `http://localhost:8080/api/docs` (laboratorio; en producción, `EXPONER_DOCS=false`).
- `docs/api.http` tiene ejemplos para la extensión REST Client.

---

## 7. Asistente virtual

| Qué | Dónde | Cómo cambiarlo |
|---|---|---|
| Intenciones (términos, prioridad) | `services/asistente-service/src/datos/intenciones.json` | Al arrancar se agregan las nuevas y se actualizan las que el administrador no editó; `PATCH /api/asistente/intenciones/:clave` (administrador, sin desplegar) las marca como editadas y desde entonces se respetan |
| Preguntas frecuentes | `src/datos/faq.json` | Igual, con las rutas de FAQ del asistente |
| Productos y secciones | Catálogo: `infra/mongo/init-mongo.js` (subcategorías con `sinonimos`) o la pestaña **Productos** del panel (`POST /api/catalogo/productos` con `subcategoria`) | Cada producto de la semilla tiene su foto en `services/catalogo-service/imagenes/` (`sku-tec-NNN.webp`, créditos en `CREDITOS.md`); un producto nuevo usa la foto de su sección (`<seccion>.webp`) hasta que se le suba una desde el panel (GridFS en `catalogo_db`, bucket `imagenes`). Una sección nueva necesita su foto de respaldo. **No se toca el asistente**: lee las secciones, los sinónimos y las marcas de `GET /api/catalogo/categorias` cada minuto y busca los productos en vivo |
| Cifras (envío, IVA, plazos) | `.env` (`COSTO_ENVIO_BASE`, `DIAS_ENTREGA`…) | Son las mismas que usa el carrito |
| Tickets de escalamiento | `GET /api/asistente/tickets` | administrador y vendedor |
| Consultas al vendedor (RF-53) | `/api/asistente/consultas*`, colección `tickets` con `tipo: consulta` | El cliente las crea desde el formulario del chat; el personal responde en la pestaña Consultas. Cada mensaje publica `asistente.consulta_*`; notificaciones crea sus plantillas al arrancar si faltan |
| Tasa de acierto | `npm run asistente:metricas` | matriz de confusión; las cifras que se reportan son las de los conjuntos de SerByTek (`frases-serbytek.json`, 50 frases), de marcas (`frases-marcas.json`, 27) y la validación de contactar al vendedor (`frases-consultas.json`, 15), que no se usan para ajustar |
| IA opcional | `ASISTENTE_IA=anthropic` y `ANTHROPIC_API_KEY` | Solo para preguntas generales; nunca recibe datos personales |

Los términos van sin tildes y en minúsculas, porque el motor normaliza el texto. Un término terminado en `*` coincide por prefijo. El motor acepta el plural y un error de tipeo (solo en palabras que no conoce), y reconoce rangos de precio, «barato» y «oferta». Si no reconoce la intención, busca en el catálogo con las palabras del mensaje y luego sugiere las intenciones más cercanas.

---

## 8. Pruebas

| Comando | Qué verifica | Requiere |
|---|---|---|
| `npm run typecheck` | Tipos de todos los paquetes | — |
| `npm run test:unit` (`:cobertura`) | 135 pruebas unitarias con Vitest: saga, circuit breaker, bus, totales, asistente, búsqueda del catálogo y coherencia de la semilla… | — |
| `npm run test:openapi` | La especificación cubre exactamente las rutas del código y sus `x-roles` | — |
| `npm run test:salud` | Los diez servicios responden | laboratorio |
| `npm run test:http` | 73 casos: auth, RBAC, aislamiento, idempotencia, pasarela, PCI-DSS (**borra los pedidos**) | laboratorio |
| `npm run test:concurrencia` | 20 compradores por 5 unidades: exactamente 5 ganan | laboratorio |
| `npm run test:e2e` | Flujo de compra completo por la API, con el correo en Mailpit | laboratorio |
| `npm run test:asistente` | 46 comprobaciones del asistente, incluido el aislamiento por chat | laboratorio |
| `npm run test:seguridad` | 23 verificaciones de seguridad | laboratorio |
| `npm run test:e2e:ui` | **18 criterios de aceptación en la web** (Playwright), con capturas | web en modo pruebas (8081) |
| `npx tsx tests/usabilidad/axe-tema-oscuro.ts` | axe (WCAG 2.2 AA) en 7 pantallas con el tema oscuro | web (8081) |
| `npm run usabilidad:recorrido` | 9 tareas, KLM y axe (WCAG 2.2 AA) | `build:web:pruebas` y `vite preview` |
| k6 (`tests/rendimiento/`) | Carga, estrés y fallos inyectados | `infra:carga` |

- Los criterios de aceptación están en [`docs/aceptacion/CRITERIOS.md`](../aceptacion/CRITERIOS.md) y su relación con los requisitos, en la [matriz de trazabilidad](../aceptacion/TRAZABILIDAD.md).
- La evidencia de cada ejecución de `test:e2e:ui` queda en `docs/evidencia/trabajo-final/e2e-ui/`: una captura por criterio, `resultados.json` y una traza de Playwright por cada fallo (se abre con `npx playwright show-trace <archivo>`).

---

## 9. Integración continua

`.github/workflows/ci.yml` tiene tres trabajos:

1. **`estatico`** (cada push y PR): typecheck, pruebas unitarias con cobertura, OpenAPI y su lint, `npm audit` de las dependencias de producción y compilación de la web.
2. **`integracion`** (cada push y PR):
   - genera secretos propios en cada ejecución;
   - levanta el sistema con `docker compose up --build --wait`;
   - ejecuta salud, `http`, concurrencia, `e2e`, asistente, seguridad y `e2e:ui`;
   - sube las capturas y, si algo falla, los registros de los contenedores.
3. **`no-funcionales`** (manual, desde *Run workflow*): humo de k6 y baseline de ZAP.

---

## 10. Operación

### 10.1 Salud y registros

- `GET /api/health` agrega la salud de los diez servicios y sus dependencias. También se ve en la web: **Administración → Salud del sistema**.
- Cada petición lleva un `request_id`, que el gateway propaga a todos los servicios. Para seguir una petición:

```bash
npm run prod:logs | grep <request_id>
```

### 10.2 Eventos y dead letter queue

- Los eventos viajan por el exchange `ecommerce.eventos`.
- Si un consumidor falla, por ejemplo con el SMTP caído, el mensaje se reintenta en su propia cola. Al tercer intento pasa a `<cola>.fallidos`, sin perderse.
- Ver las colas: consola de RabbitMQ en `http://localhost:15672` (solo en el laboratorio).

### 10.3 Datos

| Tarea | Cómo |
|---|---|
| Esquemas de PostgreSQL | `infra/postgres/*.sql`, en orden alfabético y solo al crear el volumen |
| Cambiar un esquema | Edite el SQL y el `esquema.ts` del servicio, y luego `npm run infra:reset` (borra los volúmenes) |
| Datos iniciales de Mongo, plantillas de correo incluidas | `infra/mongo/init-mongo.js`, solo con volumen nuevo |
| Cambiar una plantilla en un volumen existente | `PATCH /api/notificaciones/plantillas/:clave` como administrador |
| Fotos subidas desde el panel | GridFS de `catalogo_db` (`imagenes.files` e `imagenes.chunks`); se borran con el volumen de Mongo. Las de la semilla están en el repositorio |
| Proveedores y entradas de mercancía | Tablas `proveedores` y `entradas` de `inventario_db` (`03-inventario.sql`; tres proveedores ficticios en `06-datos-prueba.sql`) |
| Historial de precios | Colección `historial_precios` de `catalogo_db` |
| Base del asistente en un volumen anterior a la Fase 3 | `npm run infra:asistente` |
| Datos para pruebas de carga | `CLIENTES_CARGA=300 npm run sembrar:carga` |

### 10.4 Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| Compose se niega a arrancar, o los servicios registran «Configuracion insegura: …» | Falta un secreto en `.env`, es corto o es un valor publicado | Genérelo con `openssl rand -hex 32` |
| `port is already allocated` en 5432 | PostgreSQL local | `POSTGRES_PUERTO_HOST=5434` |
| La web muestra «Origen no permitido por la politica de CORS» | Se abrió desde un origen que no está en `CORS_ORIGENES` (laboratorio, `vite dev` o `preview`) | Agréguelo a `CORS_ORIGENES`; la web en contenedor no lo necesita |
| Las compras se confirman pero no llegan correos | notificaciones o Mailpit caídos; los eventos esperan en la cola | Reinicie el contenedor; los mensajes pendientes se procesan solos |
| Respuestas 504 `TIEMPO_AGOTADO` | Un servicio no responde en 15 s | `docker compose ps` y los registros de ese servicio |
| Respuestas 429 | Límite de peticiones del gateway | Espere un minuto; para carga, `npm run infra:carga` |
| `test:e2e:ui` falla en CA-06 | La web está compilada en modo `production` | `MODO_VITE=pruebas` al levantarla |

---

## 11. Extender el sistema

**Un servicio nuevo:**
1. Copie la estructura de uno existente: `package.json` con `@ecommerce/shared`, un `tsconfig.json` que extienda `tsconfig.base.json`, y un `src/index.ts` con `crearServicio()`.
2. Regístrelo en `DESTINOS` del gateway, en `docker-compose.yml` (y con `ports: !reset []` en `docker-compose.prod.yml`) y en los scripts `dev:*`.

**Una ruta nueva:**
1. Monte el controlador con `asincrono()` y use los constructores de error de `shared/src/errores.ts`.
2. Documéntela en `docs/openapi/` con su `x-roles`. Si no, `test:openapi` falla.

**Respete siempre las 15 invariantes de `CLAUDE.md`.** Por ejemplo:
- el `cliente_id` sale del JWT;
- el precio lo pone el catálogo;
- la clave de idempotencia es obligatoria en las operaciones internas;
- un pago aprobado nunca se compensa hacia atrás.
