import 'dotenv/config';
import { Application, Router } from 'express';
import { BusEventos, asincrono, crearServicio, requiereRol, verificarPostgres } from '@ecommerce/shared';
import { pool } from './db';
import { metricasCircuitos } from './dependencias';
import {
  bitacoraSaga,
  cambiarEstado,
  cancelarPedido,
  checkout,
  inyectarBus,
  listarPedidos,
  obtenerPedido
} from './controlador';

/**
 * Servicio de pedidos (seccion 5.8 del documento).
 * Base de datos propia: pedidos_db (PostgreSQL).
 *
 * Es el orquestador de la compra y el unico servicio que escribe en la base de
 * pedidos. Presenta la mayor dependencia del sistema (necesita clientes,
 * catalogo, inventario y pagos), tal como anticipa la Actividad 6, punto b.
 */
const bus = new BusEventos('pedidos-service');

const rutas = (app: Application): void => {
  const router = Router();

  router.post('/checkout', requiereRol('cliente', 'administrador', 'vendedor'), asincrono(checkout));
  router.get('/', requiereRol(), asincrono(listarPedidos));
  router.get('/:id', requiereRol(), asincrono(obtenerPedido));
  router.get('/:id/saga', requiereRol('administrador'), asincrono(bitacoraSaga));
  router.post('/:id/cancelar', requiereRol(), asincrono(cancelarPedido));
  router.patch('/:id/estado', requiereRol('administrador', 'vendedor'), asincrono(cambiarEstado));

  app.use('/', router);
};

void crearServicio({
  nombre: 'pedidos-service',
  puerto: Number(process.env.PORT || 3006),
  rutas,
  dependencias: [
    { nombre: 'postgres:pedidos_db', verificar: verificarPostgres(pool) },
    { nombre: 'rabbitmq', verificar: async () => bus.conectado, critica: false }
  ],
  metricas: metricasCircuitos,
  alIniciar: async () => {
    inyectarBus(bus);
    await bus.conectar().catch(() => undefined);
  },
  alDetener: async () => {
    await bus.cerrar();
    await pool.end();
  }
});
