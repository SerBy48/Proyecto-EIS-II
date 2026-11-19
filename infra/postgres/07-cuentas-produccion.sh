#!/usr/bin/env bash
# ============================================================================
# Cuentas de PRODUCCION (despliegue en la nube; docs/manuales/DESPLIEGUE.md).
#
# Corre despues de 06-datos-prueba.sql, solo al crear el volumen.
#
#   - Laboratorio (docker-compose.yml): CUENTAS_PRODUCCION no esta definida y
#     no hace nada. Las cuentas de prueba (Password123) se quedan: las usan
#     test:http, test:e2e, test:e2e:ui, test:asistente y test:seguridad.
#   - Produccion (docker-compose.prod.yml con CUENTAS_PRODUCCION=true): borra
#     las cuentas y los clientes de prueba y crea tres cuentas reales con los
#     correos y las contrasenas del .env DEL SERVIDOR. Ni los correos ni las
#     contrasenas estan en el repositorio (es publico).
#
# El hash lo calcula pgcrypto (bcrypt, 10 rondas, como auth-service); bcryptjs
# verifica los hashes $2a$ igual que los $2b$. La contrasena viaja como
# variable de psql (:'clave'), nunca concatenada en el SQL.
#
# Sin "exit" fuera de los errores: si el archivo no fuera ejecutable, el
# entrypoint de postgres lo cargaria con "source" y un exit lo detendria.
# ============================================================================

if [ "${CUENTAS_PRODUCCION:-}" != "true" ]; then
  echo "07-cuentas-produccion: laboratorio, se conservan las cuentas de prueba."
else
  # Sin -u: el entrypoint de postgres usa variables que pueden no estar definidas.
  set -eo pipefail
  for variable in CORREO_ADMIN CLAVE_ADMIN CORREO_VENDEDOR CLAVE_VENDEDOR CORREO_CLIENTE CLAVE_CLIENTE NOMBRE_CLIENTE APELLIDO_CLIENTE; do
    if [ -z "${!variable:-}" ]; then
      echo "07-cuentas-produccion: falta $variable en el .env del servidor." >&2
      exit 1
    fi
  done
  for variable in CORREO_ADMIN CORREO_VENDEDOR CORREO_CLIENTE; do
    if ! printf '%s' "${!variable}" | grep -Eq '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'; then
      echo "07-cuentas-produccion: $variable no es un correo valido." >&2
      exit 1
    fi
  done
  for variable in CLAVE_ADMIN CLAVE_VENDEDOR CLAVE_CLIENTE; do
    if [ "$(printf '%s' "${!variable}" | wc -c)" -lt 12 ]; then
      echo "07-cuentas-produccion: $variable debe tener al menos 12 caracteres." >&2
      exit 1
    fi
  done

  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname clientes_db \
    -v correo="$CORREO_CLIENTE" -v nombre="$NOMBRE_CLIENTE" -v apellido="$APELLIDO_CLIENTE" <<'SQL'
TRUNCATE direcciones, clientes RESTART IDENTITY CASCADE;
INSERT INTO clientes (nombre, apellido, email, telefono, documento, tipo_documento)
  VALUES (:'nombre', :'apellido', lower(:'correo'), '3101234567', '1075234567', 'CC');
INSERT INTO direcciones (cliente_id, tipo, etiqueta, linea1, ciudad, departamento, codigo_postal, predeterminada) VALUES
  (1, 'envio',       'Casa', 'Calle 8 # 12-45, Barrio Altico', 'Neiva', 'Huila', '410001', TRUE),
  (1, 'facturacion', 'Casa', 'Calle 8 # 12-45, Barrio Altico', 'Neiva', 'Huila', '410001', TRUE);
SQL

  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname auth_db \
    -v correo_admin="$CORREO_ADMIN" -v clave_admin="$CLAVE_ADMIN" \
    -v correo_vendedor="$CORREO_VENDEDOR" -v clave_vendedor="$CLAVE_VENDEDOR" \
    -v correo_cliente="$CORREO_CLIENTE" -v clave_cliente="$CLAVE_CLIENTE" <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
TRUNCATE usuarios RESTART IDENTITY CASCADE;
INSERT INTO usuarios (email, password_hash, rol, cliente_id) VALUES
  (lower(:'correo_admin'),    crypt(:'clave_admin',    gen_salt('bf', 10)), 'administrador', NULL),
  (lower(:'correo_vendedor'), crypt(:'clave_vendedor', gen_salt('bf', 10)), 'vendedor',      NULL),
  (lower(:'correo_cliente'),  crypt(:'clave_cliente',  gen_salt('bf', 10)), 'cliente',       1);
DROP EXTENSION pgcrypto;
SQL

  echo "07-cuentas-produccion: cuentas de prueba reemplazadas por las de produccion (administrador, vendedor y un cliente)."
fi
