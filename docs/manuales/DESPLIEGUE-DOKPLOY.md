# Despliegue con Dokploy

Guía para publicar SerByTek en un VPS que ya tiene **Dokploy**. Es la alternativa a la máquina virtual propia de [`DESPLIEGUE.md`](DESPLIEGUE.md): Dokploy pone Traefik, el certificado HTTPS y el panel para desplegar desde GitHub.

**Cómo queda.** Dokploy clona el repositorio y levanta `docker-compose.dokploy.yml`:

```
Internet ──443──▶ Traefik (de Dokploy, HTTPS) ──▶ web (nginx :8080) ──/api──▶ gateway ──▶ 10 servicios ──▶ PostgreSQL, MongoDB, Redis, RabbitMQ
```

| Qué | Cómo |
|---|---|
| Servicios y bases | Las mismas definiciones de `docker-compose.yml` (con `extends`), configuradas como en el perfil de producción |
| Puertos | **Ninguno publicado** en el VPS. Traefik llega a la web por la red `dokploy-network` |
| Nombres | Sin `container_name`: Dokploy los desaconseja, y en un VPS compartido podrían chocar |
| Proxies | `PROXIES_CONFIANZA=2` (Traefik y nginx): el límite de peticiones cuenta a cada persona |
| Cuentas | Las tres de producción, con los datos de las variables de entorno (`07-cuentas-produccion.sh`) |
| Correo | Gmail si se definen `SMTP_*_PROD`; si no, Mailpit dentro de la red, sin interfaz pública |

Requisitos: unos 2 GB de RAM libres para el sistema en marcha y unos 4 GB durante la primera compilación de las imágenes.

---

## 1. El dominio

Se usa **sslip.io**, que responde con la IP escrita en el nombre:
- con la IP pública del VPS `129.80.1.2`, el dominio es **`129-80-1-2.sslip.io`**;
- compruébelo con `nslookup 129-80-1-2.sslip.io`: debe devolver la IP.

Los puertos 80 y 443 del VPS ya los atiende Traefik de Dokploy; no hay que abrir nada más.

## 2. Crear el servicio en Dokploy

1. En el panel de Dokploy: **Projects → Create Project**, por ejemplo `serbytek`.
2. Dentro del proyecto: **Create Service → Compose**, por ejemplo `tienda`.
3. En **General → Provider**: **Git** (o **GitHub** si la cuenta está conectada):
   - Repository URL: `https://github.com/SerBy48/Proyecto-EIS-II.git`
   - Branch: `main`
   - **Compose Path: `./docker-compose.dokploy.yml`**
4. **Save**.

## 3. Variables de entorno

En la pestaña **Environment**, pegue el bloque y **Save**. Dokploy lo guarda como el `.env` del proyecto, que Compose usa al levantar. Los valores son ejemplos: genere los secretos con `openssl rand -hex 32` (en Git Bash o en el VPS) y no los reutilice de otro entorno.

```ini
# Dominio (paso 1) y direccion de la web
DOMINIO=129-80-1-2.sslip.io
URL_WEB=https://129-80-1-2.sslip.io

# Secretos: tres valores distintos de 64 caracteres (openssl rand -hex 32)
JWT_SECRET=
JWT_REFRESH_SECRET=
INTERNAL_TOKEN=
POSTGRES_PASSWORD=
MONGO_PASSWORD=

# Cuentas de produccion (contrasenas de 12 caracteres o mas)
CORREO_ADMIN=tu.correo+admin@gmail.com
CLAVE_ADMIN=
CORREO_VENDEDOR=tu.correo+vendedor@gmail.com
CLAVE_VENDEDOR=
CORREO_CLIENTE=cliente@ejemplo.com
CLAVE_CLIENTE=
NOMBRE_CLIENTE=Nombre
APELLIDO_CLIENTE=Apellido

# Correo real por Gmail (contrasena de aplicacion de 16 letras, sin espacios)
SMTP_HOST_PROD=smtp.gmail.com
SMTP_PUERTO_PROD=465
SMTP_SEGURO_PROD=true
SMTP_USUARIO_PROD=tu.correo@gmail.com
SMTP_CLAVE_PROD=
CORREO_REMITENTE_PROD=SerByTek <tu.correo@gmail.com>
CORREO_OPERACIONES_PROD=tu.correo+operaciones@gmail.com
```

