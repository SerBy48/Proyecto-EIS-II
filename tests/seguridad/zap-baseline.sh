#!/usr/bin/env bash
# ============================================================================
# Escaneo PASIVO de la web con zap-baseline.py: spider clasico y AJAX spider
# (la web es una SPA de React), sin ataques.
#
#   tests/seguridad/zap-baseline.sh
#
# Requiere la web construida y servida con vite preview en el 4173:
#   npm run build:web && (cd clients/web && npx vite preview --host 0.0.0.0 --port 4173)
#
# Deja en docs/evidencia/no-funcionales/seguridad/ el reporte en HTML, JSON y
# Markdown (baseline-web.*).
# ============================================================================
source "$(dirname "$0")/zap-comun.sh"

# Vite 5 rechaza los Host desconocidos (allowedHosts). En lugar de abrir la
# configuracion del proyecto, ZAP reescribe la cabecera Host a localhost.
OPCIONES_ZAP="$(reemplazo 0 Host localhost:4173)"

echo "== zap-baseline.py contra la web (http://$HOST_EQUIPO:4173)"
zap zap-baseline.py \
  -t "http://$HOST_EQUIPO:4173" \
  -j -m 3 \
  -c zap-reglas.tsv \
  -r baseline-web.html -J baseline-web.json -w baseline-web.md \
  -z "$OPCIONES_ZAP" \
  2>&1 | tee "$DESTINO/baseline-web-consola.txt"
# Codigos de zap-baseline: 0 sin alertas, 1 FAIL, 2 WARN, 3 error de ZAP.
echo "== codigo de salida de ZAP: ${PIPESTATUS[0]} (0 limpio, 1 FAIL, 2 solo WARN, 3 error)"
