# Módulo 3 — Pruebas de seguridad

> Evidencia cruda en [`docs/evidencia/no-funcionales/seguridad/`](../evidencia/no-funcionales/seguridad/): reportes de ZAP en HTML, JSON y Markdown, la salida de consola y [`verificaciones-manuales.json`](../evidencia/no-funcionales/seguridad/verificaciones-manuales.json). Clasificación con el **OWASP Top 10 2025** y puntajes **CVSS v3.1** calculados con la fórmula de la especificación.

## 1. Herramientas, alcance y configuración

| Aspecto | Valor |
|---|---|
| Escáner | **OWASP ZAP 2.17.0** en Docker (`ghcr.io/zaproxy/zaproxy:stable`), con sus scripts empaquetados |
| Verificaciones manuales | [`tests/seguridad/verificaciones.ts`](../../tests/seguridad/verificaciones.ts) (`npm run test:seguridad`): 16 pruebas automatizadas de lo que ZAP no cubre |
| Alcance | **Solo el propio proyecto en este equipo.** Los objetivos están fijos en los scripts (`host.docker.internal:4173` y `:8080`) y no aceptan URL externas |
| Web | Build de producción (`npm run build:web`) servido con `vite preview` en el 4173, con el proxy `/api` hacia el gateway |
| API | Gateway en el 8080, con los 9 servicios en contenedores |
| Fecha | 15/11/2026 |

Detalles de configuración (en [`tests/seguridad/zap-comun.sh`](../../tests/seguridad/zap-comun.sh)):

- **Contenedor y equipo.** ZAP llega al equipo por `host.docker.internal`. Vite 5 rechaza los `Host` desconocidos, así que el baseline reescribe la cabecera con una regla *replacer* (`Host: localhost:4173`) en lugar de abrir `allowedHosts` en la configuración del proyecto.
- **Contexto autenticado.** El token se obtiene con `POST /api/auth/login` justo antes de cada escaneo (vive 15 min) y ZAP lo inyecta en todas las peticiones con `ZAP_AUTH_HEADER` / `ZAP_AUTH_HEADER_VALUE`. Se hizo así porque la regla *replacer* pasada por `-z` no admite el espacio de `Bearer <token>`: los scripts de ZAP parten esa opción por espacios. Se hicieron dos corridas: rol **cliente** (Carla) y rol **administrador**.
- **Límites del gateway.** El escaneo pasivo y las verificaciones manuales corrieron con los **límites normales**. Los escaneos activos de la API corrieron con el perfil de carga (`.env.carga`), porque con 300 peticiones por minuto casi todas las sondas de ZAP habrían recibido un 429 y nunca habrían llegado a la lógica de negocio. El limitador se prueba aparte, en la suite F de `test:http` y en la sección 4.5 de [`RENDIMIENTO.md`](RENDIMIENTO.md).
- **Reglas.** [`tests/seguridad/zap-reglas.tsv`](../../tests/seguridad/zap-reglas.tsv) está vacío a propósito: ningún hallazgo se silenció. Los falsos positivos se justifican en la sección 5.

## 2. *Spidering* (Paso 2.3.1)

| Superficie | Método | Cobertura |
|---|---|---|
| Web (SPA de React) | Spider clásico y **AJAX spider** (Firefox sin interfaz dentro del contenedor), 3 min (`zap-baseline.py -j -m 3`) | 14 URL: la página, los *assets*, `robots.txt`, `sitemap.xml` y las llamadas a `/api` que hace la SPA (catálogo, categorías, login) |
| API | Importación de [`docs/openapi/openapi.yaml`](../openapi/openapi.yaml) (`zap-api-scan.py -f openapi`) | 58 URL importadas; 151 URL exploradas como cliente y 133 como administrador |

El AJAX spider recorre la parte pública de la SPA. Para las vistas autenticadas (carrito, mis pedidos, panel de administración) la API ya queda cubierta por la importación de la OpenAPI. El recorrido de la interfaz autenticada **con Playwright a través del proxy de ZAP**, que propone el plan, se hará con los flujos del Módulo 2 (usabilidad), donde Playwright se instala y se automatizan esas tareas. Queda declarado como pendiente en la sección 7.

