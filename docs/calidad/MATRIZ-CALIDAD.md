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

**En una frase:** el sistema es correcto bajo carga y seguro por diseño; sus problemas eran de capacidad en un punto (el login), de configuración (los secretos) y de acabado en los bordes de la interfaz. Los seis problemas críticos están corregidos y verificados con la misma prueba que los detectó.
