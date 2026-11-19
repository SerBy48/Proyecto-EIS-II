# 6. Fase 5: despliegue y validación final

## 6.1 Contenerización y perfiles de despliegue

Todo el sistema corre en contenedores: 16 en total.
- **Los diez servicios** usan una sola imagen parametrizada (`infra/Dockerfile.servicio`, sobre `node:22-alpine`, sin usuario root).
- **La web** se compila con Vite y la sirve `nginx-unprivileged`, que además hace de proxy de `/api` hacia el gateway. Así la web y la API comparten el mismo origen, sin CORS.
- **Los motores de datos** usan sus imágenes oficiales, con etiqueta fija.

<!-- incluir: docs/especificacion/02-especificacion-arquitectura.md :: 2.7 Despliegue -->

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

## 6.3 Despliegue en la nube

<!-- incluir: docs/adr/0010-despliegue-en-una-vm.md :: Decisión -->

**Estado.** La configuración está completa y verificada en local. Se levantó el perfil de la nube con `DOMINIO=localhost`; para ese nombre, Caddy emite su propio certificado.

Tabla: Verificación local del despliegue en la nube

| Comprobación | Resultado |
|---|---|
| Arranque desde volúmenes vacíos | 17 contenedores (16 sanos más Caddy) en 338 s |
| HTTPS y redirección | `https://localhost` responde 200; `http://` redirige con 308 |
| Cuentas | Las tres de producción entran; las de prueba (`Password123`) responden 401 |
| Exposición | El gateway y los servicios no responden desde fuera; solo Caddy publica puertos |
| CORS | Un origen ajeno recibe 403 |
| Límite por persona | 12 inicios de sesión con un `X-Forwarded-For` falso distinto cada uno caen en un solo contador: el cliente no elige su IP |
| Recuperación de contraseña | El correo llega con el enlace al dominio configurado |

Falta crear la máquina virtual. No fue posible abrir la cuenta del proveedor a tiempo: Azure no aceptó el correo institucional y Oracle Cloud rechazó la verificación de la tarjeta. La guía paso a paso para los dos proveedores está en el manual técnico, capítulo 16. Mientras tanto, la tienda se publica durante la demostración con un túnel de Cloudflare (`npm run tunel`) sobre el perfil de producción.

## 6.4 Criterios de aceptación

Cada historia principal tiene un criterio en formato **Dado / Cuando / Entonces**, verificado en la interfaz real con Playwright (`npm run test:e2e:ui`). Cada ejecución guarda una captura por criterio en `docs/evidencia/trabajo-final/e2e-ui/`.

<!-- incluir: docs/aceptacion/CRITERIOS.md :: * -->

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

La matriz de trazabilidad (anexo D) une cada uno de los 74 requisitos funcionales y los 23 no funcionales con su criterio de aceptación, los casos de prueba que lo verifican, el resultado de la última regresión y su evidencia.

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
