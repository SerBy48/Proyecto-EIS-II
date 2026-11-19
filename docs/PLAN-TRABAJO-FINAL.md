# Plan de ejecución — Trabajo Final Ingeniería de Software II

> **Para Claude Code.** Este plan aplica la *"Propuesta de proyecto final: Arquitectura e
> implementación de una plataforma distribuida inteligente"* al repositorio
> `SerBy48/Proyecto-EIS-II`. Léelo completo antes de empezar y lee también `CLAUDE.md`,
> `README.md`, `PLAN.md` y `docs/*.md`. Las convenciones e invariantes de `CLAUDE.md`
> mandan sobre este documento.

---

## 0. Contexto y reglas de trabajo

### 0.1 Las cinco fases del documento y lo que hay hoy

| Fase | Exige | Estado actual en el repo | Brecha que hay que cerrar |
|---|---|---|---|
| **1. Análisis y diseño arquitectónico** | Escenario real; **modelo C4**; descomposición en servicios; REST / colas; estrategia de persistencia. Entregable: documento de especificación y diagramas de componentes | E-commerce de alta concurrencia ya elegido. `docs/ARQUITECTURA.md`, `COMUNICACION.md` y `FLUJO-COMPRA.md` con diagramas ASCII | **No hay C4.** No hay ADR (registros de decisiones). Falta un documento de especificación unificado |
| **2. Construcción del núcleo** | Patrones limpios, **ORM**, **JWT**, integración externa (pago o notificaciones). Entregable: MVP, **Swagger/OpenAPI** y scripts de BD | MVP completo y probado (142 casos). JWT con refresh rotatorio. Pasarela simulada. Scripts SQL en `infra/postgres` | **No hay OpenAPI.** **No se usa ORM** (driver `pg` y `mongodb` directos). Las notificaciones solo se guardan en Mongo, sin envío real. No hay pruebas unitarias |
| **3. Automatización conversacional** | Chatbot de reglas o IA básica, integrado en la UI y conectado al backend | **No existe** | Todo: servicio, UI y pruebas |
| **4. Calidad no funcional** | Rendimiento (JMeter/k6), seguridad (OWASP Top 10), usabilidad. Entregable: informe con métricas, gráficas y plan de mitigación | Pruebas funcionales y de integración. Nada no funcional | Todo; **se reutiliza el plan `PLAN-ESTRATEGIAS-VALIDACION.md`** |
| **5. Despliegue y validación final** | Docker/Compose completo, entorno de pruebas o nube, E2E de aceptación. Entregables: software desplegado, manual técnico, manual de usuario y defensa | Compose con infraestructura y 9 servicios. E2E a nivel de API (`tests/e2e-compra.ts`) | **La web no está contenerizada.** No hay perfil de despliegue. No hay E2E de interfaz. No hay manuales. No hay CI |

### 0.2 Reglas para Claude Code

1. **Ramas:** una por fase (`feature/f1-c4-especificacion`, `feature/f2-nucleo`, `feature/f3-asistente`, `feature/f4-calidad`, `feature/f5-despliegue`), cada una integrada a `main` al cerrar la fase. Haz commits pequeños, en español.
2. **Convenciones (`CLAUDE.md`):**
   - Español sin tildes en los identificadores.
   - Controladores envueltos en `asincrono()`.
   - Errores con los constructores de `shared/src/errores.ts`.
   - Un servicio nuevo se crea copiando la estructura de uno existente y se registra en `DESTINOS`, `docker-compose.yml`, los scripts `dev:*` **y en `infra/Dockerfile.servicio`**, que copia el `package.json` de cada servicio de forma explícita.
3. **Invariantes:** ninguna de las 12 se rompe. Las que más afectan aquí:
   - n.º 1: `cliente_id` sale del JWT. Aplica al chatbot.
   - n.º 3: inventario es el único dueño del stock. Aplica al ORM.
   - n.º 8: SQL parametrizado.
   - n.º 11: `esLlamadaInterna` exige dos condiciones. Aplica al chatbot.
4. **Regresión al cerrar cada fase:** `npm run typecheck`, `build:web`, `test:salud`, `test:http`, `test:concurrencia`, `test:e2e`, más las suites nuevas. Si algo existente se rompe, la fase no está cerrada.
5. **Decisiones marcadas con 🔶:** requieren confirmación del usuario antes de implementarse. El plan trae una recomendación por defecto. Si el usuario no responde, aplica la recomendación y déjalo anotado en el ADR correspondiente.
6. **No inventar resultados ni datos humanos** (usabilidad, defensa). Usa el marcador `⚠️ PENDIENTE`.

### 0.3 Orden recomendado

```
F1 (diseño, incluye el chatbot ya modelado) → F2 → F3 → F4 → F5 → informe .docx
```

F4 va **después** de F2 y F3 para auditar la versión final, que incluye el chatbot y los cambios del núcleo.

Si el trabajo de *Estrategias de validación* ya se ejecutó antes, en F4 **se re-ejecutan** sus scripts (k6, ZAP, SUS) sobre la nueva versión y se amplía el alcance; no se rehacen.

---

## FASE 1 — Análisis y diseño arquitectónico (modelo C4)

### Paso 1.1 — Escenario y requisitos

**Cómo se aborda:** el escenario ya está definido: e-commerce de retail de alta concurrencia que migra desde un monolito con sobreventa, despliegues acoplados y saturación por tráfico del catálogo. Consolídalo en `docs/especificacion/01-escenario-requisitos.md`, que incluye:

