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

Elija **una** de las dos opciones. Lleva de 20 a 45 minutos.

| | Azure for Students | Oracle Cloud Always Free |
|---|---|---|
| Qué pide | Correo institucional reconocido por Microsoft (o verificación por GitHub Education) | Una tarjeta de crédito o débito, solo para verificar la identidad |
| Costo | 100 USD de crédito por 12 meses; la VM consume unos 30 USD al mes encendida | Gratis de forma permanente dentro del límite |
| Máquina | 2 vCPU y 4 GB (x64) | 2 OCPU y 12 GB (ARM; hasta 4 y 24 gratis) |
| Dominio | `serbytek.<region>.cloudapp.azure.com`, gratis | `<ip-con-guiones>.sslip.io` |
| Usuario SSH | `azureuser` | `ubuntu` |

Todas las imágenes del proyecto tienen versión ARM (postgres, mongo 7, redis, rabbitmq, mailpit, node, nginx y caddy), y el código no tiene dependencias nativas, así que funciona igual en las dos.

### Opción A: Azure for Students

**A.1 Activar la suscripción**

1. Entre a <https://azure.microsoft.com/es-es/free/students> → **Comenzar gratis**, con el correo institucional. No pide tarjeta.
2. Llene el formulario (país, nombre, teléfono para el código de verificación) y acepte.
3. Compruebe el crédito en <https://www.microsoftazuresponsors.com/balance>.

