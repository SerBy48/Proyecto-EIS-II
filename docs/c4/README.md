# Modelo C4

Fuentes C4-PlantUML (`*.puml`) y sus PNG en `png/`. Las librerias C4-PlantUML v2.10.0 estan copiadas en `lib/` para no depender de la red y fijar la version.

```bash
npm run docs:c4   # usa la imagen Docker plantuml/plantuml:1.2024.7 (trae Graphviz)
```

El borde discontinuo marca elementos planificados (Fases 2, 3 y 5) que aun no existen en el codigo. La explicacion de cada diagrama y el checklist cruzado contra el codigo estan en [`../especificacion/02-especificacion-arquitectura.md`](../especificacion/02-especificacion-arquitectura.md).
