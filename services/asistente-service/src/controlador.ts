import { randomBytes, randomUUID } from 'node:crypto';
import { NextFunction, Response } from 'express';
import {
  BusEventos,
  ClaimsToken,
  ErrorApp,
  PeticionAutenticada,
  crearLogger,
  errorNoEncontrado,
  errorSolicitud,
  verificarAcceso
} from '@ecommerce/shared';
import { LONGITUD_MAXIMA_MENSAJE, enmascarar } from './configuracion';
import { coleccionConversaciones, coleccionFaq, coleccionIntenciones, coleccionTickets } from './db';
import { Contexto, responder } from './dialogo';
import { Intencion, Pendiente, clasificar } from './motor';

const log = crearLogger('asistente-service');

/** Mensajes que se conservan por conversacion. */
const MAXIMO_MENSAJES = 50;

// ------------------------------------------------------------ identidad

/**
 * Autenticacion opcional para el chat: sin token se atiende como visitante.
 * Con un token vencido o invalido NO se degrada a visitante en silencio: se
 * responde 401 para que la web renueve la sesion (TOKEN_EXPIRADO) en lugar de
 * pedirle al usuario que inicie sesion estando dentro.
 */
export const identidadOpcional = (req: PeticionAutenticada, _res: Response, next: NextFunction): void => {
  const cabecera = req.headers.authorization;
  if (!cabecera?.startsWith('Bearer ')) {
    req.usuario = undefined; // la identidad solo sale del token del usuario
    return next();
  }
  try {
    req.usuario = verificarAcceso(cabecera.slice(7));
    next();
  } catch (error) {
    const expirado = error instanceof Error && error.name === 'TokenExpiredError';
    next(
      new ErrorApp(
        401,
        expirado ? 'Token expirado. Renueve la sesion.' : 'Token invalido.',
        expirado ? 'TOKEN_EXPIRADO' : 'TOKEN_INVALIDO'
      )
    );
  }
};

// ----------------------------------------------- intenciones y FAQ en cache

let cache: { hasta: number; intenciones: Intencion[]; faq: Map<string, string> } | undefined;
const VIGENCIA_CACHE_MS = Number(process.env.ASISTENTE_CACHE_MS || 15_000);

/** Intenciones y FAQ con una cache corta: la edicion del administrador se ve en segundos. */
const datosDelMotor = async () => {
  if (cache && cache.hasta > Date.now()) return cache;
  const [intenciones, faq] = await Promise.all([
    coleccionIntenciones().find({}, { projection: { _id: 0 } }).toArray(),
    coleccionFaq().find({}, { projection: { _id: 0 } }).toArray()
  ]);
  cache = {
    hasta: Date.now() + VIGENCIA_CACHE_MS,
    intenciones: intenciones as unknown as Intencion[],
    faq: new Map(faq.map((f) => [String(f.clave), String(f.respuesta)]))
  };
  return cache;
};
const invalidarCache = () => {
  cache = undefined;
};

// ----------------------------------------------------------- conversacion

interface Conversacion {
  _id: string;
  usuario_id: number | null;
  pendiente?: Pendiente | null;
}

/**
 * La conversacion indicada, si existe y es de quien escribe. Una conversacion
 * con dueno no se continua con otra identidad: se empieza una nueva (no se
 * filtra el contexto de otra persona).
 */
const cargarConversacion = async (id: unknown, usuario?: ClaimsToken): Promise<Conversacion | null> => {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const conversacion = (await coleccionConversaciones().findOne({ _id: id as never })) as unknown as Conversacion | null;
  if (!conversacion) return null;
  if (conversacion.usuario_id !== null && conversacion.usuario_id !== (usuario?.sub ?? null)) return null;
  return conversacion;
};

const nuevoNumeroTicket = () => `TCK-${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString('hex').toUpperCase()}`;

