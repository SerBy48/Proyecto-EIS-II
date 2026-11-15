#!/usr/bin/env bash
# ============================================================================
# Ejecuta un escenario de k6 con un perfil y guarda toda la evidencia.
#
#   tests/rendimiento/ejecutar.sh <escenario> <perfil> [etiqueta]
#   p. ej.: tests/rendimiento/ejecutar.sh checkout estres
#
# escenario: catalogo-busqueda | login | checkout | flujo-completo
# perfil:    humo | carga | estres | pico
# etiqueta:  sufijo opcional del nombre (p. ej. "antes", "despues", "limites-normales")
#
# Deja en docs/evidencia/no-funcionales/rendimiento/:
#   <nombre>.json              resumen de k6 (--summary-export)
#   <nombre>-serie.json.gz     serie temporal de k6, para las graficas
#   <nombre>-docker-stats.csv  CPU y memoria por contenedor cada ~2 s (solo estres y pico)
#   <nombre>-salud.json        /api/health y /health del catalogo antes y despues
#   <nombre>-gateway-5xx.log   lineas de error del gateway durante la corrida
#   <nombre>-consola.txt       salida de k6
#
# Variables: K6_URL_BASE (destino), ESCALON (duracion de cada escalon de estres).
# ============================================================================
set -uo pipefail

ESCENARIO="${1:?escenario}"
PERFIL="${2:-humo}"
ETIQUETA="${3:-}"
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
DESTINO="$RAIZ/docs/evidencia/no-funcionales/rendimiento"
NOMBRE="${ESCENARIO}-${PERFIL}${ETIQUETA:+-$ETIQUETA}"
URL="${K6_URL_BASE:-http://localhost:8080}"
mkdir -p "$DESTINO"

# Mensajes pendientes en la cola de notificaciones. Si una corrida empieza con
# cola acumulada por la anterior, el consumidor la drena en segundo plano y
# compite por CPU con la medicion (docs/calidad/RENDIMIENTO.md, hallazgo R6).
cola_notificaciones() {
  docker exec ecom_rabbitmq rabbitmqctl list_queues -q name messages 2>/dev/null \
    | awk '$1=="notificaciones.envio"{print $2}' | grep . || echo null
}

salud() {
  local momento="$1"
  printf '"%s": {"hora": "%s", "cola_notificaciones": %s, "gateway": %s, "catalogo": %s, "auth": %s}' \
    "$momento" "$(date -Iseconds)" "$(cola_notificaciones)" \
    "$(curl -s --max-time 5 "$URL/api/health" || echo null)" \
    "$(curl -s --max-time 5 http://localhost:3003/health || echo null)" \
    "$(curl -s --max-time 5 http://localhost:3001/health || echo null)"
}

echo "== $NOMBRE contra $URL"
INICIO_ISO="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
ANTES="$(salud antes)"

# Muestreo de recursos por contenedor mientras corre k6. Solo en estres y pico
# (o con MUESTREO=1): en Windows "docker stats" consume CPU por si mismo y
# sesgaria la linea base del humo y de la carga.
BANDERA="$(mktemp)"
MUESTREADOR=""
if [ "${MUESTREO:-}" = "1" ] || { [ "${MUESTREO:-}" != "0" ] && { [ "$PERFIL" = "estres" ] || [ "$PERFIL" = "pico" ]; }; }; then
  CSV="$DESTINO/$NOMBRE-docker-stats.csv"
  echo "marca_tiempo,contenedor,cpu_pct,mem_uso,mem_pct" > "$CSV"
  (
    while [ -f "$BANDERA" ]; do
      T="$(date +%s)"
      docker stats --no-stream --format "{{.Name}},{{.CPUPerc}},{{.MemUsage}},{{.MemPerc}}" 2>/dev/null \
        | sed -e "s/^/$T,/" -e 's/%//g' -e 's/ \/ [^,]*//' >> "$CSV"
    done
  ) &
  MUESTREADOR=$!
fi

k6 run --quiet \
  -e PERFIL="$PERFIL" -e K6_URL_BASE="$URL" ${ESCALON:+-e ESCALON="$ESCALON"} \
  --summary-export "$DESTINO/$NOMBRE.json" \
  --out "json=$DESTINO/$NOMBRE-serie.json.gz" \
  "$RAIZ/tests/rendimiento/$ESCENARIO.js" 2>&1 | tee "$DESTINO/$NOMBRE-consola.txt"
CODIGO=${PIPESTATUS[0]}

rm -f "$BANDERA"
[ -n "$MUESTREADOR" ] && wait "$MUESTREADOR" 2>/dev/null

DESPUES="$(salud despues)"
printf '{%s, %s}\n' "$ANTES" "$DESPUES" > "$DESTINO/$NOMBRE-salud.json"
docker logs ecom_gateway --since "$INICIO_ISO" 2>&1 | grep -E '"estado":5[0-9]{2}|ERROR' > "$DESTINO/$NOMBRE-gateway-5xx.log" || true

echo "== $NOMBRE terminado: codigo k6 $CODIGO (99 = algun umbral no se cumplio), lineas 5xx en el gateway: $(wc -l < "$DESTINO/$NOMBRE-gateway-5xx.log")"
exit "$CODIGO"
