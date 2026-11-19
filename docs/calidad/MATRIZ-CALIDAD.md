# Matriz de calidad unificada

Consolida las tres dimensiones evaluadas en la Fase 2 —rendimiento ([`RENDIMIENTO.md`](RENDIMIENTO.md)), seguridad ([`SEGURIDAD.md`](SEGURIDAD.md)) y usabilidad ([`USABILIDAD.md`](USABILIDAD.md))— con el estado **antes y después** de las correcciones de la Fase 3. El detalle de cada hallazgo, su acción y su responsable está en [`PLAN-CORRECCION.md`](PLAN-CORRECCION.md).

## 1. Cómo se calcula la prioridad

Para no priorizar a ojo, cada hallazgo recibe **Prioridad = Severidad (0-4) × Alcance (1-3)**. La severidad se normaliza a la misma escala de 0 a 4 a partir de la fuente propia de cada dimensión:

| Severidad | Rendimiento (umbral y carga) | Seguridad (CVSS v3.1 / riesgo ZAP) | Usabilidad (Nielsen) |
|---|---|---|---|
| **4** | Incumple el umbral **con la carga esperada (50 VU)** por más del doble | Crítico, CVSS ≥ 9,0 | 4, catástrofe |
| **3** | Incumple con la carga esperada por menos del doble | Alto, 7,0-8,9 | 3, mayor |
| **2** | Cumple con 50 VU, pero incumple desde 100-200 VU, o se degrada sin incumplir un umbral | Medio, 4,0-6,9 | 2, menor |
| **1** | Solo incumple con 300 VU (estrés extremo o pico) | Bajo, sin CVSS | 1, cosmético |
| **0** | Cumple | Informativo | 0 |

| Alcance | Significado |
|---|---|
| **3** | Afecta a todos los usuarios o al flujo de compra |
| **2** | Afecta a un grupo de usuarios, una función secundaria o solo bajo saturación |
| **1** | Afecta solo al personal interno o a un caso borde |

| Banda | Prioridad | Tratamiento |
|---|---|---|
| **P1 crítica** | 9-12 | Se corrige antes de entregar |
| **P2 alta** | 6-8 | Se corrige o se acepta con argumentos |
| **P3 media** | 3-5 | Siguiente iteración |
| **P4 baja** | 0-2 | Cuando haya ocasión |

Estado: ✅ cumple · ⚠️ parcial · ❌ no cumple · ⏳ pendiente de dato humano.

## 2. Matriz

### Rendimiento

| Criterio o métrica | Meta | Resultado antes | Resultado después | Estado | Hallazgo | Prioridad |
|---|---|---|---|---|---|---|
| p95 de la búsqueda en el catálogo, carga (50 VU) | < 500 ms | 146 ms | — (sin cambios en esa ruta) | ✅ | — | — |
| Errores del catálogo, estrés (300 VU) | < 1 % | **14,0 %** (agotamiento de puertos) | **0 %** | ✅ | R3 | P3 (1×3=3) |
| p95 del catálogo, estrés (100 / 200 / 300 VU) | < 500 ms | 193 / 645 / 829 ms | 79 / 327 / 836 ms | ⚠️ cumple hasta 200 VU | R3 y límite del equipo | — |
| p95 del login, carga (50 VU) | < 1000 ms | **4 294 ms** | **1 280 ms** | ⚠️ mejora un 70 %, aún sobre la meta | R1 | **P1** (4×3=12) |
| Throughput del login (50 VU) | — | 9,5 logins/s | **23,4 logins/s** (×2,5) | ✅ | R1 | — |
| Logins exitosos en estrés (10 min) | — | 2 535 | **11 793** (×4,7) | ✅ | R1 y R2 | — |
| Rechazo bajo saturación | Respuesta rápida y explícita | EOF a los 15 s | **503 en ~100 ms** con `Retry-After` | ✅ | R2 y R4 | P2 (2×3=6) y P3 (2×2=4) |
| Recuperación de auth al terminar la carga | Inmediata | 30-40 s fuera de servicio | Sano al empezar la corrida siguiente | ✅ | R2 | — |
| p95 del checkout, carga (50 VU) | < 1500 ms | 546 ms | 734 ms (A/B: 1 576 sin keep-alive y 734 con keep-alive, en el mismo entorno) | ✅ | R3 | — |
| Errores del checkout, estrés (300 VU) | < 1 % | 0 % (1 de 42 122) | — | ✅ | — | — |
| p95 del checkout, estrés (100 / 300 VU) | < 1500 ms | **2 116 / 7 155 ms** | — (no corregido) | ❌ desde 100 VU | R5 | P2 (2×3=6) |
| Compras completadas en el flujo, estrés | — | 1 874 | **6 162** (×3,3; el cuello se desplaza de auth al checkout) | ✅ | R1 | — |
| Consumo de la cola de notificaciones | ≥ ritmo de producción | ~10 eventos/s; hasta 10 533 pendientes | — (no corregido) | ⚠️ | R6 | P3 (2×2=4) |
| Limitación de peticiones (límites normales) | Rechazo sin caídas | 429 en ~3 ms, 0 respuestas 5xx | — | ✅ | — | — |

