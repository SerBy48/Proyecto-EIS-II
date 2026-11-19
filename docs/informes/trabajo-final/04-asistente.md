# 4. Fase 3: asistente virtual

El asistente de SerByTek atiende a visitantes y clientes desde un botón flotante presente en toda la tienda (**¿Necesitas ayuda?**):
- responde preguntas frecuentes;
- busca productos y ofertas;
- informa el precio y la disponibilidad;
- consulta el estado de los pedidos del usuario y guía su cancelación;
- deja escribirle al vendedor.

Es un microservicio más (asistente-service, puerto 3009), con su propia base de datos.

## 4.1 Decisión de diseño: reglas frente a IA

El asistente es un **motor de reglas determinista**, con un adaptador de IA opcional apagado por defecto (ADR-0007). Un motor de reglas responde en milisegundos, es reproducible, se puede probar frase por frase y nunca inventa un precio ni un estado de pedido: los toma del servicio dueño del dato. La IA, si se activa, solo responde preguntas generales que el motor no reconoce, y nunca recibe datos personales ni herramientas.

## 4.2 Arquitectura del módulo

<!-- incluir: docs/especificacion/03-asistente-virtual.md :: 3.1 Arquitectura :: sin-figuras -->

## 4.3 Intenciones y diálogo

<!-- incluir: docs/especificacion/03-asistente-virtual.md :: 3.2 Intenciones -->

## 4.4 Seguridad y resiliencia

<!-- incluir: docs/especificacion/03-asistente-virtual.md :: 3.3 Seguridad :: sin-figuras -->

<!-- incluir: docs/especificacion/03-asistente-virtual.md :: 3.4 Resiliencia -->

## 4.5 Interfaz de chat

El chat es un panel accesible: el historial es una región viva para los lectores de pantalla, el foco va al campo al abrirlo, y Esc lo cierra y devuelve el foco al botón. Las respuestas pueden ser:
- texto;
- tarjetas de productos, con su foto, precio, descuento y disponibilidad;
- tarjetas de pedidos;
- opciones rápidas.

Un visitante que pide escribirle al vendedor recibe la invitación a iniciar sesión; al volver con la sesión, el chat se abre solo con el formulario de la consulta. Con una cuenta de vendedor o administrador, el chat muestra la franja «Modo demostración».

![El asistente como visitante: búsqueda de audífonos disponibles, con foto, precio, descuento y unidades](../../evidencia/trabajo-final/asistente-visitante.png)

![El asistente con la sesión de un cliente: el estado de sus propios pedidos](../../evidencia/trabajo-final/asistente-cliente.png)

## 4.6 Resultados: tasa de acierto de intenciones

La meta (RNF-20) era acertar al menos el 85 % de las intenciones. Las frases de prueba se escribieron **antes** de cada cambio del motor, y los conjuntos de evaluación no se usan para ajustar los términos: si se ajustara contra ellos, la cifra dejaría de medir lo que el motor entiende de verdad.

Tabla: Acierto del asistente por conjunto de frases (`npm run asistente:metricas`)

| Conjunto | Frases | Aciertos | Tasa |
|---|---:|---:|---:|
| Evaluación general (Fase 3) | 36 | 33 | 91,7 % |
| Evaluación SerByTek: búsquedas, ofertas, envíos, pedidos | 50 | 50 | 100 % |
| Evaluación de marcas | 27 | 27 | 100 % |
| Validación de «contactar al vendedor» | 15 | 13 | 86,7 % |

**Los errores que quedan son de vocabulario y se documentaron sin ajustar.**
- **Evaluación general:**
  - «me puedes ayudar?» no tiene término para el verbo «ayudar»;
  - «muéstrame el menú» empata con la búsqueda de productos;
  - «me quiero retractar» no reconoce el verbo, solo el sustantivo «retracto».
- **Contactar al vendedor:** «atención al cliente» se interpreta como el horario, y «tengo una inquietud sobre una garantía, con quién hablo» como devoluciones.

**Dos defectos que encontró la medición.**
- **Contexto:** los refuerzos por entidad contaban como palabras, y un número de pedido suelto se clasificaba como «cancelar».
- **Plural:** la regla del plural convertía «disponibles» en «disponibl».

Se corrigió el motor, no las frases.

**Pruebas del asistente.** `npm run test:asistente` hace 57 comprobaciones contra el gateway:
- una frase por intención y el contexto de varios turnos;
- **aislamiento:** un cliente no ve por el chat los pedidos de otro;
- consultas al vendedor con su correo y edición de la FAQ;
- validaciones y límite de mensajes;
- degradación con pedidos-service detenido.
