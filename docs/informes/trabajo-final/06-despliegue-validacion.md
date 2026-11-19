# 6. Fase 5: despliegue y validación final

## 6.1 Contenerización y perfiles de despliegue

Todo el sistema corre en contenedores: 16 en total.
- **Los diez servicios** usan una sola imagen parametrizada (`infra/Dockerfile.servicio`, sobre `node:22-alpine`, sin usuario root).
- **La web** se compila con Vite y la sirve `nginx-unprivileged`, que además hace de proxy de `/api` hacia el gateway. Así la web y la API comparten el mismo origen, sin CORS.
- **Los motores de datos** usan sus imágenes oficiales, con etiqueta fija.

<!-- incluir: docs/especificacion/02-especificacion-arquitectura.md :: 2.7 Despliegue :: sin-figuras -->

**Arranque robusto (RNF-11).** Desde volúmenes vacíos, el perfil de producción levanta los 16 contenedores sanos en 276 s, compilando las imágenes y sin intervención. Los servicios toleran que RabbitMQ tarde, por tres mecanismos:
- el bus de eventos reintenta la conexión con espera exponencial;
- al reconectar, vuelve a declarar sus consumidores;
- si un servicio falla al iniciar, termina el proceso y Docker lo reinicia.

## 6.2 Integración continua

GitHub Actions (`.github/workflows/ci.yml`) ejecuta en cada push y en cada pull request:
1. **Estático:** typecheck, pruebas unitarias con cobertura, OpenAPI y su lint, auditoría de las dependencias de producción y compilación de la web.
2. **Integración:**
   - genera secretos propios en cada ejecución y levanta el sistema completo con Compose;
   - corre las suites de salud, HTTP, concurrencia, E2E, asistente, seguridad y E2E de interfaz;
   - sube las capturas y, si algo falla, los registros de los contenedores.
3. **No funcionales:** un trabajo manual con el humo de k6 y el *baseline* de ZAP.