```bash
npm run build:web && (cd clients/web && npx vite preview --host 0.0.0.0 --port 4173)   # web
npm run test:zap:baseline                 # pasivo sobre la web (límites normales)
npm run infra:carga                       # escaneo activo: límites altos
npm run test:zap:api -- cliente           # activo y autenticado como cliente
npm run test:zap:api -- administrador     # activo y autenticado como administrador
npm run infra:normal && npm run test:seguridad   # verificaciones manuales
```

> **El escaneo activo es destructivo.** Envía miles de peticiones con datos de ataque, y con el token de administrador **creó 115 usuarios administradores** cuyos "correos" eran plantillas de inyección o URL (hallazgo S-10). Después se reinició la base (`docker compose down -v`) y se volvió a poblar antes de las verificaciones manuales.

## 3. Resultados de ZAP (Paso 2.3.2)

| Escaneo | Reporte | Alertas | Pasan |
|---|---|---|---|
| Baseline pasivo, web | [`baseline-web.html`](../evidencia/no-funcionales/seguridad/baseline-web.html) | 0 FAIL, **8 WARN** | 60 reglas |
| API activo, cliente | [`api-cliente.html`](../evidencia/no-funcionales/seguridad/api-cliente.html) | 0 FAIL, **3 WARN** | 118 reglas |
| API activo, administrador | [`api-administrador.html`](../evidencia/no-funcionales/seguridad/api-administrador.html) | 0 FAIL, **4 WARN** | 117 reglas |

| Regla de ZAP | Riesgo ZAP | Dónde | Instancias | Hallazgo |
|---|---|---|---|---|
| 10038 Content Security Policy Header Not Set | Medio | Web | 4 | S-08 |
| 10020 Missing Anti-clickjacking Header | Medio | Web | 3 | S-08 |
| 10021 X-Content-Type-Options Header Missing | Bajo | Web | 5 | S-08 |
| 10063 Permissions Policy Header Not Set | Bajo | Web | 5 | S-08 |
| 90004 Cross-Origin-{Embedder,Opener,Resource}-Policy | Bajo | Web | 10 | S-08 |
| 90022 Application Error Disclosure | Bajo | Web: `POST /api/auth/login` → 500 | 1 | S-07 (rechazo de CORS) |
| 100000 A Server Error response code was returned | Bajo | API | 6 (cliente) y 20 (administrador) | S-06 y S-04 |
| 90022 Application Error Disclosure | Bajo | API: `/inventario/reservas/1` → 500 | 3 | S-06 |
| 30002 Format String Error | Medio | API: `POST /clientes`, `/direcciones`, `/auth/usuarios` | 5 y 11 | Falso positivo; la causa real es S-06 |
| 10096 Timestamp Disclosure – Unix | Bajo | API | 2 | Falso positivo |
| 10049 Storable Content / 10109 Modern Web Application / 10111 Authentication Request Identified | Informativo | Web y API | — | Informativos |

Durante los escaneos activos, el gateway registró **781 respuestas 500 y 1 030 respuestas 503**. Al agrupar los errores de los servicios aparecen dos causas:

- **Entradas sin validar que llegan hasta Postgres** (unas 750):
  - `value too long for type character varying(30)` en clientes (245 veces) y otros tamaños (195).
  - `invalid input syntax for type integer: "NaN"` (129).
  - `invalid input syntax for type uuid: "1"` en inventario (123).
  - Violaciones de restricciones `CHECK` (37), el byte nulo `0x00` en una consulta y los ID enormes (desbordamiento del entero).
- **Circuit breakers abiertos.** Los 503 son "el servicio de clientes no está disponible" (793, en pedidos) y "el servicio de catálogo no está disponible" (221, en carrito). Los propios errores de ZAP abrieron los circuitos; ver S-04.

## 4. Verificaciones manuales (Paso 2.3.2)