- **Problema y contexto de negocio**, tomado del README y de `docs/PREGUNTAS-ANALISIS.md`.
- **Actores**: cliente, vendedor, administrador, pasarela de pago, servidor de correo y, nuevo, el asistente virtual.
- **Requisitos funcionales** numerados (RF-01…), extraídos de los routers reales de los servicios. Incluye los nuevos del chatbot (RF-ASIS-xx) y de las notificaciones reales.
- **Atributos de calidad** (RNF-01…), escritos como **escenarios de calidad medibles**: estímulo, entorno, respuesta y medida. Por ejemplo: *"con 100 compradores concurrentes, el p95 del checkout < 1,5 s"*.
  - Cubren disponibilidad, rendimiento, escalabilidad, seguridad, tolerancia a fallos, usabilidad y mantenibilidad.
  - **Estos escenarios son los criterios que la Fase 4 mide**: tienen que ser coherentes con los umbrales de k6.

### Paso 1.2 — Modelo C4

**Decisión de herramienta: C4-PlantUML** (macros oficiales `C4_Context`, `C4_Container`, `C4_Component`, `C4_Dynamic`, `C4_Deployment`).

- Es texto versionable y el formato C4 más maduro.
- Exporta PNG/SVG para el `.docx`.
- **Incluye las librerías C4 copiadas en `docs/c4/lib/`**, en lugar de cargarlas desde una URL remota: la red puede estar restringida y la versión queda fija.
- Para renderizar: `plantuml` (requiere Java + Graphviz) o la imagen Docker `plantuml/plantuml`.
- Script: `npm run docs:c4` → genera `docs/c4/png/*.png`.

Alternativa aceptable si PlantUML no funciona en la máquina: Structurizr DSL con exportación de Structurizr Lite. Documenta cuál se usó.

**Diagramas, extraídos del código real** (puertos, bases, colas y rutas). Usa `docker-compose.yml`, `DESTINOS` del gateway, `bus-eventos.ts` y los `db.ts`:

| Nivel | Archivo | Contenido |
|---|---|---|
| **N1 Contexto** | `c4/01-contexto.puml` | Sistema "Plataforma e-commerce"; actores cliente, vendedor y admin; sistemas externos: pasarela de pago, servidor de correo y, opcional, proveedor de IA |
| **N2 Contenedores** | `c4/02-contenedores.puml` | Web (React/nginx), móvil (Flutter), API Gateway, los 8 microservicios + **asistente-service**, PostgreSQL (5 bases lógicas), MongoDB, Redis, RabbitMQ y Mailpit. Las flechas se etiquetan con protocolo y tipo: `REST/JSON síncrono` o `AMQP asíncrono`, más el nombre del evento |
| **N3 Componentes** | `c4/03-componentes-pedidos.puml` | Interior de `pedidos-service`: router, controlador, orquestador de saga (`saga-checkout.ts`), clientes HTTP con circuit breaker (`dependencias.ts`), repositorio y publicador de eventos |
| **N3 Componentes** | `c4/03-componentes-asistente.puml` | Interior del chatbot: router, motor de intenciones, árbol de diálogo, adaptadores a pedidos/catálogo/inventario, repositorio de conversaciones y adaptador IA opcional |
| **N3 Componentes** | `c4/03-componentes-gateway.puml` | Saneamiento de cabeceras, request_id, rate limiters, validación JWT, proxy y salud agregada |
| **Dinámico** | `c4/04-dinamico-checkout.puml` | Secuencia de la saga, con compensaciones (a partir de `docs/FLUJO-COMPRA.md`) |
| **Despliegue** | `c4/05-despliegue.puml` | Nodos Docker y red `interna`; qué puertos se publican al host en el perfil de pruebas frente al de producción |

Verifica cada diagrama contra el código: cada contenedor, puerto y cola que aparece debe existir, y viceversa. Haz un checklist cruzado en el documento.

### Paso 1.3 — Descomposición, comunicación y persistencia

`docs/especificacion/02-especificacion-arquitectura.md`. Es el **Documento de Especificación de Arquitectura**, que integra (y referencia, sin duplicar) `ARQUITECTURA.md`, `COMUNICACION.md` y `FLUJO-COMPRA.md`:

1. **Estilo arquitectónico** y justificación: microservicios + API Gateway.
2. **Descomposición en servicios:** tabla con servicio, *bounded context*, responsabilidad, datos propios, API expuesta, eventos publicados y consumidos. Incluye `asistente-service`.
3. **Comunicación:** matriz síncrona frente a asíncrona.
   - Qué va por REST y por qué: consistencia inmediata. Ejemplo: catálogo → inventario.
   - Qué va por RabbitMQ y por qué: desacoplamiento. Ejemplo: pedidos → notificaciones.
   - Exchanges, colas, *routing keys* y la DLQ, leídos de `bus-eventos.ts`.
4. **Persistencia:** *database per service*, motor elegido por necesidad (PG transaccional, Mongo documental para el catálogo, Redis con TTL para el carrito), usuarios de BD aislados y consistencia eventual mediante saga.
5. **Patrones aplicados:**
   - API Gateway
   - Saga orquestada con compensaciones
   - Circuit breaker
   - Reintentos con espera exponencial y jitter
   - Idempotencia
   - Dead letter queue
   - Degradación elegante
   - *Health check* agregado
6. **Seguridad de la arquitectura:** JWT, RBAC, autorización a nivel de dato, autenticación mutua interna y PCI-DSS por ausencia del dato.
7. **Despliegue:** referencia al C4 de despliegue.

