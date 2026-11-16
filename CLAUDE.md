# Contexto del repositorio

Plataforma de comercio electrónico con arquitectura de microservicios
(Práctica de Laboratorio 2). Monorepo con npm workspaces.

---

## Estructura

```
packages/shared/        Librería transversal. La usan los diez servicios.
services/               10 servicios: api-gateway + 9 microservicios (incluido el asistente)
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
| asistente-service | 3009 | MongoDB `asistente_db` |
| web | 5173 (`dev:web`); 8081 en contenedor (nginx, proxy `/api`) | — |
| Mailpit (correo de pruebas) | 8025 (web y API), 1025 (SMTP) | — |

Infraestructura: PostgreSQL 5432 (o `POSTGRES_PUERTO_HOST`), MongoDB 27017, Redis 6379,
RabbitMQ 5672 (consola 15672).

---

## Comandos

```bash
npm install                 # instala todos los workspaces de una vez
npm run infra:up            # motores de datos en Docker
npm run dev                 # los diez servicios con recarga
npm run dev:pedidos         # uno solo
npm run dev:web             # cliente web
npm run typecheck           # tipos de todos los paquetes
npm run test:salud          # todos los servicios responden
npm run test:concurrencia   # no hay sobreventa
npm run test:e2e            # flujo de compra completo (incluye el correo en Mailpit)
npm run test:e2e:ui         # 12 criterios de aceptacion en la web (Playwright, 8081, modo pruebas; GRABAR_VIDEO=1)
npm run prod:up             # perfil de produccion: solo la web publica puerto (prod:down, prod:logs)
npm run tunel               # Cloudflare Quick Tunnel hacia la web (solo durante la defensa)
npm run test:unit           # pruebas unitarias con Vitest (sin Docker); :cobertura para el reporte
npm run test:openapi        # la especificacion OpenAPI cubre exactamente las rutas del codigo
npm run docs:openapi        # valida (Redocly) y empaqueta docs/openapi para el gateway
npm run test:asistente      # asistente contra el gateway (ASISTENTE_PROBAR_DEGRADACION=1: detiene pedidos)
npm run asistente:metricas  # tasa de acierto de intenciones y matriz de confusion (-- --guardar)
npm run infra:asistente     # crea asistente_db en un volumen de Mongo que ya existe (idempotente)
npm run infra:reset         # borra volúmenes y recrea desde cero
npm run test:seguridad      # 21 verificaciones de seguridad, 5 del asistente (ver docs/calidad/SEGURIDAD.md)
npm run usabilidad:recorrido # 9 tareas en Chromium: KLM, capturas y axe (vite preview en 4173 de build:web:pruebas)
npm run build:web:pruebas   # build con los controles de la pasarela simulada (U-08); build:web los oculta
npm run usabilidad:sus      # puntaje SUS; falla si no hay respuestas reales
npm run informe:estrategias # informe .docx (libreria docx) y su indice actualizado con Word
npm run docs:c4             # renderiza docs/c4/*.puml a PNG (Docker plantuml/plantuml)
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

**Acceso a datos.** auth y clientes usan Drizzle ORM a traves de
`src/repositorio.ts`; inventario, pedidos y pagos usan SQL nativo parametrizado
(ADR-0006). El esquema lo definen SOLO los scripts de `infra/postgres`:
`esquema.ts` los refleja y no se usa `drizzle-kit push`. Si cambias un
`CREATE TABLE`, cambia tambien `esquema.ts` (`test:unit` detecta la diferencia).
Para leer el codigo de PostgreSQL de un error usa `errorDePostgres()`: Drizzle
envuelve el error del driver.

**Documentacion de la API.** Se escribe en `docs/openapi/` (dividida por
servicio; las rutas de la saga en `openapi-interna.yaml`) y `npm run
docs:openapi` la empaqueta en `services/api-gateway/especificacion/openapi.json`,
que el gateway sirve en `/api/docs`. Una ruta nueva sin documentar, o con
`x-roles` distinto de su `requiereRol()`, hace fallar `test:openapi`.

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
    `bus.publicar()` registra el fallo y devuelve `false`. Del lado del
    consumidor, un fallo de envío (SMTP caído) se relanza: el bus lo reintenta
    en la propia cola y, al tercer intento, lo deja en la DLQ. Nunca se pierde.

