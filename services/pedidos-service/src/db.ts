import { crearPool } from '@ecommerce/shared';

export const pool = crearPool(
  'pedidos-service',
  'postgresql://pedidos_user:pedidos_pass@localhost:5432/pedidos_db'
);
