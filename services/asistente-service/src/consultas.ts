import { randomBytes } from 'node:crypto';
import { Response } from 'express';
import { BusEventos, ErrorApp, Eventos, PeticionAutenticada, crearLogger, errorNoEncontrado, errorSolicitud } from '@ecommerce/shared';
import { enmascarar } from './configuracion';
import { coleccionTickets } from './db';

const log = crearLogger('asistente-service');

/**
 * Consultas al vendedor desde el asistente (RF-53).
 *
 * El cliente escribe su duda en un formulario dentro del chat; queda como un
 * hilo (cliente <-> personal) en la coleccion de tickets, con tipo
 * 'consulta'. Cada mensaje publica un evento y notificaciones lo convierte en
 * correo y en la campana de la web: al personal le llega lo que escribe el
 * cliente (buzon de operaciones) y al cliente, la respuesta.
 *
 * Autorizacion por dato: un cliente solo ve y responde sus consultas; uno
 * ajeno recibe 404 (no se confirma que existe, invariante 1).
 */

export const MOTIVOS: Record<string, string> = {
  producto: 'Pregunta sobre un producto',
  pedido: 'Mi pedido',
  garantia: 'Garantía o devolución',
  pago: 'Pagos y facturación',
  otro: 'Otro tema'
};

export const LONGITUD_MAXIMA_CONSULTA = 1000;
const MAXIMO_MENSAJES_HILO = 50;

export const nuevoNumeroTicket = (): string =>
  `TCK-${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString('hex').toUpperCase()}`;

const esPersonal = (rol?: string) => rol === 'administrador' || rol === 'vendedor';

const textoValido = (valor: unknown): string => {
  if (typeof valor !== 'string' || valor.trim().length < 5) throw errorSolicitud('Escribe tu mensaje (al menos 5 caracteres).');
  if (valor.length > LONGITUD_MAXIMA_CONSULTA) throw errorSolicitud(`El mensaje no puede superar ${LONGITUD_MAXIMA_CONSULTA} caracteres.`);
  // Una tarjeta o un telefono no se guardan en claro, igual que en el chat.
  return enmascarar(valor.trim());
};

/** Lo que ve cada quien: el hilo sin los identificadores internos. */
const proyectar = (t: Record<string, unknown>) => ({
  numero: t.numero,
  motivo: t.motivo,
  motivo_texto: MOTIVOS[String(t.motivo)] ?? 'Otro tema',
  referencia: t.referencia ?? null,
  estado: t.estado,
  email: t.email,
  mensajes: ((t.mensajes ?? []) as Array<Record<string, unknown>>).map((m) => ({ autor: m.autor, nombre: m.nombre, texto: m.texto, en: m.en })),
  creado_en: t.creado_en,
  actualizado_en: t.actualizado_en ?? t.creado_en
});

