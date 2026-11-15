#!/usr/bin/env bash
# ============================================================================
# Escaneo ACTIVO y autenticado de la API con zap-api-scan.py, a partir de la
# especificacion OpenAPI (docs/openapi/openapi.yaml).
#
#   tests/seguridad/zap-api.sh [cliente|administrador]
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
case "$ROL" in
  cliente) CUENTA="carla@correo.co" ;;      # cliente 3: no se usa en las demas pruebas
  administrador) CUENTA="admin@tienda.co" ;;
  *) echo "rol desconocido: $ROL (cliente|administrador)"; exit 2 ;;
esac

cp "$RAIZ/docs/openapi/openapi.yaml" "$DESTINO/openapi.yaml"
TOKEN="$(token_de "$CUENTA")"
if [ "${#TOKEN}" -lt 100 ]; then
  echo "No se pudo obtener el token de $CUENTA: $TOKEN"; exit 2
fi

export ZAP_TOKEN="$TOKEN"

echo "== zap-api-scan.py como $ROL ($CUENTA) contra http://$HOST_EQUIPO:8080"
zap zap-api-scan.py \
  -t openapi.yaml -f openapi \
  -O "http://$HOST_EQUIPO:8080" \
  -c zap-reglas.tsv \
  -r "api-$ROL.html" -J "api-$ROL.json" -w "api-$ROL.md" \
  2>&1 | tee "$DESTINO/api-$ROL-consola.txt"
echo "== codigo de salida de ZAP: ${PIPESTATUS[0]} (0 limpio, 1 FAIL, 2 solo WARN, 3 error)"