Cómo se generan las cuentas y la contraseña de aplicación de Gmail: [`DESPLIEGUE.md`](DESPLIEGUE.md), secciones 5.3 y 5.4.

## 4. Desplegar

1. Pulse **Deploy**. La primera vez compila las once imágenes: de 5 a 15 minutos. El avance se ve en **Deployments** (el registro de la compilación).
2. Al terminar, en **Logs** elija el servicio `postgres` y busque la línea `07-cuentas-produccion: cuentas de prueba reemplazadas por las de produccion`.

## 5. Agregar el dominio con HTTPS

En la pestaña **Domains → Add Domain**:

| Campo | Valor |
|---|---|
| Service Name | **`web`** |
| Host | `129-80-1-2.sslip.io` |
| Path | `/` |
| Container Port | **`8080`** (el puerto de nginx dentro del contenedor) |
| HTTPS | activado |
| Certificate | Let's Encrypt |

Guarde y vuelva a pulsar **Deploy** para que Traefik tome el dominio. En uno o dos minutos, `https://129-80-1-2.sslip.io` debe abrir la tienda con un certificado válido.

## 6. Verificar

Igual que la sección 7 de [`DESPLIEGUE.md`](DESPLIEGUE.md):
1. Entrar como administrador → **Salud del sistema**: todo en verde.
2. Comprar con la cuenta de cliente; llega el correo de confirmación.
3. **¿Olvidaste tu contraseña?** con el correo del cliente: el enlace apunta a `https://<DOMINIO>/#restablecer=…`.

## 7. Operación

| Qué | Cómo |
|---|---|
| Actualizar tras un merge a `main` | **Deploy** en el servicio, o activar **Autodeploy** con el webhook de GitHub |
| Registros de un servicio | Pestaña **Logs**, eligiendo el servicio |
| Reiniciar | **Stop** y **Deploy**, o **Reload** |
| Borrar los datos y empezar de cero | **Stop**; por SSH, `docker volume ls` para ver los volúmenes del proyecto (terminan en `pg_datos`, `mongo_datos`, `redis_datos` y `rabbit_datos`) y `docker volume rm` de cada uno; luego **Deploy**. Vuelve a crear las tres cuentas con las variables |

Las cuentas se crean solo al crear el volumen de PostgreSQL. Cambiar una contraseña en **Environment** después **no** la cambia: use **¿Olvidaste tu contraseña?** o el panel de Usuarios.

## 8. Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| El despliegue falla con `Defina CORREO_ADMIN…` (u otra variable) | Falta esa línea en **Environment** |
| `network dokploy-network declared as external, but could not be found` | El servidor no es un nodo de Dokploy, o la red tiene otro nombre: revise con `docker network ls` |
| `Bad Gateway` o `404` en el dominio | El dominio apunta a otro servicio o puerto: debe ser `web` y `8080`. Vuelva a desplegar después de agregarlo |
| El certificado no es válido | Traefik no pudo pedirlo: el dominio debe resolver a la IP del VPS y el puerto 80 debe llegar a Traefik |
| `container ... notificaciones ... is unhealthy` en el primer despliegue | RabbitMQ tardó en iniciar; se recupera solo en uno o dos minutos |
| `429` para todos a la vez | `PROXIES_CONFIANZA` debe ser 2 (lo fija el archivo); no lo cambie en **Environment** |
| No llegan los correos | Revise los registros de `notificaciones-service`: `Invalid login` indica la contraseña de aplicación; sin `SMTP_HOST_PROD`, quedan en Mailpit |
