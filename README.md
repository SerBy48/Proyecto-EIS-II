# Plataforma de comercio electrónico — arquitectura de microservicios

Implementación funcional de la arquitectura diseñada en la **Práctica de
Laboratorio 2**: una plataforma de e-commerce con API Gateway, ocho
microservicios independientes, base de datos por servicio y comunicación mixta
síncrona/asíncrona.

El caso de negocio de partida es una empresa de retail con un monolito que
padece tres problemas: **sobreventa** por existencias desactualizadas,
despliegues acoplados y saturación del sistema completo cuando solo crece el
tráfico del catálogo. La arquitectura resuelve los tres.

---

## Puesta en marcha rápida

```bash
npm install
cp .env.example .env
npm run infra:up      # PostgreSQL, MongoDB, Redis, RabbitMQ
npm run dev           # los nueve servicios
npm run dev:web       # tienda web en http://localhost:5173
```

Verifica que todo esté en pie y prueba el sistema:

```bash
npm run test:salud          # los nueve servicios responden
npm run test:concurrencia   # no hay sobreventa
npm run test:http           # contrato HTTP: RBAC, idempotencia, aislamiento
npm run test:e2e            # flujo de compra completo
```

- **[`PLAN.md`](PLAN.md)** — levantamiento paso a paso y plan de pruebas.
- **[`docs/PRUEBAS.md`](docs/PRUEBAS.md)** — casos de prueba, **resultados
  obtenidos** (142 casos, 142 pasan), defectos encontrados y lo que queda por
  verificar. La salida literal de cada suite está en
  [`docs/evidencia/`](docs/evidencia/).

---

## Arquitectura

```
                 ┌──────────────┐   ┌──────────────┐
                 │  Tienda web  │   │  App móvil   │
                 │ React+Tail.  │   │   Flutter    │
                 └──────┬───────┘   └──────┬───────┘
                        │  HTTPS + JWT     │
                        └────────┬─────────┘
                                 ▼
                    ┌────────────────────────┐
                    │      API GATEWAY       │  :8080
                    │ JWT · RBAC · rate lim. │
                    └────────────┬───────────┘
        ┌──────────┬─────────┬───┴────┬─────────┬──────────┐
        ▼          ▼         ▼        ▼         ▼          ▼
     ┌─────┐  ┌────────┐ ┌──────┐ ┌──────┐ ┌───────┐ ┌───────┐
     │auth │  │clientes│ │catál.│ │carri.│ │PEDIDOS│ │ pagos │
     │:3001│  │ :3002  │ │:3003 │ │:3005 │ │ :3006 │ │ :3007 │
     └──┬──┘  └───┬────┘ └──┬───┘ └──┬───┘ └───┬───┘ └───┬───┘
        │         │         │        │      orquesta     │
     ┌──▼──┐   ┌──▼──┐   ┌──▼──┐  ┌──▼──┐      │      ┌──▼──┐
     │ PG  │   │ PG  │   │Mongo│  │Redis│      │      │ PG  │
     └─────┘   └─────┘   └─────┘  └─────┘      │      └─────┘
                            ▲                  │
                            │  ┌───────────────▼──┐  ┌──────────────┐
                    ┌───────┴──┐  │  inventario   │  │notificaciones│
                    │          │  │    :3004      │  │    :3008     │
                    │          └──┤   PostgreSQL  │  │    Mongo     │
                    │             └───────┬───────┘  └──────▲───────┘
                    │                     │                 │
                    └─────────────────────┴─── RabbitMQ ────┘
                                              (eventos)
```

