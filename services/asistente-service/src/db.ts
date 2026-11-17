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
 * Indices y datos iniciales. Es idempotente:
 *   - los indices se crean si faltan;
 *   - las intenciones y preguntas frecuentes nuevas (por clave) se agregan;
 *   - las existentes se actualizan con la version del codigo SOLO si el
 *     administrador no las edito (editada != true): asi una mejora del
 *     asistente llega a una base que ya existe sin pisar lo que se ajusto a mano.
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

  const sembrar = async (coleccion: string, documentos: Array<{ clave: string }>) => {
    const ahora = new Date();
    const resultado = await db.collection(coleccion).bulkWrite(
      documentos.map((documento) => ({
        updateOne: {
          filter: { clave: documento.clave, editada: { $ne: true } },
          update: { $set: { ...documento, actualizada_en: ahora } },
          upsert: true
        }
      })),
      { ordered: false }
    ).catch((error: { code?: number; result?: unknown }) => {
      // E11000: la clave existe y fue editada por el administrador (el filtro no
      // la encuentra y el upsert choca con el indice unico). Se respeta.
      if (error.code === 11000 || /E11000/.test(String(error))) return null;
      throw error;
    });
    log.info('Datos del asistente sincronizados', { coleccion, documentos: documentos.length, nuevos: resultado?.upsertedCount ?? 0 });
  };
  await sembrar('intenciones', datosIntenciones.intenciones);
  await sembrar('faq', datosFaq.faq);
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