13. **Los secretos no tienen valor por defecto.** `JWT_SECRET`,
    `JWT_REFRESH_SECRET` e `INTERNAL_TOKEN` se definen en `.env` (generados con
    `openssl rand -hex 32`). Sin ellos, o con menos de 32 caracteres, o con un
    valor que estuvo publicado, ningún servicio arranca (`verificarSecretos()`).
    Antes había un valor de respaldo publicado, y con él se podía forjar un
    token de administrador.

14. **Un circuit breaker cuenta solo errores de red, 5xx y timeouts**
    (`esFalloDelServicio()`). Si contara los 4xx, un cliente con seis SKU
    inexistentes abriría el circuito para todos. En semiabierto deja pasar
    **una** llamada de prueba a la vez; las demás reciben la alternativa al
    instante (hallazgo R7: con todas pasando, el catálogo daba ráfagas de 6 s).

15. **El asistente consulta pedidos con el token del usuario, nunca como
    llamada interna.** `ClienteServicio` con la opción `autorizacion` reenvía
    el `Authorization` sin `x-llamada-interna`, y pedidos-service aplica su
    RBAC y su autorización por dato. Con una llamada interna, cualquiera vería
    por el chat los pedidos de otro cliente (`test:asistente` lo verifica).

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
| Repositorios con Drizzle | `services/{auth,clientes}-service/src/repositorio.ts` y `esquema.ts` |
| Canales de envío (SMTP / registro) | `services/notificaciones-service/src/canales.ts` |
| Swagger UI | `services/api-gateway/src/documentacion.ts` → `/api/docs` |
| Totales del carrito (IVA, envío, cupón) | `services/carrito-service/src/totales.ts` |
| Scripts de base de datos | `infra/README.md` |
| Asistente: motor, diálogo, intenciones y FAQ | `services/asistente-service/src/{motor,dialogo}.ts`, `src/datos/*.json` |
| Chat de la web | `clients/web/src/componentes/Asistente.jsx` |
| Especificación, C4 y ADR del Trabajo Final | `docs/especificacion/`, `docs/c4/`, `docs/adr/` |
| Web en contenedor y perfil prod | `clients/web/{Dockerfile,nginx.conf}`, `docker-compose.prod.yml` |
| Criterios de aceptación, trazabilidad y E2E de interfaz | `docs/aceptacion/`, `tests/e2e-ui/aceptacion.ts` |
| Manuales y guion de la defensa | `docs/manuales/`, `docs/defensa/GUION.md` |

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
evidencia; última ejecución el 2026-11-16, Fase 5, con el sistema completo en
contenedores): 205 casos de integración y 115 unitarios, todos pasan, y los 12
criterios de aceptación de `test:e2e:ui`; `test:openapi` pasa sus 355 comprobaciones y
`test:asistente` sus 46. Los diez servicios compilan y arrancan sanos; la prueba
de concurrencia pasa sus 33 comprobaciones (20 compradores simultáneos por 5
unidades → exactamente 5 ganan); `test:http` pasa sus 73 casos sobre
autenticación, RBAC, aislamiento entre clientes, idempotencia, los cuatro
desenlaces de la pasarela, el ciclo de vida de los pedidos, rate limiting,
PCI-DSS y aislamiento de las bases; `test:e2e` pasa sus 53 comprobaciones
(compra, pago rechazado con compensación, última unidad, doble clic, cancelación
y seguridad), incluido el consumo de eventos por notificaciones y el correo real
en Mailpit. El cliente web
compila y `flutter analyze` no reporta problemas.

