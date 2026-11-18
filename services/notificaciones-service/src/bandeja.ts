import { Response } from 'express';
import { ObjectId } from 'mongodb';
import { PeticionAutenticada, errorSolicitud } from '@ecommerce/shared';
import { coleccionMensajes, coleccionPlantillas } from './db';

/**
 * Bandeja de notificaciones de la web (RF-52): la campana junto al perfil.
 *
 * Cada notificacion es el mismo mensaje que se envio por correo; la bandeja
 * solo agrega quien ya lo leyo. El cliente ve los suyos (su correo, sacado del
 * token: invariante 1). El personal ve, ademas, el buzon de operaciones
 * (alertas de reposicion y consultas de clientes), que es compartido: por eso
 * "leido" se guarda por persona (leida_por), no como un si/no del mensaje.
 */

export const buzonOperaciones = (): string => process.env.CORREO_OPERACIONES || 'operaciones@tienda.co';

const destinatariosDe = (req: PeticionAutenticada): string[] => {
  const yo = req.usuario!;
  const propios = [yo.email];
  if (yo.rol === 'administrador' || yo.rol === 'vendedor') propios.push(buzonOperaciones());
  return propios;
};

/** A donde lleva cada notificacion en la web. */
const destinoDe = (evento: string): string =>
  evento.startsWith('asistente.consulta') ? 'consultas'
  : evento.startsWith('pedido.') || evento.startsWith('pago.') ? 'pedidos'
  : evento === 'inventario.stock_minimo' ? 'inventario'
  : evento === 'carrito.abandonado' ? 'carrito'
  : 'inicio';

/** GET /bandeja?limite=10 */
export const verBandeja = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const yo = req.usuario!.email;
  const filtro = { destinatario: { $in: destinatariosDe(req) } };
  const limite = Math.min(Math.max(Number(req.query.limite) || 10, 1), 50);
  const [mensajes, no_leidas] = await Promise.all([
    coleccionMensajes()
      .find(filtro, { projection: { evento: 1, asunto: 1, texto: 1, creado_en: 1, leida_por: 1, destinatario: 1, 'datos_evento.ticket': 1 } })
      .sort({ creado_en: -1 })
      .limit(limite)
      .toArray(),
    coleccionMensajes().countDocuments({ ...filtro, leida_por: { $ne: yo } })
  ]);
  res.status(200).json({
    no_leidas,
    notificaciones: mensajes.map((m) => ({
      id: String(m._id),
      evento: m.evento,
      asunto: m.asunto,
      texto: m.texto ?? '',
      destino: destinoDe(String(m.evento)),
      ticket: m.datos_evento?.ticket ?? null,
      de_operaciones: m.destinatario !== yo,
      leida: Array.isArray(m.leida_por) && m.leida_por.includes(yo),
      creado_en: m.creado_en
    }))
  });
};

/** POST /bandeja/leidas { ids?: string[] } - sin ids marca todas. */
export const marcarLeidas = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const yo = req.usuario!.email;
  const filtro: Record<string, unknown> = { destinatario: { $in: destinatariosDe(req) }, leida_por: { $ne: yo } };
  const ids = req.body?.ids;
  if (ids !== undefined) {
    if (!Array.isArray(ids) || ids.length > 100 || !ids.every((i) => typeof i === 'string' && /^[a-f0-9]{24}$/.test(i))) {
      throw errorSolicitud('ids debe ser una lista de hasta 100 identificadores de notificacion.');
    }
    filtro._id = { $in: ids.map((i: string) => new ObjectId(i)) };
  }
  // El filtro por destinatario impide marcar (ni confirmar que existe) una ajena.
  const r = await coleccionMensajes().updateMany(filtro, { $addToSet: { leida_por: yo } });
  res.status(200).json({ marcadas: r.modifiedCount });
};

/**
 * Plantillas de las consultas al vendedor (la del escalamiento la crea infra/mongo/asistente.js). El servicio las crea si faltan
 * ($setOnInsert): un volumen creado antes de esta version las recibe al
 * arrancar, y una plantilla que el administrador ya edito no se pisa.
 */
const PLANTILLAS_BASE = [
  {
    clave: 'asistente.consulta_nueva',
    canal: 'email',
    asunto: 'Nueva consulta {{ticket}}: {{motivo_texto}}',
    cuerpo: 'El cliente {{correo_cliente}} escribió (referencia: {{referencia}}): "{{mensaje}}". Respóndela en el panel, pestaña Consultas.'
  },
  {
    clave: 'asistente.consulta_mensaje',
    canal: 'email',
    asunto: 'El cliente respondió la consulta {{ticket}}',
    cuerpo: 'El cliente {{correo_cliente}} escribió en la consulta {{ticket}}: "{{mensaje}}".'
  },
  {
    clave: 'asistente.consulta_respondida',
    canal: 'email',
    asunto: 'Respondimos tu consulta {{ticket}}',
    cuerpo: 'Hola, SerByTek respondió tu consulta {{ticket}}: "{{mensaje}}". Puedes verla y contestar en Mi perfil, sección Mis consultas.'
  }
];

export const asegurarPlantillas = async (): Promise<void> => {
  await coleccionPlantillas().bulkWrite(
    PLANTILLAS_BASE.map((p) => ({
      updateOne: { filter: { clave: p.clave }, update: { $setOnInsert: { ...p, activo: true } }, upsert: true }
    })),
    { ordered: false }
  ).catch((error) => {
    // Dos replicas arrancando a la vez: la otra ya la creo.
    if ((error as { code?: number }).code !== 11000) throw error;
  });
};