### Seguridad

| Criterio o métrica | Meta | Resultado antes | Resultado después | Estado | Hallazgo | Prioridad |
|---|---|---|---|---|---|---|
| Secretos sin valores por defecto | No se aceptan tokens forjados | Token de administrador forjado → **200** | **401**; el servicio no arranca con secretos débiles | ✅ | S-02 (CVSS 9,8) | **P1** (4×3=12) |
| Servicios internos detrás del gateway | Sin acceso directo | Reserva de stock sin JWT → **201** | **401**; puertos solo en `127.0.0.1` | ✅ | S-03 (8,3) | **P1** (3×3=9) |
| Aislamiento entre clientes (invariante 1) | Nadie accede a datos ajenos | Registro con el `cliente_id` de Ana → lee su perfil | **403** | ✅ | S-01 (8,2) | **P1** (3×3=9) |
| Disponibilidad frente a errores de un cliente | 4xx sin efecto en otros | 6 errores 404 → **503 para todos**; 1 030 en ZAP | 200; **0** en ZAP | ✅ | S-04 (6,5) | P2 (2×3=6) |
| Tokens en el cliente | Fuera del alcance de un XSS | `localStorage` | Igual, mitigado por la CSP | ⚠️ **riesgo aceptado** | S-09 (6,9) | P2 (2×3=6) |
| Entradas inválidas → 400 | 0 respuestas 500 | **781** respuestas 500 en el escaneo activo | **0** | ✅ | S-06 (4,3) | P3 (2×2=4) |
| Cabeceras de seguridad en la web | CSP, anti-clickjacking, nosniff… | Ausentes (8 advertencias de ZAP) | Presentes (2 advertencias informativas) | ✅ | S-08 (4,3) | P3 (2×2=4) |
| Inyección NoSQL | Operadores rechazados | `$ne` y `$regex` interpretados | **400** | ✅ | S-05 (5,3) | P4 (2×1=2) |
| CORS con un origen no permitido | 403 | 500 | **403** | ✅ | S-07 | P4 (1×1=1) |
| Validación del correo | Formato exigido | Aceptaba cualquier texto | **400** | ✅ | S-10 | P4 (1×1=1) |
| Escapado del HTML del usuario en correos | Escapado | Sin escapar | Escapado | ✅ | S-11 | P4 (0×1=0) |
| Inyección SQL | Sin efecto | Consultas parametrizadas, 404 | — | ✅ | — | — |
| Manipulación de tokens (`alg:none`, firma alterada, refresh reutilizado) | Rechazo | 401 en los tres casos | — | ✅ | — | — |
| IDOR y cabeceras de confianza inyectadas | Rechazo | 403/404 | — | ✅ | — | — |
| Contraseñas | bcrypt y nunca expuestas | 305/305 con bcrypt; 0 en respuestas y logs | — | ✅ | — | — |
| **Verificaciones manuales** (16) | 0 hallazgos | **11** | **1** (S-09, aceptado) | ✅ | — | — |

### Usabilidad

