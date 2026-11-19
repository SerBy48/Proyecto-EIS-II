import 'dotenv/config';
import express, { Application, Router } from 'express';
import { asincrono, autenticacionOpcional, crearServicio, requiereRol } from '@ecommerce/shared';
import { cliente, conectarMongo, verificarMongo } from './db';
import {
  actualizarProducto,
  crearProducto,
  historialPrecios,
  listarCategorias,
  listarProductos,
  metricasInventario,
  obtenerProducto,
  precioVigente,
  validarPromocion
} from './controlador';
import { TAMANO_MAXIMO, TIPOS_PERMITIDOS, eliminarImagen, servirImagen, subirImagen } from './imagenes';

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
  // Fotos de los productos: publicas, las cargan la web y la app movil (RF-50).
  router.get('/imagenes/:nombre', asincrono(servirImagen));

  // Interno: consultado por pedidos (precio vigente) y carrito (cupones).
  router.get('/productos/:sku/precio', asincrono(precioVigente));
  router.get('/promociones/:codigo', asincrono(validarPromocion));

  // Gestion del catalogo: solo personal interno.
  router.post('/productos', requiereRol('administrador', 'vendedor'), asincrono(crearProducto));
  router.patch('/productos/:sku', requiereRol('administrador', 'vendedor'), asincrono(actualizarProducto));
  router.get('/productos/:sku/historial-precios', requiereRol('administrador', 'vendedor'), asincrono(historialPrecios));
  // El archivo llega crudo en el cuerpo (sin multipart): un solo campo, sin
  // dependencias nuevas. El tipo real se verifica por su contenido.
  router.post(
    '/productos/:sku/imagenes',
    requiereRol('administrador', 'vendedor'),
    express.raw({ type: [...TIPOS_PERMITIDOS], limit: TAMANO_MAXIMO }),
    asincrono(subirImagen)
  );
  router.delete('/productos/:sku/imagenes/:id', requiereRol('administrador', 'vendedor'), asincrono(eliminarImagen));

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