### Paso 1.4 — Registros de decisiones (ADR)

`docs/adr/NNNN-titulo.md`, en formato Michael Nygard: contexto, decisión, consecuencias y alternativas descartadas. Como mínimo:

| ADR | Decisión |
|---|---|
| 0001 | Microservicios con API Gateway frente al monolito modular |
| 0002 | Base de datos por servicio y motor por necesidad |
| 0003 | Saga orquestada (no coreografiada) para el checkout |
| 0004 | RabbitMQ para eventos; REST para consultas que exigen consistencia |
| 0005 | JWT de vida corta + refresh rotatorio |
| 0006 | 🔶 Estrategia ORM (ver Fase 2) |
| 0007 | 🔶 Chatbot: motor de reglas con IA opcional (ver Fase 3) |
| 0008 | Documentación OpenAPI centralizada en el gateway |
| 0009 | Entorno de despliegue (ver Fase 5) |

**Entregable F1:** `docs/especificacion/`, `docs/c4/` (fuentes + PNG) y `docs/adr/`.

---

## FASE 2 — Construcción del núcleo

El MVP ya funciona. Esta fase **cierra brechas sin romper lo verificado**.

### Paso 2.1 — 🔶 Persistencia con ORM

**Problema:** el documento evalúa el "uso de ORM", pero el proyecto usa `pg` con SQL parametrizado y funciones SQL. La función `reservar_stock` tiene la lógica antisobreventa: descuento condicional, `version`, `pg_advisory_xact_lock` e idempotencia.

**Recomendación por defecto: adopción parcial y justificada.** Hay que confirmarla con el usuario.

- **Drizzle ORM** sobre el `Pool` de `pg` que ya crea `crearPool()`.
  - Es TypeScript puro y no genera código: encaja con la ejecución vía `tsx` sin compilación.
  - No trae binarios de motor (a diferencia de Prisma), así que no complica `Dockerfile.servicio`.
- Se migran los servicios de **CRUD simple**: `clientes-service` (perfiles, direcciones e historial) y `auth-service` (usuarios y refresh tokens).
  - Esquema tipado en `services/<s>/src/esquema.ts`, que **refleja** el SQL existente de `infra/postgres/01-auth.sql` y `02-clientes.sql`.
  - Los scripts SQL siguen siendo la fuente de verdad del esquema. No se usa `drizzle-kit push`, para no tener dos fuentes de esquema.
- **Inventario, pedidos (saga) y pagos se quedan con SQL directo.** Las operaciones de concurrencia viven en funciones de PostgreSQL con bloqueos explícitos que un ORM ocultaría o haría ineficientes. Se documenta en ADR-0006 como uso deliberado del patrón *Repository* con SQL nativo: *usar la herramienta adecuada por contexto*.
- MongoDB (catálogo, notificaciones): driver nativo. Mongoose es opcional y no se recomienda.

**Alternativas para presentar al usuario:**
- (a) La recomendada.
- (b) ORM en todos los servicios PG excepto la función `reservar_stock`.
- (c) Sin ORM, solo justificación en el ADR. Es arriesgado frente a la rúbrica.

**Cómo se implementa (opción a):**
1. Instala `drizzle-orm` en los dos servicios.
2. Crea `esquema.ts` y un `repositorio.ts` por servicio. Los controladores dejan de tener SQL embebido y llaman al repositorio, lo que además aplica un patrón limpio.
3. Mantén los mismos códigos HTTP y formas de respuesta: `test:http` es el contrato.
4. Ejecuta la regresión completa.

### Paso 2.2 — Documentación de la API (OpenAPI 3 + Swagger UI)

**Decisión:** una sola especificación **de la API pública del gateway** (la que ven los clientes), en `docs/openapi/openapi.yaml`, dividida por archivos con `$ref` por servicio: `docs/openapi/rutas/*.yaml`, `componentes/*.yaml`. Las rutas internas solo para servicios (`/precio`, `/validar`, `/reservas`, `/cobros`) se documentan con la etiqueta `x-interna: true` en una segunda especificación `openapi-interna.yaml`, que no se expone.

**Cómo se aborda:**
1. **Parte del código, no de la memoria:**
   - Rutas y roles: routers de cada `index.ts` y `RUTAS_PUBLICAS`.
   - Cuerpos: `exigirCampos(...)` en los controladores.
   - Ejemplos: `docs/api.http`.
   - Errores: forma uniforme del middleware de `errores.ts`, `{ mensaje, codigo }`.
2. **Componentes comunes:**
   - `securitySchemes.bearerAuth` (JWT).
   - Esquemas `Error`, `Producto`, `Carrito`, `Pedido`, `Transaccion`, etc.
   - Cabecera `Idempotency-Key`, o el nombre real que use el código: búscalo, no lo supongas.
   - Respuestas 401, 403, 404, 409 y 429.
3. **Servir Swagger UI desde el gateway:**
   - `swagger-ui-express` + `yaml` en `GET /api/docs` (y `GET /api/docs/openapi.json`).
   - Añade esas rutas a `RUTAS_PUBLICAS`, que es una lista blanca: si no se añaden, el gateway las bloquea con 401.
   - Monta la ruta **antes** del middleware de validación JWT y después de helmet.
   - Ajusta la CSP de helmet solo para esa ruta si Swagger UI lo necesita.
   - Variable `EXPONER_DOCS=true|false` para poder apagarla en producción.
