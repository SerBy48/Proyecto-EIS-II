# Despliegue en la nube

Guía para publicar SerByTek en una máquina virtual de **Azure** o de **Oracle Cloud**, con HTTPS y correo real. La decisión y sus razones están en [ADR-0010](../adr/0010-despliegue-en-una-vm.md).

**Cómo queda.** Una sola máquina con Docker corre el mismo perfil de producción del laboratorio (`docker-compose.prod.yml`), más `docker-compose.nube.yml`:

```
Internet ──443──▶ Caddy (HTTPS) ──▶ web (nginx) ──/api──▶ gateway ──▶ 10 servicios ──▶ PostgreSQL, MongoDB, Redis, RabbitMQ
```

- **Puertos abiertos:** solo 80 y 443, que atiende Caddy, y 22 para SSH. Todo lo demás queda en la red interna de Docker.
- **Mailpit** se ve solo por un túnel SSH.

Los únicos pasos distintos entre Azure y Oracle son el 1 y el 2.

---

## 1. Crear la máquina virtual

### Opción A: Azure for Students

1. Active la suscripción en <https://azure.microsoft.com/es-es/free/students> con el correo institucional. No pide tarjeta.
2. En el portal, vaya a **Máquinas virtuales → Crear → Máquina virtual de Azure** y llene:

   | Campo | Valor |
   |---|---|
   | Grupo de recursos | nuevo, `rg-serbytek` |
   | Nombre | `vm-serbytek` |
   | Región | East US 2, o la que tenga disponible el tamaño |
   | Imagen | **Ubuntu Server 24.04 LTS – x64 Gen2** |
   | Tamaño | **Standard_B2s** (2 vCPU, 4 GB); si no aparece, B2as_v2 o B2ls_v2 |
   | Autenticación | clave pública SSH; usuario `azureuser`; *Generar nuevo par de claves* |
   | Puertos de entrada | **SSH (22), HTTP (80), HTTPS (443)** |
   | Disco del sistema operativo (pestaña Discos) | 64 GB, SSD estándar |

3. **Revisar y crear.** Descargue el archivo `.pem` de la clave y guárdelo: no se puede volver a descargar.
4. Abra la VM → **Dirección IP pública** → **Configuración**:
   - **Asignación: Estática**, para que la IP no cambie al apagarla.
   - **Etiqueta de nombre DNS:** `serbytek`, o la que esté libre.

   Ese es su dominio: **`serbytek.<region>.cloudapp.azure.com`**.
5. Para no gastar el crédito:
   - programe en **Operaciones → Apagado automático** una hora de apagado por la noche;
   - cuando no la use, deténgala con **Detener** (desasigna la máquina y no se cobra el cómputo).

### Opción B: Oracle Cloud Always Free

1. Cree la cuenta en <https://www.oracle.com/cloud/free/>.
   - Pide una tarjeta para verificar la identidad; dentro del nivel gratuito no cobra.
   - La región de inicio (São Paulo, Bogotá…) no se puede cambiar después.
2. Vaya a **Compute → Instances → Create instance** y llene:

   | Campo | Valor |
   |---|---|
   | Image | **Canonical Ubuntu 24.04**, versión **aarch64** |
   | Shape | **Ampere VM.Standard.A1.Flex**, 2 OCPU y 12 GB (el nivel gratuito permite hasta 4 OCPU y 24 GB) |
   | Networking | VCN nueva con subred pública; *Assign a public IPv4 address* |
   | SSH keys | *Generate a key pair*; descargue la clave privada |
   | Boot volume | 100 GB |

3. Si aparece **"Out of capacity"**:
   - pruebe otro *Availability Domain* o vuelva a intentarlo más tarde;
   - o pase la cuenta a *Pay As You Go*: lo que está dentro del nivel gratuito sigue sin cobrarse.
4. Abra los puertos en la nube: **la instancia → Subnet → Security List → Add Ingress Rules**:
   - origen `0.0.0.0/0`;
   - protocolo TCP;
   - puertos **80** y **443**.
5. **El dominio** es `<ip-con-guiones>.sslip.io`. Por ejemplo, con la IP `129.80.1.2` es `129-80-1-2.sslip.io`. sslip.io responde con la IP que va en el nombre, así que no hay nada que registrar.

Todas las imágenes del proyecto tienen versión ARM (postgres, mongo 7, redis, rabbitmq, mailpit, node, nginx y caddy).

---

## 2. Entrar por SSH

Desde PowerShell, en el equipo donde está la clave:

```powershell
# Solo la primera vez: OpenSSH exige que el archivo de la clave sea privado
icacls .\clave.pem /inheritance:r /grant:r "$($env:USERNAME):(R)"
ssh -i .\clave.pem azureuser@<IP>      # en Oracle el usuario es ubuntu
```

