import { crearPool } from '@ecommerce/shared';

export const pool = crearPool(
  'pagos-service',
  'postgresql://pagos_user:pagos_pass@localhost:5432/pagos_db'
);