4. **Validación:**
   - `npx @redocly/cli lint docs/openapi/openapi.yaml` sin errores.
   - Script `tests/openapi-cobertura.ts` (`npm run test:openapi`): compara las rutas de los routers con las de la especificación y falla si hay rutas sin documentar o documentadas que no existen.
5. Esta especificación alimenta el escaneo de la API con ZAP (`zap-api-scan.py -f openapi`) en la Fase 4.

### Paso 2.3 — Integración con servicios externos (notificaciones reales)

**Decisión:**
- La pasarela de pagos sigue simulada (`pasarela.ts`, tokens deterministas): es lo correcto para pruebas reproducibles y para PCI-DSS. Se documenta su contrato como un *adaptador* que puede cambiarse por una real (Wompi o Stripe en modo de pruebas) **sin tocar la saga**.
- **Se añade el envío real de correo** con SMTP hacia **Mailpit** (contenedor `axllent/mailpit`, SMTP en 1025, interfaz web en 8025). Así la integración externa es verificable de punta a punta.

**Cómo se aborda:**
1. Añade `mailpit` a `docker-compose.yml`, en la red `interna`.
2. En `notificaciones-service`, crea un adaptador `CanalCorreo`:
   - Interfaz con implementaciones `SmtpCanal` (con `nodemailer`) y `RegistroCanal` (comportamiento actual, solo Mongo), elegidas por `CANAL_CORREO=smtp|registro`.
   - Las plantillas existentes de Mongo se renderizan y se envían.
   - Un fallo de SMTP **no** debe perder el evento: se reintenta y, si persiste, va a la DLQ, en línea con el principio de la invariante 12.
3. Variables nuevas en `.env.example`: `SMTP_HOST`, `SMTP_PUERTO`, `CORREO_REMITENTE`.
4. Extiende `test:e2e`: tras una compra, consulta la API de Mailpit (`GET /api/v1/messages`) y comprueba que llegó el correo de confirmación al cliente.

### Paso 2.4 — Pruebas unitarias y patrones limpios (recomendado)

Ya están en los pendientes de `CLAUDE.md` y refuerzan la evaluación de patrones.

- **Vitest** en `packages/shared` y en los servicios: circuit breaker (transiciones de estado), cliente HTTP (reintentos solo en red o 5xx, nunca en 409, invariante 7), `autenticacion.ts` (token expirado o manipulado, `esLlamadaInterna` con sus dos condiciones), cálculo de totales (IVA, envío gratis) y repositorios con ORM.
- Script `npm run test:unit`. Reporte de cobertura con `--coverage` (v8) para el informe.

### Paso 2.5 — Scripts de base de datos

- Los que existen en `infra/postgres/00…06` e `infra/mongo/init-mongo.js` ya son el entregable. Añade un `infra/README.md` que explique el orden, los usuarios por servicio y cómo reiniciar.
- Añade el script de la base del chatbot (Fase 3) en `init-mongo.js` y los datos de FAQ iniciales.
- 🔶 Opcional: migraciones versionadas (pendiente conocido). Solo si sobra tiempo; no es requisito del documento.

**Entregable F2:** código, `docs/openapi/`, Swagger UI en `/api/docs`, scripts de BD, correo real verificable y pruebas unitarias.

---

## FASE 3 — Automatización conversacional (asistente virtual)

### Paso 3.1 — 🔶 Decisión de diseño

**Recomendación por defecto: un microservicio nuevo `asistente-service`, con motor de reglas determinista y un adaptador de IA opcional desactivado por defecto.**

- **Reglas como núcleo:** respuestas predecibles y comprobables con pruebas automáticas, sin coste ni dependencia de red. Cumple la opción "reglas predefinidas" del documento.
- **IA opcional** (`ASISTENTE_IA=desactivada|anthropic|openai`, más la clave de API correspondiente): solo actúa como *fallback* cuando ninguna intención supera el umbral de confianza, y solo para preguntas generales. Nunca ejecuta acciones ni ve datos de otros clientes.
- **Microservicio propio** en lugar de lógica dentro del gateway o de la web: respeta la arquitectura (servicio con responsabilidad única, su propia base y aislamiento de fallos). Si el asistente cae, la tienda sigue funcionando.

Registra la decisión en ADR-0007, junto con las alternativas.

### Paso 3.2 — Diseño funcional del asistente

**Intenciones (árbol de decisión o FAQ):**

| Intención | Requiere sesión | Fuente de la respuesta |
|---|---|---|
| Saludo, ayuda, menú de opciones | No | Reglas |
| FAQ: costo de envío, envío gratis, IVA, métodos de pago, tiempos de entrega, devoluciones, horario | No | Colección `faq` en Mongo. Los valores numéricos (`COSTO_ENVIO_BASE`, `UMBRAL_ENVIO_GRATIS`, `PORCENTAJE_IVA`) se leen de la configuración, **nunca se escriben a mano** en el texto |
| Buscar producto ("¿tienen portátiles?") | No | `catalogo-service GET /productos?q=` |
| Precio y disponibilidad de un SKU o nombre | No | Catálogo (precio vigente, invariante 2) + disponibilidad de inventario |
| Estado de **mis** pedidos o de un pedido concreto | **Sí** | `pedidos-service`, con la identidad del usuario |
| Cómo cancelar un pedido (guía, más el enlace a la acción en la UI) | Sí | Reglas + estado del pedido |
| Hablar con un humano (escalamiento) | No | Registra un ticket en `asistente_db.tickets` y publica el evento `asistente.escalamiento` → notificaciones avisa a `CORREO_OPERACIONES` |
| No entendido | — | Mensaje de reformulación + menú. Si la IA está activa, *fallback* |

