# ADR-0009: Despliegue con Compose (perfil prod), CI en GitHub Actions y túnel para la defensa

**Estado:** Aceptada por el equipo el 2026-11-15. Implementada en la Fase 5 (2026-11-16); ver «Implementación».

## Contexto

El Trabajo Final pide software desplegado, un entorno de pruebas (o en la nube) y pruebas E2E de aceptación. Hoy Compose levanta la infraestructura y los 9 servicios, pero falta lo siguiente:
- La web no está en un contenedor.
- No hay un perfil de producción.
- No hay CI.
- `BusEventos` no reintenta si falla el **primer** intento de conectar a RabbitMQ, así que un arranque en frío es frágil.

El equipo no dispone de credenciales de nube para la entrega.

## Decisión

- **Contenerización completa.** La web pasa a una imagen multietapa: `node:22-alpine` para el build y `nginx:alpine` para servirlo, con proxy inverso de `/api` hacia el gateway (mismo origen, sin CORS). También se agregan los contenedores de asistente-service y Mailpit.
- **Dos perfiles:**
  - `docker-compose.yml` para el laboratorio, como hoy.
  - `docker-compose.prod.yml` como *override*:
    - sin puertos publicados para servicios ni bases;
    - secretos obligatorios;
    - `NODE_ENV=production` y `EXPONER_DOCS=false`;
    - límites de recursos.
- **Arranque robusto.** La conexión inicial al broker se reintenta con espera exponencial, y se agrega `depends_on: service_healthy` donde falte.
- **Entorno de pruebas como código: GitHub Actions** (`.github/workflows/ci.yml`). Cada push o PR ejecuta typecheck, pruebas unitarias, Compose y las suites de integración, E2E y E2E de interfaz. ZAP y k6 de humo quedan en un job manual.
- **Despliegue para la defensa: local con túnel.** Un equipo del grupo corre el perfil prod y lo expone con Cloudflare Tunnel o ngrok, sin coste ni credenciales de nube.

## Consecuencias

- ✅ Cualquier persona levanta el sistema completo con un comando, y el CI lo demuestra en cada cambio.
- ✅ No se crean recursos en la nube ni se manejan credenciales de terceros.
- ❌ La URL pública solo existe mientras el equipo anfitrión y el túnel están encendidos; no es un despliegue permanente.
- ❌ El rendimiento depende del equipo anfitrión; las mediciones de la Fase 4 se documentan con su hardware.

## Alternativas descartadas

- **Una VM en la nube** (EC2, Azure, GCP u Oracle en su nivel gratuito). Daría una URL permanente, pero requiere credenciales y una cuenta del equipo. Queda como trabajo futuro: el perfil prod es el mismo.
- **Kubernetes** (minikube, k3s). Es desproporcionado para la entrega y no cambia lo que se evalúa.
- **Solo local, sin exponer.** Impide que el jurado acceda desde sus dispositivos.

## Implementación (Fase 5)

Lo construido coincide con la decisión, con dos desviaciones justificadas.

| Pieza | Archivo | Comando |
|---|---|---|
| Imagen de la web: `node:22-alpine`, luego `nginxinc/nginx-unprivileged:1.27-alpine`, sin root y en el puerto 8080 del contenedor | `clients/web/Dockerfile`, `nginx.conf`, `cabeceras-seguridad.conf` | se construye con Compose |
| Perfil de producción | `docker-compose.prod.yml` | `npm run prod:up`, `prod:down`, `prod:logs` |
| Bus con reconexión | `packages/shared/src/bus-eventos.ts` (y 2 pruebas unitarias) | — |
| CI | `.github/workflows/ci.yml` | cada push y PR; manual para k6 y ZAP |
| E2E de interfaz | `tests/e2e-ui/aceptacion.ts` | `npm run test:e2e:ui` |
| Túnel | `scripts/tunel.sh` (cloudflared en un contenedor, dentro de la red de Compose) | `npm run tunel` |

**Desviación 1: `service_started` en lugar de `service_healthy` para RabbitMQ.**
- **Qué se hizo.** El bus ya no depende de que el broker esté listo al arrancar: reintenta con espera exponencial (1 s, 2 s… hasta 30 s), vuelve a declarar sus colas y consumidores al reconectar, y `publicar` devuelve `false` al instante mientras tanto (invariante 12). Por eso los servicios esperan solo a que RabbitMQ esté *iniciado*.
- **Por qué.** Con `service_healthy`, un RabbitMQ lento en su primer arranque dejaba a los servicios en `dependency failed` y el arranque abortaba. Le ocurrió a la Fase 4 en el primer `infra:carga` tras `down -v`.
- **Complementos:**
  - el healthcheck de RabbitMQ tiene más margen (`start_period` de 180 s);
  - `crearServicio` termina el proceso si falla su inicialización, para que Docker lo reinicie en lugar de dejarlo vivo y roto.

**Desviación 2: la cabecera `Origin` del mismo origen no llega al gateway.**
- **El problema.** El navegador envía `Origin` también en los POST del mismo origen. Con el túnel, ese origen es una URL aleatoria que no puede estar de antemano en `CORS_ORIGENES`.
- **La solución.** nginx compara `Origin` con el `Host` de la petición (`map $origen_hacia_gateway`):
  - si coinciden, reenvía la petición sin `Origin`;
  - si vienen de otro sitio, la reenvía tal cual y el gateway responde 403.
- **Verificado:**
  - la web y el túnel simulado pasan;
  - `https://malo.example` y otro subdominio de trycloudflare reciben 403.
- **Variable propia de producción.** El perfil de producción usa `CORS_ORIGENES_PROD`, porque `CORS_ORIGENES` del `.env` es la del laboratorio.

**Arranque en frío (RNF-11).**
- **Prueba:** `docker compose down -v` y luego `npm run prod:up` con volúmenes nuevos, compilando las imágenes.
- **Resultado:** los 16 contenedores quedaron sanos en 276 s, sin intervención.
- **Puertos:** solo se publica la web (8081), más Mailpit en `127.0.0.1:8025`.
- **Comprobaciones:**
  - el gateway no responde en `localhost:8080`;
  - `/api/health` responde por el proxy;
  - `/api/docs` no se sirve.
- **Evidencia:** `docs/evidencia/trabajo-final/arranque-en-frio-prod.txt`.

**Pendiente.** El túnel no se abrió durante el desarrollo, porque publica la tienda y sus cuentas de prueba. Se probará en el ensayo de la defensa con `npm run tunel`.
