import { crearPool } from '@ecommerce/shared';

export const pool = crearPool(
  'auth-service',
  'postgresql://auth_user:auth_pass@localhost:5432/auth_db'
);