**Motor de intenciones:**
- Normalización: minúsculas, sin tildes, sin signos.
- Coincidencia por palabras clave y sinónimos con puntaje.
- Extracción de entidades por expresión regular: SKU (`SKU-XXX-000`), número de pedido y nombre de producto.
- Contexto de conversación de varios turnos. Ejemplo: tras "¿cuál es el estado de mi pedido?" → "¿cuál número?" → el usuario responde el número.
- Las reglas viven en datos (`intenciones.json` o la colección Mongo) para que el administrador pueda editarlas sin desplegar.
- Opcional: `GET/PATCH /intenciones` solo para el rol administrador.

### Paso 3.3 — Implementación del backend

1. **Estructura:** copia la de un servicio existente (p. ej. `notificaciones-service`, que ya usa Mongo).
   - Puerto **3009**, base `asistente_db` en Mongo con su propio usuario. Añádela en `infra/mongo/init-mongo.js`.
   - Colecciones: `conversaciones`, `faq`, `tickets`, `intenciones`.
2. **Registro** (checklist de `CLAUDE.md`):
   - `DESTINOS` del gateway: `{ prefijo: '/api/asistente', tienePublicas: true }`.
   - `RUTAS_PUBLICAS`: `POST /api/asistente/mensajes`.
   - `docker-compose.yml` (servicio + healthcheck).
   - `Dockerfile.servicio` (COPY del `package.json`).
   - Scripts `dev:asistente` y `dev` de la raíz (concurrently).
   - `tests/salud.ts`: ahora son diez servicios.
   - OpenAPI.
   - C4.
3. **Endpoints:**
   - `POST /mensajes` → `{ conversacion_id?, texto }` → `{ conversacion_id, respuestas: [{ tipo: 'texto'|'productos'|'pedido'|'opciones', ... }] }`. Usa `autenticacionOpcional`.
   - `GET /conversaciones/:id`: solo el dueño o el administrador.
   - `GET /tickets`: administrador o vendedor.
4. **Seguridad — puntos críticos:**
   - **Para consultar pedidos, el asistente reenvía el `Authorization` del usuario** a `pedidos-service`, de modo que el RBAC y la autorización a nivel de dato de pedidos se aplican igual que si el usuario llamara directamente.
     - **No** se usa la llamada interna (`x-llamada-interna` + secreto): saltaría el control de rol (invariante 11) y permitiría que un cliente consultara pedidos ajenos por el chat.
     - El `cliente_id` sale del JWT, nunca del texto del mensaje (invariante 1). "Muéstrame el pedido 45" de un cliente que no es dueño de ese pedido debe responder "no encontrado", igual que la API.
   - Validación y límites del texto: longitud máxima (p. ej. 500 caracteres) y saneamiento.
   - Las respuestas se renderizan como texto en React, **nunca** con `dangerouslySetInnerHTML`.
   - Rate limit propio: el general del gateway más uno específico para `/api/asistente` (p. ej. 30 por minuto).
   - Con IA activa, mitigación de *prompt injection*: el modelo no recibe datos personales ni herramientas, y su salida se trata como texto.
5. **Resiliencia:** llamadas a pedidos, catálogo e inventario con `ClienteServicio` (circuit breaker + timeout) y **degradación elegante**. Si pedidos no responde, el asistente dice "no puedo consultar tus pedidos en este momento" en lugar de fallar.
6. Registra las conversaciones (sin datos sensibles; enmascaramiento con el logger existente) para la analítica de intenciones no resueltas.

### Paso 3.4 — Integración en la interfaz

1. **Web:** `clients/web/src/componentes/Asistente.jsx`.
   - Botón flotante + panel de chat, montado en `App.jsx`, visible en todas las vistas.
   - Estilo con Tailwind, coherente con lo existente.
   - Funciones:
     - Historial en la sesión.
     - Indicador de "escribiendo…".
     - Botones de opciones rápidas (*quick replies*).
     - Tarjetas de producto con "agregar al carrito", que reutilizan `agregarAlCarrito` de `App.jsx`.
     - Tarjeta de pedido con su estado.
     - Accesibilidad: `aria-live` para mensajes nuevos, foco y cierre con Esc.
   - Usa `api()` de `servicios/api.js` para heredar la renovación automática del token.
2. **Móvil (opcional):** pantalla `asistente_pantalla.dart` que consume el mismo endpoint.

### Paso 3.5 — Pruebas del asistente

- `tests/asistente.ts` (`npm run test:asistente`), de integración contra el gateway. Debe cubrir:
  - Una frase por intención con la intención esperada.
  - Sinónimos y tildes.
  - Entidad SKU o pedido.
  - Contexto de varios turnos.
  - **Aislamiento**: el cliente A no ve el pedido de B por el chat.
  - Sin sesión → la consulta de pedidos pide iniciar sesión.
  - Degradación con pedidos caído.
  - Mensaje vacío o demasiado largo → 400.
- Pruebas unitarias (Vitest) del motor de intenciones con una tabla de frases.
- Métrica para el informe: **tasa de acierto de intenciones** sobre un conjunto de ≥ 40 frases de prueba (`tests/asistente/frases.json`), con su matriz de confusión.