**Puerto de PostgreSQL en el host:** `POSTGRES_PUERTO_HOST` en `.env` (5432 por
defecto; en este equipo 5434 porque hay un PostgreSQL nativo en 5432). Compose,
los servicios y las pruebas lo respetan. Los scripts `dev` y `test:*` cargan el
`.env` raíz con `--env-file-if-exists` (requiere Node ≥ 22.9).

**Arranque:** `BusEventos` reconecta con espera exponencial (también si el
primer intento falla) y vuelve a declarar sus consumidores; por eso los
servicios dependen de RabbitMQ con `service_started`, no `service_healthy`. Si
`alIniciar` falla, `crearServicio` termina el proceso y Docker lo reinicia.
Arranque en frío del perfil prod: 16/16 contenedores sanos en 276 s.

**Despliegue (Fase 5, ADR-0009):** `docker-compose.prod.yml` sobre el de
laboratorio (`npm run prod:up`): sin puertos salvo la web (8081) y Mailpit en
127.0.0.1:8025, `EXPONER_DOCS=false`, límites de recursos. La web se compila con
`MODO_VITE` (`pruebas` muestra el selector de la pasarela; `production` lo
oculta). nginx quita el `Origin` cuando coincide con el `Host` (mismo origen,
también por el túnel); los orígenes ajenos los rechaza el gateway
(`CORS_ORIGENES`, o `CORS_ORIGENES_PROD` en prod). CI en
`.github/workflows/ci.yml`. `test:seguridad` no falla por los riesgos aceptados
(`RIESGOS_ACEPTADOS`: V-13 = S-09).

**Defectos ya corregidos**, cada uno con su caso de prueba (sección 4 de
`docs/PRUEBAS.md`): escalada de privilegios por el token interno, error 500 al
consultar un pedido por su número, código 201 en una réplica idempotente, la
suite que no era re-ejecutable, y la cancelación repetida por el cliente que
devolvía 403. Bajo carga (4.10 a 4.12): bcrypt en el hilo principal de auth
(ahora un pool de hilos con cola acotada, `pool-hash.ts`), el gateway sin
keep-alive y el gateway que cortaba con EOF en lugar de responder 504. De
seguridad (4.13 a 4.16): secretos por defecto, registro con el `cliente_id` de
otra persona, circuit breaker abierto por 404 y correo sin validar. Segunda
tanda (4.17 a 4.22): inyección NoSQL, 500 ante entradas inválidas
(`traducirErrorDeEntrada()`), CORS que respondía 500, cabeceras de la web
(`clients/web/cabeceras-seguridad.js`), correos sin escapar y CORS sin el
origen del build (4173). De usabilidad (4.23 a 4.25): inicio de sesion real
(antes, un desplegable de cuentas de prueba), paginacion del catalogo y
cancelacion con confirmacion y error visible dentro del dialogo.

**Pruebas de carga:** `tests/rendimiento/` (k6). Corren con `npm run infra:carga`
(límites altos del gateway) y `CLIENTES_CARGA=300 npm run sembrar:carga`. Ojo:
`test:http` borra los pedidos, y la cola `notificaciones.envio` se drena a solo
~10 mensajes/s (`prefetch(1)` y 100 ms por envío). `bateria.sh` espera a que esa
cola se vacíe antes de cada corrida.

**Pendientes, en orden de valor:**

- **S-09 (riesgo aceptado, ver `docs/calidad/SEGURIDAD.md` 9.4):** refresh token
  en cookie `HttpOnly` para la web, almacenamiento seguro en la app móvil y
  protección CSRF. Hoy el token vive en `localStorage`, mitigado por la CSP.

- Caché del catálogo en Redis (el motor ya está desplegado para el carrito).
- Métricas para Prometheus y trazas distribuidas. Hoy hay `request_id` propagado
  y `/health` agregado, que es el mínimo.
- Migraciones versionadas. Los esquemas se aplican una sola vez al crear el
  volumen; cambiarlos exige `npm run infra:reset`.
- Paginación por cursor en los listados largos (hoy `LIMIT` fijo).
- Separar la web del panel de administración si crecen.
