# ADR-0010: Despliegue en una máquina virtual de la nube con Compose y Caddy

**Estado:** Aceptada por el equipo el 2026-11-18. Complementa a [ADR-0009](0009-entorno-de-despliegue.md): la VM en la nube, que allí era trabajo futuro, pasa a ser el despliegue de la entrega. El túnel sigue disponible como plan B.

## Contexto

- Con ADR-0009 la URL pública solo existe mientras el equipo anfitrión y el túnel están encendidos, y cambia cada vez.
- El equipo consiguió una cuenta de nube: Azure for Students, u Oracle Cloud Always Free como alternativa.
- El sistema son 16 contenedores: 10 servicios, la web, 4 motores de datos y Mailpit. En reposo usan unos 1,3 GB de memoria.
- Para desplegar en internet quedaban cuatro problemas:
  - Las cuentas de prueba usan una contraseña publicada (`Password123`), incluida la del administrador, y el repositorio es público.
  - Mailpit no entrega correos: la recuperación de contraseña (RF-54) no llegaría al usuario.
  - Detrás de un segundo proxy, el gateway (`trust proxy 1`) vería a todos con la misma IP. El límite de inicios de sesión (10 por minuto) sería uno solo para toda la tienda.
  - El perfil prod publica la web en todas las interfaces. Docker se salta el firewall del sistema operativo.

## Decisión

- **Una sola máquina virtual** (2 vCPU y 4 GB o más) con Docker. Corre el mismo perfil de producción, más un tercer archivo, `docker-compose.nube.yml`:
  - **Caddy** en los puertos 80 y 443, con HTTPS automático para `DOMINIO`. En Azure el dominio es el nombre DNS gratuito de la IP pública; en Oracle, `<ip>.sslip.io`.
  - La web queda solo en `127.0.0.1`.
  - `PROXIES_CONFIANZA=2` en el gateway (Caddy y nginx).
  - CORS solo para `https://DOMINIO`.
- **Cuentas por entorno.** `infra/postgres/07-cuentas-produccion.sh` corre después de los datos de prueba:
  - **Laboratorio:** no hace nada; las suites siguen usando las cuentas de prueba.
  - **Producción** (`CUENTAS_PRODUCCION=true`): las reemplaza por un administrador, un vendedor y un cliente. Los correos y contraseñas vienen del `.env` del servidor.
  - El hash bcrypt lo calcula pgcrypto, y la contraseña viaja como variable de psql, nunca concatenada en el SQL.
  - El repositorio no contiene ni los correos ni las contraseñas.
- **Correo real configurable.** Con `SMTP_HOST_PROD` definido, notificaciones envía por ese servidor: Gmail con una contraseña de aplicación, puerto 465 con TLS. Sin él, sigue usando Mailpit.
- **La pantalla de inicio de sesión no muestra cuentas** en ningún entorno. Las cuentas del laboratorio siguen documentadas en `infra/README.md`.

## Consecuencias

- ✅ La tienda tiene una URL fija con HTTPS, disponible aunque el equipo del grupo esté apagado.
- ✅ Se despliega con los mismos archivos que el laboratorio y el CI, más un *override* de 50 líneas. No hay otra forma de desplegar que mantener.
- ✅ Los secretos y las cuentas viven solo en el servidor.
- ✅ El límite de peticiones vuelve a contar a cada persona.
- ❌ Es un único punto de falla: si la VM se apaga, la tienda también. Es aceptable para la entrega.
- ❌ Las cuentas se crean solo al crear el volumen. Para cambiarlas después, se usa el flujo de la web («¿Olvidaste tu contraseña?», o el panel para el personal) o `down -v`, que borra los datos.
- ❌ Gmail limita los envíos (unos 500 al día) y los primeros correos pueden caer en spam. Para la demostración basta.

## Alternativas descartadas

- **Un PaaS por servicio** (Render, Railway, Fly.io) con bases administradas. Serían 16 piezas que configurar por separado, casi todas de pago, y el despliegue ya no se parecería al laboratorio.
- **Kubernetes administrado** (AKS, OKE). Es desproporcionado para una VM de 4 GB y para lo que se evalúa.
- **Caddy instalado en el sistema operativo** en lugar de en un contenedor. Funciona igual, pero deja la configuración fuera del repositorio.
- **Subir hashes de las contraseñas de producción al repositorio.** Con un repositorio público, cualquiera podría atacarlos sin conexión. En el `.env` del servidor no hay nada que atacar.

## Implementación

| Pieza | Archivo |
|---|---|
| Caddy, web en `127.0.0.1`, proxies y CORS | `docker-compose.nube.yml`, `infra/caddy/Caddyfile` |
| Cuentas de producción | `infra/postgres/07-cuentas-produccion.sh`; variables en `docker-compose.prod.yml` |
| Correo real | `SMTP_*_PROD`, `CORREO_REMITENTE_PROD`, `CORREO_OPERACIONES_PROD` en `docker-compose.prod.yml` |
| Proxies de confianza | `services/api-gateway/src/proxies.ts` (y su prueba unitaria) |
| Comandos | `npm run nube:up`, `nube:down`, `nube:logs` (en la VM, el `docker compose` equivalente) |
| Guía paso a paso | [`docs/manuales/DESPLIEGUE.md`](../manuales/DESPLIEGUE.md) |

## Resultado (2026-11-19)

No fue posible abrir la cuenta en Azure (no aceptó el correo institucional) ni en Oracle Cloud (rechazó la verificación de la tarjeta). La tienda se publicó en un VPS con **Dokploy**, facilitado por un tercero, en <https://149-130-169-209.sslip.io>. La decisión se mantiene con dos ajustes:
- **Dokploy reemplaza a Caddy:** trae Traefik, que pone el HTTPS. `docker-compose.dokploy.yml` no publica puertos y conecta la web a la red de Traefik.
- **El archivo se genera** (`npm run dokploy:compose`) desde `infra/dokploy/compose-fuente.yml`, porque la versión de Docker Compose del VPS (anterior a la 2.24) no entiende `!reset`.

Las cuentas y el correo por entorno y `PROXIES_CONFIANZA=2` funcionan igual.

