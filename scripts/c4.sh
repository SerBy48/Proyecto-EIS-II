#!/usr/bin/env bash
# Renderiza los diagramas C4 (docs/c4/*.puml) a docs/c4/png con la imagen
# Docker de PlantUML, que ya trae Graphviz. Las librerias C4-PlantUML v2.10.0
# estan copiadas en docs/c4/lib: no se descarga nada en cada render.
set -euo pipefail
cd "$(dirname "$0")/../docs/c4"
DIR="$(pwd -W 2>/dev/null || pwd)"
MSYS_NO_PATHCONV=1 docker run --rm -v "$DIR:/data" -w /data plantuml/plantuml:1.2024.7 \
  -tpng -o png 0*.puml informe-*.puml
ls png