**Entregable F3:** `services/asistente-service`, el componente de chat, pruebas y la documentación del flujo (C4 de componentes + diagrama de secuencia de "consultar mi pedido").

---

## FASE 4 — Aseguramiento de calidad no funcional

**Se ejecuta `PLAN-ESTRATEGIAS-VALIDACION.md` (Fases 1 a 3) completo**, con estas ampliaciones propias del Trabajo Final:

1. **Alcance ampliado:**
   - Se añade el asistente a los endpoints críticos: escenario de k6 `asistente.js` con mezcla de intenciones con y sin sesión.
   - Se añade su verificación de seguridad: IDOR por el chat, inyección en el texto y, si la IA está activa, *prompt injection*.
2. **Foco en el carácter distribuido:**
   - **Carga con fallo inyectado:** durante el escenario de carga del catálogo, `docker compose stop inventario-service` a mitad de la corrida y arranque posterior. Se mide la apertura y cierre del circuit breaker, la latencia y la degradación elegante (el catálogo sigue respondiendo sin stock). Haz lo mismo con notificaciones durante la carga de checkout: los eventos se acumulan en RabbitMQ y se consumen al volver.
   - Identificación del **cuello de botella entre servicios**: el servicio que satura primero, según `docker stats` y las latencias por tramo de los logs con `request_id`.
   - 🔶 Opcional: **escalado horizontal** del servicio cuello de botella (`docker compose up --scale catalogo-service=3` detrás del gateway). Requiere un balanceador o DNS de Docker, y verificar que el gateway resuelve varias réplicas. Si se hace, se compara el throughput con 1 y con 3 réplicas.
3. **Seguridad frente al OWASP Top 10:** además del ZAP, una **tabla de controles por categoría** con el control implementado, el archivo de código y la prueba que lo evidencia (`test:http`, `test:asistente`, ZAP o manual). Ejemplo: A01 Control de acceso roto → RBAC + autorización por dato → `autenticacion.ts`, Suite B de `docs/PRUEBAS.md`.
4. **Usabilidad:** las tareas incluyen el uso del asistente. Ejemplo: *"pregúntale al asistente cuánto cuesta el envío y el estado de tu último pedido"*.
5. **Plan de mitigación de vulnerabilidades:** cada hallazgo con riesgo, acción, plazo y estado, además de las correcciones ya aplicadas (≥ 1 por dimensión, como exige el otro plan).

**Entregable F4:** `docs/calidad/*` actualizados, evidencias y gráficas. Es la base de la sección de calidad del informe.

---

## FASE 5 — Despliegue y validación final

### Paso 5.1 — Contenerización completa

1. **Web en contenedor:** `clients/web/Dockerfile`, multietapa:
   - Etapa 1: `node:22-alpine` con `npm ci` y `vite build`.
   - Etapa 2: `nginx:alpine` sirviendo `dist/`.
   - `clients/web/nginx.conf` con:
     - `try_files` para la SPA.
     - **Proxy inverso de `/api` → `api-gateway:8080`**: misma URL de origen, lo que elimina CORS en producción. Ajusta la URL base de `servicios/api.js` con la variable de Vite `VITE_API_URL`, con valor por defecto `/api`.
     - Cabeceras de seguridad: CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`.
     - gzip y caché de los recursos con hash.
2. Añade a `docker-compose.yml` `web` (puerto 80 o 8081), `asistente-service` y `mailpit`, con `depends_on` y healthchecks.
3. **Perfiles de despliegue:**
   - `docker-compose.yml`: desarrollo y laboratorio, como hoy.
   - `docker-compose.prod.yml` (*override*): los microservicios y las bases **no publican puertos** (solo `web` y, opcionalmente, el gateway). Los secretos son obligatorios, sin valores por defecto: usa `${JWT_SECRET:?falta JWT_SECRET}`. Además, `NODE_ENV=production`, `LOG_FORMATO=json`, `EXPONER_DOCS=false` y límites de recursos (`deploy.resources`).
4. **Arranque robusto:** corrige el pendiente conocido de que `BusEventos` no reintenta si falla el **primer** intento de conexión a RabbitMQ. Añade reintentos con espera exponencial en la conexión inicial; sin esto, el despliegue en frío con Compose es frágil. Añade `depends_on: condition: service_healthy` donde falte.
5. Verificación: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build` desde cero (`down -v`) → los 10 servicios sanos sin intervención manual.

### Paso 5.2 — 🔶 Entorno de pruebas o nube

**Recomendación por defecto:** se usan dos entornos.

1. **Entorno de pruebas reproducible en CI: GitHub Actions.** Workflow `.github/workflows/ci.yml`:
   - En cada *push* o PR: `npm ci` → `typecheck` → `test:unit` → `docker compose up -d --build --wait` → `test:salud`, `test:http`, `test:concurrencia`, `test:e2e`, `test:asistente`, `test:openapi` → E2E de interfaz (Playwright) → reportes como *artifacts*.
   - Un job opcional y manual (`workflow_dispatch`) para ZAP baseline y k6 de humo.
   - Así, el entorno de pruebas queda documentado como código.
2. **Despliegue accesible**, según lo que el usuario tenga disponible. **Pregúntale**:
   - (a) Una VM en la nube (AWS EC2, Azure, GCP u Oracle Cloud en su nivel gratuito) con Docker + Compose y el perfil `prod`. Claude Code prepara el `scripts/desplegar.sh` y la guía; el usuario aporta las credenciales y ejecuta.
   - (b) Una máquina local del equipo expuesta en la red del aula o con un túnel (Cloudflare Tunnel o ngrok) para la defensa.

   **Claude Code no crea recursos en la nube ni maneja credenciales sin la confirmación explícita del usuario.**