| Criterio o métrica | Meta | Resultado antes | Resultado después | Estado | Hallazgo | Prioridad |
|---|---|---|---|---|---|---|
| Tareas completadas en el recorrido | 8/8 | 8/8 | 8/8 | ✅ | — | — |
| KLM por tarea frente al tiempo esperado | ≤ tiempo esperado | 4,4-36,2 s (todas por debajo) | 4,3-44,6 s (todas por debajo; la mayor llega al 50 %) | ✅ | — | — |
| Acceso con cualquier cuenta | Todas las cuentas | Solo 4 cuentas de demostración (E11: Carla no puede entrar) | Todas (Carla entra) | ✅ | U-01 (Nielsen 4) | **P1** (4×3=12) |
| Productos alcanzables navegando | 100 % | **20 de 71** (28 %) | **71 de 71** | ✅ | U-02 (3) | **P1** (3×3=9) |
| Prevención de acciones irreversibles | Confirmación | Cancelación con un clic | Confirmación en dos pasos | ✅ | U-03 (3) | P2 (3×2=6) |
| Errores visibles | Visibles y completos | Error tapado por el modal (E8) | Visible y completo | ✅ | U-04 (3) | P2 (3×2=6) |
| Hallazgos heurísticos de severidad 3-4 | 0 abiertos | 4 | **0** | ✅ | U-01 a U-04 | — |
| Hallazgos heurísticos de severidad 2 | 0 abiertos | 8 | 8 | ⚠️ | U-05 a U-12 | P2 a P4 |
| Hallazgos heurísticos de severidad 1 | — | 5 | 4 (U-16 resuelto) | ⚠️ | U-13 a U-17 | P3 y P4 |
| Accesibilidad automatizada (WCAG 2.2 AA) | 0 incumplimientos | 0 en 13 pantallas | 0 en 13 pantallas | ✅ | — | — |
| Adaptación a móvil (390 px) | Sin desplazamiento horizontal | Sin desplazamiento | — | ✅ | — | — |
| Puntaje SUS | ≥ 68 (promedio de referencia) | ⚠️ PENDIENTE: dato humano | — | ⏳ | — | — |
| Éxito y tiempos con evaluadores reales | — | ⚠️ PENDIENTE: dato humano | — | ⏳ | — | — |

### Resumen

| Dimensión | Hallazgos | P1 | P2 | P3 | P4 | Corregidos | Aceptados | Pendientes |
|---|---|---|---|---|---|---|---|---|
| Rendimiento | 6 (R1-R6) | 1 | 2 | 3 | 0 | 4 (R1-R4) | 0 | 2 (R5, R6) |
| Seguridad | 11 (S-01 a S-11) | 3 | 2 | 2 | 4 | 10 | 1 (S-09) | 0 |
| Usabilidad | 17 (U-01 a U-17) | 2 | 5 | 7 | 3 | 5 (U-01 a U-04, U-16) | 0 | 12 |
| **Total** | **34** | **6** | **9** | **12** | **7** | **19** | **1** | **14** |

**Los 6 hallazgos P1 están corregidos y verificados.** De los 9 P2, se corrigieron 4 (R2, S-04, U-03 y U-04), se aceptó 1 con argumentos (S-09, sección 9.4 de SEGURIDAD.md) y quedan 4 (R5, U-07, U-08 y U-11) para la siguiente iteración. Las correcciones siguieron la prioridad calculada, no la facilidad: primero todas las P1 y luego las P2. Los P3 y P4 corregidos (R3, R4, S-05 a S-08, S-10, S-11 y U-16) salieron casi gratis junto a una P1 o P2 del mismo componente; por ejemplo, U-16 se resolvió al paginar el catálogo (U-02).

## 3. Diagnóstico

**Rendimiento.** Con la carga esperada (50 usuarios), el catálogo responde con un p95 de 146 ms y el checkout de 546 ms, ambos dentro de sus metas. El sistema resiste 300 usuarios en el catálogo sin errores desde que el gateway reutiliza conexiones. El cuello de botella era el login: bcrypt en el hilo principal lo limitaba a 10 inicios de sesión por segundo y, saturado, cortaba conexiones a los 15 s. Con el pool de hilos llega a 26 por segundo y rechaza el exceso en 100 ms. Aun así su p95 (1,3 s) sigue sobre la meta de 1 s con 50 usuarios, porque bcrypt es costoso a propósito; el paso siguiente es escalar auth horizontalmente. **El checkout se degrada desde 100 usuarios** (p95 de 2,1 s y de 7,2 s con 300) por saturación de PostgreSQL, pero **sin un solo error en 20 910 compras**: el sistema se vuelve lento, no incorrecto.

**Seguridad.** Los controles de diseño resisten: consultas parametrizadas, aislamiento entre clientes, cabeceras de confianza, verificación de tokens, rotación del refresh token y bcrypt. Las vulnerabilidades graves estaban en la configuración y en un endpoint: un secreto JWT público que permitía forjar tokens de administrador (CVSS 9,8), servicios internos alcanzables sin el gateway (8,3) y un registro que vinculaba la cuenta a otro cliente (8,2). Las tres están corregidas, el escaneo activo pasó de 781 errores 500 y 1 030 respuestas 503 a cero, y las verificaciones manuales, de 11 hallazgos a 1. Ese único hallazgo, los tokens en `localStorage`, se acepta como riesgo, mitigado por una CSP estricta.

