import 'dotenv/config';
import { Application, Router } from 'express';
import { asincrono, crearServicio, requiereRol } from '@ecommerce/shared';
import { redis, verificarRedis } from './db';
import {
  actualizarItem,
  agregarItem,
  aplicarCupon,
  datosCheckout,
  eliminarItem,
  metricasCarrito,
  quitarCupon,
  vaciarCarrito,
  verCarrito
} from './controlador';

/**
 * Servicio de carrito (seccion 5.7 del documento).
 * Almacenamiento propio: Redis (clave-valor en memoria con expiracion).
 */
const rutas = (app: Application): void => {
  const router = Router();

  router.get('/:clienteId', requiereRol(), asincrono(verCarrito));
  router.post('/:clienteId/items', requiereRol(), asincrono(agregarItem));
  router.patch('/:clienteId/items/:sku', requiereRol(), asincrono(actualizarItem));
  router.delete('/:clienteId/items/:sku', requiereRol(), asincrono(eliminarItem));
  router.post('/:clienteId/cupon', requiereRol(), asincrono(aplicarCupon));
  router.delete('/:clienteId/cupon', requiereRol(), asincrono(quitarCupon));
  router.delete('/:clienteId', requiereRol(), asincrono(vaciarCarrito));

  // Interno: consumido por el servicio de pedidos al iniciar el checkout.
  router.get('/:clienteId/checkout', requiereRol('administrador', 'vendedor'), asincrono(datosCheckout));

  app.use('/', router);
};

void crearServicio({
  nombre: 'carrito-service',
  puerto: Number(process.env.PORT || 3005),
  rutas,
  dependencias: [{ nombre: 'redis', verificar: verificarRedis }],
  metricas: metricasCarrito,
  alDetener: async () => {
    redis.disconnect();
  }
});
