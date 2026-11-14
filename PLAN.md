# Plan de levantamiento y pruebas

Guía operativa para poner el sistema en marcha y validarlo. Pensada para
ejecutarse de arriba abajo en Claude Code.

---

## Parte 1 — Levantamiento

### Requisitos

| Herramienta | Versión | Para qué |
|---|---|---|
| Docker + Docker Compose | 24+ | PostgreSQL, MongoDB, Redis y RabbitMQ |
| Node.js | 22.9 o superior | Los nueve servicios y el cliente web |
| npm | 10+ | Workspaces del monorepo |
| Flutter SDK | 3.x | Solo si vas a probar la app móvil |

Comprueba antes de empezar:

```bash
docker --version && docker compose version
node --version && npm --version
```

---

### Paso 1 — Instalar dependencias

Una sola instalación cubre los nueve servicios, la librería compartida y el
cliente web, porque el repositorio usa npm workspaces.

```bash
cd ecommerce-distribuido
npm install
cp .env.example .env
```

**Verificación:** `ls node_modules/@ecommerce` debe listar diez enlaces
(`shared` más los nueve servicios).

---

### Paso 2 — Levantar la infraestructura de datos

```bash
npm run infra:up
```

Arranca los cuatro motores. La primera vez, PostgreSQL ejecuta los scripts de
`infra/postgres/` en orden y MongoDB ejecuta `infra/mongo/init-mongo.js`: se
crean las cinco bases relacionales, las dos documentales, los usuarios de cada
servicio y los datos de prueba.

El comando no termina hasta que los cuatro contenedores están sanos (unos 30
segundos la primera vez). Esto importa: si los servicios arrancan antes que
RabbitMQ, notificaciones queda sin suscripción hasta reiniciar `npm run dev`.

```bash
docker compose ps
```

**Verificación:** las cuatro filas deben mostrar `(healthy)`.

```bash
# Las cinco bases de PostgreSQL existen
docker compose exec postgres psql -U postgres -c "\l" | grep _db

# El catálogo tiene sus diez productos
docker compose exec mongo mongosh --quiet catalogo_db --eval "db.productos.countDocuments()"

# Redis responde
docker compose exec redis redis-cli ping

# RabbitMQ: consola en http://localhost:15672 (ecommerce / ecommerce)
```

> **Si algo falla aquí**, casi siempre es un puerto ocupado. Comprueba con
> `netstat -ano | findstr :5432` en Windows o `ss -lptn 'sport = :5432'` en
> Linux (o 27017, 6379, 5672). Para PostgreSQL basta cambiar
> `POSTGRES_PUERTO_HOST` en `.env` (por ejemplo a 5434 si ya hay un PostgreSQL
> nativo en 5432): compose, los servicios y las pruebas lo respetan. Para los
> demás, para el servicio que lo tenga tomado o cambia el puerto publicado en
> `docker-compose.yml`.

---

### Paso 3 — Arrancar los microservicios

Dos opciones. Para desarrollo, en local con recarga automática:

```bash
npm run dev
```

Levanta los nueve procesos en paralelo con salida coloreada por servicio.
Para arrancar uno solo: `npm run dev:catalogo`, `npm run dev:pedidos`, etc.

Para probar el despliegue completo en contenedores:

```bash
docker compose up -d --build
```

**Verificación:**

```bash
npm run test:salud
```

Debe mostrar los nueve servicios en `OK` con sus dependencias conectadas. Este
comando es el que conviene repetir cada vez que algo se comporte raro.

---

### Paso 4 — Cliente web

```bash
npm run dev:web
```

Abre <http://localhost:5173>. Entra con cualquiera de las cuentas de prueba
(contraseña `Password123` en todas):

| Correo | Rol | Sirve para |
|---|---|---|
| `ana@correo.co` | cliente | Comprar, ver pedidos |
| `bruno@correo.co` | cliente | Probar la disputa por la última unidad |
| `carla@correo.co` | cliente | Probar idempotencia |
| `vendedor@tienda.co` | vendedor | Inventario y pedidos |
| `admin@tienda.co` | administrador | Todo, incluida la salud del sistema |

---

### Paso 5 — App móvil (opcional)

La carpeta trae el código Dart y la plataforma Android. Para iOS u otras
plataformas, genéralas una vez con `flutter create .` (respeta `lib/` y
`pubspec.yaml`).

```bash
cd clients/mobile
flutter pub get
flutter run
```

Configura la dirección del gateway según dónde ejecutes (`lib/config.dart`):