Resultado de `npm run test:seguridad` sobre la base recién poblada ([consola](../evidencia/no-funcionales/seguridad/verificaciones-manuales-consola.txt)): **16 verificaciones, 11 hallazgos, 4 seguras y 1 informativa.**

| ID | Verificación del plan | Resultado | Lo observado |
|---|---|---|---|
| V-01 | Control de acceso: registro | ❌ | `POST /auth/registro` acepta `cliente_id` en el cuerpo: una cuenta nueva con `cliente_id=1` lee el perfil y las direcciones de Ana |
| V-02 | Entradas: NoSQL | ❌ | `?categoria[$ne]=tecnologia` devuelve los 45 productos de las otras categorías; `?marca[$regex]=.*` devuelve 70 |
| V-03 | Errores | ❌ | `?q[$gt]=` → 500 |
| V-04 | Entradas: SQLi | ✅ | `/pedidos/1'OR'1'='1`, `1 OR 1=1` y `1;SELECT pg_sleep(3)--` → 404 en 11–83 ms: consultas parametrizadas |
| V-05 | Entradas: XSS almacenado | ℹ️ | Un vendedor guarda `<img src=x onerror=…>` como nombre de producto; la API lo devuelve tal cual y React lo muestra como texto. La web no usa `dangerouslySetInnerHTML` |
| V-06 | Contraseñas | ✅ | 305 de 305 hashes bcrypt de 10 rondas; el hash no sale en el login, en `/auth/perfil` ni en los logs |
| V-07 | Errores | ❌ | Un JSON mal formado en el login → **500** (debería ser 400). Sin stack ni rutas en el cuerpo, y sin `x-powered-by` |
| V-08 | IDOR y cabeceras de confianza | ✅ | Pedido, carrito y perfil ajenos → 404/403; `x-usuario-rol: administrador` o `x-cliente-id` inyectadas se ignoran (403) |
| V-09 | Sesión | ✅ | `alg:none`, rol cambiado sin volver a firmar y firma alterada → 401; reutilizar un refresh token ya rotado → 401 |
| V-10 | Configuración: secreto JWT | ❌ | Un token de administrador **forjado** con el secreto por defecto, para un usuario inexistente, lee la bitácora de la saga y todos los pedidos |
| V-11 | Configuración: CORS | ❌ | Un origen no permitido no recibe `Access-Control-Allow-Origin` (correcto), pero la respuesta es **500** |
| V-12 | Configuración: cabeceras de la web | ❌ | Faltan CSP, `X-Frame-Options`, `X-Content-Type-Options` y `Referrer-Policy` |
| V-13 | Almacenamiento en el cliente | ❌ | `token`, `refresh_token` y `usuario` en `localStorage` |
| V-14 | Disponibilidad (salió de ZAP) | ❌ | 6 peticiones de Ana con SKU inexistentes dejan a Bruno sin poder agregar al carrito (503) durante 15 s |
| V-15 | Entradas: correo | ❌ | El registro acepta `no-es-un-correo-…` como correo |
| V-16 | Configuración: red interna | ❌ | Directo a `localhost:3004`, con el token interno por defecto y sin JWT, se **reservó la última unidad** de `SKU-TEC-004` (luego liberada) |

Además, `test:http` ya cubre (65/65, ver [`PRUEBAS.md`](../PRUEBAS.md)):
- RBAC por rol (suite B).
- Aislamiento entre clientes.
- PCI-DSS: `pagos_db` sin número de tarjeta, CVV ni vencimiento (suite G).
- Aislamiento de las bases por usuario (suite H).
- Limitación de peticiones y bloqueo tras 5 intentos de login (suites A y F).

## 5. Clasificación de hallazgos (Paso 2.3.3)

OWASP Top 10 **2025**: A01 Broken Access Control · A02 Security Misconfiguration · A05 Injection · A06 Insecure Design · A07 Authentication Failures · A10 Mishandling of Exceptional Conditions.