### Paso 5.3 — Suite de pruebas de aceptación E2E

1. **Criterios de aceptación** en `docs/aceptacion/CRITERIOS.md`, en formato Dado/Cuando/Entonces, uno por historia principal (derivados de los RF de la Fase 1):
   - Registro e inicio de sesión.
   - Búsqueda y filtro.
   - Carrito y cupón.
   - Compra aprobada.
   - Compra rechazada con compensación (stock devuelto).
   - Última unidad (`SKU-TEC-004`).
   - Cancelación.
   - Correo de confirmación recibido (Mailpit).
   - Asistente: FAQ, búsqueda, estado del pedido propio y aislamiento.
   - Vendedor: entrada de stock.
   - Administrador: cambio de estado y bitácora de la saga.
2. **E2E de interfaz con Playwright** (`tests/e2e-ui/`, `npm run test:e2e:ui`), contra el despliegue en contenedores (perfil prod).
   - Selectores accesibles (`getByRole`, `getByLabel`). Si faltan, añade `aria-label` o `data-testid` en los JSX.
   - Capturas y traza en caso de fallo; video opcional.
3. Se mantiene el E2E de API existente (`test:e2e`): las dos capas se complementan.
4. **Matriz de trazabilidad** (`docs/aceptacion/TRAZABILIDAD.md`): requisito → criterio → caso de prueba → resultado (✅/❌) → evidencia.

### Paso 5.4 — Manuales

1. **Manual técnico** (`docs/manuales/MANUAL-TECNICO.md`):
   - Arquitectura (resumen + C4).
   - Requisitos.
   - Instalación en desarrollo y en producción.
   - Variables de entorno (tabla completa a partir de `.env.example`).
   - Estructura del repositorio.
   - Cómo añadir un servicio.
   - Base de datos y scripts.
   - API (enlace a Swagger).
   - Asistente: cómo editar intenciones y FAQ.
   - Operación: salud, logs con `request_id`, consola RabbitMQ, Mailpit, DLQ.
   - Pruebas: cómo correr cada suite.
   - Solución de problemas: reutiliza la sección de `PLAN.md`.
   - Seguridad operativa: rotación de secretos.
2. **Manual de usuario** (`docs/manuales/MANUAL-USUARIO.md`), con **capturas reales** tomadas con Playwright sobre el despliegue. Una sección por rol:
   - **Cliente:** registrarse, buscar, comprar, pedidos, cancelar, asistente.
   - **Vendedor:** inventario, alertas y pedidos.
   - **Administrador:** gestión, plantillas de notificación, bitácora de la saga y tickets del asistente.
   - Además, preguntas frecuentes y mensajes de error comunes con su solución.

### Paso 5.5 — Defensa / presentación final

Fuera del alcance de los `.docx`, pero Claude Code deja `docs/defensa/GUION.md` con:
- La estructura de la presentación (10-15 diapositivas).
- La demo en vivo paso a paso, con datos y cuentas.
- Un plan B si falla la demo: video grabado de Playwright y capturas.
- Preguntas probables del jurado con su respuesta. Por ejemplo: "¿por qué no ORM en inventario?" o "¿qué pasa si cae RabbitMQ?".

Si el usuario lo pide, la presentación se genera aparte.

---

## FASE 6 — Generación del informe `.docx`

### 6.1 Cómo se genera

1. El contenido se escribe primero en `docs/informes/INFORME-TRABAJO-FINAL.md`, **ensamblando** los documentos ya producidos (`docs/especificacion`, `c4/png`, `adr`, `openapi`, `calidad`, `aceptacion` y `manuales`) en lugar de redactarlos de nuevo.
2. Conversión a `.docx` con pandoc y la plantilla de estilos compartida con el otro informe:

   ```bash
   pandoc docs/informes/INFORME-TRABAJO-FINAL.md \
     -o docs/informes/Informe_Trabajo_Final_ISII.docx \
     --reference-doc=docs/informes/plantilla.docx --toc --toc-depth=2 \
     --resource-path=.:docs/c4/png:docs/evidencia/no-funcionales/graficas:docs/manuales/capturas
   ```

   Alternativa: la librería `docx` de npm (`scripts/informes/generar-trabajo-final.ts`) si se necesita control fino de la portada o de las tablas.
3. **Decisión 🔶:** ¿un solo `.docx` con los manuales como anexos, o tres archivos (informe + manual técnico + manual de usuario)?
   - **Recomendación:** un informe principal y los dos manuales como `.docx` separados, generados con el mismo pipeline. Los manuales suelen entregarse como documentos independientes.
4. Verificación final:
   - Imágenes visibles y C4 legibles. Usa una página horizontal si el diagrama de contenedores es ancho.
   - Tablas dentro del margen.
   - Tabla de contenido.
   - Ningún `⚠️ PENDIENTE` sin avisar al usuario.
   - Enlaces al repositorio.
5. **Datos que hay que pedir al usuario:** universidad, programa, asignatura, docente, integrantes, nombre del proyecto, URL del despliegue (si existe) y fecha.

### 6.2 Secciones del informe principal

