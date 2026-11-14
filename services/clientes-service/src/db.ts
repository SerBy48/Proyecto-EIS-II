import { crearPool } from '@ecommerce/shared';

export const pool = crearPool(
  'clientes-service',
  'postgresql://clientes_user:clientes_pass@localhost:5432/clientes_db'
);