Si Microsoft no reconoce el correo institucional, la alternativa sin tarjeta es verificarse en **GitHub Education** (<https://education.github.com/pack>), que también da acceso a Azure for Students.

**A.2 Crear la VM.** En <https://portal.azure.com> busque **Máquinas virtuales** → **+ Crear** → **Máquina virtual de Azure**. Llene pestaña por pestaña:

*Datos básicos*

| Campo | Valor |
|---|---|
| Suscripción | Azure for Students |
| Grupo de recursos | Crear nuevo: `rg-serbytek` |
| Nombre de la máquina virtual | `vm-serbytek` |
| Región | (US) East US 2. Si dice "región no permitida", ver A.6 |
| Opciones de disponibilidad | No se requiere redundancia de la infraestructura |
| Tipo de seguridad | Máquinas virtuales de inicio seguro (predeterminado) |
| Imagen | **Ubuntu Server 24.04 LTS - x64 Gen2** |
| Azure Spot | **Sin marcar** (una VM Spot se apaga sola) |
| Tamaño | **Standard_B2s** (2 vCPU, 4 GiB). Si no está: **B2als_v2** |
| Tipo de autenticación | Clave pública SSH |
| Nombre de usuario | `azureuser` |
| Origen de la clave pública SSH | Generar nuevo par de claves (RSA), nombre `vm-serbytek_key` |
| Puertos de entrada públicos | Permitir los puertos seleccionados: **HTTP (80), HTTPS (443) y SSH (22)** |

*Discos:* tamaño del disco del sistema operativo **64 GiB**, tipo **SSD estándar**, "Eliminar con la VM" marcado. Sin discos de datos.

*Redes:* deje la red virtual, la subred y la IP pública nuevas que propone Azure. Grupo de seguridad **Básico**, con los mismos tres puertos. Marque "Eliminar la IP pública y la NIC cuando se elimine la VM". Equilibrio de carga: ninguno.

*Administración:* Microsoft Defender **no**. **Habilitar el apagado automático**: 11:00 p. m., zona **(UTC-05:00) Bogotá, Lima, Quito**; la notificación por correo es opcional. Copia de seguridad **no**.

*Supervisión:* diagnóstico de arranque con la cuenta de almacenamiento administrada (predeterminado). *Opciones avanzadas* y *Etiquetas*: sin cambios.

*Revisar y crear:* espere **"Validación superada"** → **Crear** → **Descargar clave privada y crear recurso**. El archivo `vm-serbytek_key.pem` **solo se puede descargar esa vez**. Guárdelo:

```powershell
mkdir $HOME\.ssh -Force
Move-Item "$HOME\Downloads\vm-serbytek_key.pem" "$HOME\.ssh\vm-serbytek_key.pem"
```

**A.3 IP fija y dominio.** En la VM, haga clic en la **Dirección IP pública** → **Configuración**:
- **Asignación:** Estática.
- **Etiqueta de nombre DNS:** `serbytek` (o `serbytek-tienda` si está ocupada).
- Guarde.

El dominio es **`serbytek.<region>.cloudapp.azure.com`**. Compruébelo con `nslookup <dominio>`, que debe devolver la IP.

**A.4 Puertos.** En la VM → **Redes** → **Configuración de red** deben aparecer permitidos 22, 80 y 443, y nada más. Si falta uno: **Crear regla de puerto** → regla de entrada, puerto `80` o `443`, protocolo TCP, acción Permitir.

**A.5 Alerta de gasto.** **Administración de costos** → **Presupuestos** → **+ Agregar**: mensual, 25 USD, alerta al 80 % por correo.

**A.6 Errores al crearla**

| Error | Qué hacer |
|---|---|
| *RequestDisallowedByPolicy* o región no permitida | Azure for Students limita las regiones: pruebe East US, Central US, West US 2, West US 3 o Brazil South |
| El tamaño no está disponible | Use B2als_v2 o cambie de región |
| Se superó la cuota de vCPU | Revise que no haya otra VM creada, o cambie de región |
| La etiqueta DNS está ocupada | Use otra |

**Uso diario.** Para encenderla, **Iniciar**; el apagado automático no la vuelve a encender. Para apagarla, **Detener**, que desasigna la VM y deja de cobrar el cómputo. Apagarla desde Linux (`sudo shutdown`) no la desasigna y sigue cobrando.

### Opción B: Oracle Cloud Always Free

**B.1 Crear la cuenta**

1. Entre a <https://www.oracle.com/cloud/free/> → **Start for free**.
2. **Account information:** país Colombia, nombre y correo (cualquier correo sirve) → **Verify my email** y abra el enlace, que vence en 30 minutos.
3. **Contraseña** y **Cloud Account Name**, por ejemplo `serbytek`. Es el nombre del *tenancy*: se escribe cada vez que se entra.
4. **Home Region:** **no se puede cambiar después**, y los recursos gratuitos solo existen en ella.
   - **Brazil East (Sao Paulo):** buena latencia desde Colombia.
   - **Colombia Central (Bogota):** la más cercana, pero más pequeña, así que puede tener menos capacidad ARM.
5. **Address information:** dirección y teléfono.
6. **Payment verification:** tarjeta de crédito o débito. Oracle hace una retención temporal de prueba (alrededor de 1 USD) que se libera sola, y no cobra mientras no se actualice la cuenta. Si la verificación falla, ver B.9.
7. Acepte el acuerdo → **Start my free trial**, y espere el correo **"Your Oracle Cloud account is fully provisioned"** (de minutos a un par de horas).

Los 300 USD de prueba por 30 días no hacen falta: la máquina que se crea es *Always Free* y sigue gratis después.

**B.2 Primer inicio de sesión.** En <https://cloud.oracle.com> escriba el Cloud Account Name → correo y contraseña. La primera vez exige **verificación en dos pasos**: instale **Oracle Mobile Authenticator** en el celular y escanee el código QR. Arriba a la derecha, compruebe la región.

**B.3 Crear la instancia.** Menú **☰** → **Compute** → **Instances** → **Create instance**:

| Sección | Valor |
|---|---|
| Name | `vm-serbytek` |
| Compartment | la raíz (la que aparece) |
| Placement | **AD-1** (si sale *Out of capacity*, pruebe otro; ver B.4) |
| Shape (**Change shape**) | Virtual machine → **Ampere** → **VM.Standard.A1.Flex** (*Always Free-eligible*), **2 OCPU y 12 GB** → Select shape |
| Image (**Change image**) | **Ubuntu** → **Canonical Ubuntu 24.04** (no la *Minimal*), build **aarch64** → Select image |
| Primary network | **Create new virtual cloud network** `vcn-serbytek` |
| Subnet | **Create new public subnet** `subnet-serbytek` |
| Public IPv4 address | **Automatically assign public IPv4 address** (marcado) |
| SSH keys | **Generate a key pair for me** → **Download private key** (y la pública como respaldo). **Solo se puede descargar esa vez** |
| Boot volume | **Specify a custom boot volume size**: 100 GB; rendimiento *Balanced* (predeterminado) |

Pulse **Create**. El estado pasa de *Provisioning* a **Running** en 1 a 3 minutos. Anote la **Public IP address**; el usuario es `ubuntu`. La IP se conserva aunque detenga e inicie la máquina, y solo se pierde si la elimina (*Terminate*).

**B.4 "Out of capacity for shape VM.Standard.A1.Flex"** es el error más común. Pruebe en este orden:
1. Otro Availability Domain, si la región tiene varios.
2. Menos recursos: 1 OCPU y 6 GB. Alcanza para la tienda; la compilación inicial es más lenta, y luego se puede ampliar.
3. Reintentar más tarde; en la madrugada suele haber más capacidad.
4. **Pasar la cuenta a Pay As You Go** (☰ → **Billing & Cost Management** → **Upgrade and Manage Payment**). Lo Always Free sigue siendo gratis y casi siempre aparece capacidad. Cree entonces la alerta de B.8.

**B.5 Abrir 80 y 443 en la red de Oracle.** En la instancia → pestaña **Networking** → la **Subnet** → **Security** (o *Security Lists*) → **Default Security List** → **Add Ingress Rules**. Agregue dos reglas, la segunda con **+ Another Ingress Rule**:

| Campo | Regla 1 | Regla 2 |
|---|---|---|
| Stateless | no | no |
| Source CIDR | `0.0.0.0/0` | `0.0.0.0/0` |
| IP Protocol | TCP | TCP |
| Destination Port Range | `80` | `443` |

El 22 ya viene abierto. No abra ningún otro.

**B.6 Guardar la clave.**

```powershell
mkdir $HOME\.ssh -Force
Move-Item "$HOME\Downloads\ssh-key-AAAA-MM-DD.key" "$HOME\.ssh\oracle-serbytek.key"
```

**B.7 El dominio.** Oracle no da nombre: se usa **sslip.io**, con la IP escrita con guiones. Con la IP `129.80.1.2`, el dominio es **`129-80-1-2.sslip.io`**; compruébelo con `nslookup 129-80-1-2.sslip.io`. sslip.io responde con la IP que va en el nombre, así que no hay nada que registrar.

**B.8 Alerta de gasto** (si pasó a Pay As You Go). ☰ → **Billing & Cost Management** → **Budgets** → **Create Budget**: mensual, 5 USD, alerta por gasto real al 1 %, por correo. Avisa con el primer centavo.

**B.9 Si la verificación de la tarjeta falla** ("no fue posible crear la cuenta" después de los datos de pago):
- **Habilite en la app del banco las compras internacionales y por internet.** Muchas tarjetas colombianas las traen bloqueadas, y Oracle cobra la retención desde el exterior.
- La **dirección y el nombre** deben coincidir con los de la tarjeta.
- **Desactive la VPN**, use una ventana de incógnito sin autocompletar, o pruebe otro navegador.
- Las tarjetas **prepagadas o virtuales** suelen ser rechazadas: pruebe una de crédito, o una débito Visa o Mastercard física.
- Tras varios intentos fallidos, Oracle puede bloquear el registro por unas horas: espere antes de reintentar. Si persiste, el chat de soporte de la página de registro puede revisar el caso.

---

## 2. Entrar por SSH

En PowerShell, en el equipo donde está la clave (el usuario es `azureuser` en Azure y `ubuntu` en Oracle):

```powershell
# Solo la primera vez: OpenSSH exige que el archivo de la clave sea privado
icacls "$HOME\.ssh\<clave>" /inheritance:r /grant:r "$($env:USERNAME):(R)"
ssh -i "$HOME\.ssh\<clave>" <usuario>@<IP o dominio>
```

- La primera vez responda **`yes`** a la pregunta de la huella.
- Está dentro cuando ve `<usuario>@vm-serbytek:~$`.

Atajo opcional, para entrar luego con `ssh serbytek`:

```powershell
Add-Content "$HOME\.ssh\config" "`nHost serbytek`n  HostName <IP o dominio>`n  User <usuario>`n  IdentityFile ~/.ssh/<clave>"
```

| Error de SSH | Qué hacer |
|---|---|
| *Permissions for … are too open* | Repita el `icacls` |
| *Connection timed out* | La VM está detenida (en Azure, el apagado automático), o falta la regla del puerto 22 |

**Solo en Oracle:** la imagen de Ubuntu trae un firewall propio (iptables) que bloquea todo menos el 22, **además** de la regla de B.5. Ábralo dentro de la máquina:

```bash
sudo iptables -I INPUT 1 -p tcp -m state --state NEW -m multiport --dports 80,443 -j ACCEPT
sudo netfilter-persistent save                       # sobrevive a los reinicios
sudo iptables -L INPUT -n --line-numbers | head -5   # la regla de 80,443 debe estar arriba
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

**Con 4 GB de memoria** (Azure B2s; en Oracle, con 12 GB, no hace falta), agregue 4 GB de intercambio para que la compilación de las imágenes no se quede sin memoria:

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