El último pull request fusionado (#21) pasó los dos trabajos automáticos.

## 6.3 Despliegue en producción

**La tienda está publicada en <https://149-130-169-209.sslip.io>**, en un VPS con **Dokploy** que facilitó un tercero. El dominio es de sslip.io, que responde con la IP escrita en el nombre.

**Cómo se llegó ahí.**
1. **Primero se preparó una máquina virtual propia** (ADR-0010): el perfil de producción con Caddy delante para el HTTPS, las cuentas y el correo por entorno y el límite de peticiones por persona. Se verificó completa en local, con `DOMINIO=localhost`.
2. **No fue posible abrir la cuenta del proveedor a tiempo:** Azure no aceptó el correo institucional y Oracle Cloud rechazó la verificación de la tarjeta.
3. **Se desplegó en un VPS con Dokploy.** Dokploy ya trae Traefik, que pone el certificado HTTPS, y despliega un archivo de Compose desde GitHub. Para él se creó `docker-compose.dokploy.yml`:
   - reutiliza los mismos servicios del laboratorio con la configuración de producción;
   - no publica ningún puerto en el VPS, que es compartido; Traefik llega a la web por su red interna;
   - fija `PROXIES_CONFIANZA=2`, porque Traefik y nginx van delante del gateway.
4. **Un incidente en el primer despliegue:** el VPS tenía una versión de Docker Compose anterior a la 2.24, que no entiende `!reset`, y le puso a todos los servicios el mismo nombre. Desde entonces el archivo se **genera** a partir de su fuente (`npm run dokploy:compose`), sin funciones de versiones nuevas. Se validó con Compose 2.22 y 2.24.

Tabla: Verificación del despliegue publicado (2026-11-19, desde fuera del VPS)

| Comprobación | Resultado |
|---|---|
| Tienda por HTTPS | 200, con certificado válido de Let's Encrypt |
| HTTP | Redirige a HTTPS (301) |
| Salud del sistema | El gateway y los nueve servicios en «ok» |
| Catálogo | Los 60 productos |
| Cuentas | La cuenta de prueba (`Password123`) es rechazada (401); solo existen las tres de producción |
| Documentación de la API | No se sirve en producción |
| Exposición | El puerto de la web (8081) no responde desde fuera: solo Traefik publica 80 y 443 |
| Cabeceras de la web | `Content-Security-Policy`, `X-Frame-Options` y `X-Content-Type-Options` presentes |

**Pendiente: el correo real.** La cuenta de Gmail del equipo no ofrece contraseñas de aplicación. Mientras se configura (con Gmail o con un proveedor como Brevo), los correos de la tienda quedan guardados dentro del sistema sin enviarse. Basta con agregar las variables `SMTP_*_PROD` y volver a desplegar; los datos no se pierden.

La guía paso a paso está en `docs/manuales/DESPLIEGUE-DOKPLOY.md`. La de una máquina virtual propia en Azure u Oracle, en el capítulo 16 del manual técnico.

## 6.4 Criterios de aceptación

Cada historia principal tiene un criterio en formato **Dado / Cuando / Entonces** (`docs/aceptacion/CRITERIOS.md`). `npm run test:e2e:ui` los verifica en la interfaz real con Playwright y guarda una captura por criterio en `docs/evidencia/trabajo-final/e2e-ui/`. En la última ejecución (19 de noviembre de 2026), **los 29 pasan**.

Tabla: Criterios de aceptación verificados en la interfaz

| Criterio | Historia | | Criterio | Historia |
|---|---|---|---|---|
| CA-01 | Registro de un cliente nuevo | | CA-16 | Modo oscuro y contraseña visible |
| CA-02 | Inicio de sesión (error y éxito) | | CA-17 | Administrador: crear y desactivar un vendedor |
| CA-03 | Búsqueda y filtro | | CA-18 | Sesión vencida: la web vuelve a modo visitante |
| CA-04 | Carrito y cupón | | CA-19 | Productos: precio y oferta con fecha de fin |
| CA-05 | Compra aprobada | | CA-20 | Productos: subir una foto desde el PC |
| CA-06 | Compra rechazada con compensación | | CA-21 | Inventario: entrada con proveedor, costo y factura |
| CA-07 | Última unidad | | CA-22 | Límite por cliente en el carrito |
| CA-08 | Cancelación | | CA-23 | Consulta al vendedor y respuesta en la campana |
| CA-09 | Correo de confirmación | | CA-24 | Recuperar la contraseña con el enlace del correo |
| CA-10 | Asistente virtual | | CA-25 | Ver todas las notificaciones y responder una consulta |
| CA-11 | Vendedor: entrada de stock | | CA-26 | Cerrar sesión y seguir como visitante |
| CA-12 | Administrador: estados del pedido con fecha y hora | | CA-27 | Vendedor: vista previa del catálogo |
| CA-13 | Perfil: datos y direcciones | | CA-28 | El visitante inicia sesión para escribirle al vendedor |
| CA-14 | Dirección al pagar y dos cambios después | | CA-29 | Los filtros no pasan de una cuenta a otra |
| CA-15 | Eliminar la cuenta (bloqueada con pedidos en curso) | | | |

## 6.5 Resultados de las pruebas

Tabla: Suites de pruebas y resultado de la última regresión (2026-11-19, desde volúmenes vacíos)

| Suite | Qué verifica | Resultado |
|---|---|---|
| `test:unit` | Lógica aislada (Vitest) | 187/187 |
| `test:openapi` | La especificación cubre exactamente las rutas del código | 517/517 |
| `test:salud` | Los diez servicios responden | 10/10 |
| `test:http` | Autenticación, RBAC, aislamiento entre clientes, idempotencia, pasarela, ciclo de vida, rate limiting, PCI-DSS | 73/73 |
| `test:concurrencia` | 20 compradores por 5 unidades: exactamente 5 ganan | 33/33 |
| `test:e2e` | Compra completa por la API, pago rechazado con compensación, última unidad, doble clic, cancelación, correo en Mailpit | 53/53 |
| `test:asistente` | Intenciones, contexto, aislamiento por chat, consultas al vendedor, degradación | 57/57 |
| `test:seguridad` | Verificaciones de OWASP Top 10 | 26 seguras + 1 riesgo aceptado |
| `test:e2e:ui` | Criterios de aceptación en la web | **29/29** |
| axe | WCAG 2.2 A y AA, temas claro y oscuro | 48 pantallas, 0 incumplimientos |

## 6.6 Trazabilidad

La matriz de trazabilidad (`docs/aceptacion/TRAZABILIDAD.md`) une cada uno de los 74 requisitos funcionales y los 23 no funcionales con su criterio de aceptación, los casos de prueba que lo verifican, el resultado de la última regresión y su evidencia.

## 6.7 Revisiones de la tienda por el equipo

Después de la Fase 5, el equipo usó la tienda como cliente, vendedor y administrador. Cada ronda de revisión se convirtió en requisitos nuevos, criterios de aceptación y una regresión completa:

Tabla: Rondas de revisión de la Fase 5

| Ronda | Qué cambió | Criterios |
|---|---|---|
| F5b: SerByTek | Identidad de la tienda (solo tecnología, marcas reales, 60 productos con foto), perfil y direcciones, eliminar la cuenta, cambiar la dirección de un pedido, administración de usuarios, tema oscuro y asistente reforzado (plural, errores de tipeo, marcas leídas del catálogo) | CA-13 a CA-18 |
| F5c: gestión de la tienda | Panel de productos (precio, ofertas con fecha de fin, fotos y productos nuevos), proveedores y entradas de mercancía, campana de notificaciones, consultas al vendedor desde el chat y límite de compra por cliente | CA-19 a CA-23 |
| F5d: revisión manual | Recuperar la contraseña por correo, vista completa de notificaciones, pantalla de cierre de sesión, salud del sistema solo para el administrador y con medidas correctivas, historial de estados del pedido y vista previa del catálogo para el personal | CA-24 a CA-27 |
| F5e: segunda revisión | El visitante inicia sesión para escribirle al vendedor (sin tickets sin dueño), los filtros no pasan de una cuenta a otra, validación junto al campo con las reglas del servidor y modo demostración del asistente para el personal | CA-28 y CA-29 |
| Despliegue en la nube | Caddy con HTTPS, cuentas y correo por entorno, límite de peticiones por persona | Verificación local (6.3) |

## 6.8 Defectos encontrados y corregidos

`docs/PRUEBAS.md` registra **44 entradas** de defectos y hallazgos, cada una con su síntoma, causa, corrección y caso de prueba. Algunos ejemplos:
- **Graves:** una escalada de privilegios con el token interno, secretos por defecto que permitían forjar tokens de administrador y el registro vinculado a otro cliente.
- **Bajo carga:** el login limitado por bcrypt en el hilo principal y un gateway que cortaba conexiones en lugar de responder 504.
- **De resiliencia:** un correo fallido que se perdía en el reintento y un circuit breaker que, en semiabierto, dejaba pasar todo.
- **De usabilidad:** solo cuatro cuentas podían entrar y el 72 % del catálogo era inalcanzable navegando.

Cada defecto corregido quedó con un caso de prueba que lo reproduce, para que no vuelva a aparecer.
