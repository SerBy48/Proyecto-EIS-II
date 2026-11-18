import 'dotenv/config';
import { Application, Router } from 'express';
import { BusEventos, asincrono, crearServicio, requiereRol, verificarPostgres } from '@ecommerce/shared';
import { pool } from './db';
import {
  actualizarUsuario,
  crearUsuarioInterno,
  eliminarCuenta,
  listarUsuarios,
  login,
  logout,
  perfil,
  registro,
  renovar,
  verificarTokenRemoto
} from './controlador';
import { inyectarBus, restablecer, solicitarRecuperacion } from './recuperacion';
import { metricasHash } from './pool-hash';

/**
 * Servicio de autenticacion (seccion 5.3 del documento).
 * Base de datos propia: auth_db (PostgreSQL).
 */
// Solo publica: el correo de recuperacion de contrasena lo envia notificaciones.
const bus = new BusEventos('auth-service');

const rutas = (app: Application): void => {
  const router = Router();

  // Publicas
  router.post('/registro', asincrono(registro));
  router.post('/login', asincrono(login));
  router.post('/renovar', asincrono(renovar));
  router.post('/recuperar', asincrono(solicitarRecuperacion));
  router.post('/restablecer', asincrono(restablecer));

  // Requieren token
  router.post('/logout', requiereRol(), asincrono(logout));
  router.get('/perfil', requiereRol(), asincrono(perfil));
  router.post('/verificar', requiereRol(), asincrono(verificarTokenRemoto));
  router.delete('/cuenta', requiereRol('cliente'), asincrono(eliminarCuenta));

  // Solo administrador
  router.get('/usuarios', requiereRol('administrador'), asincrono(listarUsuarios));
  router.post('/usuarios', requiereRol('administrador'), asincrono(crearUsuarioInterno));
  router.patch('/usuarios/:id', requiereRol('administrador'), asincrono(actualizarUsuario));

  app.use('/', router);
};

void crearServicio({
  nombre: 'auth-service',
  puerto: Number(process.env.PORT || 3001),
  rutas,
  dependencias: [
    { nombre: 'postgres:auth_db', verificar: verificarPostgres(pool) },
    // No critica: sin broker el inicio de sesion sigue; solo no salen los correos de recuperacion.
    { nombre: 'rabbitmq', verificar: async () => bus.conectado, critica: false }
  ],
  metricas: metricasHash,
  alIniciar: async () => {
    inyectarBus(bus);
    await bus.conectar().catch(() => undefined);
  },
  alDetener: async () => {
    await bus.cerrar();
    await pool.end();
  }
});
