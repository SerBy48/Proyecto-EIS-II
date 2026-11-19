# Plan de ejecución — Estrategias de validación y pruebas de software

> **Para Claude Code.** Este plan aplica la práctica *"Estrategias de validación y
> pruebas de software — Implementación de pruebas en el proyecto"* al repositorio
> `SerBy48/Proyecto-EIS-II` (plataforma de e-commerce con microservicios).
> Léelo completo antes de empezar. Lee también `CLAUDE.md`, `PLAN.md` y
> `docs/PRUEBAS.md` del repositorio: sus convenciones e invariantes mandan sobre
> cualquier cosa de este documento.

---

## 0. Contexto y reglas de trabajo

### 0.1 Lo que pide la práctica

| Fase | Paso | Qué exige |
|---|---|---|
| 1. Preparación | 1.1 | Desplegar la app en local con la BD poblada (≥ 50 registros simulados) |
| | 1.2 | Inventario de rutas: flujo principal y endpoints críticos del backend |
| 2. Pruebas no funcionales | Módulo 1 | **Rendimiento**: endpoint más pesado, JMeter o k6, concurrencia y rampa, latencia / errores / throughput |
| | Módulo 2 | **Usabilidad**: tareas, inspección heurística (Nielsen), prueba cruzada con otro equipo, escala SUS |
| | Módulo 3 | **Seguridad**: OWASP ZAP como proxy (spidering), escaneo automatizado, clasificación por criticidad |
| 3. Consolidación | 3.1 | Matriz de calidad unificada (las tres dimensiones) |
| | 3.2 | Plan de corrección **y refactorización real del código**: ≥ 1 problema crítico corregido **por cada dimensión** |

### 0.2 Lo que ya existe en el repositorio (no rehacerlo)

- 9 servicios Node/TypeScript (Express, ejecutados con `tsx`), gateway en `:8080`.
- Infraestructura en `docker-compose.yml`: PostgreSQL, MongoDB, Redis y RabbitMQ, además de los 9 servicios.
  **El cliente web (`clients/web`, React + Vite) NO está en Compose**: se levanta con `npm run dev:web` (puerto 5173).
- Pruebas funcionales y de integración (142 casos que pasan): `test:salud`, `test:concurrencia`, `test:http`, `test:e2e`.
  Evidencia en `docs/evidencia/`.
- Seguridad ya implementada: JWT con vigencia de 15 min y refresh rotatorio, RBAC, bcrypt, rate limiting en 3 niveles, helmet en el gateway, saneamiento de cabeceras de confianza, PCI-DSS por ausencia del dato.
- Datos semilla: **solo 10 productos y 5 usuarios** → hay que poblar más (Paso 1.1).
- No hay especificación OpenAPI: `docs/api.http` es la única colección de peticiones.

### 0.3 Reglas para Claude Code

1. **Rama de trabajo:** `feature/pruebas-no-funcionales`. Haz un commit por cada paso cerrado, con un mensaje en español.
2. **Idioma y estilo:** código, identificadores y comentarios en español, sin tildes en los identificadores (convención de `CLAUDE.md`).
3. **Invariantes:** las 12 de `CLAUDE.md` no se rompen. Las más expuestas en esta práctica son las de seguridad:
   - n.º 1: el `cliente_id` sale del JWT.
   - n.º 8: SQL siempre parametrizado.
   - n.º 10 y 11: cabeceras de confianza.
4. **Regresión obligatoria:** después de cualquier cambio de código (Fase 3), `npm run typecheck`, `test:salud`, `test:http`, `test:concurrencia` y `test:e2e` deben seguir pasando.
5. **No inventar resultados.** Los datos de usabilidad (SUS, observaciones del evaluador externo) los produce un equipo humano. Si no están, se deja el marcador `⚠️ PENDIENTE: dato humano` y se avisa al usuario. Nunca se rellenan con cifras plausibles.
6. **Todo resultado crudo se guarda** en `docs/evidencia/no-funcionales/` (JSON, HTML, CSV y capturas), igual que la evidencia existente.
7. **Antes y después:** cada corrección de la Fase 3 se mide con la misma prueba que detectó el problema, antes y después del cambio.

### 0.4 Estructura de carpetas que se va a crear

