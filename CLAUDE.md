# Contexto del repositorio

Plataforma de comercio electrónico con arquitectura de microservicios
(Práctica de Laboratorio 2). Monorepo con npm workspaces.

---

## Estructura

```
packages/shared/        Librería transversal. La usan los nueve servicios.
services/               9 servicios: api-gateway + 8 microservicios
clients/web/            React + Vite + Tailwind (tienda y panel admin)
clients/mobile/         Flutter. SOLO lib/ y pubspec.yaml
infra/postgres/         Esquemas SQL, se ejecutan por orden alfabético
infra/mongo/            Inicialización de las bases documentales
tests/                  salud, concurrencia y E2E
docs/                   Arquitectura, flujo, comunicación, análisis, api.http
```

---

## Puertos

| Servicio | Puerto | Datos |
|---|---|---|
| api-gateway | 8080 | — |
| auth-service | 3001 | PostgreSQL `auth_db` |
| clientes-service | 3002 | PostgreSQL `clientes_db` |
| catalogo-service | 3003 | MongoDB `catalogo_db` |
| inventario-service | 3004 | PostgreSQL `inventario_db` |
| carrito-service | 3005 | Redis |
| pedidos-service | 3006 | PostgreSQL `pedidos_db` |
| pagos-service | 3007 | PostgreSQL `pagos_db` |
| notificaciones-service | 3008 | MongoDB `notificaciones_db` |
| web | 5173 | — |

Infraestructura: PostgreSQL 5432 (o `POSTGRES_PUERTO_HOST`), MongoDB 27017, Redis 6379,
RabbitMQ 5672 (consola 15672).

---

## Comandos

```bash
npm install                 # instala todos los workspaces de una vez
npm run infra:up            # motores de datos en Docker
npm run dev                 # los nueve servicios con recarga
npm run dev:pedidos         # uno solo
npm run dev:web             # cliente web
npm run typecheck           # tipos de todos los paquetes
npm run test:salud          # los nueve servicios responden
npm run test:concurrencia   # no hay sobreventa
npm run test:e2e            # flujo de compra completo
npm run infra:reset         # borra volúmenes y recrea desde cero
```

---

## Convenciones

**Idioma.** Todo el código, los identificadores y los comentarios están en
español, sin tildes en identificadores. Los mensajes de error que ve el usuario
también en español. Mantén esa consistencia.

**Ejecución.** Los servicios corren con `tsx` directamente sobre TypeScript, sin
paso de compilación. `@ecommerce/shared` expone `src/index.ts` como `main`, así
que los cambios en la librería se reflejan de inmediato sin construirla.
`npm run typecheck` es la verificación de tipos; no hay `npm run build` en los
servicios.

**Un servicio nuevo** se crea copiando la estructura de uno existente:
`package.json` con `@ecommerce/shared` como dependencia, `tsconfig.json` que
extiende `tsconfig.base.json`, y `src/index.ts` que llama a `crearServicio()`.
Hay que registrarlo además en la tabla `DESTINOS` del gateway, en
`docker-compose.yml` y en los scripts `dev:*` de la raíz.

**Controladores.** Se envuelven siempre en `asincrono()` al montarlos en el
router; sin eso, una promesa rechazada no llega al middleware de errores y la
petición queda colgada. Para los errores se usan los constructores de
`shared/src/errores.ts` (`errorSolicitud`, `errorProhibido`, …), no
`res.status().json()` a mano: el middleware central los traduce de forma uniforme.

---

## Invariantes que no deben romperse

1. **El `cliente_id` sale siempre del JWT**, nunca del cuerpo ni de la query,
   salvo cuando un administrador compra en nombre de otro (venta telefónica). Es
   la base del aislamiento entre clientes.

2. **El precio lo pone el catálogo.** El carrito y el orquestador lo releen del
   servicio propietario antes de cobrar. Si se aceptara el precio del cliente,
   cualquiera compraría un portátil por mil pesos.

3. **Inventario es el único propietario del stock.** Ningún otro servicio escribe
   en esas tablas. Sin esa exclusividad, ningún mecanismo de concurrencia
   funciona.

4. **La clave de idempotencia es obligatoria** en reservar stock, cobrar y hacer
   checkout. No es opcional ni se genera en el servidor para esas operaciones
   internas: sin ella un reintento duplica el efecto.

5. **Cada paso de la saga con efecto lateral registra su compensación**
   inmediatamente después de ejecutarse, no al final del bucle. Si el tercer ítem
   falla, los dos primeros ya tienen su liberación registrada.

6. **Nunca compensar hacia atrás un pago ya aprobado.** Si falla la confirmación
   de la reserva después del cobro, el cliente ya pagó: se registra el fallo en
   `saga_pasos` para resolverlo hacia adelante. Devolverle el dinero a alguien
   que sí compró es peor que un ajuste manual de inventario.

7. **Los reintentos solo aplican a errores de red y 5xx.** Un `409` de stock
   insuficiente es una respuesta de negocio válida. El cobro no se reintenta en
   absoluto.

8. **Consultas parametrizadas siempre** (`$1`, `$2`). Nunca concatenar SQL.

9. **`pagos_db` no debe tener columnas de número de tarjeta, CVV ni
   vencimiento.** El cumplimiento PCI-DSS se logra no teniendo el dato, no
   cifrándolo bien.

10. **El gateway borra las cabeceras de confianza que vengan del exterior**
    (`CABECERAS_DE_CONFIANZA`) antes de escribir las suyas. Los servicios
    confían en `x-usuario-rol`; si un cliente pudiera inyectarla, el RBAC sería
    decorativo.

