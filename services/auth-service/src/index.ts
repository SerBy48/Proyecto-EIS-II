import 'dotenv/config';
import { Application, Router } from 'express';
import { asincrono, crearServicio, requiereRol, verificarPostgres } from '@ecommerce/shared';
import { pool } from './db';
import {
  crearUsuarioInterno,
  login,
  logout,
  perfil,
  registro,
  renovar,
  verificarTokenRemoto
} from './controlador';
import { metricasHash } from './pool-hash';

/**
 * Servicio de autenticacion (seccion 5.3 del documento).
 * Base de datos propia: auth_db (PostgreSQL).
 */
const rutas = (app: Application): void => {
  const router = Router();

  // Publicas
  router.post('/registro', asincrono(registro));
  router.post('/login', asincrono(login));
  router.post('/renovar', asincrono(renovar));

  // Requieren token
  router.post('/logout', requiereRol(), asincrono(logout));
  router.get('/perfil', requiereRol(), asincrono(perfil));
  router.post('/verificar', requiereRol(), asincrono(verificarTokenRemoto));

  // Solo administrador
  router.post('/usuarios', requiereRol('administrador'), asincrono(crearUsuarioInterno));

  app.use('/', router);
};

void crearServicio({
  nombre: 'auth-service',
  puerto: Number(process.env.PORT || 3001),
  rutas,
  dependencias: [{ nombre: 'postgres:auth_db', verificar: verificarPostgres(pool) }],
  metricas: metricasHash,
  alDetener: async () => {
    await pool.end();
  }
});