```
tests/
├── rendimiento/            Scripts k6 (escenarios, utilidades, umbrales)
│   ├── lib/                login, cabeceras, datos compartidos
│   ├── catalogo-busqueda.js
│   ├── login.js
│   ├── checkout.js
│   └── flujo-completo.js
├── seguridad/              Configuración y automatización de OWASP ZAP
│   ├── zap-baseline.sh
│   ├── zap-api.sh
│   └── zap-reglas.tsv      Reglas ignoradas o ajustadas, con justificación
└── usabilidad/
    ├── tareas.md           Guion de tareas para el evaluador externo
    ├── heuristicas.md      Plantilla de evaluación (10 heurísticas de Nielsen)
    ├── sus-cuestionario.md Las 10 preguntas SUS en español
    ├── sus-respuestas.csv  Lo llena el equipo evaluador
    └── calcular-sus.ts     Calcula el puntaje SUS e interpreta
scripts/
├── sembrar-datos-carga.ts  Poblado masivo idempotente (vía API)
└── graficas/               Generación de gráficas para el informe (Python)
docs/
├── calidad/
│   ├── INVENTARIO-RUTAS.md
│   ├── RENDIMIENTO.md
│   ├── USABILIDAD.md
│   ├── SEGURIDAD.md
│   ├── MATRIZ-CALIDAD.md
│   └── PLAN-CORRECCION.md
└── evidencia/no-funcionales/
    ├── rendimiento/  seguridad/  usabilidad/  graficas/
```

Agrega a `package.json` de la raíz estos scripts:

- `test:carga:catalogo`
- `test:carga:login`
- `test:carga:checkout`
- `test:carga:flujo`
- `sembrar:carga`
- `test:zap:baseline`
- `test:zap:api`
- `usabilidad:sus`

---

## FASE 1 — Preparación

### Paso 1.1 — Despliegue local con datos de prueba

**Objetivo:** el sistema bajo prueba (SUT) arriba, sano y con volumen de datos suficiente para que las métricas signifiquen algo.

**Cómo se aborda:**

1. **Requisitos:** verifica Node ≥ 22.9 (`node -v`), Docker y Docker Compose. Si falta algo, avisa al usuario. No lo instales a ciegas en su máquina.

2. **Modo de despliegue para las pruebas: contenedores.** Usa `docker compose up -d --build` en lugar de `npm run dev`.
   - Los procesos con `tsx watch` y recarga distorsionan las mediciones de rendimiento.
   - Compose es lo más cercano al despliegue real.

   Para la web, de momento, usa `npm run build:web` + `npx vite preview --port 4173` (el build optimizado, no el servidor de desarrollo). En el Trabajo Final, Fase 5, la web pasa a un contenedor nginx.

3. **Verificación:** `npm run test:salud` y `GET http://localhost:8080/api/health` → los 9 servicios en verde. Guarda la salida en `docs/evidencia/no-funcionales/00-salud-previa.txt`.

4. **Poblado masivo** (`scripts/sembrar-datos-carga.ts`, comando `npm run sembrar:carga`).

   **Decisión de arquitectura: el poblado se hace a través de la API del gateway, no con inserciones directas en las bases.** Hay dos razones:
   - Cada servicio tiene su propio usuario de BD y aislamiento.
   - Inventario es el único dueño del stock (invariante 3).

   Escribir directo en las tablas saltaría esas reglas y generaría datos que el sistema real nunca produciría.

   Lo que crea el script:
   - **60 productos** en varias categorías, con `POST /api/catalogo/productos` como administrador. Incluye nombres y descripciones variados para que la búsqueda de texto (`$text` de MongoDB) trabaje con volumen real.
   - **Stock inicial** con `POST /api/inventario/stock/:sku/entrada`. Las cantidades deben ser altas (p. ej. 10 000 unidades) en los SKU que se usarán en la prueba de checkout, para que la carga no se agote por falta de stock.
   - **100 clientes de carga**: `carga001@correo.co` … `carga100@correo.co`, todos con la contraseña `Password123`, creados por el endpoint público de registro. Se necesitan muchas cuentas porque el rate limit es **por usuario** (`identificar()` en el gateway). Con una sola cuenta, el límite medido sería el del limitador y no el del sistema.
   - **Pedidos históricos** (≥ 50) mediante checkouts con `tok_ok_*`, para que `GET /api/pedidos` y el historial tengan volumen.

   El script debe ser **idempotente**: si el SKU o el correo ya existe (409), lo omite. También debe ser re-ejecutable después de `npm run infra:reset`.

   Al final imprime un conteo por entidad y guárdalo en `docs/evidencia/no-funcionales/01-poblado.txt`.

