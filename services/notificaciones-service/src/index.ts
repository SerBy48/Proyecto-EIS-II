import 'dotenv/config';
import { Application, Router } from 'express';
import { BusEventos, asincrono, crearServicio, requiereRol } from '@ecommerce/shared';
import { cliente, conectarMongo, verificarMongo } from './db';
import {
  actualizarPlantilla,
  listarMensajes,
  listarPlantillas,
  registrarSuscripciones
} from './controlador';

/**
 * Servicio de notificaciones (seccion 5.10 del documento).
 * Base de datos propia: notificaciones_db (MongoDB, documental).
 *
 * Consumidor de eventos. No expone ningun endpoint para enviar: los mensajes
 * se originan siempre en un evento publicado por otro servicio.
 */
const bus = new BusEventos('notificaciones-service');

const rutas = (app: Application): void => {
  const router = Router();

  router.get('/mensajes', requiereRol(), asincrono(listarMensajes));
  router.get('/plantillas', requiereRol('administrador'), asincrono(listarPlantillas));
  router.patch('/plantillas/:clave', requiereRol('administrador'), asincrono(actualizarPlantilla));

  app.use('/', router);
};

void crearServicio({
  nombre: 'notificaciones-service',
  puerto: Number(process.env.PORT || 3008),
  rutas,
  dependencias: [
    { nombre: 'mongo:notificaciones_db', verificar: verificarMongo },
    { nombre: 'rabbitmq', verificar: async () => bus.conectado }
  ],
  alIniciar: async () => {
    await conectarMongo();
    await registrarSuscripciones(bus);
  },
  alDetener: async () => {
    await bus.cerrar();
    await cliente.close();
  }
});