**Usabilidad.** La tienda es accesible (sin incumplimientos de WCAG 2.2 AA), se adapta a móvil y es honesta con el estado del sistema en sus flujos centrales: el pago rechazado es su mejor pantalla. Sus fallas estaban en los bordes, y eran graves: solo cuatro cuentas de demostración podían entrar, el 72 % del catálogo era inalcanzable navegando y cancelar un pedido era irreversible con un clic y con el error escondido. Las cuatro están corregidas; quedan 12 hallazgos menores y cosméticos. **Falta la voz de los usuarios:** el SUS y la prueba con evaluadores están listos pero pendientes de dato humano.

**En una frase (práctica):** el sistema es correcto bajo carga y seguro por diseño; sus problemas eran de capacidad en un punto (el login), de configuración (los secretos) y de acabado en los bordes de la interfaz. Los seis problemas críticos están corregidos y verificados con la misma prueba que los detectó.

---

## 4. Trabajo Final: versión final con el asistente (Fase 4)

Se volvieron a ejecutar las tres dimensiones sobre la versión final (ORM, correo SMTP y asistente virtual), con el alcance ampliado del Trabajo Final:
- el asistente como endpoint crítico;
- la carga con un servicio detenido;
- el cuello de botella entre servicios;
- la tabla de controles del OWASP Top 10 ([`OWASP-CONTROLES.md`](OWASP-CONTROLES.md)).

Detalle: [`RENDIMIENTO.md`](RENDIMIENTO.md) sección 9, [`SEGURIDAD.md`](SEGURIDAD.md) sección 10 y [`USABILIDAD.md`](USABILIDAD.md) sección 11.

### 4.1 Re-medición

| Dimensión | Criterio | Meta | Práctica (después) | Trabajo Final | Estado |
|---|---|---|---|---|---|
| Rendimiento | p95 del login, 50 VU (RNF-03) | < 1 000 ms | 1 280 ms | **981 ms** | ✅ en el límite (R1) |
| Rendimiento | p95 del checkout, 50 VU (RNF-02) | < 1 500 ms | 734 ms | 621 ms | ✅ |
| Rendimiento | p95 del checkout, 100 VU | < 1 500 ms | 2 116 ms (antes) | 1 414 ms (escalón de 1 min) | ✅ en el límite (R5) |
| Rendimiento | p95 del catálogo, 50 VU (RNF-01) | < 500 ms | 146 ms | 74 ms | ✅ |
| Rendimiento | p95 del asistente, 50 VU 🆕 | < 500 ms | — | **36 ms** (FAQ: 22 ms) | ✅ |
| Rendimiento | Inventario detenido 61 s durante la carga (RNF-07) 🆕 | 0 errores; recuperación < 30 s | — | 0 errores; tras corregir R7, p99 de 76 ms (antes 6 373) y cierre a los 7 s | ✅ R7 corregido |
| Rendimiento | Notificaciones detenido 62 s durante el checkout (RNF-08) 🆕 | 0 compras fallidas | — | 7 429 compras, 0 errores; cola máxima 2 233, vacía en 84 s | ✅ |
| Rendimiento | Consumo de la cola de notificaciones | ≥ ritmo de producción | ~10 eventos/s | **~50 eventos/s** (SMTP real en lugar de 100 ms simulados) | ✅ (R6 rebajado) |
| Rendimiento | Primer servicio en saturarse (estrés) | — | auth | **auth** (237 % de CPU); los errores con 300 VU son 503 de su cola acotada | — |
| Seguridad | Verificaciones manuales | 0 hallazgos | 1 de 16 (S-09) | **1 de 21** (S-09); las 5 del asistente (V-17 a V-21) seguras | ✅ |
| Seguridad | Dependencias de producción (`npm audit`) 🆕 | 0 altas | — | 2 altas y 1 moderada → **0** tras `npm audit fix` | ✅ S-12 corregido |
| Seguridad | Escaneo activo de ZAP sobre la API, con el asistente | 0 FAIL; solo falsos positivos | 151 URL, 0 FAIL, 1 advertencia (FP-2) | **174 URL**, 0 FAIL, 1 advertencia (FP-2) | ✅ |
| Usabilidad | Tareas completadas | Todas | 8/8 | **9/9** (T9: asistente) | ✅ |
| Usabilidad | KLM de T9 frente al esperado | ≤ 60 s | — | 43,4 s | ✅ |
| Usabilidad | Accesibilidad (WCAG 2.2 AA) | 0 incumplimientos | 0 en 13 pantallas | 0 en 14 (con el panel del asistente) | ✅ |
| Usabilidad | Tasa de acierto de intenciones (RNF-20) 🆕 | ≥ 85 % | — | 91,7 % (conjunto de evaluación) | ✅ |
| Usabilidad | SUS y prueba con evaluadores | — | ⚠️ PENDIENTE: dato humano | ⚠️ PENDIENTE: dato humano | ⏳ |