5. **Perfil de entorno para la carga (`.env.carga`).** El gateway lee los límites de las variables de entorno (`LIMITE_GENERAL`, `LIMITE_LOGIN` y `LIMITE_CHECKOUT`). Crea `.env.carga`, una copia de `.env` con los límites elevados (p. ej. `LIMITE_GENERAL=100000`). Así se mide la capacidad del sistema y no la del limitador.
   - Documenta esta decisión en el informe.
   - **No cambies los valores por defecto del código.**
   - Haz una corrida adicional **con los límites normales**, para demostrar que el rate limiting responde 429 bajo abuso. Esa corrida también es evidencia de seguridad.

**Entregable del paso:** salida de salud, conteo de poblado y la descripción del entorno de prueba (CPU, RAM, sistema operativo, versiones de Docker y Node). Obtén esos datos con comandos, no los supongas.

### Paso 1.2 — Inventario de rutas y flujos

**Objetivo:** el mapa de la app que pide la práctica: flujo principal y endpoints críticos.

**Cómo se aborda:**

1. **Extrae el inventario del código, no de memoria.** Usa `grep` sobre `router.(get|post|patch|delete)` en `services/*/src/index.ts`, la tabla `DESTINOS` y `RUTAS_PUBLICAS` del gateway. Genera una tabla con estas columnas:
   - Método
   - Ruta pública (`/api/...`)
   - Servicio
   - Rol requerido
   - ¿Pública?
   - Dependencias síncronas que dispara

2. **Flujo principal del negocio:**

   ```
   Registro/Login → Catálogo (búsqueda) → Detalle → Carrito → Checkout (saga) → Pago → Mis pedidos
   ```

   Dibújalo en Mermaid dentro de `docs/calidad/INVENTARIO-RUTAS.md` y exporta un PNG para el informe (mermaid-cli o el método que funcione en la máquina).

3. **Selección y justificación de los endpoints críticos** para la carga. Los candidatos siguientes salen del análisis del código; confírmalos o descártalos con datos:

   | Endpoint | Por qué es crítico |
   |---|---|
   | `GET /api/catalogo/productos?q=` | El de mayor tráfico (ruta pública). Combina búsqueda de texto en MongoDB con una llamada síncrona a inventario (`/disponibilidad`), protegida con circuit breaker |
   | `POST /api/auth/login` | bcrypt es costoso en CPU a propósito. Es el clásico cuello de botella bajo concurrencia |
   | `POST /api/pedidos/checkout` | **El más pesado:** saga que toca 4 servicios y 4 bases (clientes, carrito, catálogo, inventario con `pg_advisory_xact_lock` y pagos) y publica en RabbitMQ |
   | `GET /api/pedidos` | Listado con `JOIN` y `LIMIT 100` por cliente |

4. Documenta qué **no** se somete a carga y por qué. Por ejemplo, los endpoints de administración: tienen bajo tráfico y su riesgo es de seguridad, no de rendimiento.

**Entregable:** `docs/calidad/INVENTARIO-RUTAS.md` con la tabla, el diagrama del flujo y la justificación de los endpoints críticos.

---

## FASE 2 — Ejecución de pruebas no funcionales

### Módulo 1 — Pruebas de rendimiento

**Herramienta elegida: k6** (no JMeter), por estas razones:

- Los scripts se escriben en JavaScript, el mismo ecosistema del proyecto.
- Se versionan como código junto a los tests existentes.
- Tienen umbrales (*thresholds*) declarativos que se pueden usar como criterio de aceptación.
- Exportan JSON que se grafica sin herramientas adicionales.

Deja esta justificación en el informe.

**Instalación:** binario nativo (`winget install k6`, `brew install k6` o el paquete de Linux) o la imagen `grafana/k6`.
- Con Docker en Windows o Mac, el destino es `http://host.docker.internal:8080`.
- En Linux, usa `--network host`.
- Parametriza la URL con la variable `K6_URL_BASE`.

#### Paso 2.1.1 — Endpoints o flujos críticos

Son los cuatro del Paso 1.2, más un escenario de **flujo completo** que encadena login → búsqueda → carrito → checkout con `tok_ok_*`. Es el que mejor representa la carga distribuida.

#### Paso 2.1.2 — Diseño del plan de pruebas

