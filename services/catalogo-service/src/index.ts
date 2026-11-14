import 'dotenv/config';
import { Application, Router } from 'express';
import { asincrono, autenticacionOpcional, crearServicio, requiereRol } from '@ecommerce/shared';
import { cliente, conectarMongo, verificarMongo } from './db';
import {
  actualizarProducto,
  crearProducto,
  listarCategorias,
  listarProductos,
  metricasInventario,
  obtenerProducto,
  precioVigente,
  validarPromocion
} from './controlador';

/**
 * Servicio de catalogo (seccion 5.5 del documento).
 * Base de datos propia: catalogo_db (MongoDB, documental con indice de texto).
 *
 * Es el servicio con mayor volumen de consultas del sistema: el documento
 * estima diez consultas de catalogo por cada compra. Por eso es el primer
 * candidato al escalado horizontal.
 */
const rutas = (app: Application): void => {
  const router = Router();

  // El catalogo es publico: se puede navegar sin iniciar sesion.
  router.get('/productos', autenticacionOpcional, asincrono(listarProductos));
  router.get('/productos/:sku', autenticacionOpcional, asincrono(obtenerProducto));
  router.get('/categorias', autenticacionOpcional, asincrono(listarCategorias));

  // Interno: consultado por pedidos (precio vigente) y carrito (cupones).
  router.get('/productos/:sku/precio', asincrono(precioVigente));
  router.get('/promociones/:codigo', asincrono(validarPromocion));

  // Gestion del catalogo: solo personal interno.
  router.post('/productos', requiereRol('administrador', 'vendedor'), asincrono(crearProducto));
  router.patch('/productos/:sku', requiereRol('administrador', 'vendedor'), asincrono(actualizarProducto));

  app.use('/', router);
};

void crearServicio({
  nombre: 'catalogo-service',
  puerto: Number(process.env.PORT || 3003),
  rutas,
  dependencias: [{ nombre: 'mongo:catalogo_db', verificar: verificarMongo }],
  metricas: metricasInventario,
  alIniciar: async () => {
    await conectarMongo();
  },
  alDetener: async () => {
    await cliente.close();
  }
});
