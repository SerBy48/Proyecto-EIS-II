import { Collection, Db, Document, MongoClient } from 'mongodb';
import { crearLogger } from '@ecommerce/shared';

const log = crearLogger('catalogo-service');

const url =
  process.env.MONGO_URL ||
  'mongodb://catalogo_user:catalogo_pass@localhost:27017/catalogo_db?authSource=catalogo_db';

export const cliente = new MongoClient(url, {
  serverSelectionTimeoutMS: 5000,
  maxPoolSize: 10
});

let baseDatos: Db | undefined;

export const conectarMongo = async (): Promise<Db> => {
  if (baseDatos) return baseDatos;
  await cliente.connect();
  baseDatos = cliente.db(process.env.MONGO_DB || 'catalogo_db');
  log.info('Conectado a MongoDB', { base: baseDatos.databaseName });
  await baseDatos.collection('historial_precios').createIndex({ sku: 1, fecha: -1 });
  return baseDatos;
};

export const baseDatosConectada = (): Db => exigirBase();

const exigirBase = (): Db => {
  if (!baseDatos) throw new Error('MongoDB no esta conectado todavia.');
  return baseDatos;
};

export const coleccionProductos = (): Collection<Document> => exigirBase().collection('productos');
export const coleccionCategorias = (): Collection<Document> => exigirBase().collection('categorias');
export const coleccionPromociones = (): Collection<Document> => exigirBase().collection('promociones');
/** Quien cambio el precio o la oferta de un producto, y cuando (RF-48). */
export const coleccionHistorialPrecios = (): Collection<Document> => exigirBase().collection('historial_precios');

export const verificarMongo = async (): Promise<boolean> => {
  try {
    await exigirBase().command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
};