Crea `tests/rendimiento/lib/` con lo común:
- Login por usuario virtual (VU), usando una cuenta `cargaNNN` distinta por VU según `__VU`.
- Cabecera `Authorization`.
- Generación de la clave de idempotencia (invariante 4: el checkout **exige** clave de idempotencia; un UUID por intento).

Escenarios (`scenarios` de k6, con `ramping-vus` o `ramping-arrival-rate`):

| Tipo | Perfil | Propósito |
|---|---|---|
| **Humo** (*smoke*) | 1-2 VU, 30 s | El script funciona; línea base de latencia sin carga |
| **Carga** (*load*) | Rampa 0 → 50 VU en 1 min, sostener 3 min, bajar 30 s | Comportamiento esperado en una hora pico |
| **Estrés** (*stress*) | Escalones 50 → 100 → 200 → 300 VU, 2 min cada uno | Encontrar el punto de quiebre |
| **Pico** (*spike*) | 10 → 300 VU en 10 s, 1 min, y bajada | Reacción ante un evento tipo "día sin IVA" |

Umbrales (criterios de aceptación, a ajustar tras la corrida de humo y a justificar):
- `http_req_failed < 1%`
- `http_req_duration p(95) < 500 ms` en catálogo
- `p(95) < 1500 ms` en checkout
- `checks > 99%`

En el checkout se valida con `check()` que la respuesta sea 201 o 200 y que el pedido quede `pagado`. Un 409 de stock **no** se cuenta como error del sistema: es una respuesta de negocio válida (invariante 7). Etiquétalo aparte con `tags`.

Ejecuta los escenarios **por separado** (un comando cada uno), con el entorno `.env.carga` cargado en los contenedores:

```bash
docker compose --env-file .env.carga up -d
```

#### Paso 2.1.3 — Ejecución y recolección de métricas

1. Para cada corrida, exporta:
   - El resumen: `--summary-export docs/evidencia/no-funcionales/rendimiento/<escenario>.json`.
   - La serie temporal: `--out json=<escenario>-serie.json.gz`, para las gráficas.
2. Durante el estrés y el pico, captura en paralelo:
   - `docker stats --no-stream` en intervalos (script en bucle que guarda un CSV). Sirve para ver qué contenedor satura CPU o RAM.
   - `GET /api/health` antes y después, con las métricas del circuit breaker (`circuito_inventario`).
   - Los logs del gateway, que registran `ms` por petición; filtra los 5xx.
3. **Métricas por escenario:**
   - Latencia: promedio, p50, p90, p95, p99 y máximo.
   - Throughput (peticiones por segundo).
   - Tasa de errores por código (4xx de negocio, 429, 5xx, timeouts).
   - VU máximos sostenidos.
4. **Gráficas** (`scripts/graficas/rendimiento.py`, matplotlib → PNG en `docs/evidencia/no-funcionales/graficas/`):
   - Latencia p95 frente a VU en el tiempo.
   - Throughput frente al tiempo.
   - Tasa de errores frente a VU.
   - Barras comparativas de p95 por endpoint.
   - CPU por contenedor durante el estrés.
5. **Análisis del cuello de botella:** identifica qué servicio o recurso colapsa primero y con cuántos VU. Hipótesis que hay que **verificar con datos, no afirmar**:
   - CPU de auth por bcrypt.
   - Pool de PostgreSQL (`DB_POOL_MAX=10` por defecto).
   - Serialización por SKU en `reservar_stock`.
   - Llamada síncrona catálogo → inventario.
   - Latencia simulada de la pasarela (`PASARELA_LATENCIA_MS`).
6. Corrida extra **con los límites normales** (sin `.env.carga`): demuestra que se emiten 429 y que el sistema no se cae. Es evidencia cruzada para seguridad.

**Entregable:** `docs/calidad/RENDIMIENTO.md`, con la configuración, la tabla de resultados, las gráficas, el cuello de botella identificado y su evidencia.

### Módulo 2 — Pruebas de usabilidad

> ⚠️ **Este módulo tiene partes que Claude Code NO puede hacer**: la prueba cruzada con el equipo B y las respuestas SUS reales son actividades humanas. Claude Code prepara los materiales, hace la inspección experta y procesa los datos cuando el usuario los entregue. Al llegar a este punto, **pausa y pide al usuario** el CSV de respuestas y las notas de observación.

#### Paso 2.2.1 — Flujos de tareas para los evaluadores

Crea `tests/usabilidad/tareas.md`. Son 6-8 tareas concretas, con su criterio de éxito y un tiempo esperado, basadas en las pantallas reales de `clients/web/src/paginas/` (Catalogo, Carrito, MisPedidos, Admin):