| Entorno | URL |
|---|---|
| Emulador Android | `http://10.0.2.2:8080` (por defecto) |
| Simulador iOS | `http://localhost:8080` |
| Dispositivo físico | `http://<IP-de-tu-PC>:8080` |

O sin tocar el código:

```bash
flutter run --dart-define=API_URL=http://192.168.1.5:8080
```

La carpeta `android/` ya está generada y su manifiesto trae el permiso
`INTERNET` y `usesCleartextTraffic="true"` (el gateway local es HTTP).

**Teléfono físico sin cable (APK):**

```bash
flutter build apk --release --dart-define=API_URL=http://<IP-de-tu-PC>:8080
# resultado: build/app/outputs/flutter-apk/app-release.apk
```

La URL queda fija dentro del APK: si cambia la IP del PC (otra red Wi‑Fi),
hay que recompilarlo. El teléfono y el PC deben estar en la misma red, y el
firewall de Windows debe permitir a Node.js conexiones entrantes en el perfil
de esa red (Pública o Privada).

---

## Parte 2 — Plan de pruebas

Seis niveles, de más rápido a más completo. Ejecútalos en orden: si falla uno,
los siguientes no aportan información útil.

> Los **resultados ya obtenidos** de los niveles 1 a 5, con la salida literal de
> cada suite y los defectos que encontraron, están en
> [`docs/PRUEBAS.md`](docs/PRUEBAS.md).

### Nivel 1 — Verificación estática (no necesita nada levantado)

```bash
npm run typecheck      # los nueve servicios y la librería compartida
npm run build:web      # el cliente web compila
cd clients/mobile && flutter analyze
```

**Criterio de aceptación:** cero errores.

---

### Nivel 2 — Salud del sistema

```bash
npm run test:salud
```

**Criterio de aceptación:** nueve servicios en `OK`. RabbitMQ puede aparecer
como *no crítica* sin que eso invalide nada; cualquier otra dependencia caída sí
es un problema.

---

### Nivel 3 — Concurrencia sobre el inventario

Esta es la prueba central del laboratorio: verifica la pregunta 5 del análisis
(que dos clientes no compren la última unidad). Ataca directamente la función
`reservar_stock` de PostgreSQL, sin pasar por la API, para aislar el mecanismo
de concurrencia.

```bash
npm run test:concurrencia
```

Cubre seis escenarios:

| # | Escenario | Qué verifica |
|---|---|---|
| 1 | 2 compradores, 1 unidad | Exactamente uno gana |
| 2 | 20 compradores, 5 unidades | Exactamente cinco ganan |
| 3 | Reintento con la misma clave | No descuenta dos veces |
| 4 | Pago rechazado | La compensación devuelve la unidad |
| 5 | Pago aprobado | El descuento es definitivo |
| 6 | Reserva mayor al stock | Rechazo limpio, nunca negativo |

**Criterio de aceptación:** las 33 comprobaciones en verde.

---

### Nivel 4 — Contrato HTTP

60 casos sobre nueve áreas: autenticación, control de acceso, inventario, pagos,
pedidos, limitación de peticiones, cumplimiento PCI-DSS, aislamiento de las bases
de datos y degradación.

```bash
npm run test:http
```

La suite arranca su propio gateway temporal (puerto 18080) para no agotar el
limitador del gateway de `npm run dev`, restablece el estado de las bases antes
de empezar y desbloquea las cuentas al terminar, así que se puede ejecutar tantas
veces como se quiera, también justo antes de `test:e2e`.

**Criterio de aceptación:** 60 casos en verde.

---

### Nivel 5 — Integración extremo a extremo

Recorre los quince pasos del flujo de compra a través del API Gateway, más los
caminos de fallo.

```bash
npm run test:e2e
```

| Escenario | Qué verifica |
|---|---|
| A | Compra exitosa: los 15 pasos, la bitácora de la saga y la notificación asíncrona |
| B | Pago rechazado: el stock se libera y el carrito se conserva |
| C | Dos clientes por la última unidad: un solo ganador, sin sobreventa |
| D | Doble clic en "Pagar": un solo pedido |
| E | Cancelación de un pedido pagado: reembolso y devolución de stock |
| F | Seguridad: 401 sin token, 403 por rol, aislamiento entre clientes |

**Criterio de aceptación:** todas las comprobaciones en verde.

---

### Nivel 6 — Pruebas manuales dirigidas

Estas comprueban comportamientos que conviene ver con los propios ojos.

#### 5.1 Tolerancia a fallos: caída de notificaciones

Demuestra la Actividad 6, punto d.

```bash
docker compose stop notificaciones-service
```