export const crearControlador = (bus: BusEventos) => {
  /**
   * POST /mensajes  { conversacion_id?, texto }
   * -> { conversacion_id, intencion, respuestas: [...] }
   */
  const enviarMensaje = async (req: PeticionAutenticada, res: Response): Promise<void> => {
    const { texto, conversacion_id } = (req.body ?? {}) as { texto?: unknown; conversacion_id?: unknown };
    if (typeof texto !== 'string' || !texto.trim()) throw errorSolicitud('Escribe un mensaje.');
    if (texto.length > LONGITUD_MAXIMA_MENSAJE) {
      throw errorSolicitud(`El mensaje no puede superar ${LONGITUD_MAXIMA_MENSAJE} caracteres.`);
    }
    const mensaje = texto.trim();
    const usuario = req.usuario;

    const previa = await cargarConversacion(conversacion_id, usuario);
    const conversacionId = previa?._id ?? randomUUID();

    const { intenciones, faq } = await datosDelMotor();
    const resultado = clasificar(mensaje, intenciones, previa?.pendiente ?? undefined);

    const contexto: Contexto = {
      texto: mensaje,
      usuario,
      autorizacion: usuario ? req.headers.authorization : undefined,
      requestId: req.requestId,
      conversacionId,
      faq,
      bus,
      registrarTicket: async ({ texto: textoTicket, usuario: autor }) => {
        const numero = nuevoNumeroTicket();
        await coleccionTickets().insertOne({
          numero,
          conversacion_id: conversacionId,
          usuario_id: autor?.sub ?? null,
          cliente_id: autor?.cliente_id ?? null,
          email: autor?.email ?? null,
          texto: enmascarar(textoTicket),
          estado: 'abierto',
          creado_en: new Date()
        });
        return numero;
      }
    };

    const salida = await responder(resultado, contexto);
    const ahora = new Date();

    // Se guarda sin datos sensibles: el texto del usuario va enmascarado y las
    // respuestas se resumen por tipo. Sirve para medir que no se entiende.
    await coleccionConversaciones().updateOne(
      { _id: conversacionId as never },
      {
        $setOnInsert: { creada_en: ahora },
        $set: {
          usuario_id: usuario?.sub ?? previa?.usuario_id ?? null,
          actualizada_en: ahora,
          pendiente: salida.pendiente ?? null
        },
        $push: {
          mensajes: {
            $each: [
              {
                rol: 'usuario',
                texto: enmascarar(mensaje),
                intencion: resultado.intencion,
                confianza: resultado.confianza,
                por_contexto: resultado.por_contexto ?? false,
                en: ahora
              },
              { rol: 'asistente', tipos: salida.respuestas.map((r) => r.tipo), en: ahora }
            ],
            $slice: -MAXIMO_MENSAJES
          }
        } as never
      },
      { upsert: true }
    );

    log.con({ request_id: req.requestId }).info('Mensaje del asistente', {
      intencion: resultado.intencion,
      confianza: resultado.confianza,
      con_sesion: Boolean(usuario)
    });

    res.status(200).json({ conversacion_id: conversacionId, intencion: resultado.intencion, respuestas: salida.respuestas });
  };

  /** GET /conversaciones/:id - solo su dueno o un administrador. */
  const obtenerConversacion = async (req: PeticionAutenticada, res: Response): Promise<void> => {
    const conversacion = await coleccionConversaciones().findOne({ _id: req.params.id as never });
    const usuario = req.usuario!;
    if (!conversacion || (usuario.rol !== 'administrador' && conversacion.usuario_id !== usuario.sub)) {
      throw errorNoEncontrado('Conversacion no encontrada.');
    }
    res.status(200).json({ conversacion_id: conversacion._id, ...conversacion, _id: undefined });
  };

  /** GET /tickets?estado= - personal interno. */
  const listarTickets = async (req: PeticionAutenticada, res: Response): Promise<void> => {
    const filtro: Record<string, unknown> = {};
    if (typeof req.query.estado === 'string') filtro.estado = req.query.estado;
    const tickets = await coleccionTickets().find(filtro, { projection: { _id: 0 } }).sort({ creado_en: -1 }).limit(100).toArray();
    res.status(200).json(tickets);
  };

  /** GET /intenciones - administrador. */
  const listarIntenciones = async (_req: PeticionAutenticada, res: Response): Promise<void> => {
    res.status(200).json(await coleccionIntenciones().find({}, { projection: { _id: 0 } }).sort({ prioridad: -1 }).toArray());
  };

  /** PATCH /intenciones/:clave { terminos?, prioridad?, descripcion? } - administrador. */
  const actualizarIntencion = async (req: PeticionAutenticada, res: Response): Promise<void> => {
    const { terminos, prioridad, descripcion } = (req.body ?? {}) as Record<string, unknown>;
    const cambios: Record<string, unknown> = {};
    if (terminos !== undefined) {
      const validos =
        Array.isArray(terminos) &&
        terminos.length > 0 &&
        terminos.length <= 100 &&
        terminos.every(
          (t) =>
            typeof t?.texto === 'string' && t.texto.trim().length > 0 && t.texto.length <= 60 &&
            typeof t?.peso === 'number' && t.peso >= 1 && t.peso <= 10
        );
      if (!validos) throw errorSolicitud('terminos debe ser una lista de { texto (hasta 60 caracteres), peso (1 a 10) }.');
      cambios.terminos = (terminos as Array<{ texto: string; peso: number }>).map((t) => ({ texto: t.texto.trim(), peso: t.peso }));
    }
    if (prioridad !== undefined) {
      if (typeof prioridad !== 'number' || prioridad < 0 || prioridad > 100) throw errorSolicitud('prioridad debe ser un numero de 0 a 100.');
      cambios.prioridad = prioridad;
    }
    if (descripcion !== undefined) {
      if (typeof descripcion !== 'string' || descripcion.length > 120) throw errorSolicitud('descripcion debe ser un texto de hasta 120 caracteres.');
      cambios.descripcion = descripcion;
    }
    if (!Object.keys(cambios).length) throw errorSolicitud('Indique al menos uno de: terminos, prioridad, descripcion.');

    const resultado = await coleccionIntenciones().findOneAndUpdate(
      { clave: req.params.clave },
      { $set: { ...cambios, actualizada_en: new Date() } },
      { returnDocument: 'after', projection: { _id: 0 } }
    );
    if (!resultado) throw errorNoEncontrado('Intencion no encontrada.');
    invalidarCache();
    res.status(200).json({ mensaje: 'Intencion actualizada.', intencion: resultado });
  };

  /** GET /faq - administrador. */
  const listarFaq = async (_req: PeticionAutenticada, res: Response): Promise<void> => {
    res.status(200).json(await coleccionFaq().find({}, { projection: { _id: 0 } }).toArray());
  };

  /** PATCH /faq/:clave { respuesta } - administrador. */
  const actualizarFaq = async (req: PeticionAutenticada, res: Response): Promise<void> => {
    const { respuesta } = (req.body ?? {}) as { respuesta?: unknown };
    if (typeof respuesta !== 'string' || !respuesta.trim() || respuesta.length > 1000) {
      throw errorSolicitud('respuesta debe ser un texto de hasta 1000 caracteres.');
    }
    const resultado = await coleccionFaq().findOneAndUpdate(
      { clave: req.params.clave },
      { $set: { respuesta: respuesta.trim(), actualizada_en: new Date() } },
      { returnDocument: 'after', projection: { _id: 0 } }
    );
    if (!resultado) throw errorNoEncontrado('Pregunta frecuente no encontrada.');
    invalidarCache();
    res.status(200).json({ mensaje: 'Respuesta actualizada.', faq: resultado });
  };

  return { enviarMensaje, obtenerConversacion, listarTickets, listarIntenciones, actualizarIntencion, listarFaq, actualizarFaq };
};