1. Iniciar sesión como cliente.
2. Buscar un producto por nombre y filtrar por categoría.
3. Agregar dos productos al carrito y cambiar la cantidad de uno.
4. Aplicar un cupón.
5. Finalizar la compra (token de prueba aprobado).
6. Consultar el estado del pedido en "Mis pedidos" y cancelarlo.
7. Intentar comprar con un pago rechazado e interpretar el mensaje.
8. (Rol vendedor o administrador) Registrar una entrada de stock o cambiar el estado de un pedido.

Incluye además:
- Una hoja de observación para el autor que mira en silencio: tarea, éxito o fracaso, tiempo, errores, comentarios en voz alta y punto donde se tropezó.
- El protocolo de pensar en voz alta (*think-aloud*).

#### Paso 2.2.2 — Inspección experta (evaluación heurística de Nielsen)

1. Claude Code levanta la web y recorre cada pantalla. Si la máquina lo permite, usa Playwright para tomar capturas de cada estado: vacío, error, carga, éxito.
2. Revisa el código JSX de cada página para verificar estados que no se ven a simple vista: mensajes de error, confirmaciones, accesibilidad (`label`, `alt`, contraste, foco por teclado).
3. Evalúa las **10 heurísticas de Nielsen** (`tests/usabilidad/heuristicas.md`). Cada hallazgo lleva:
   - Heurística violada.
   - Pantalla y captura.
   - Descripción.
   - **Severidad en la escala de Nielsen (0-4)**.
   - Recomendación.
4. Opcional y recomendado: un análisis automatizado de accesibilidad con `@axe-core/playwright` o Lighthouse, como evidencia complementaria (WCAG).

#### Paso 2.2.3 — Cuestionario SUS

1. `tests/usabilidad/sus-cuestionario.md`: las 10 afirmaciones estándar de la SUS en español, con escala Likert de 1 a 5. Genera también una versión imprimible o para Google Forms.
2. `tests/usabilidad/sus-respuestas.csv`, con las columnas `evaluador,p1,...,p10` (lo llena el equipo B).
3. `tests/usabilidad/calcular-sus.ts` (`npm run usabilidad:sus`). Hace lo siguiente:
   - Valida el CSV.
   - Aplica la fórmula estándar: impares (respuesta − 1), pares (5 − respuesta), suma × 2,5.
   - Calcula el puntaje por evaluador, la media y la desviación.
   - Interpreta la media: adjetivo de Bangor y nota A-F; 68 es la referencia promedio.
   - Escribe `docs/evidencia/no-funcionales/usabilidad/sus-resultado.json`.
4. **Si el CSV no existe o está vacío:** el script lo informa y termina con código distinto de 0. El informe muestra el marcador de pendiente. No se simulan respuestas.

**Entregable:** `docs/calidad/USABILIDAD.md`, con tareas, resultados de observación (humanos), tabla de hallazgos heurísticos con severidad, puntaje SUS y conclusiones.

### Módulo 3 — Pruebas de seguridad (OWASP ZAP)

**Herramienta:** OWASP ZAP en Docker (`ghcr.io/zaproxy/zaproxy:stable`), con los scripts empaquetados (`zap-baseline.py`, `zap-full-scan.py` y `zap-api-scan.py`).

> **Alcance y ética:** solo se escanea `localhost` (el propio proyecto). Nunca se apunta ZAP a otra URL.

#### Paso 2.3.1 — Proxy de intercepción y *spidering*

1. **Spider de la interfaz:** levanta ZAP en modo daemon (puerto 8090) y configura un navegador con ZAP como proxy para recorrer la web (tienda y panel de administración) con dos sesiones: cliente y administrador.
   - Automatízalo con Playwright con `proxy: { server: 'http://localhost:8090' }`, recorriendo los flujos del Paso 2.2.1. Así el *spidering* es reproducible.
   - Opcionalmente, los estudiantes navegan a mano con el navegador apuntando al proxy, que es lo que describe la práctica. Deja instrucciones para ambos caminos.
2. Aplica además el **spider clásico y el AJAX spider** de ZAP, porque la web es una SPA de React.
3. **Spider de la API:** el gateway no publica OpenAPI. Para que ZAP conozca todas las rutas (incluidas las autenticadas), hay dos opciones:
   - (a) Importar las peticiones de `docs/api.http` recorriéndolas a través del proxy.
   - (b) **Recomendado:** usar la especificación `docs/openapi/openapi.yaml`. Se crea en el Trabajo Final, Fase 2; si este trabajo se ejecuta primero, crea aquí una versión mínima y el Trabajo Final la completa.
