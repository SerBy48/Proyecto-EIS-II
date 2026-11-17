import 'dotenv/config';
import { Application, Router } from 'express';
import { BusEventos, asincrono, crearServicio, requiereRol, soloLlamadaInterna, verificarPostgres } from '@ecommerce/shared';
import { pool } from './db';
import {
  actualizarCliente,
  actualizarDireccion,
  anonimizarCliente,
  eliminarDireccion,
  listarDepartamentos,
  crearCliente,
  crearDireccion,
  historialCompras,
  listarDirecciones,
  obtenerCliente,
  registrarSuscripciones,
  validarParaCompra
} from './controlador';

/**
 * Servicio de clientes (seccion 5.4 del documento).
 * Base de datos propia: clientes_db (PostgreSQL).
 */
const bus = new BusEventos('clientes-service');

const rutas = (app: Application): void => {
  const router = Router();

  router.post('/', asincrono(crearCliente));
  // Antes de /:id para que "departamentos" no se lea como un id.
  router.get('/departamentos', asincrono(listarDepartamentos));
  router.get('/:id', requiereRol(), asincrono(obtenerCliente));
  router.patch('/:id', requiereRol(), asincrono(actualizarCliente));
  router.get('/:id/direcciones', requiereRol(), asincrono(listarDirecciones));
  router.post('/:id/direcciones', requiereRol(), asincrono(crearDireccion));
  router.patch('/:id/direcciones/:direccionId', requiereRol(), asincrono(actualizarDireccion));
  router.delete('/:id/direcciones/:direccionId', requiereRol(), asincrono(eliminarDireccion));
  router.get('/:id/historial', requiereRol(), asincrono(historialCompras));

  // Endpoint interno consumido por el servicio de pedidos durante el checkout.
  router.get('/:id/validar', requiereRol('administrador', 'vendedor'), asincrono(validarParaCompra));
  // Interno: auth-service al eliminar una cuenta.
  router.post('/:id/anonimizar', requiereRol('administrador'), soloLlamadaInterna, asincrono(anonimizarCliente));

  app.use('/', router);
};

void crearServicio({
  nombre: 'clientes-service',
  puerto: Number(process.env.PORT || 3002),
  rutas,
  dependencias: [
    { nombre: 'postgres:clientes_db', verificar: verificarPostgres(pool) },
    { nombre: 'rabbitmq', verificar: async () => bus.conectado, critica: false }
  ],
  alIniciar: async () => {
    await registrarSuscripciones(bus);
  },
  alDetener: async () => {
    await bus.cerrar();
    await pool.end();
  }
});