**Solo en Oracle.** La imagen trae un firewall propio (iptables) que bloquea todo menos el 22. Ábralo para la web:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

---

## 3. Preparar la máquina

```bash
sudo apt update && sudo apt -y upgrade
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
exit                                   # salga y vuelva a entrar por SSH
```

Al volver a entrar, compruebe la versión con `docker compose version`. Debe ser la 2.24 o mayor, porque el perfil prod usa `!reset` y `!override`.

**Con 4 GB de memoria** (Azure B2s), agregue 4 GB de intercambio para que la compilación de las imágenes no se quede sin memoria:

```bash
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 4. Clonar el repositorio

```bash
git clone -b main https://github.com/SerBy48/Proyecto-EIS-II.git serbytek
cd serbytek
```

- Use `main` si ya tiene la versión a desplegar; si no, `develop`.
- Si el repositorio fuera privado, en la contraseña va un token personal de GitHub de solo lectura.

---

## 5. El `.env` del servidor

Se crea **en la máquina**, nunca se copia del equipo de desarrollo y nunca se sube al repositorio.

### 5.1 Secretos y bases

```bash
cp .env.example .env
for v in JWT_SECRET JWT_REFRESH_SECRET INTERNAL_TOKEN; do
  sed -i "s|^$v=.*|$v=$(openssl rand -hex 32)|" .env
done
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 16)|" .env
sed -i "s|^MONGO_PASSWORD=.*|MONGO_PASSWORD=$(openssl rand -hex 16)|" .env
```

### 5.2 Dominio y dirección de la web

Reemplace el dominio por el suyo:

```bash
DOMINIO=serbytek.eastus2.cloudapp.azure.com
sed -i "s|^URL_WEB=.*|URL_WEB=https://$DOMINIO|" .env
echo "DOMINIO=$DOMINIO" >> .env
```

`URL_WEB` es la dirección que va en el enlace del correo de recuperación de contraseña. CORS y los proxies los fija `docker-compose.nube.yml` a partir de `DOMINIO`.

### 5.3 Las tres cuentas

Al crear la base, el script `infra/postgres/07-cuentas-produccion.sh` reemplaza las cuentas de prueba por estas tres. Las contraseñas deben tener 12 caracteres o más.

```bash
nano .env
```

Al final del archivo agregue (con sus datos):

```ini
CORREO_ADMIN=tu.correo+admin@gmail.com
CLAVE_ADMIN=...
CORREO_VENDEDOR=tu.correo+vendedor@gmail.com
CLAVE_VENDEDOR=...
CORREO_CLIENTE=correo.del.cliente@ejemplo.com
CLAVE_CLIENTE=...
NOMBRE_CLIENTE=Nombre
APELLIDO_CLIENTE=Apellido
```

**El `+` en los correos.** Gmail entrega `tu.correo+admin@gmail.com` en la bandeja de `tu.correo@gmail.com`. Así el administrador, el vendedor y el buzón de operaciones tienen cada uno su correo y todos llegan a la misma bandeja.

### 5.4 Correo real con Gmail

1. En la cuenta de Gmail que enviará los correos, active la **verificación en dos pasos**.
2. Vaya a **Cuenta de Google → Seguridad → Contraseñas de aplicaciones** y cree una, por ejemplo "SerByTek". Google muestra 16 letras.
3. Agregue al `.env` (la contraseña sin espacios):

```ini
SMTP_HOST_PROD=smtp.gmail.com
SMTP_PUERTO_PROD=465
SMTP_SEGURO_PROD=true
SMTP_USUARIO_PROD=tu.correo@gmail.com
SMTP_CLAVE_PROD=abcdefghijklmnop
CORREO_REMITENTE_PROD=SerByTek <tu.correo@gmail.com>
CORREO_OPERACIONES_PROD=tu.correo+operaciones@gmail.com
```

- **El remitente** debe ser la misma cuenta de `SMTP_USUARIO_PROD`: Gmail no deja enviar a nombre de otra.
- **Sin `SMTP_HOST_PROD`**, los correos se quedan en Mailpit (sección 8).

Revise lo que quedó, sin mostrar las contraseñas:

```bash
grep -E "^(DOMINIO|URL_WEB|CORREO_|NOMBRE_|APELLIDO_|SMTP_HOST_PROD|SMTP_USUARIO_PROD)" .env
```

---

## 6. Levantar la tienda

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.nube.yml up -d --build --wait
```

Es lo mismo que `npm run nube:up`, pero sin necesitar Node en la máquina.