Diagramas completos, incluido el de secuencia del flujo de compra:
[`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) ·
[`docs/FLUJO-COMPRA.md`](docs/FLUJO-COMPRA.md) ·
[`docs/COMUNICACION.md`](docs/COMUNICACION.md)

---

## Componentes

| Servicio | Puerto | Base de datos | Responsabilidad |
|---|---|---|---|
| **api-gateway** | 8080 | — | Punto único de entrada, JWT, RBAC, rate limiting |
| **auth-service** | 3001 | PostgreSQL `auth_db` | Credenciales, tokens, roles |
| **clientes-service** | 3002 | PostgreSQL `clientes_db` | Perfiles, direcciones, historial |
| **catalogo-service** | 3003 | MongoDB `catalogo_db` | Productos, búsqueda, precios, promociones |
| **inventario-service** | 3004 | PostgreSQL `inventario_db` | Stock, reservas, movimientos |
| **carrito-service** | 3005 | Redis | Carrito con expiración, cupones |
| **pedidos-service** | 3006 | PostgreSQL `pedidos_db` | Orquestación de la compra (Saga) |
| **pagos-service** | 3007 | PostgreSQL `pagos_db` | Cobros, reembolsos, PCI-DSS |
| **notificaciones-service** | 3008 | MongoDB `notificaciones_db` | Consumidor de eventos |

Cada servicio tiene su **propio usuario de base de datos** y no puede leer las
tablas de otro, ni siquiera por error: el aislamiento no depende de que el
código se porte bien.

---

## Lo que está resuelto de verdad

No es un esqueleto: los mecanismos que el documento exige están implementados y
verificados con pruebas ejecutables.

### Sin sobreventa (pregunta 5 del análisis)

El servicio de inventario implementa los cinco mecanismos que enumera el
documento, todos dentro de la función SQL `reservar_stock`:

1. **Descuento condicional atómico** — `UPDATE ... WHERE cantidad_disponible >= n`
2. **Bloqueo optimista** — columna `version` en la tabla de stock
3. **Serialización por producto** — `pg_advisory_xact_lock(hashtext(sku))`
4. **Reserva temporal** — vigencia de 15 minutos con barrido automático
5. **Idempotencia** — clave única por intento de compra

Verificado: **20 compradores simultáneos por 5 unidades → exactamente 5 ganan**,
el stock nunca queda negativo. Ver `npm run test:concurrencia`.

### Saga con transacciones compensatorias

El checkout abarca cuatro servicios y cuatro bases de datos, así que no hay un
`COMMIT` que lo cubra. Cada paso registra su compensación y, si el pago se
rechaza, se ejecutan en orden inverso: las unidades reservadas vuelven al
inventario y el pedido queda cancelado sin cobro.

La bitácora es consultable: `GET /api/pedidos/:id/saga`.

### Resiliencia

- **Circuit breaker** por servicio destino, con estados cerrado / abierto / semiabierto
- **Timeouts y reintentos** con espera exponencial y jitter, solo en fallos transitorios
- **Degradación elegante**: si inventario cae, el catálogo se muestra sin el indicador de stock en lugar de caer también
- **Dead letter queue** para eventos que fallan repetidamente
- **Idempotencia** en reserva, cobro, checkout, confirmación y liberación

### Seguridad

- JWT de vigencia corta (15 min) con refresh token rotatorio y revocable
- RBAC en las rutas: `cliente`, `vendedor`, `administrador`
- Autorización a nivel de dato: un cliente solo accede a sus propios pedidos
- Contraseñas con bcrypt; bloqueo temporal tras intentos fallidos
- Rate limiting en tres niveles (general, login, checkout)
- **PCI-DSS**: la base de pagos no tiene columnas para número de tarjeta ni CVV
- Autenticación mutua entre servicios internos, con saneamiento de cabeceras de confianza en el gateway
- Enmascaramiento de campos sensibles en los registros

---

## Cuentas de prueba

Contraseña `Password123` en todas:

| Correo | Rol |
|---|---|
| `admin@tienda.co` | administrador |
| `vendedor@tienda.co` | vendedor |
| `ana@correo.co` | cliente |
| `bruno@correo.co` | cliente |
| `carla@correo.co` | cliente |

El producto **`SKU-TEC-004`** tiene deliberadamente **una sola unidad**: es el
que se usa para probar la disputa por la última unidad.

---

## Estructura

```
ecommerce-distribuido/
├── packages/shared/       Librería transversal: JWT, RBAC, circuit breaker,
│                          cliente HTTP con reintentos, bus de eventos, logger
├── services/              Los nueve servicios
├── clients/web/           Tienda y panel admin (React + Vite + Tailwind)
├── clients/mobile/        App Flutter (lib/ y plataforma Android)
├── infra/
│   ├── postgres/          Esquemas y datos de prueba
│   ├── mongo/             Inicialización de las bases documentales
│   └── Dockerfile.servicio
├── tests/                 salud, concurrencia, contrato HTTP y E2E
├── docs/                  Arquitectura, flujo, comunicación, análisis, pruebas
│   └── evidencia/         Salida literal de las suites ejecutadas
├── docker-compose.yml
├── PLAN.md                Levantamiento y plan de pruebas
└── CLAUDE.md              Contexto para trabajar el repositorio
```

---

## Comandos

```bash
# Desarrollo
npm run dev                 # los nueve servicios con recarga
npm run dev:pedidos         # uno solo
npm run dev:web             # cliente web

# Infraestructura
npm run infra:up            # motores de datos
npm run infra:down          # detener
npm run infra:reset         # borrar volúmenes y recrear desde cero

# Verificación
npm run typecheck           # tipos de todos los paquetes
npm run build:web           # build del frontend
npm run test:salud          # salud de los nueve servicios
npm run test:concurrencia   # no hay sobreventa (33 comprobaciones)
npm run test:http           # contrato HTTP (60 casos)
npm run test:e2e            # flujo de compra completo

# Todo en contenedores
docker compose up -d --build
docker compose logs -f pedidos-service
```

---

## Consolas de administración

| Herramienta | URL | Credenciales |
|---|---|---|
| Tienda web | <http://localhost:5173> | ver cuentas de prueba |
| API Gateway | <http://localhost:8080> | — |
| Salud del sistema | <http://localhost:8080/api/health> | — |
| RabbitMQ | <http://localhost:15672> | `ecommerce` / `ecommerce` |

---

## Correspondencia con el documento

| Actividad del documento | Dónde está |
|---|---|
| 1. Identificación de componentes | `services/` · [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) |
| 2. Diagrama de arquitectura | [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) |
| 3. Definición de responsabilidades | [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) |
| 4. Flujo de compra (secuencia) | [`docs/FLUJO-COMPRA.md`](docs/FLUJO-COMPRA.md) · `pedidos-service/src/saga-checkout.ts` |
| 5. Comunicación síncrona y asíncrona | [`docs/COMUNICACION.md`](docs/COMUNICACION.md) |
| 6. Características del sistema distribuido | [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) |
| 11. Preguntas de análisis | [`docs/PREGUNTAS-ANALISIS.md`](docs/PREGUNTAS-ANALISIS.md) |
| Pruebas de integración | [`docs/PRUEBAS.md`](docs/PRUEBAS.md) · [`docs/evidencia/`](docs/evidencia/) |
