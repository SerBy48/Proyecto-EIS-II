import { randomBytes } from 'node:crypto';

/**
 * Secretos de prueba, generados en cada corrida. Los modulos de la libreria
 * compartida los exigen (invariante 13) y no deben depender del .env local.
 */
for (const nombre of ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'INTERNAL_TOKEN']) {
  process.env[nombre] = randomBytes(32).toString('hex');
}
process.env.LOG_LEVEL = 'error';
