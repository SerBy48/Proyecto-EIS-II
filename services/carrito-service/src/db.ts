import Redis from 'ioredis';
import { crearLogger } from '@ecommerce/shared';

const log = crearLogger('carrito-service');

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 2,
  lazyConnect: false,
  retryStrategy: (intentos) => Math.min(intentos * 200, 3000)
});

redis.on('error', (error) => log.error('Error de Redis', { error: error.message }));
redis.on('connect', () => log.info('Conectado a Redis'));

export const verificarRedis = async (): Promise<boolean> => {
  try {
    return (await redis.ping()) === 'PONG';
  } catch {
    return false;
  }
};
