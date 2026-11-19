#!/usr/bin/env bash
# ============================================================================
# Bateria completa del Modulo 1: carga, estres y pico de los cuatro escenarios.
#
#   tests/rendimiento/bateria.sh [perfiles] [escenarios] [etiqueta]
#   p. ej.: tests/rendimiento/bateria.sh "carga estres pico"
#           tests/rendimiento/bateria.sh "estres" "checkout" despues
#
# Requiere el sistema levantado con el perfil de carga (npm run infra:carga) y
# las 300 cuentas (CLIENTES_CARGA=300 npm run sembrar:carga). Antes de cada
# escenario que compra se repone el stock (el poblado es idempotente) y entre
# corridas se deja enfriar el sistema 30 s.
# ============================================================================
set -uo pipefail
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
PERFILES="${1:-carga estres pico}"
ESCENARIOS="${2:-catalogo-busqueda login checkout flujo-completo}"
ETIQUETA="${3:-}"
cd "$RAIZ"

for escenario in $ESCENARIOS; do
  for perfil in $PERFILES; do
    if [ "$escenario" = "checkout" ] || [ "$escenario" = "flujo-completo" ]; then
      echo "-- reponiendo stock antes de $escenario-$perfil"
      CLIENTES_CARGA=300 npx tsx --env-file-if-exists=.env scripts/sembrar-datos-carga.ts > /dev/null 2>&1 \
        || echo "   (aviso: el poblado termino con errores)"
    fi
    # Cada corrida empieza con la cola de notificaciones vacia: si la anterior
    # dejo eventos pendientes, el consumidor los drenaria durante la medicion.
    for _ in $(seq 1 180); do
      PENDIENTES="$(docker exec ecom_rabbitmq rabbitmqctl list_queues -q name messages 2>/dev/null | awk '$1=="notificaciones.envio"{print $2}')"
      [ "${PENDIENTES:-0}" -le "${COLA_MAXIMA_INICIO:-50}" ] && break
      echo "   esperando a que se vacie la cola de notificaciones ($PENDIENTES pendientes)"
      sleep 20
    done
    bash tests/rendimiento/ejecutar.sh "$escenario" "$perfil" "$ETIQUETA" \
      | grep -E '^==|✗|checks_succeeded|http_req_duration\.\.|http_req_failed\.\.|http_reqs\.\.|vus_max'
    sleep 30
  done
done
echo "== bateria terminada $(date -Iseconds)"
