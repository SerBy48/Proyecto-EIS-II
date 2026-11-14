import 'dotenv/config';
import { Application, Router } from 'express';
import { BusEventos, asincrono, crearServicio, requiereRol, verificarPostgres } from '@ecommerce/shared';
import { pool } from './db';
import {
  alertasReposicion,
  confirmarReserva,
  crearReserva,
  disponibilidad,
  iniciarBarridoReservas,
  inyectarBus,
  liberarReserva,
  movimientos,
  obtenerReserva,
  registrarEntrada,
  stockPorSku
} from './controlador';

/**
 * Servicio de inventario (seccion 5.6 del documento).
 * Base de datos propia: inventario_db (PostgreSQL con soporte transaccional).
 *
 * Es el unico propietario del stock. Ningun otro servicio escribe en estas
 * tablas: esa es la condicion para poder garantizar que no haya sobreventa.
 */
const bus = new BusEventos('inventario-service');
let barrido: NodeJS.Timeout | undefined;

const rutas = (app: Application): void => {
  const router = Router();

  // Consultas: las puede hacer cualquier servicio interno o usuario autenticado.
  router.get('/disponibilidad', asincrono(disponibilidad));
  router.get('/stock/:sku', asincrono(stockPorSku));
  router.get('/movimientos/:sku', requiereRol('administrador', 'vendedor'), asincrono(movimientos));
  router.get('/alertas', requiereRol('administrador', 'vendedor'), asincrono(alertasReposicion));

  // Escrituras de stock: solo personal interno.
  router.post('/stock/:sku/entrada', requiereRol('administrador', 'vendedor'), asincrono(registrarEntrada));

  // Reservas: las invoca el servicio de pedidos por la red privada.
  router.post('/reservas', requiereRol('administrador', 'vendedor'), asincrono(crearReserva));
  router.get('/reservas/:id', requiereRol('administrador', 'vendedor'), asincrono(obtenerReserva));
  router.post('/reservas/:id/confirmar', requiereRol('administrador', 'vendedor'), asincrono(confirmarReserva));
  router.post('/reservas/:id/liberar', requiereRol('administrador', 'vendedor'), asincrono(liberarReserva));

  app.use('/', router);
};

void crearServicio({
  nombre: 'inventario-service',
  puerto: Number(process.env.PORT || 3004),
  rutas,
  dependencias: [
    { nombre: 'postgres:inventario_db', verificar: verificarPostgres(pool) },
    { nombre: 'rabbitmq', verificar: async () => bus.conectado, critica: false }
  ],
  alIniciar: async () => {
    inyectarBus(bus);
    await bus.conectar().catch(() => undefined);
    barrido = iniciarBarridoReservas();
  },
  alDetener: async () => {
    if (barrido) clearInterval(barrido);
    await bus.cerrar();
    await pool.end();
  }
});
