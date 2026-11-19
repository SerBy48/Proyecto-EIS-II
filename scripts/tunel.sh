#!/usr/bin/env bash
# ============================================================================
# Tunel publico para la defensa (Trabajo Final, Fase 5; docs/adr/0009).
#
#   npm run prod:up      el sistema en el perfil de produccion
#   npm run tunel        expone la web con un Cloudflare Quick Tunnel
#
# - cloudflared corre en un contenedor DENTRO de la red de Compose y apunta al
#   servicio "web" (nginx): no hay nada que instalar ni cuenta que crear.
# - Solo se expone la web. La API va por su proxy /api, en el mismo origen, y
#   nginx quita la cabecera Origin cuando coincide con el Host, asi que la URL
#   aleatoria del tunel no necesita estar en CORS_ORIGENES.
# - La URL (https://<palabras>.trycloudflare.com) cambia en cada ejecucion y
#   deja de existir al cerrar el tunel (Ctrl+C).
#
# CUIDADO: mientras el tunel este abierto, cualquiera con la URL ve la tienda.
# Con el perfil prod las cuentas son las de produccion del .env; si se abre
# sobre el laboratorio, cualquiera podria entrar con las cuentas de prueba
# (Password123). Abrirlo solo durante la demostracion. Con PROXIES_CONFIANZA=2
# el limite de peticiones cuenta a cada persona. La interfaz de Mailpit NO se
# expone (127.0.0.1:8025).
# ============================================================================
set -euo pipefail

RED="${RED_COMPOSE:-ecommerce-distribuido_interna}"
IMAGEN="cloudflare/cloudflared:2024.12.2"

if ! docker inspect -f '{{.State.Health.Status}}' ecom_web 2>/dev/null | grep -q healthy; then
  echo "La web (ecom_web) no esta en marcha o no esta sana. Primero: npm run prod:up" >&2
  exit 1
fi

echo "Abriendo el tunel hacia la web (Ctrl+C para cerrarlo)..."
echo "Busca la linea con https://...trycloudflare.com"
echo
exec docker run --rm --name ecom_tunel --network "$RED" "$IMAGEN" \
  tunnel --no-autoupdate --url http://web:8080