4. **Contexto autenticado:** obtén un JWT con `POST /api/auth/login` e inyéctalo con la regla *replacer* de ZAP:

   ```
   -z "-config replacer.full_list(0).matchtype=REQ_HEADER -config replacer.full_list(0).matchstr=Authorization -config replacer.full_list(0).replacement='Bearer <token>'"
   ```

   El token vive 15 minutos: el script lo renueva justo antes de cada escaneo. Haz corridas con rol cliente y con rol administrador.

#### Paso 2.3.2 — Escaneo automatizado

Ejecuta y guarda los reportes HTML, JSON y Markdown (`-r`, `-J`, `-w`) en `docs/evidencia/no-funcionales/seguridad/`:

1. `zap-baseline.py` sobre la web (escaneo pasivo).
2. `zap-api-scan.py -f openapi` sobre el gateway (escaneo activo de la API, autenticado).
3. `zap-full-scan.py` sobre la web (activo), si el tiempo lo permite.

Usa `tests/seguridad/zap-reglas.tsv` solo para marcar falsos positivos **ya analizados y justificados**, nunca para silenciar hallazgos reales.

**Verificaciones manuales que pide la práctica** (ZAP no las cubre del todo). Hazlas con scripts (`curl` o TS), dejando la evidencia:

| Verificación | Cómo |
|---|---|
| Validación de entradas | Cargas de inyección NoSQL en `q` del catálogo (`{"$gt":""}`, `$where`) y SQLi en parámetros numéricos (`/api/pedidos/1'OR'1'='1`), XSS almacenado en nombre o descripción de producto (como vendedor) y cómo lo renderiza React |
| Contraseñas | Confirmar el hash bcrypt en `auth_db` (consulta de solo lectura) y que ningún endpoint ni log devuelva el hash |
| Errores que filtran información | Provocar 500 y 400 y revisar que no salgan stack traces, versiones ni rutas internas; revisar que falte `x-powered-by` |
| Control de accesos (IDOR) | Cliente A pidiendo pedido o carrito de cliente B; cliente con `x-usuario-rol: administrador` inyectada (debe ignorarse, invariante 10) |
| Gestión de sesión | Token expirado y manipulado (`alg: none`, firma cambiada), refresh token reutilizado tras rotación |
| Configuración | Cabeceras de seguridad en la web servida (CSP, X-Frame-Options), CORS con un origen no permitido, secretos por defecto en `docker-compose.yml` (`JWT_SECRET:-...`) |
| Almacenamiento en el cliente | JWT en `localStorage` (`clients/web/src/servicios/api.js`): riesgo ante XSS |

Reutiliza lo que ya cubre `test:http` (RBAC, aislamiento, PCI-DSS) y cítalo como evidencia; no lo dupliques.

#### Paso 2.3.3 — Clasificación de hallazgos

Cada hallazgo (de ZAP o manual) va a una tabla con estas columnas:

- ID
- Título
- Herramienta u origen
- URL o componente
- **Riesgo ZAP** (Alto, Medio, Bajo o Informativo)
- **CWE**
- **Categoría OWASP Top 10**: usa la edición vigente; verifica si el curso pide 2021 o 2025 y declara cuál se usó
- **Puntaje CVSS v3.1** estimado, para los Altos y Medios
- Evidencia
- Estado: confirmado o falso positivo justificado
- Recomendación

Los falsos positivos se justifican uno por uno (p. ej. CSP desactivada a propósito en la API JSON del gateway, porque la CSP la sirve el frontend).

**Entregable:** `docs/calidad/SEGURIDAD.md` y los reportes de ZAP.

---

## FASE 3 — Consolidación y refactorización

### Paso 3.1 — Matriz de calidad unificada y diagnóstico

`docs/calidad/MATRIZ-CALIDAD.md`, con una tabla única. Columnas:

- Dimensión
- Criterio o métrica
- Meta (umbral)
- Resultado obtenido
- Estado (✅ cumple, ⚠️ parcial, ❌ no cumple)
- Hallazgo asociado (ID)
- Prioridad

**Cómo se calcula la prioridad.** Se combinan severidad e impacto, para no priorizar a ojo:

