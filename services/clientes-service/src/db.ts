import { drizzle } from 'drizzle-orm/node-postgres';
import { crearPool } from '@ecommerce/shared';
import * as esquema from './esquema';

/** Pool de conexiones: lo usan el chequeo de salud y el cierre ordenado. */
export const pool = crearPool(
  'clientes-service',
  'postgresql://clientes_user:clientes_pass@localhost:5432/clientes_db'
);

/** Drizzle sobre el mismo pool: no abre conexiones propias. */
export const db = drizzle({ client: pool, schema: esquema });
