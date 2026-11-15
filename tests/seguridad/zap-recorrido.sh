#!/usr/bin/env bash
# ============================================================================
# Spidering autenticado de la web: ZAP como proxy de intercepcion de un
# navegador real (Paso 2.3.1 del plan).
#
#   tests/seguridad/zap-recorrido.sh
#
# 1. Levanta ZAP en modo daemon (puerto 8090, solo en 127.0.0.1).
# 2. Recorre la web con Playwright A TRAVES del proxy, haciendo las 8 tareas
#    de tests/usabilidad/tareas.md: sesion de cliente (T1-T7) y de
#    administrador (T8). Asi ZAP registra las paginas y llamadas autenticadas
#    (carrito, checkout, mis pedidos, panel) que el AJAX spider anonimo no ve.
# 3. Espera al escaneo pasivo y guarda el reporte en HTML y JSON.
#
# Requiere la web servida con vite preview en el 4173 y el sistema levantado.
#
# Alternativa manual: con ZAP de escritorio en el 8090, configurar el
# navegador para usar el proxy localhost:8090, entrar a la web por
# http://host.docker.internal:4173 o http://localhost:4173 y recorrer la
# tienda y el panel con las cuentas de Ana y del administrador.
# ============================================================================
source "$(dirname "$0")/zap-comun.sh"

API_ZAP="http://localhost:8090"
NOMBRE_CONTENEDOR="ecom_zap_proxy"

docker rm -f "$NOMBRE_CONTENEDOR" >/dev/null 2>&1
echo "== Levantando ZAP como proxy en 127.0.0.1:8090"
MSYS_NO_PATHCONV=1 docker run -d --name "$NOMBRE_CONTENEDOR" \
  --add-host "$HOST_EQUIPO:host-gateway" -p 127.0.0.1:8090:8090 \
  "$IMAGEN_ZAP" zap.sh -daemon -host 0.0.0.0 -port 8090 \
  -config api.disablekey=true -config 'api.addrs.addr.name=.*' -config api.addrs.addr.regex=true >/dev/null

for _ in $(seq 1 60); do curl -s "$API_ZAP/JSON/core/view/version/" >/dev/null && break; sleep 2; done
echo "   ZAP $(curl -s "$API_ZAP/JSON/core/view/version/" | sed -E 's/.*"version":"([^"]+)".*/\1/')"

# El navegador entra por host.docker.internal (Chromium no usa el proxy para
# localhost). Vite rechaza ese Host y el gateway ese Origin: ZAP los reescribe.
regla() {
  curl -s "$API_ZAP/JSON/replacer/action/addRule/?description=$1&enabled=true&matchType=REQ_HEADER&matchRegex=false&matchString=$2&replacement=$3&initiators=" >/dev/null
}
regla host Host "localhost:4173"
regla origen Origin "http%3A%2F%2Flocalhost%3A4173"

echo "== Recorriendo la web a traves del proxy (cliente y administrador)"
ZAP_PROXY="$API_ZAP" URL_WEB="http://$HOST_EQUIPO:4173" \
  npx tsx --env-file-if-exists=.env "$RAIZ/tests/usabilidad/recorrido.ts"
CODIGO_RECORRIDO=$?

echo "== Esperando el escaneo pasivo"
for _ in $(seq 1 60); do
  PENDIENTES="$(curl -s "$API_ZAP/JSON/pscan/view/recordsToScan/" | sed -E 's/.*"recordsToScan":"([0-9]+)".*/\1/')"
  [ "$PENDIENTES" = "0" ] && break
  sleep 2
done

curl -s "$API_ZAP/OTHER/core/other/htmlreport/" > "$DESTINO/recorrido-autenticado.html"
curl -s "$API_ZAP/JSON/core/view/alerts/?baseurl=http%3A%2F%2F$HOST_EQUIPO%3A4173" > "$DESTINO/recorrido-autenticado.json"
curl -s "$API_ZAP/JSON/core/view/urls/?baseurl=http%3A%2F%2F$HOST_EQUIPO%3A4173" > "$DESTINO/recorrido-autenticado-urls.json"

docker rm -f "$NOMBRE_CONTENEDOR" >/dev/null
echo "== Recorrido: codigo $CODIGO_RECORRIDO. Reporte en $DESTINO/recorrido-autenticado.html"
exit "$CODIGO_RECORRIDO"
