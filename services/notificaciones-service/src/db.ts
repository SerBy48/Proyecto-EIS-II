import { Collection, Db, Document, MongoClient } from 'mongodb';
import { crearLogger } from '@ecommerce/shared';

const log = crearLogger('notificaciones-service');

const url =
  process.env.MONGO_URL ||
  'mongodb://notificaciones_user:notificaciones_pass@localhost:27017/notificaciones_db?authSource=notificaciones_db';

export const cliente = new MongoClient(url, {
  serverSelectionTimeoutMS: 5000,
  maxPoolSize: 10
});

let baseDatos: Db | undefined;

export const conectarMongo = async (): Promise<Db> => {
  if (baseDatos) return baseDatos;
  await cliente.connect();
  baseDatos = cliente.db(process.env.MONGO_DB || 'notificaciones_db');
  log.info('Conectado a MongoDB', { base: baseDatos.databaseName });
  return baseDatos;
};

const exigirBase = (): Db => {
  if (!baseDatos) throw new Error('MongoDB no esta conectado todavia.');
  return baseDatos;
};

export const coleccionMensajes = (): Collection<Document> => exigirBase().collection('mensajes');
export const coleccionPlantillas = (): Collection<Document> => exigirBase().collection('plantillas');

export const verificarMongo = async (): Promise<boolean> => {
  try {
    await exigirBase().command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
};
