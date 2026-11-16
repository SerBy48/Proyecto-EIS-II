# ADR-0007: Asistente virtual como microservicio con motor de reglas e IA opcional

**Estado:** Aceptada por el equipo el 2026-11-15. Implementada en la Fase 3 ([`03-asistente-virtual.md`](../especificacion/03-asistente-virtual.md)): tasa de acierto del 91,7 % en el conjunto de evaluación y 46 comprobaciones de integración, incluido el aislamiento entre clientes.

## Contexto

El Trabajo Final exige un asistente conversacional, de reglas o de IA básica, integrado en la interfaz y conectado al backend.

El asistente tiene que hacer tres cosas:
- responder preguntas frecuentes;
- buscar productos;
- informar el estado de los pedidos **del usuario**.

Lo último toca datos personales. Además, sus respuestas deben poder probarse de forma automática y reproducible, sin coste ni dependencia de la red.

## Decisión

**Un microservicio nuevo, `asistente-service` (:3009, `asistente_db` en MongoDB), con un motor de reglas determinista como núcleo.**

**Motor de intenciones:**
- Normaliza el texto: minúsculas, sin tildes y sin signos.
- Puntúa palabras clave y sinónimos.
- Extrae entidades con expresiones regulares: SKU y número de pedido.
- Mantiene el contexto de varios turnos.
- Las reglas viven en datos (colección `intenciones`), no en el código.

**Las preguntas frecuentes** salen de la colección `faq`. Los valores numéricos (envío, umbral de envío gratis, IVA) se leen de la configuración: nunca se escriben a mano.

**Adaptador de IA opcional** (`ASISTENTE_IA=desactivada|anthropic`), **apagado por defecto**:
- Solo actúa cuando ninguna intención supera el umbral de confianza, y solo para preguntas generales.
- No recibe datos personales ni herramientas, y su salida se trata como texto. Así se mitiga la inyección de *prompts*.

**Seguridad.** Para consultar pedidos, el asistente **reenvía el `Authorization` del usuario** a `pedidos-service`.
- No usa la llamada interna, que saltaría el control de rol (invariante 11).
- El `cliente_id` sale del JWT, nunca del texto (invariante 1).
- Si un cliente pregunta por un pedido ajeno, la respuesta es "no encontrado", igual que en la API.

**Resiliencia.** Las llamadas usan `ClienteServicio` con circuit breaker y timeout. Si pedidos no responde, el asistente lo dice en lugar de fallar.

## Consecuencias

- ✅ Las respuestas son predecibles, se pueden probar con `test:asistente` y miden la tasa de acierto sobre ≥ 40 frases.
- ✅ Si el asistente cae, la tienda sigue funcionando, porque es un servicio aislado con su propia base.
- ✅ El administrador puede editar intenciones y preguntas frecuentes sin desplegar.
- ❌ Las reglas no entienden frases fuera de su vocabulario; la IA opcional cubre parte de esa brecha.
- ❌ Hay un servicio más que registrar y operar. Se registra con el checklist de `CLAUDE.md`: `DESTINOS`, Compose, `Dockerfile.servicio`, `dev:*`, salud, OpenAPI y C4.

## Alternativas descartadas

- **IA como núcleo**, con un LLM que interpreta todo y llama herramientas. Exige una clave de API y red, las pruebas dejan de ser deterministas, y el modelo tendría acceso a acciones sobre datos personales.
- **Solo reglas, sin adaptador de IA.** Es válido frente a la rúbrica, pero cierra la puerta a mejorar las preguntas abiertas.
- **Lógica del asistente en la web o en el gateway.** Rompe la responsabilidad única y el aislamiento de fallos, y obligaría a exponer en el cliente la lógica que decide qué datos consultar.

## Revisión del 2026-11-16 (SerByTek, F5b)

La prueba del equipo mostró el límite señalado en las consecuencias: «Hay audífonos disponibles?» respondía «no te entendí», y el botón de categoría «tecnologia» no encontraba productos. Se **mantiene la decisión** (reglas como núcleo, IA opcional y apagada) y se refuerza el motor sin perder el determinismo:

- **Vocabulario del catálogo.** Las subcategorías y sus sinónimos se leen de `GET /api/catalogo/categorias` (caché de 60 s). Un producto o una sección nueva se entienden en el chat sin tocar las reglas.
- **Coincidencia tolerante.** Plural y singular, y un error de tipeo solo en palabras que el motor no conoce («audifnos» → «audífonos», pero «cuesta» no se confunde con «cuenta»).
- **Entidades nuevas.** Rango de precio («menos de 3 millones»), «barato» y «en oferta».
- **Sin callejones sin salida.** Si ninguna intención alcanza el umbral, primero se busca en el catálogo con las palabras del mensaje, luego se sugieren las intenciones más cercanas y solo al final se muestra el menú.
- **Intenciones nuevas.** Secciones, ofertas, cupones, cuenta, contraseña, dirección, eliminar la cuenta, la tienda, seguridad y factura.
- **Datos existentes.** Las intenciones y la FAQ nuevas se agregan al arrancar; las que el administrador editó (`editada: true`) no se pisan.

**Medición.** Un conjunto de evaluación nuevo, de 50 frases de SerByTek, escrito y versionado **antes** del motor nuevo. Primera medición: 49/50; la frase fallida reveló un defecto en `singular()` (docs/PRUEBAS.md, 4.34). Tras corregir la regla, no los términos: 50/50.

**Lo que no cambia.** La clave de IA **no** es necesaria para buscar productos: por diseño, la IA no recibe el catálogo ni tiene herramientas. Activarla solo mejora las preguntas generales que no son de la tienda.