- **Tiempo:** la primera vez se compilan las imágenes, de 5 a 15 minutos. Al terminar deben quedar **17 contenedores sanos**, los 16 del perfil prod más Caddy.
- **Comprobación:**

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.nube.yml ps
docker logs ecom_postgres 2>&1 | grep 07-cuentas      # "cuentas de prueba reemplazadas por las de produccion"
docker logs ecom_caddy 2>&1 | grep -i "certificate obtained"
```

Para no escribir los tres `-f` cada vez:

```bash
echo 'alias tienda="docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.nube.yml"' >> ~/.bashrc
source ~/.bashrc          # luego: tienda ps, tienda logs -f caddy, tienda up -d --build --wait
```

---

## 7. Verificar

1. Abra `https://<DOMINIO>`. El candado del navegador debe mostrar un certificado válido.
2. Entre con la cuenta de **administrador** → **Administración → Salud del sistema**: todo en verde.
3. Con la cuenta de **cliente**, haga una compra. La pasarela simulada aprueba con cualquier tarjeta válida. El correo de confirmación llega a la bandeja del cliente.
4. Cierre sesión y use **¿Olvidaste tu contraseña?** con el correo del cliente.
   - Llega un correo con el enlace `https://<DOMINIO>/#restablecer=…`, que vence en 30 minutos.
   - Si no aparece, revise la carpeta de spam y marque el correo como "no es spam".
5. Compruebe que nada más quede expuesto. Desde **su** equipo, estas dos peticiones deben fallar:
   - `http://<IP>:8081`
   - `http://<IP>:8080`

---

## 8. Ver los correos de Mailpit

Si no configuró Gmail, abra un túnel SSH desde su equipo y entre a <http://localhost:8025>:

```powershell
ssh -i .\clave.pem -L 8025:127.0.0.1:8025 azureuser@<IP>
```

---

## 9. Operación

| Qué | Comando (en `~/serbytek`, con el alias `tienda`) |
|---|---|
| Ver el estado | `tienda ps` |
| Registros de un servicio | `tienda logs -f --tail=100 pedidos-service` |
| Actualizar tras un merge | `git pull && tienda up -d --build --wait` |
| Reiniciar un servicio | `tienda restart notificaciones-service` |
| Apagar (conserva los datos) | `tienda down` |
| **Borrar todo y empezar de cero** | `tienda down -v`, y luego `tienda up -d --build --wait`. Borra pedidos, clientes y certificados, y vuelve a crear las tres cuentas con el `.env` |

- **Al reiniciar la máquina**, los contenedores vuelven solos (`restart: unless-stopped`). Compruébelo con `tienda ps`.
- **Las cuentas** se crean una sola vez, al crear el volumen. Cambiar una contraseña en el `.env` después **no** la cambia. Para eso:
  - use **¿Olvidaste tu contraseña?** en la web, o el panel de Usuarios para el personal;
  - o haga `down -v`, que borra los datos.

---

## 10. Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `up --wait` termina con `container ecom_notificaciones is unhealthy` | Pasa a veces en el primer arranque: RabbitMQ tarda en iniciar y notificaciones queda *unhealthy* mientras su bus reintenta. Se recupera solo en uno o dos minutos; compruébelo con `tienda ps`. Si sigue así después de 5 minutos, `tienda restart notificaciones-service`. |
| `Defina CORREO_ADMIN en .env` (u otra variable) al levantar | Falta esa línea en el `.env` (sección 5). |
| `07-cuentas-produccion: CLAVE_… debe tener al menos 12 caracteres` en `docker logs ecom_postgres` | Corrija la clave en el `.env` y repita con `tienda down -v`: el script solo corre al crear el volumen. |
| El navegador dice que el certificado no es válido | Caddy no pudo pedirlo. Revise `docker logs ecom_caddy`. El puerto 80 debe estar abierto en la nube (y en iptables, en Oracle) y `DOMINIO` debe resolver a la IP de la máquina (`nslookup <DOMINIO>`). |
| `429 Demasiadas peticiones` para todos a la vez | El gateway no ve la IP de cada persona: `PROXIES_CONFIANZA` debe ser 2, que fija `docker-compose.nube.yml`. Levante siempre con los tres `-f`. |
| No llegan los correos | Revise `docker logs ecom_notificaciones`. `Invalid login` indica una contraseña de aplicación incorrecta o sin la verificación en dos pasos. Si dice que no hay SMTP, falta `SMTP_HOST_PROD`. Si llegan a spam, márquelos como "no es spam". |
| La compilación se detiene sin memoria | Falta el intercambio de la sección 3, o la máquina tiene menos de 4 GB. |
| `Out of capacity` en Oracle | Ver el paso 1-B.3. |
