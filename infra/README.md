# Scripts de base de datos e infraestructura

Esquemas, usuarios y datos iniciales de los motores de datos. Son el entregable de "scripts de BD" del Trabajo Final y **la única fuente del esquema**: el ORM de auth y clientes solo los refleja ([ADR-0006](../docs/adr/0006-estrategia-orm.md)).

## Cuándo se ejecutan

Los contenedores oficiales de PostgreSQL y MongoDB ejecutan los scripts de `/docker-entrypoint-initdb.d` **una sola vez, al crear el volumen vacío**.

| Motor | Montaje (`docker-compose.yml`) | Orden |
|---|---|---|
| PostgreSQL 16 | `./infra/postgres` → `/docker-entrypoint-initdb.d` | Alfabético: `00` → `06` |
| MongoDB 7 | `./infra/mongo/init-mongo.js` → `/docker-entrypoint-initdb.d/` | Un solo script |

Un cambio en un script **no se aplica** a un volumen que ya existe. Para recrear todo desde cero:

```bash
npm run infra:reset   # docker compose down -v + motores de datos y Mailpit
```

Esto borra **todos** los datos, incluidos los pedidos y el sembrado de carga. Después:
- vuelve a levantar los servicios con `npm run infra:normal` o `npm run dev`;
- vuelve a sembrar los datos de carga con `CLIENTES_CARGA=300 npm run sembrar:carga`, si se van a correr pruebas de rendimiento.

Las migraciones versionadas son un pendiente conocido: hoy no hay forma de aplicar un cambio de esquema sin recrear el volumen.

## PostgreSQL: una base y un usuario por servicio

| Script | Base | Contenido |
|---|---|---|
| `00-bases.sql` | — | Crea los 5 usuarios y las 5 bases, cada base **propiedad de su usuario**, y revoca el acceso de `PUBLIC` |
| `01-auth.sql` | `auth_db` | `usuarios` (con el índice único parcial `uq_usuarios_cliente`, hallazgo S-01), `tokens_renovacion` (se guarda el hash, no el token) y `auditoria_accesos` |
| `02-clientes.sql` | `clientes_db` | `clientes`, `direcciones` (una sola predeterminada por tipo) e `historial_compras`, la proyección que alimentan los eventos |
| `03-inventario.sql` | `inventario_db` | `bodegas`, `stock` (con `version` y `CHECK` de no negativos), `reservas`, `movimientos` y las funciones `reservar_stock`, `confirmar_reserva`, `liberar_reserva` y `expirar_reservas` |
| `04-pedidos.sql` | `pedidos_db` | `pedidos`, `pedido_items`, `historial_estados` (con disparador), `saga_pasos` y `generar_numero_pedido` |
| `05-pagos.sql` | `pagos_db` | `transacciones` (sin número, CVV ni vencimiento: invariante 9), `reembolsos` y `auditoria_pasarela` |
| `06-datos-prueba.sql` | todas | Cuentas de prueba (contraseña `Password123`), clientes, direcciones, bodegas y stock |

| Usuario | Contraseña (laboratorio) | Solo puede abrir |
|---|---|---|
| `auth_user` | `auth_pass` | `auth_db` |
| `clientes_user` | `clientes_pass` | `clientes_db` |
| `inventario_user` | `inventario_pass` | `inventario_db` |
| `pedidos_user` | `pedidos_pass` | `pedidos_db` |
| `pagos_user` | `pagos_pass` | `pagos_db` |

El aislamiento lo impone el motor: `auth_user` recibe *permission denied* si intenta conectarse a `pedidos_db` (`test:http` lo verifica). Las contraseñas son de laboratorio y solo se alcanzan desde `127.0.0.1`. En producción se reemplazan y no se publica el puerto ([ADR-0009](../docs/adr/0009-entorno-de-despliegue.md)).

### La lógica que no está en los servicios

La protección contra la sobreventa vive en `reservar_stock` (`03-inventario.sql`) y combina cuatro mecanismos:
- el descuento condicional (`WHERE cantidad_disponible >= $n`);
- la columna `version`;
- `pg_advisory_xact_lock` por SKU;
- la idempotencia por clave.

Por eso inventario no usa ORM ([ADR-0006](../docs/adr/0006-estrategia-orm.md)), y `test:concurrencia` lo verifica.

## MongoDB

`init-mongo.js` crea dos bases, cada una con su usuario.

| Base | Usuario | Colecciones | Índices relevantes |
|---|---|---|---|
| `catalogo_db` | `catalogo_user` | `productos`, `categorias`, `promociones` | `sku` único; índice de texto con pesos (nombre > marca > descripción) |
| `notificaciones_db` | `notificaciones_user` | `mensajes`, `plantillas` | `clave_dedupe` único (entrega "al menos una vez" sin correos duplicados) |

`asistente_db` se agregará en la Fase 3, con sus colecciones de intenciones y preguntas frecuentes iniciales.

## Redis y RabbitMQ

No tienen scripts:
- **Redis** guarda los carritos con un TTL de 7 días que se renueva en cada escritura.
- **RabbitMQ:** cada servicio declara al arrancar su exchange, sus colas y su DLQ (`packages/shared/src/bus-eventos.ts`). Ver la topología en [`docs/especificacion/02-especificacion-arquitectura.md`](../docs/especificacion/02-especificacion-arquitectura.md#23-comunicación).

## Mailpit

Servidor SMTP de pruebas (`axllent/mailpit:v1.27`). No guarda nada entre reinicios y no entrega fuera del equipo.
- **Recibe por SMTP** en el puerto 1025 todo lo que envía `notificaciones-service`.
- **Lo muestra** en http://localhost:8025, con una API en `/api/v1/`, que usa `test:e2e`.

## `Dockerfile.servicio`

Es la imagen común de los nueve servicios: el argumento `SERVICIO` decide cuál se ejecuta.

Copia explícitamente el `package.json` de cada servicio antes del `npm install`. **Un servicio nuevo debe agregarse aquí**, además de en `DESTINOS` del gateway, en `docker-compose.yml` y en los scripts `dev:*` (ver `CLAUDE.md`).
