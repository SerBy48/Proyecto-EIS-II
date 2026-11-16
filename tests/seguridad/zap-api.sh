#!/usr/bin/env bash
# ============================================================================
# Escaneo ACTIVO y autenticado de la API con zap-api-scan.py, a partir de la
# especificacion OpenAPI: la publica y la interna empaquetadas por
# npm run docs:openapi, unidas en un solo archivo. Las rutas internas tambien
# se escanean: a traves del gateway las alcanza el personal interno.
#
#   tests/seguridad/zap-api.sh [cliente|administrador] [etiqueta]
#
# El token se obtiene justo antes del escaneo (vive 15 min) y ZAP lo inyecta
# en todas las peticiones (ZAP_AUTH_HEADER_VALUE, ver zap-comun.sh).
#
# IMPORTANTE: el escaneo activo envia miles de peticiones con datos de ataque
# (crea usuarios y productos, cancela pedidos...). Solo contra el entorno
# local de pruebas, nunca contra datos reales. Con los limites normales del
# gateway casi todo seria 429, por lo que se ejecuta con el perfil de carga
# (npm run infra:carga); el limitador se prueba aparte (test:http, suite F).
#
# Deja api-<rol>.html, .json y .md en docs/evidencia/no-funcionales/seguridad/.
# ============================================================================
source "$(dirname "$0")/zap-comun.sh"

ROL="${1:-cliente}"
NOMBRE="api-$ROL${2:+-$2}"   # etiqueta opcional, p. ej. "despues"
case "$ROL" in
  cliente) CUENTA="carla@correo.co" ;;      # cliente 3: no se usa en las demas pruebas
  administrador) CUENTA="admin@tienda.co" ;;
  *) echo "rol desconocido: $ROL (cliente|administrador)"; exit 2 ;;
esac

node -e '
const [publica, interna, salida] = process.argv.slice(1);
const p = require(publica), i = require(interna);
p.paths = { ...p.paths, ...i.paths };
p.servers = [{ url: "http://localhost:8080" }];
require("fs").writeFileSync(salida, JSON.stringify(p, null, 2));
' "$RAIZ/services/api-gateway/especificacion/openapi.json" "$RAIZ/docs/openapi/generado/openapi-interna.json" "$DESTINO/openapi.json"
TOKEN="$(token_de "$CUENTA")"
if [ "${#TOKEN}" -lt 100 ]; then
  echo "No se pudo obtener el token de $CUENTA: $TOKEN"; exit 2
fi

export ZAP_TOKEN="$TOKEN"

echo "== zap-api-scan.py como $ROL ($CUENTA) contra http://$HOST_EQUIPO:8080"
zap zap-api-scan.py \
  -t openapi.json -f openapi \
  -O "http://$HOST_EQUIPO:8080" \
  -c zap-reglas.tsv \
  -r "$NOMBRE.html" -J "$NOMBRE.json" -w "$NOMBRE.md" \
  2>&1 | tee "$DESTINO/$NOMBRE-consola.txt"
echo "== codigo de salida de ZAP: ${PIPESTATUS[0]} (0 limpio, 1 FAIL, 2 solo WARN, 3 error)"