### 4.2 Hallazgos nuevos y re-priorizados

| ID | Hallazgo | Severidad × Alcance | Prioridad | Estado |
|---|---|---|---|---|
| **S-12** | Dependencias transitivas de producción con vulnerabilidades conocidas: `body-parser` < 1.20.9, DoS con un cuerpo comprimido, en los diez servicios (vía Express); `follow-redirects` 1.16.0, fuga de cabeceras de credenciales en redirecciones, en el gateway (vía http-proxy); `qs` ≤ 6.16.0, DoS (moderada) | 3 × 3 | **P1 (9)** | ✅ Corregido: `npm audit fix` (solo el lockfile); 0 vulnerabilidades de producción. Residual: 3 en herramientas de desarrollo (SEGURIDAD.md 10.3) |
| **R7** | El circuit breaker en semiabierto deja pasar todas las peticiones contra la dependencia caída: ráfagas de p95 = 6,4 s en el catálogo cada ~22 s mientras inventario está caído | 2 × 3 | **P2 (6)** | ✅ Corregido: una sola llamada de prueba en semiabierto. p99 con inventario caído: de 6 373 a 76 ms; 0 errores (RENDIMIENTO.md 9.6) |
| R6 | Consumo de la cola de notificaciones | 1 × 2 (antes 2 × 2) | P4 (2) | Re-medido: ~50 eventos/s con SMTP real; vuelve si el proveedor es lento, porque el `prefetch(1)` sigue igual |
| R1 | Login con 50 VU | 2 × 3 (antes 4 × 3) | P2 (6) | Cumple la meta, pero en el límite (981 ms) |
| R5 | Checkout desde 100 VU | 2 × 3 | P2 (6) | Sin cambios de código; en el límite con 100 VU |
| U-13 | Textos sin tildes | 1 × 3 | P3 (3) | ✅ Corregido en la web y el asistente; residuos: mensajes de la API, nombres de productos y estados del panel (USABILIDAD.md 11.5) |
| U-07 | El aviso de «agregado» muestra el SKU y puede quedar fuera de la vista | 2 × 3 | P2 (6) | ✅ Corregido: nombre del producto en un aviso flotante |
| U-08 | Controles de prueba de la pasarela visibles al cliente | 2 × 3 | P2 (6) | ✅ Corregido: solo en desarrollo y en la compilación de pruebas; la de producción no los contiene |
| — | Arranque en frío: RabbitMQ supera la ventana de su healthcheck con un volumen nuevo y Compose deja servicios sin arrancar | 2 × 3 | P2 (6) | Detectado al reiniciar el entorno; se corrige en la Fase 5 (RNF-11) |

### 4.3 Resumen tras el Trabajo Final

| Dimensión | Hallazgos | Corregidos | Aceptados | Pendientes |
|---|---|---|---|---|
| Rendimiento | 7 (R1-R7) | 5 (R1-R4, **R7**) | 0 | 2 (R5, R6), y el arranque en frío para la Fase 5 |
| Seguridad | 12 (S-01 a S-12) | 11 (incluido **S-12**) | 1 (S-09) | 0 |
| Usabilidad | 17 (U-01 a U-17) | 8 (U-01 a U-04, **U-07**, **U-08**, **U-13**, U-16) | 0 | 9 (U-05, U-06, U-09 a U-12, U-14, U-15, U-17) |
| **Total** | **36** | **24** | **1** | **11** |

**No queda ningún hallazgo P1 abierto.** En el Trabajo Final apareció uno nuevo, S-12, y se corrigió en la misma fase. De los P2:
- se corrigieron 7: R2, S-04, U-03 y U-04 en la práctica, y R7, U-07 y U-08 en esta fase;
- S-09 sigue aceptado con argumentos;
- quedan R1 y R5 (capacidad: cumplen, pero en el límite) y U-11 (detalle del producto).

**En una frase (Trabajo Final):** la versión final, con el asistente, conserva las propiedades de la práctica, que son la corrección bajo carga y la seguridad por diseño. Ahora además están **demostradas frente a fallos reales**: con inventario o notificaciones detenidos en plena carga no se perdió ni una compra ni un evento. La prueba de fallo encontró un defecto que la carga normal no podía ver (R7). Lo que queda abierto es capacidad (auth y el checkout desde 100 usuarios) y la voz de los usuarios (SUS, ⚠️ PENDIENTE: dato humano).
