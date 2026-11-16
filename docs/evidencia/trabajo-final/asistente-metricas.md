# Asistente virtual: tasa de acierto de intenciones

Generado con `npm run asistente:metricas -- --guardar` el 2026-11-16. Motor de reglas con las intenciones iniciales; sin IA.

| Conjunto | Frases | Aciertos | Tasa de acierto |
|---|---:|---:|---:|
| Desarrollo (se usa para ajustar los terminos) | 26 | 26 | 100,0 % |
| **Evaluacion (no se ajusta; es la cifra que se reporta)** | 36 | 33 | **91,7 %** |
| Total | 62 | 59 | 95,2 % |

## Matriz de confusion (conjunto de evaluacion)

Filas: intencion esperada. Columnas: intencion que dio el motor. La diagonal en negrita son aciertos; ⚠ marca confusiones.

| esperada \ obtenida | ayuda | buscar | cancelar | despedida | estado | f_devoluciones | f_entrega | f_envio | f_envio_gratis | f_horario | f_iva | f_pagos | humano | no_ent | precio | saludo |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| ayuda | · | ⚠ 1 | · | · | · | · | · | · | · | · | · | · | · | ⚠ 1 | · | · |
| buscar_producto | · | **4** | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| cancelar_pedido | · | · | **3** | · | · | · | · | · | · | · | · | · | · | · | · | · |
| despedida | · | · | · | **1** | · | · | · | · | · | · | · | · | · | · | · | · |
| estado_pedido | · | · | · | · | **5** | · | · | · | · | · | · | · | · | · | · | · |
| faq_devoluciones | · | · | · | · | · | **1** | · | · | · | · | · | · | · | ⚠ 1 | · | · |
| faq_entrega | · | · | · | · | · | · | **2** | · | · | · | · | · | · | · | · | · |
| faq_envio | · | · | · | · | · | · | · | **2** | · | · | · | · | · | · | · | · |
| faq_envio_gratis | · | · | · | · | · | · | · | · | **2** | · | · | · | · | · | · | · |
| faq_horario | · | · | · | · | · | · | · | · | · | **1** | · | · | · | · | · | · |
| faq_iva | · | · | · | · | · | · | · | · | · | · | **1** | · | · | · | · | · |
| faq_pagos | · | · | · | · | · | · | · | · | · | · | · | **2** | · | · | · | · |
| humano | · | · | · | · | · | · | · | · | · | · | · | · | **2** | · | · | · |
| no_entendido | · | · | · | · | · | · | · | · | · | · | · | · | · | **1** | · | · |
| precio_disponibilidad | · | · | · | · | · | · | · | · | · | · | · | · | · | · | **4** | · |
| saludo | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | **2** |

## Errores

| Conjunto | Frase | Esperada | Obtenida |
|---|---|---|---|
| evaluacion | me puedes ayudar? | ayuda | no_entendido |
| evaluacion | muéstrame el menú | ayuda | buscar_producto |
| evaluacion | me quiero retractar de una compra | faq_devoluciones | no_entendido |