| Dimensión | Fuente de la severidad |
|---|---|
| Seguridad | Riesgo ZAP o CVSS |
| Usabilidad | Severidad Nielsen (0-4) |
| Rendimiento | Cuánto se supera el umbral y con cuántos VU |

Cierra con el **diagnóstico narrativo** que pide la práctica, en una o dos frases por dimensión, del tipo: *"La app resiste X VU en catálogo con p95 de Y ms, pero el checkout se degrada desde Z VU por …; en usabilidad … ; en seguridad …"*.

### Paso 3.2 — Plan de corrección y refactorización del código

1. `docs/calidad/PLAN-CORRECCION.md`: **todos** los hallazgos con acción, responsable, esfuerzo estimado y prioridad. Se marcan los que se corrigen en esta entrega.

2. **Requisito mínimo: corregir en el código al menos un problema crítico por dimensión.** Elige los de mayor prioridad según la matriz, no los más fáciles. Candidatos probables, que solo valen **si los datos los confirman**:

   | Dimensión | Candidatos |
   |---|---|
   | Rendimiento | Caché del catálogo en Redis, con TTL corto e invalidación al crear o actualizar un producto (ya está en los pendientes de `CLAUDE.md`); ajustar `DB_POOL_MAX`; índices faltantes en MongoDB o PostgreSQL; consultas N+1 |
   | Usabilidad | Mensajes de error más claros, confirmación antes de cancelar, estados de carga o vacío, retroalimentación del carrito, accesibilidad (etiquetas y foco) |
   | Seguridad | Cabeceras de seguridad (CSP) en la web servida; quitar los secretos por defecto de Compose para producción (fallar si faltan); endurecer la validación de entradas del catálogo; mitigar el JWT en `localStorage` |

3. **Para cada corrección:**
   1. Haz un commit separado (`fix(rendimiento): …`, `fix(usabilidad): …`, `fix(seguridad): …`).
   2. Respeta las convenciones de `CLAUDE.md`: `asincrono()`, constructores de `errores.ts`, SQL parametrizado e invariantes.
   3. **Re-ejecuta la misma prueba que lo detectó** (mismo escenario de k6, mismo escaneo de ZAP o la misma heurística revisada) y deja la tabla *antes / después* con números.
   4. Pasa la regresión completa: `typecheck`, `test:salud`, `test:http`, `test:concurrencia`, `test:e2e` y `build:web`. Si alguna prueba existente se rompe, la corrección no está terminada.

4. Actualiza la matriz con el estado final y `docs/PRUEBAS.md` (sección de defectos) con los nuevos defectos corregidos, siguiendo el formato existente.

---

## FASE 4 — Generación del informe `.docx`

### 4.1 Cómo se genera

1. Primero se escribe el contenido completo en Markdown: `docs/informes/INFORME-ESTRATEGIAS-VALIDACION.md`, a partir de los `docs/calidad/*.md`.
2. Después se convierte a `.docx` con **pandoc** usando una plantilla de estilos `docs/informes/plantilla.docx` (fuente, márgenes, estilos de título):

   ```bash
   pandoc docs/informes/INFORME-ESTRATEGIAS-VALIDACION.md \
     -o docs/informes/Informe_Estrategias_Validacion_Pruebas.docx \
     --reference-doc=docs/informes/plantilla.docx --toc --toc-depth=2 \
     --resource-path=.:docs/evidencia/no-funcionales/graficas
   ```

   Si pandoc no está disponible o se necesita más control (portada compleja, tablas con color de celda por estado), genera el `.docx` con la librería `docx` de npm en `scripts/informes/generar-estrategias.ts`.
3. Abre el `.docx` generado y verifica:
   - Que se ven todas las imágenes.
   - Que las tablas no se desbordan del margen.
   - Que la tabla de contenido existe.
   - Que no quedan marcadores `⚠️ PENDIENTE`. Si quedan, avisa al usuario explícitamente.
4. **Datos que hay que pedir al usuario antes de generar:** universidad, programa, asignatura, docente, integrantes del grupo, nombre del equipo evaluador cruzado y fecha de entrega.

### 4.2 Secciones del informe

