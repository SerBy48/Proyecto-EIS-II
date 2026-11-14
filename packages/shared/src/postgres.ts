import { Pool, PoolConfig } from 'pg';
import { crearLogger } from './logger';

/**
 * Pool de conexiones propio de este servicio.
 *
 * Cada microservicio se conecta unicamente a SU base de datos, con SU usuario.
 * El servicio de autenticacion no tiene credenciales para leer pedidos ni
 * inventario: si necesitara ese dato, tendria que pedirlo por la API del
 * servicio propietario.
 */
export const crearPool = (servicio: string, urlPorDefecto: string): Pool => {
  const log = crearLogger(servicio);

  const config: PoolConfig = {
    connectionString: process.env.DATABASE_URL || conPuertoHost(urlPorDefecto),
    max: Number(process.env.DB_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000
  };

  const pool = new Pool(config);

  pool.on('error', (error) => {
    log.error('Error inesperado en el pool de PostgreSQL', { error: error.message });
  });

  return pool;
};

/**
 * En desarrollo local el contenedor de PostgreSQL puede publicarse en otro
 * puerto del host (POSTGRES_PUERTO_HOST) si el 5432 ya lo ocupa una
 * instalacion nativa. Solo aplica a la URL por defecto; DATABASE_URL manda.
 */
export const conPuertoHost = (url: string): string => {
  const puerto = process.env.POSTGRES_PUERTO_HOST;
  if (!puerto) return url;
  const destino = new URL(url);
  destino.port = puerto;
  return destino.toString();
};

/** Sonda para el endpoint /health. */
export const verificarPostgres = (pool: Pool) => async (): Promise<boolean> => {
  try {
    const cliente = await pool.connect();
    try {
      await cliente.query('SELECT 1');
      return true;
    } finally {
      cliente.release();
    }
  } catch {
    return false;
  }
};

/**
 * Ejecuta una funcion dentro de una transaccion, con COMMIT o ROLLBACK
 * automatico. Necesario en el servicio de inventario, donde reservar stock y
 * registrar el movimiento deben ocurrir o no ocurrir juntos.
 */
export const enTransaccion = async <T>(
  pool: Pool,
  operacion: (cliente: import('pg').PoolClient) => Promise<T>
): Promise<T> => {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await operacion(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    cliente.release();
  }
};
