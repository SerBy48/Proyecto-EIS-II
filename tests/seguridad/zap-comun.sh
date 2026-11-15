#!/usr/bin/env bash
# ============================================================================
# Funciones comunes de los escaneos de OWASP ZAP (Modulo 3).
#
# ZAP corre en Docker (ghcr.io/zaproxy/zaproxy:stable) y llega a los servicios
# del equipo por host.docker.internal. ALCANCE: solo se escanea el propio
# proyecto en este equipo; los objetivos estan fijos y no se aceptan URL
# externas.
# ============================================================================
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DESTINO="$RAIZ/docs/evidencia/no-funcionales/seguridad"
IMAGEN_ZAP="${IMAGEN_ZAP:-ghcr.io/zaproxy/zaproxy:stable}"
HOST_EQUIPO="host.docker.internal"
mkdir -p "$DESTINO"

# Ruta del destino en formato Windows para el montaje de Docker Desktop (en
# Linux o macOS, pwd -W no existe y se usa la ruta tal cual).
DESTINO_DOCKER="$(cd "$DESTINO" && (pwd -W 2>/dev/null || pwd))"

# Copia la configuracion de reglas al directorio montado para que ZAP la lea.
cp "$RAIZ/tests/seguridad/zap-reglas.tsv" "$DESTINO/zap-reglas.tsv"

# Ejecuta un script empaquetado de ZAP con el directorio de evidencia montado.
# Si ZAP_TOKEN esta definido, ZAP lo envia como "Authorization: Bearer ..." en
# todas las peticiones (variables ZAP_AUTH_HEADER* de los scripts empaquetados;
# -z no sirve porque ZAP parte sus opciones por espacios).
zap() {
  MSYS_NO_PATHCONV=1 docker run --rm \
    --add-host "$HOST_EQUIPO:host-gateway" \
    ${ZAP_TOKEN:+-e ZAP_AUTH_HEADER=Authorization -e "ZAP_AUTH_HEADER_VALUE=Bearer $ZAP_TOKEN"} \
    -v "$DESTINO_DOCKER:/zap/wrk/:rw" \
    "$IMAGEN_ZAP" "$@"
}

# Inicia sesion contra el gateway e imprime el token de acceso.
token_de() {
  curl -s -X POST http://localhost:8080/api/auth/login \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"Password123\"}" \
    | sed -E 's/.*"token":"([^"]+)".*/\1/'
}

# Regla "replacer" de ZAP: fija una cabecera en todas las peticiones.
#   reemplazo <indice> <cabecera> <valor>
reemplazo() {
  printf -- "-config replacer.full_list(%s).description=%s -config replacer.full_list(%s).enabled=true -config replacer.full_list(%s).matchtype=REQ_HEADER -config replacer.full_list(%s).matchstr=%s -config replacer.full_list(%s).regex=false -config replacer.full_list(%s).replacement=%s " \
    "$1" "$2" "$1" "$1" "$1" "$2" "$1" "$1" "$3"
}
