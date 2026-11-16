# ADR-0009: Despliegue con Compose (perfil prod), CI en GitHub Actions y túnel para la defensa

**Estado:** Aceptada por el equipo el 2026-11-15. Se implementa en la Fase 5.

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