Compra normalmente desde la web. **Debe funcionar sin degradación alguna.**
Luego:

```bash
docker compose start notificaciones-service
sleep 10
curl -s localhost:8080/api/notificaciones/mensajes \
  -H "Authorization: Bearer $TOKEN_ADMIN" | head -c 500
```

Los mensajes pendientes aparecen: quedaron en la cola del broker y se
procesaron al restablecerse el servicio.

#### 5.2 Degradación elegante: caída de inventario

```bash
docker compose stop inventario-service
```

Abre el catálogo en la web. **Los productos se siguen mostrando**, pero la
disponibilidad aparece como *"Disponibilidad no verificada"* en lugar de
mentir. Intentar comprar falla de forma explícita, no en silencio.

#### 5.3 Circuit breaker

Con inventario aún caído, recarga el catálogo cinco o seis veces y consulta:

```bash
curl -s localhost:8080/api/health | python3 -m json.tool | grep -A4 circuito
```

El estado del circuito pasa de `cerrado` a `abierto`. A partir de ahí las
llamadas fallan de inmediato en vez de esperar el timeout. Levanta inventario y,
tras unos quince segundos, el circuito pasa a `semiabierto` y luego a `cerrado`.

#### 5.4 Expiración de reservas

Reduce la vigencia para no esperar quince minutos:

```bash
# En .env:
MINUTOS_RESERVA=1
INTERVALO_BARRIDO_MS=10000
docker compose up -d inventario-service
```

Reserva stock y espera poco más de un minuto:

```bash
curl -s -X POST localhost:8080/api/inventario/reservas \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: prueba-expira' \
  -d '{"sku":"SKU-TEC-001","cantidad":2}'

sleep 75
curl -s localhost:8080/api/inventario/stock/SKU-TEC-001 \
  -H "Authorization: Bearer $TOKEN_ADMIN"
```

Las dos unidades vuelven a estar disponibles solas.

#### 5.5 Rate limiting

```bash
for i in $(seq 1 15); do
  curl -s -o /dev/null -w "%{http_code} " -X POST localhost:8080/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"ana@correo.co","password":"incorrecta"}'
done; echo
```

Debe pasar de `401` a `429` tras unos diez intentos.

#### 5.6 Trazabilidad distribuida

Haz una compra y toma el `x-request-id` de la respuesta:

```bash
curl -i -s -X POST localhost:8080/api/pedidos/checkout ... | grep x-request-id
```

Búscalo en los registros de todos los servicios:

```bash
docker compose logs | grep <ese-request-id>
```

La misma compra aparece en gateway, pedidos, clientes, catálogo, inventario y
pagos. Es la respuesta práctica a la mayor desventaja de la comunicación
distribuida: la dificultad de depuración.

---

## Parte 3 — Colección de peticiones

`docs/api.http` tiene la colección completa lista para el REST Client de
VS Code o IntelliJ, con las variables encadenadas (el login alimenta el token de
las demás peticiones). Es la alternativa a Postman si prefieres no salir del
editor.

---

## Tokens de prueba de la pasarela

El servicio de pagos simula la pasarela de forma **determinista** según el token
que reciba, para que los escenarios sean reproducibles:

| Token | Resultado | Sirve para probar |
|---|---|---|
| `tok_ok_4242` | Aprobado | Camino feliz |
| `tok_rechazo_1111` | Rechazado (fondos insuficientes) | Compensación de la saga |
| `tok_error_9999` | Error técnico (502) | Manejo de fallo de la pasarela |
| `tok_lento_7777` | Aprobado tras 5 s | Timeouts y circuit breaker |

---

## Solución de problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `ECONNREFUSED :5432` | PostgreSQL aún arrancando | `docker compose ps` y esperar a `healthy` |
| Las tablas no existen | El volumen ya existía | `npm run infra:reset` |
| `MongoServerError: Authentication failed` | Volumen creado antes del script de init | `docker compose down -v && npm run infra:up` |
| El gateway responde 503 en todo | Los servicios no están arrancados | `npm run dev` |
| `401 TOKEN_EXPIRADO` en curl | El token dura 15 minutos | Volver a hacer login |
| `429` al probar repetidamente | Rate limiting | Esperar o subir `LIMITE_*` en `.env` |
| El catálogo no muestra disponibilidad | Inventario caído | Es el comportamiento esperado; revisa ese servicio |
| Los puertos están ocupados | Otro proyecto corriendo | `docker compose down` en el otro, o cambiar puertos |

Para empezar de cero, borrando todos los datos:

```bash
npm run infra:reset
```
