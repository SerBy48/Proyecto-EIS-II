import { crearPool } from '@ecommerce/shared';

export const pool = crearPool(
  'inventario-service',
  'postgresql://inventario_user:inventario_pass@localhost:5432/inventario_db'
);
