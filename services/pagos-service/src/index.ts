import 'dotenv/config';
import { Application, Router } from 'express';
import { BusEventos, asincrono, crearServicio, requiereRol, verificarPostgres } from '@ecommerce/shared';
import { pool } from './db';
import {
  cobrar,
  inyectarBus,
  listarTransacciones,
  obtenerTransaccion,
  reembolsarTransaccion
} from './controlador';

/**
 * Servicio de pagos (seccion 5.9 del documento).
 * Base de datos propia: pagos_db (PostgreSQL, cumplimiento PCI-DSS).
 *
 * No almacena datos completos de tarjeta en ningun momento: solo la referencia
 * tokenizada que entrega la pasarela.
 */
const bus = new BusEventos('pagos-service');

const rutas = (app: Application): void => {
  const router = Router();

  // El cobro lo invoca el servicio de pedidos por la red privada.
  router.post('/cobros', requiereRol('administrador', 'vendedor'), asincrono(cobrar));
  router.post(
    '/transacciones/:referencia/reembolsar',
    requiereRol('administrador', 'vendedor'),
    asincrono(reembolsarTransaccion)
  );

  router.get('/transacciones', requiereRol(), asincrono(listarTransacciones));
  router.get('/transacciones/:referencia', requiereRol(), asincrono(obtenerTransaccion));

  app.use('/', router);
};

void crearServicio({
  nombre: 'pagos-service',
  puerto: Number(process.env.PORT || 3007),
  rutas,
  dependencias: [
    { nombre: 'postgres:pagos_db', verificar: verificarPostgres(pool) },
    { nombre: 'rabbitmq', verificar: async () => bus.conectado, critica: false }
  ],
  alIniciar: async () => {
    inyectarBus(bus);
    await bus.conectar().catch(() => undefined);
  },
  alDetener: async () => {
    await bus.cerrar();
    await pool.end();
  }
});