export const crearControladorConsultas = (bus: BusEventos) => {
  /** POST /consultas { motivo, referencia?, mensaje, conversacion_id? } - cliente con sesion. */
  const crearConsulta = async (req: PeticionAutenticada, res: Response): Promise<void> => {
    const yo = req.usuario;
    if (!yo || yo.rol !== 'cliente') throw new ErrorApp(403, 'Inicia sesión como cliente para escribirle al vendedor.', 'ACCESO_DENEGADO');
    const cuerpo = (req.body ?? {}) as Record<string, unknown>;
    const motivo = typeof cuerpo.motivo === 'string' && MOTIVOS[cuerpo.motivo] ? cuerpo.motivo : null;
    if (!motivo) throw errorSolicitud(`Elige el motivo: ${Object.keys(MOTIVOS).join(', ')}.`);
    const referencia =
      cuerpo.referencia === undefined || cuerpo.referencia === null || cuerpo.referencia === ''
        ? null
        : typeof cuerpo.referencia === 'string' && /^[A-Za-z0-9-]{1,40}$/.test(cuerpo.referencia.trim())
          ? cuerpo.referencia.trim().toUpperCase()
          : (() => { throw errorSolicitud('La referencia debe ser un número de pedido o un SKU.'); })();
    const mensaje = textoValido(cuerpo.mensaje);
    const ahora = new Date();
    const numero = nuevoNumeroTicket();

    await coleccionTickets().insertOne({
      numero,
      tipo: 'consulta',
      motivo,
      referencia,
      conversacion_id: typeof cuerpo.conversacion_id === 'string' ? cuerpo.conversacion_id.slice(0, 36) : null,
      usuario_id: yo.sub,
      cliente_id: yo.cliente_id ?? null,
      email: yo.email,
      // Compatibilidad con GET /tickets (F3): el primer mensaje como texto.
      texto: mensaje,
      estado: 'abierta',
      mensajes: [{ autor: 'cliente', nombre: yo.email, texto: mensaje, en: ahora }],
      creado_en: ahora,
      actualizado_en: ahora
    });

    // Invariante 12: si el broker falla, la consulta ya quedo guardada.
    await bus.publicar(Eventos.CONSULTA_NUEVA, {
      ticket: numero,
      motivo_texto: MOTIVOS[motivo],
      referencia: referencia ?? 'ninguna',
      correo_cliente: yo.email,
      cliente_id: yo.cliente_id ?? null,
      mensaje,
      cambio: 1
    }, req.requestId);
    log.con({ request_id: req.requestId }).info('Consulta al vendedor creada', { ticket: numero, motivo });

    res.status(201).json({
      mensaje: `Envié tu consulta al vendedor con el número ${numero}. Te avisaremos en la campana y por correo cuando responda.`,
      consulta: { numero, estado: 'abierta', motivo, referencia }
    });
  };

  /** GET /consultas?estado= - el cliente ve las suyas; el personal, todas. */
  const listarConsultas = async (req: PeticionAutenticada, res: Response): Promise<void> => {
    const yo = req.usuario!;
    const filtro: Record<string, unknown> = { tipo: 'consulta' };
    if (!esPersonal(yo.rol)) filtro.usuario_id = yo.sub;
    if (typeof req.query.estado === 'string' && ['abierta', 'respondida', 'cerrada'].includes(req.query.estado)) filtro.estado = req.query.estado;
    const consultas = await coleccionTickets().find(filtro).sort({ actualizado_en: -1 }).limit(100).toArray();
    res.status(200).json(consultas.map(proyectar));
  };

  const cargarPropia = async (req: PeticionAutenticada) => {
    const numero = String(req.params.numero);
    if (!/^TCK-[A-Z0-9]{4,30}$/.test(numero)) throw errorNoEncontrado('Consulta no encontrada.');
    const consulta = await coleccionTickets().findOne({ numero, tipo: 'consulta' });
    const yo = req.usuario!;
    if (!consulta || (!esPersonal(yo.rol) && consulta.usuario_id !== yo.sub)) throw errorNoEncontrado('Consulta no encontrada.');
    return consulta;
  };

  /** GET /consultas/:numero */
  const obtenerConsulta = async (req: PeticionAutenticada, res: Response): Promise<void> => {
    res.status(200).json(proyectar(await cargarPropia(req)));
  };

  /**
   * POST /consultas/:numero/mensajes { texto }
   * El personal responde (la consulta pasa a 'respondida' y le llega al
   * cliente); el cliente contesta (vuelve a 'abierta' y le llega al personal).
   */
  const responderConsulta = async (req: PeticionAutenticada, res: Response): Promise<void> => {
    const consulta = await cargarPropia(req);
    const yo = req.usuario!;
    if (consulta.estado === 'cerrada') {
      throw new ErrorApp(409, 'La consulta está cerrada. Si tienes otra duda, escríbele al vendedor desde el asistente.', 'CONSULTA_CERRADA');
    }
    const texto = textoValido(req.body?.texto);
    const personal = esPersonal(yo.rol);
    const ahora = new Date();
    const actualizada = await coleccionTickets().findOneAndUpdate(
      { numero: consulta.numero, estado: { $ne: 'cerrada' } },
      {
        $push: { mensajes: { $each: [{ autor: personal ? 'vendedor' : 'cliente', nombre: personal ? 'SerByTek' : yo.email, texto, en: ahora }], $slice: -MAXIMO_MENSAJES_HILO } } as never,
        $set: {
          estado: personal ? 'respondida' : 'abierta',
          actualizado_en: ahora,
          ...(personal ? { respondida_por: yo.email } : {})
        }
      },
      { returnDocument: 'after' }
    );
    if (!actualizada) throw new ErrorApp(409, 'La consulta se cerró mientras escribías.', 'CONSULTA_CERRADA');

    const cambio = ((actualizada.mensajes ?? []) as unknown[]).length;
    await bus.publicar(
      personal ? Eventos.CONSULTA_RESPONDIDA : Eventos.CONSULTA_MENSAJE_CLIENTE,
      personal
        ? { ticket: consulta.numero, email: consulta.email, cliente_id: consulta.cliente_id ?? null, mensaje: texto, cambio }
        : { ticket: consulta.numero, correo_cliente: consulta.email, cliente_id: consulta.cliente_id ?? null, mensaje: texto, cambio },
      req.requestId
    );
    res.status(200).json(proyectar(actualizada));
  };

  /** PATCH /consultas/:numero { estado: 'cerrada' | 'abierta' } - personal interno. */
  const cambiarEstadoConsulta = async (req: PeticionAutenticada, res: Response): Promise<void> => {
    const estado = req.body?.estado;
    if (estado !== 'cerrada' && estado !== 'abierta') throw errorSolicitud("El estado debe ser 'cerrada' o 'abierta'.");
    const consulta = await cargarPropia(req);
    const actualizada = await coleccionTickets().findOneAndUpdate(
      { numero: consulta.numero },
      { $set: { estado, actualizado_en: new Date(), ...(estado === 'cerrada' ? { cerrada_por: req.usuario!.email } : {}) } },
      { returnDocument: 'after' }
    );
    res.status(200).json(proyectar(actualizada!));
  };

  return { crearConsulta, listarConsultas, obtenerConsulta, responderConsulta, cambiarEstadoConsulta };
};