11. **`esLlamadaInterna` requiere DOS cosas**: el secreto compartido y la
    cabecera `x-llamada-interna`. El gateway envía solo la primera. Si bastara el
    secreto, todo el tráfico de usuario pasaría por interno y se saltaría el
    control de rol.

12. **Publicar un evento nunca debe tumbar la operación principal.**
    `bus.publicar()` registra el fallo y devuelve `false`.

---

## Dónde está cada cosa

| Necesito… | Archivo |
|---|---|
| Lógica de concurrencia del stock | `infra/postgres/03-inventario.sql` (función `reservar_stock`) |
| Orquestación de la compra | `services/pedidos-service/src/saga-checkout.ts` |
| Circuit breaker | `packages/shared/src/circuit-breaker.ts` |
| Cliente HTTP con timeout y reintentos | `packages/shared/src/cliente-servicio.ts` |
| Bus de eventos y dead letter queue | `packages/shared/src/bus-eventos.ts` |
| JWT y RBAC | `packages/shared/src/autenticacion.ts` |
| Arranque común de los servicios | `packages/shared/src/servicio.ts` |
| Enrutamiento, rate limiting y saneamiento | `services/api-gateway/src/index.ts` |
| Pasarela de pagos simulada | `services/pagos-service/src/pasarela.ts` |
| Timeouts por dependencia | `services/pedidos-service/src/dependencias.ts` |

---

## Datos de prueba

Contraseña `Password123` en todas las cuentas:
`admin@tienda.co` (administrador), `vendedor@tienda.co` (vendedor),
`ana@correo.co`, `bruno@correo.co`, `carla@correo.co` (clientes 1, 2 y 3).

**`SKU-TEC-004` tiene una sola unidad** a propósito: es el producto con el que se
prueba la disputa por la última unidad. **`SKU-HOG-002`** está bajo el mínimo
para disparar la alerta de reposición.

Tokens de la pasarela simulada (resultado determinista):

| Token | Resultado |
|---|---|
| `tok_ok_*` | Aprobado |
| `tok_rechazo_*` | Rechazado por fondos insuficientes |
| `tok_error_*` | Error técnico (502) |
| `tok_lento_*` | Aprobado tras 5 segundos |

---

## Estado y pendientes conocidos

**Verificado y funcionando** (ver `docs/PRUEBAS.md` para el detalle y la
evidencia; última ejecución el 2026-11-14 con los servicios en contenedores y la
base poblada con `npm run sembrar:carga`): 147 casos ejecutados, 147 pasan. Los nueve servicios compilan y arrancan sanos; la prueba
de concurrencia pasa sus 33 comprobaciones (20 compradores simultáneos por 5
unidades → exactamente 5 ganan); `test:http` pasa sus 65 casos sobre
autenticación, RBAC, aislamiento entre clientes, idempotencia, los cuatro
desenlaces de la pasarela, el ciclo de vida de los pedidos, rate limiting,
PCI-DSS y aislamiento de las bases; `test:e2e` pasa sus 49 comprobaciones
(compra, pago rechazado con compensación, última unidad, doble clic, cancelación
y seguridad), incluido el consumo de eventos por notificaciones. El cliente web
compila y `flutter analyze` no reporta problemas.

**Puerto de PostgreSQL en el host:** `POSTGRES_PUERTO_HOST` en `.env` (5432 por
defecto; en este equipo 5434 porque hay un PostgreSQL nativo en 5432). Compose,
los servicios y las pruebas lo respetan. Los scripts `dev` y `test:*` cargan el
`.env` raíz con `--env-file-if-exists` (requiere Node ≥ 22.9).

**Arranque:** `npm run infra:up` usa `docker compose up --wait`. `BusEventos` no
reintenta si el **primer** intento de conexión falla, así que si los servicios
arrancan antes que RabbitMQ, notificaciones queda caído hasta reiniciar
`npm run dev`.

**Defectos ya corregidos**, cada uno con su caso de prueba (sección 4 de
`docs/PRUEBAS.md`): escalada de privilegios por el token interno, error 500 al
consultar un pedido por su número, código 201 en una réplica idempotente, la
suite que no era re-ejecutable, y la cancelación repetida por el cliente que
devolvía 403. Bajo carga (4.10 a 4.12): bcrypt en el hilo principal de auth
(ahora un pool de hilos con cola acotada, `pool-hash.ts`), el gateway sin
keep-alive y el gateway que cortaba con EOF en lugar de responder 504.

**Pruebas de carga:** `tests/rendimiento/` (k6). Corren con `npm run infra:carga`
(límites altos del gateway) y `CLIENTES_CARGA=300 npm run sembrar:carga`. Ojo:
`test:http` borra los pedidos, y la cola `notificaciones.envio` se drena a solo
~10 mensajes/s (`prefetch(1)` y 100 ms por envío). `bateria.sh` espera a que esa
cola se vacíe antes de cada corrida.

**Pendientes, en orden de valor:**

- Pruebas unitarias con Jest o Vitest. Solo hay pruebas de integración.
- Caché del catálogo en Redis (el motor ya está desplegado para el carrito).
- Métricas para Prometheus y trazas distribuidas. Hoy hay `request_id` propagado
  y `/health` agregado, que es el mínimo.
- Migraciones versionadas. Los esquemas se aplican una sola vez al crear el
  volumen; cambiarlos exige `npm run infra:reset`.
- Paginación por cursor en los listados largos (hoy `LIMIT` fijo).
- Separar la web del panel de administración si crecen.