1. **Portada**: universidad, asignatura (Ingeniería de Software II), título de la práctica, integrantes, docente, fecha.
2. **Tabla de contenido**.
3. **Resumen ejecutivo**: una página con el estado de calidad en las tres dimensiones y las tres correcciones principales con su mejora medida.
4. **Introducción**: objetivo de la práctica, alcance, aplicación evaluada.
5. **Descripción del sistema bajo prueba**: arquitectura de microservicios (diagrama del README), tecnologías, servicios y puertos.
6. **Fase 1 — Preparación**
   - 6.1 Entorno de pruebas: hardware, software, versiones, modo de despliegue con Compose y el perfil `.env.carga` justificado.
   - 6.2 Poblado de datos: estrategia por API y conteos.
   - 6.3 Inventario de rutas y flujo principal: tabla de endpoints, diagrama del flujo y endpoints críticos justificados.
7. **Fase 2 — Módulo 1: Pruebas de rendimiento**
   - 7.1 Herramienta y justificación (k6 frente a JMeter).
   - 7.2 Diseño del plan: escenarios, rampa, concurrencia, umbrales.
   - 7.3 Resultados por endpoint y escenario: tablas de latencia, throughput y errores.
   - 7.4 Gráficas.
   - 7.5 Análisis del cuello de botella: uso de recursos por contenedor, circuit breaker, rate limiting.
8. **Fase 2 — Módulo 2: Pruebas de usabilidad**
   - 8.1 Metodología: prueba cruzada, think-aloud, equipo evaluador.
   - 8.2 Tareas evaluadas y resultados de observación: tasa de éxito, tiempos, tropiezos.
   - 8.3 Evaluación heurística de Nielsen: tabla de hallazgos con severidad y capturas.
   - 8.4 Resultados SUS: puntaje por evaluador, media e interpretación.
   - 8.5 Accesibilidad (si se hizo con axe o Lighthouse).
9. **Fase 2 — Módulo 3: Pruebas de seguridad**
   - 9.1 Herramienta, alcance y configuración de ZAP: proxy, spidering, contexto autenticado.
   - 9.2 Resultados del escaneo automatizado: resumen por nivel de riesgo.
   - 9.3 Verificaciones manuales: entradas, contraseñas, errores, IDOR, sesión.
   - 9.4 Clasificación de hallazgos: tabla OWASP Top 10, CWE y CVSS; falsos positivos justificados.
10. **Fase 3 — Consolidación**
    - 10.1 Matriz de calidad unificada.
    - 10.2 Diagnóstico del estado real del proyecto.
11. **Plan de acciones correctivas y refactorización**
    - 11.1 Plan completo de mejora (todos los hallazgos).
    - 11.2 Correcciones implementadas, una por dimensión: problema, causa raíz, cambio en el código (fragmento o diff resumido), commit y **comparación antes / después**.
    - 11.3 Pruebas de regresión: los suites existentes siguen pasando.
12. **Conclusiones y lecciones aprendidas**.
13. **Referencias**: k6, OWASP ZAP, OWASP Top 10, Nielsen (1994), Brooke (1996) SUS, Bangor et al. (2009), CVSS v3.1.
14. **Anexos**
    - A. Scripts de k6 (extractos).
    - B. Reportes de ZAP (resumen; los HTML completos van en el repositorio).
    - C. Cuestionario SUS y respuestas crudas.
    - D. Guion de tareas y hojas de observación.
    - E. Enlace al repositorio y a la rama o commits.

---

## Orden de ejecución y puntos de pausa

| # | Paso | ¿Pausa para el usuario? |
|---|---|---|
| 1 | Fase 1 completa | No |
| 2 | Módulo 1 (rendimiento) | No |
| 3 | Módulo 3 (seguridad) | No |
| 4 | Módulo 2: materiales e inspección heurística | **Sí**: entregar al usuario `tareas.md` y el cuestionario SUS, y esperar el CSV y las observaciones de la prueba cruzada |
| 5 | Fase 3: matriz y elección de correcciones | **Sí**: confirmar con el usuario las 3 correcciones elegidas antes de tocar código |
| 6 | Correcciones, re-medición y regresión | No |
| 7 | Informe `.docx` | **Sí**: pedir los datos de la portada si no se dieron |

> **Relación con el Trabajo Final (`PLAN-TRABAJO-FINAL.md`).** La Fase 4 del Trabajo Final pide estas mismas tres auditorías. Todo lo que se cree aquí (scripts de k6, ZAP, SUS y matriz) se diseña para **reutilizarse**: allí se re-ejecuta sobre la versión final del sistema (con el chatbot) y se amplía. Si este trabajo se ejecuta antes, deja los scripts parametrizados por URL y lista de endpoints.