| ID | Hallazgo | Origen | Componente | Riesgo ZAP | CWE | OWASP 2025 | CVSS v3.1 | Estado | Recomendación |
|---|---|---|---|---|---|---|---|---|---|
| **S-01** | Registro público vinculado a un `cliente_id` ajeno: acceso a los datos personales de otro cliente | Manual (V-01) | `auth-service` `registro` | — | CWE-639 | **A01** | **8.2 Alto** `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:L/A:N` | Confirmado | El `cliente_id` no debe venir del cliente (invariante 1). El registro crea el cliente o exige que el correo del cliente coincida y que no tenga cuenta |
| **S-02** | Secreto JWT por defecto y público: cualquiera forja tokens de administrador | Manual (V-10) | `docker-compose.yml`, `.env.example`, `shared/autenticacion.ts` | — | CWE-1394, CWE-798 | **A02** | **9.8 Crítico** `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` | Confirmado en este despliegue | Sin valor por defecto: los servicios no arrancan en producción sin un secreto propio y largo. Sacar el valor de compose y de `.env.example` |
| **S-03** | Token interno por defecto y puertos 3001-3008 publicados: se salta el gateway y el RBAC | Manual (V-16) | `docker-compose.yml`, `INTERNAL_TOKEN` | — | CWE-1394, CWE-668 | **A02** | **8.3 Alto** `AV:A/AC:L/PR:N/UI:N/S:U/C:L/I:H/A:H` | Confirmado | Mismo arreglo de secretos que S-02, y no publicar los puertos internos (o limitarlos a `127.0.0.1`) |
| **S-04** | Los 4xx de negocio abren el circuit breaker: un cliente deja a todos sin carrito o sin checkout | ZAP (100000) y manual (V-14) | `shared/circuit-breaker.ts` | Bajo | CWE-755 | **A10** | **6.5 Medio** `AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:H` | Confirmado | Contar como fallo solo los 5xx, los timeouts y los errores de red, que es lo mismo que ya decide si se reintenta (invariante 7) |
| **S-05** | Inyección de operadores NoSQL en `categoria` y `marca` | Manual (V-02) | `catalogo-service` `listarProductos` | — | CWE-943 | **A05** | **5.3 Medio** `AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L` | Confirmado | Aceptar solo cadenas (`typeof === 'string'`) en los filtros. Hoy el filtro `activo: true` evita fugas de datos, pero `$regex` abre la puerta a ReDoS |
| **S-06** | Entradas sin validar llegan a la base y devuelven 500: tamaños, tipos, UUID, byte nulo, ID fuera de rango | ZAP (100000, 90022, 30002) y manual (V-03, V-07) | clientes, inventario, auth, pedidos | Bajo | CWE-20 | **A10** | **4.3 Medio** `AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:L` | Confirmado | Validar el esquema en la entrada (longitudes, tipos, formatos) y responder 400. Esos 500 además alimentan S-04 |
| **S-07** | El rechazo de CORS se responde como 500 | ZAP baseline (90022) y manual (V-11) | `api-gateway` | Bajo | CWE-755 | A10 | — (Bajo) | Confirmado | Responder 403 sin pasar por el manejador de errores |
| **S-08** | La web se sirve sin cabeceras de seguridad (CSP, anti-clickjacking, nosniff, Permissions-Policy, COOP/COEP/CORP) | ZAP baseline (10038, 10020, 10021, 10063, 90004) y manual (V-12) | Servidor de la web | **Medio** | CWE-693, CWE-1021 | **A02** | **4.3 Medio** `AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:N` | Confirmado | Definir las cabeceras en el servidor que sirva la web en producción (nginx, CDN) y en `preview.headers` de Vite |
| **S-09** | Token de acceso y refresh token (7 días) en `localStorage`, legibles ante cualquier XSS | Manual (V-13) | `clients/web/src/servicios/api.js` | — | CWE-922 | **A07** | **6.9 Medio** `AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:H/A:N` | Confirmado, mitigado por el escapado de React | Refresh token en cookie `HttpOnly; Secure; SameSite=Strict` y token de acceso solo en memoria |
| **S-10** | El correo no se valida en el registro ni en `/auth/usuarios` | Manual (V-15) y escaneo activo (115 usuarios basura) | `auth-service` | — | CWE-20 | A06 | — (Bajo) | Confirmado | Validar el formato del correo y la longitud de los campos |
| **S-11** | XSS almacenado latente: la API guarda HTML en los productos | Manual (V-05) | `catalogo-service` | — | CWE-79 | A05 | — (Informativo) | Mitigado en la web por React | Validar o escapar la salida en todo consumidor que no sea React (correos de notificaciones, app móvil, reportes) |
| FP-1 | *Format String Error* | ZAP 30002 | API | Medio | CWE-134 | — | — | **Falso positivo** | Node no usa `printf`. ZAP lo marca porque la carga con `%n%s…` provoca un 500, pero ese 500 es un `value too long for type varchar` (S-06), no una interpretación de formato |
| FP-2 | *Timestamp Disclosure – Unix* | ZAP 10096 | API | Bajo | CWE-497 | — | — | **Falso positivo** | Las 4 instancias son `POST /auth/verificar`, que devuelve los *claims* del token del propio solicitante: los números son su `iat` y su `exp` (diferencia de 900 s = 15 min). El usuario ya los tiene dentro de su JWT; no revelan nada del servidor |

