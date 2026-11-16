# Asistente virtual: tasa de acierto de intenciones

Generado con `npm run asistente:metricas -- --guardar` el 2026-11-16. Motor de reglas con las intenciones de `intenciones.json` y el vocabulario del catalogo; sin IA.

| Conjunto | Frases | Aciertos | Tasa de acierto |
|---|---:|---:|---:|
| Desarrollo (se usa para ajustar los terminos) | 54 | 54 | 100,0 % |
| Evaluacion de la Fase 3 (no se ajusta) | 36 | 35 | 97,2 % |
| **Evaluacion SerByTek (escrita antes del motor nuevo; es la cifra que se reporta)** | 50 | 50 | **100,0 %** |
| Total | 140 | 139 | 99,3 % |

Primera medicion del conjunto SerByTek (2026-11-16): 49 de 50 (98,0 %). La frase fallida, "Hay audífonos disponibles?", revelo un defecto en `singular()` ("disponibles" -> "disponibl"); se corrigio la regla del plural, no los terminos, y la cifra de arriba es la medicion posterior (docs/PRUEBAS.md, 4.33).

## Matriz de confusion (evaluacion SerByTek)

Filas: intencion esperada. Columnas: intencion que dio el motor. La diagonal en negrita son aciertos; ⚠ marca confusiones.

| esperada \ obtenida | buscar | cancelar | categorias | despedida | estado | f_contrasena | f_cuenta | f_cupones | f_devoluciones | f_direccion | f_eliminar_cuenta | f_entrega | f_envio_gratis | f_factura | f_iva | f_pagos | f_seguridad | f_tienda | humano | no_ent | ofertas | precio |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| buscar_producto | **13** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| cancelar_pedido | · | **1** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| categorias | · | · | **2** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| despedida | · | · | · | **2** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| estado_pedido | · | · | · | · | **1** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| faq_contrasena | · | · | · | · | · | **3** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| faq_cuenta | · | · | · | · | · | · | **2** | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| faq_cupones | · | · | · | · | · | · | · | **2** | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| faq_devoluciones | · | · | · | · | · | · | · | · | **2** | · | · | · | · | · | · | · | · | · | · | · | · | · |
| faq_direccion | · | · | · | · | · | · | · | · | · | **2** | · | · | · | · | · | · | · | · | · | · | · | · |
| faq_eliminar_cuenta | · | · | · | · | · | · | · | · | · | · | **2** | · | · | · | · | · | · | · | · | · | · | · |
| faq_entrega | · | · | · | · | · | · | · | · | · | · | · | **1** | · | · | · | · | · | · | · | · | · | · |
| faq_envio_gratis | · | · | · | · | · | · | · | · | · | · | · | · | **1** | · | · | · | · | · | · | · | · | · |
| faq_factura | · | · | · | · | · | · | · | · | · | · | · | · | · | **1** | · | · | · | · | · | · | · | · |
| faq_iva | · | · | · | · | · | · | · | · | · | · | · | · | · | · | **1** | · | · | · | · | · | · | · |
| faq_pagos | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | **1** | · | · | · | · | · | · |
| faq_seguridad | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | **1** | · | · | · | · | · |
| faq_tienda | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | **2** | · | · | · | · |
| humano | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | **1** | · | · | · |
| no_entendido | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | **1** | · | · |
| ofertas | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | **3** | · |
| precio_disponibilidad | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | **5** |

## Errores

| Conjunto | Frase | Esperada | Obtenida |
|---|---|---|---|
| evaluacion F3 | muéstrame el menú | ayuda | buscar_producto |
