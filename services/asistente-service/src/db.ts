import { Collection, Db, Document, MongoClient } from 'mongodb';
import { crearLogger } from '@ecommerce/shared';
import datosFaq from './datos/faq.json';
import datosIntenciones from './datos/intenciones.json';

const log = crearLogger('asistente-service');

const url =
  process.env.MONGO_URL ||
  'mongodb://asistente_user:asistente_pass@localhost:27017/asistente_db?authSource=asistente_db';

export const cliente = new MongoClient(url, { serverSelectionTimeoutMS: 5000, maxPoolSize: 10 });

let baseDatos: Db | undefined;

/** Dias que se conserva una conversacion sin actividad (privacidad). */
const DIAS_CONVERSACION = Number(process.env.ASISTENTE_DIAS_CONVERSACION || 30);

export const conectarMongo = async (): Promise<Db> => {
  if (baseDatos) return baseDatos;
  await cliente.connect();
  baseDatos = cliente.db(process.env.MONGO_DB || 'asistente_db');
  log.info('Conectado a MongoDB', { base: baseDatos.databaseName });
  await prepararColecciones(baseDatos);
  return baseDatos;
};

/**
 * Indices y datos iniciales. Es idempotente: los indices se crean si faltan y
 * las intenciones y la FAQ se siembran SOLO si su coleccion esta vacia, para no
 * pisar lo que haya editado el administrador.
 */
const prepararColecciones = async (db: Db): Promise<void> => {
  await db.collection('intenciones').createIndex({ clave: 1 }, { unique: true });
  await db.collection('faq').createIndex({ clave: 1 }, { unique: true });
  await db.collection('tickets').createIndex({ numero: 1 }, { unique: true });
  await db.collection('tickets').createIndex({ estado: 1, creado_en: -1 });
  await db.collection('conversaciones').createIndex({ usuario_id: 1, actualizada_en: -1 });
  await db
    .collection('conversaciones')
    .createIndex({ actualizada_en: 1 }, { expireAfterSeconds: DIAS_CONVERSACION * 24 * 3600, name: 'ttl_conversaciones' });

  if ((await db.collection('intenciones').estimatedDocumentCount()) === 0) {
    await db.collection('intenciones').insertMany(datosIntenciones.intenciones.map((i) => ({ ...i, actualizada_en: new Date() })));
    log.info('Intenciones iniciales sembradas', { cantidad: datosIntenciones.intenciones.length });
  }
  if ((await db.collection('faq').estimatedDocumentCount()) === 0) {
    await db.collection('faq').insertMany(datosFaq.faq.map((f) => ({ ...f, actualizada_en: new Date() })));
    log.info('FAQ inicial sembrada', { cantidad: datosFaq.faq.length });
  }
};

const exigirBase = (): Db => {
  if (!baseDatos) throw new Error('MongoDB no esta conectado todavia.');
  return baseDatos;
};

export const coleccionConversaciones = (): Collection<Document> => exigirBase().collection('conversaciones');
export const coleccionIntenciones = (): Collection<Document> => exigirBase().collection('intenciones');
export const coleccionFaq = (): Collection<Document> => exigirBase().collection('faq');
export const coleccionTickets = (): Collection<Document> => exigirBase().collection('tickets');

export const verificarMongo = async (): Promise<boolean> => {
  try {
    await exigirBase().command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
};
