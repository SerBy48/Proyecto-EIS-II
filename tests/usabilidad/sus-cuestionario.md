# Cuestionario SUS (System Usability Scale)

Escala de usabilidad de Brooke (1996), en español. Se aplica **al terminar las tareas** ([`tareas.md`](tareas.md)) y **antes** de conversar con el evaluador sobre la tienda. Cada evaluador responde las 10 afirmaciones; no se omite ninguna. Si alguna no aplica, se marca el punto medio (3).

Los resultados se registran en [`sus-respuestas.csv`](sus-respuestas.csv) (una fila por evaluador) y se calculan con `npm run usabilidad:sus`.

## Versión para imprimir

Evaluador: ______ Fecha: ______

Marque con una X qué tan de acuerdo está con cada afirmación sobre la **tienda en línea** que acaba de usar.

| # | Afirmación | 1<br>Totalmente en desacuerdo | 2 | 3 | 4 | 5<br>Totalmente de acuerdo |
|---|---|---|---|---|---|---|
| 1 | Creo que me gustaría usar esta tienda con frecuencia. | | | | | |
| 2 | Encontré la tienda innecesariamente compleja. | | | | | |
| 3 | Me pareció que la tienda era fácil de usar. | | | | | |
| 4 | Creo que necesitaría la ayuda de una persona con conocimientos técnicos para poder usar esta tienda. | | | | | |
| 5 | Las distintas funciones de la tienda estaban bien integradas. | | | | | |
| 6 | Me pareció que la tienda tenía demasiadas inconsistencias. | | | | | |
| 7 | Imagino que la mayoría de las personas aprendería a usar esta tienda muy rápidamente. | | | | | |
| 8 | Encontré la tienda muy incómoda de usar. | | | | | |
| 9 | Me sentí muy seguro usando la tienda. | | | | | |
| 10 | Necesité aprender muchas cosas antes de poder usar esta tienda. | | | | | |

> Las afirmaciones impares son positivas y las pares, negativas. La alternancia es deliberada (Brooke, 1996): obliga a leer cada afirmación y reduce el sesgo de responder siempre lo mismo. **No se debe reordenar ni reformular.**

## Versión para Google Forms

Crear un formulario con una pregunta de **respuesta corta** ("Código del evaluador", p. ej. E1) y luego 10 preguntas de tipo **escala lineal de 1 a 5**, todas obligatorias. En cada una, la etiqueta del 1 es "Totalmente en desacuerdo" y la del 5, "Totalmente de acuerdo". Los enunciados se copian tal cual:

```
1. Creo que me gustaría usar esta tienda con frecuencia.
2. Encontré la tienda innecesariamente compleja.
3. Me pareció que la tienda era fácil de usar.
4. Creo que necesitaría la ayuda de una persona con conocimientos técnicos para poder usar esta tienda.
5. Las distintas funciones de la tienda estaban bien integradas.
6. Me pareció que la tienda tenía demasiadas inconsistencias.
7. Imagino que la mayoría de las personas aprendería a usar esta tienda muy rápidamente.
8. Encontré la tienda muy incómoda de usar.
9. Me sentí muy seguro usando la tienda.
10. Necesité aprender muchas cosas antes de poder usar esta tienda.
```

Las respuestas se exportan desde la hoja de cálculo vinculada y se copian en `sus-respuestas.csv` con el formato `evaluador,p1,p2,…,p10`: el código del evaluador y diez números del 1 al 5, sin encabezados extra.

## Cálculo (lo hace `calcular-sus.ts`)

1. Afirmaciones impares: respuesta − 1.
2. Afirmaciones pares: 5 − respuesta.
3. Suma de las 10 contribuciones (0 a 40) × 2,5, lo que da un puntaje de 0 a 100 por evaluador.
4. Media y desviación estándar del grupo.

**Interpretación:**
- **68** es el promedio de referencia (Sauro, 2011).
- El **adjetivo** se asigna según Bangor, Kortum y Miller (2009).
- La **nota de la A a la F** sigue la escala curva de Sauro y Lewis (2016).
- La **aceptabilidad** sigue a Bangor, Kortum y Miller (2008): no aceptable por debajo de 50, marginal entre 50 y 70, aceptable por encima de 70.

El SUS mide la **percepción** de usabilidad, no el desempeño: se complementa con el éxito y los tiempos de la hoja de observación.
