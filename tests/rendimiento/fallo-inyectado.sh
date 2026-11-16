#!/usr/bin/env bash
# ============================================================================
# Carga con un fallo inyectado (Trabajo Final, Fase 4: caracter distribuido).
#
#   tests/rendimiento/fallo-inyectado.sh inventario      # durante la busqueda en el catalogo
#   tests/rendimiento/fallo-inyectado.sh notificaciones  # durante el checkout
#
# Corre el escenario con el perfil "carga" (0->50 VU en 1 min, 3 min a 50 VU) y,
# en plena meseta, DETIENE el servicio (docker stop) durante CAIDA segundos
# (60 por defecto) y lo vuelve a arrancar. Mientras tanto muestrea cada 2 s:
#   inventario      estado del circuit breaker de catalogo -> inventario
#                   (GET :3003/health, metricas.circuito_inventario)
#   notificaciones  mensajes en la cola notificaciones.envio (RabbitMQ)
# Tras la corrida de notificaciones sigue muestreando hasta que la cola se
# vacia, para medir el tiempo de recuperacion.
#
# Evidencia en docs/evidencia/no-funcionales/rendimiento/:
#   <escenario>-carga-fallo-<servicio>.json, -serie.json.gz, -consola.txt (k6)
#   fallo-<servicio>-muestras.csv   (marca de tiempo, fase, metrica)
#   fallo-<servicio>-eventos.txt    (cuando se detuvo, arranco y se recupero)
# ============================================================================
set -uo pipefail

SERVICIO="${1:?inventario | notificaciones}"
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
DESTINO="$RAIZ/docs/evidencia/no-funcionales/rendimiento"
INICIO_FALLO="${INICIO_FALLO:-100}"   # segundos desde el arranque de k6 (meseta: 60-240 s)
CAIDA="${CAIDA:-60}"

case "$SERVICIO" in
  inventario) ESCENARIO=catalogo-busqueda; CONTENEDOR=ecom_inventario ;;
  notificaciones) ESCENARIO=checkout; CONTENEDOR=ecom_notificaciones ;;
  *) echo "servicio desconocido: $SERVICIO"; exit 2 ;;
esac

MUESTRAS="$DESTINO/fallo-$SERVICIO-muestras.csv"
EVENTOS="$DESTINO/fallo-$SERVICIO-eventos.txt"
: > "$EVENTOS"
evento() { echo "$(date +%s) $(date -Iseconds) $*" | tee -a "$EVENTOS"; }

metrica() {
  if [ "$SERVICIO" = inventario ]; then
    curl -s --max-time 2 http://localhost:3003/health \
      | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const c=JSON.parse(s).metricas.circuito_inventario;console.log(`${c.estado},${c.fallos_consecutivos}`)}catch{console.log("sin_respuesta,")}})'
  else
    local n
    n="$(curl -s --max-time 2 -u ecommerce:ecommerce http://localhost:15672/api/queues/%2F/notificaciones.envio \
      | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).messages)}catch{console.log("")}})')"
    echo "${n:-}"
  fi
}

if [ "$SERVICIO" = inventario ]; then echo "marca_tiempo,fase,circuito,fallos_consecutivos" > "$MUESTRAS"
else echo "marca_tiempo,fase,mensajes_en_cola" > "$MUESTRAS"; fi

FASE=normal
BANDERA="$(mktemp)"
(
  while [ -f "$BANDERA" ]; do
    echo "$(date +%s),$(cat "$BANDERA" 2>/dev/null),$(metrica)" >> "$MUESTRAS"
    sleep 2
  done
) &
MUESTREADOR=$!
echo normal > "$BANDERA"

evento "inicio de la carga ($ESCENARIO, perfil carga)"
bash "$RAIZ/tests/rendimiento/ejecutar.sh" "$ESCENARIO" carga "fallo-$SERVICIO" > /dev/null 2>&1 &
K6=$!

sleep "$INICIO_FALLO"
echo caido > "$BANDERA"
docker stop "$CONTENEDOR" > /dev/null
evento "docker stop $CONTENEDOR"
sleep "$CAIDA"
docker start "$CONTENEDOR" > /dev/null
echo recuperando > "$BANDERA"
evento "docker start $CONTENEDOR"

wait "$K6"
evento "fin de la carga (codigo de ejecutar.sh: $?)"

if [ "$SERVICIO" = notificaciones ]; then
  # Recuperacion: hasta que la cola se vacie (maximo 15 min).
  for _ in $(seq 1 450); do
    [ "$(metrica)" = "0" ] && break
    sleep 2
  done
  evento "cola notificaciones.envio vacia: $(metrica) mensajes"
fi

rm -f "$BANDERA"
wait "$MUESTREADOR" 2>/dev/null
evento "muestras: $(($(wc -l < "$MUESTRAS") - 1))"