1. **Portada**.
2. **Tabla de contenido**, más índices de figuras y tablas.
3. **Resumen ejecutivo**: problema, solución, resultados clave (métricas de rendimiento, hallazgos de seguridad corregidos, SUS, tasa de acierto del asistente y aceptación E2E).
4. **Introducción**: objetivo general, objetivos específicos por fase, alcance y limitaciones.
5. **Fase 1 — Análisis y diseño arquitectónico**
   - 5.1 Escenario y problema de negocio.
   - 5.2 Actores, requisitos funcionales y escenarios de atributos de calidad.
   - 5.3 Modelo C4: contexto, contenedores, componentes (pedidos, gateway, asistente), dinámico del checkout y despliegue.
   - 5.4 Descomposición en servicios (tabla de *bounded contexts*).
   - 5.5 Comunicación síncrona y asíncrona: matriz, eventos y colas, DLQ.
   - 5.6 Estrategia de persistencia: BD por servicio, motores y consistencia eventual (saga).
   - 5.7 Patrones de diseño y de resiliencia.
   - 5.8 Decisiones de arquitectura (resumen de los ADR).
6. **Fase 2 — Construcción del núcleo**
   - 6.1 Tecnologías y estructura del monorepo.
   - 6.2 Patrones de código: repositorio, adaptador, middleware y librería compartida.
   - 6.3 Persistencia con ORM y SQL nativo: dónde y por qué.
   - 6.4 Seguridad de sesiones: JWT, refresh rotatorio, RBAC y autenticación interna.
   - 6.5 Integraciones externas: pasarela de pagos (adaptador) y notificaciones por correo (SMTP/Mailpit).
   - 6.6 Documentación de la API: OpenAPI y Swagger UI (capturas, tabla resumen de endpoints).
   - 6.7 Scripts de base de datos.
   - 6.8 Pruebas unitarias y cobertura.
7. **Fase 3 — Asistente virtual**
   - 7.1 Decisión de diseño: reglas frente a IA (resumen del ADR).
   - 7.2 Intenciones, árbol de diálogo y FAQ.
   - 7.3 Arquitectura del módulo: C4 de componentes y secuencia "consultar mi pedido".
   - 7.4 Integración con el backend y seguridad (reenvío de identidad, aislamiento).
   - 7.5 Interfaz de chat (capturas).
   - 7.6 Resultados: tasa de acierto de intenciones y matriz de confusión.
8. **Fase 4 — Aseguramiento de calidad**
   - 8.1 Rendimiento: plan, resultados, gráficas, cuello de botella distribuido, carga con fallo inyectado y escalado (si se hizo).
   - 8.2 Seguridad: ZAP, verificaciones manuales, tabla de controles OWASP Top 10 y hallazgos clasificados.
   - 8.3 Usabilidad: heurísticas, tareas y SUS.
   - 8.4 Matriz de calidad unificada.
   - 8.5 Plan de mitigación y correcciones aplicadas (antes/después).
9. **Fase 5 — Despliegue y validación final**
   - 9.1 Contenerización: imágenes, Compose, perfiles dev/prod y diagrama de despliegue.
   - 9.2 Entorno de pruebas (CI) y despliegue (nube o local), con la URL si aplica.
   - 9.3 Criterios de aceptación.
   - 9.4 Resultados de la suite E2E (API + interfaz) y matriz de trazabilidad.
10. **Conclusiones, lecciones aprendidas y trabajo futuro**: migraciones versionadas, observabilidad con Prometheus y trazas, paginación por cursor, separación del panel de administración.
11. **Referencias**: C4 (Simon Brown), patrones de microservicios (Chris Richardson), OWASP, k6, ZAP, Nielsen, SUS, documentación de las tecnologías.
12. **Anexos**
    - A. Enlace al repositorio y tabla fase → carpeta o commit.
    - B. ADR completos.
    - C. Extracto de la especificación OpenAPI.
    - D. Evidencias de las pruebas (salidas de las suites).
    - E. Guion de la defensa.

### 6.3 Secciones de los manuales (`.docx` separados)

**Manual técnico:**
1. Portada.
2. Contenido.
3. Introducción y alcance.
4. Arquitectura.
5. Requisitos.
6. Instalación (desarrollo / producción).
7. Configuración (variables de entorno).
8. Estructura del código y convenciones.
9. Base de datos.
10. API.
11. Asistente (administración de intenciones y FAQ).
12. Operación y monitoreo.
13. Pruebas.
14. Despliegue.
15. Solución de problemas.
16. Seguridad operativa.

**Manual de usuario:**
1. Portada.
2. Contenido.
3. Introducción.
4. Acceso al sistema.
5. Guía del cliente.
6. Guía del vendedor.
7. Guía del administrador.
8. Uso del asistente virtual.
9. Preguntas frecuentes.
10. Mensajes de error y soluciones.
11. Glosario.

---

## Resumen de puntos de pausa (🔶 y datos humanos)

| Momento | Qué se pregunta o pide al usuario |
|---|---|
| Inicio de F2 | Estrategia ORM: (a) parcial con Drizzle, recomendada; (b) amplia; (c) ninguna |
| Inicio de F3 | Asistente: reglas + IA opcional (recomendado), solo reglas o IA como núcleo; y si se dispone de una clave de API |
| F4 (Módulo usabilidad) | Respuestas SUS y observaciones de la prueba cruzada con otro equipo |
| F4 (correcciones) | Confirmar las correcciones elegidas por dimensión |
| F5.2 | Destino del despliegue (nube, con qué proveedor, o local con túnel) y credenciales; las gestiona el usuario |
| F6 | Datos de portada; un informe o informe + manuales separados |