**Lo que resistió:**
- Las consultas parametrizadas (V-04).
- El almacenamiento de contraseñas (V-06).
- El aislamiento entre clientes y el saneamiento de las cabeceras de confianza (V-08, invariante 10).
- La verificación del JWT: rechaza `alg:none`, la firma alterada y el token expirado (V-09, V-10).
- La rotación del refresh token (V-09).
- Que los servicios exijan su propio JWT aunque la petición traiga las cabeceras del gateway.
- Que ningún error filtre stack, rutas ni versiones.
- La ausencia de `x-powered-by`.
- ZAP no encontró inyección SQL, XSS reflejado, *path traversal* ni ejecución remota en ninguna de las 117–118 reglas activas que pasaron.

## 6. Priorización para la Fase 3

| Prioridad | Hallazgos | Por qué |
|---|---|---|
| 1 | **S-02 y S-03**: secretos por defecto | Crítico y alto. Una sola corrección (fallar al arrancar sin secretos propios, y no publicar los puertos internos) cierra las dos vías de suplantación total |
| 2 | **S-01**: registro con `cliente_id` ajeno | Alto. Rompe el invariante 1, la base del aislamiento entre clientes |
| 3 | **S-04**: circuit breaker | Medio, pero lo explota cualquier cliente con 6 peticiones y deja a todos sin comprar |
| 4 | S-05, S-06, S-07, S-10 | Validación de entradas, que se puede resolver con una sola capa de validación por esquema |
| 5 | S-08, S-09 | Configuración del despliegue de la web y cambio del modelo de sesión |

Las correcciones de la Fase 3 se confirmarán con el equipo antes de implementarlas, y cada una se verificará volviendo a ejecutar `npm run test:seguridad` y el escaneo de ZAP que la detectó.

## 7. Limitaciones

- **Recorrido autenticado de la interfaz con Playwright a través del proxy de ZAP**: pendiente para el Módulo 2, donde se automatizan esos flujos. La API autenticada sí está cubierta por la OpenAPI.
- **Sin `zap-full-scan.py`** sobre la web. La superficie de la SPA es estática; la lógica vive en la API, que sí recibió el escaneo activo completo con los dos roles.
- **Escaneo activo con el perfil de carga.** Con los límites normales, el limitador habría ocultado la mayoría de las respuestas. Es una decisión de cobertura, no un cambio en el sistema evaluado.
- **CVSS estimado** por el equipo con la calculadora de la especificación v3.1. S-02 y S-03 suponen el despliegue tal como está en el repositorio (secretos por defecto y puertos publicados).
- **Entorno local sin TLS**: no se evaluaron HSTS ni cookies `Secure`.
