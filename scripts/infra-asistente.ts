/**
 * Prepara asistente_db en un volumen de MongoDB que ya existe (npm run
 * infra:asistente). En un volumen nuevo no hace falta: Mongo ejecuta el mismo
 * script al inicializarse. Es idempotente.
 *
 * Las credenciales de root se leen DENTRO del contenedor (sus variables
 * MONGO_INITDB_ROOT_*), asi que no dependen del shell del anfitrion.
 */
import { execFileSync } from 'node:child_process';

execFileSync(
  'docker',
  [
    'compose', 'exec', '-T', 'mongo', 'sh', '-c',
    'mongosh -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --quiet /docker-entrypoint-initdb.d/z-asistente.js'
  ],
  { stdio: 'inherit' }
);
