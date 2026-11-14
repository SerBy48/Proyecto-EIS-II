import { Response } from 'express';
import {
  BusEventos,
  EventoDominio,
  PeticionAutenticada,
  crearLogger,
  errorNoEncontrado
} from '@ecommerce/shared';
import { coleccionMensajes, coleccionPlantillas } from './db';

const log = crearLogger('notificaciones-service');

/**
 * Servicio de notificaciones (seccion 5.10 del documento).
 *
 * Es el unico servicio puramente ASINCRONO: no lo invoca nadie por HTTP para
 * enviar un mensaje, sino que reacciona a los eventos que otros publican. Esa
 * es la razon de que su caida no interrumpa ninguna venta (Actividad 6, punto
 * d): los eventos se acumulan en la cola del broker y se procesan cuando
 * vuelve a estar disponible.
 */

/** Sustituye los marcadores {{campo}} de la plantilla. */
const renderizar = (plantilla: string, datos: Record<string, unknown>): string =>
  plantilla.replace(/\{\{(\w+)\}\}/g, (_coincidencia, campo: string) => {
    const valor = datos[campo];
    return valor === undefined || valor === null ? '' : String(valor);
  });

const formatearMoneda = (valor: unknown): string => {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return String(valor ?? '');
  return `$${numero.toLocaleString('es-CO')}`;
};

/**
 * Envio real del mensaje.
 *
 * En produccion aqui iria el proveedor de correo (SendGrid, SES), el de SMS
 * (Twilio) o el de push (FCM). Para el laboratorio se registra en el log y se
 * persiste en MongoDB, que es suficiente para verificar el flujo completo.
 */
const enviar = async (
  canal: string,
  destinatario: string,
  asunto: string,
  cuerpo: string
): Promise<{ exitoso: boolean; proveedor: string }> => {
  // Latencia simulada del proveedor externo. Es precisamente esta latencia la
  // que justifica que la notificacion sea asincrona: el cliente no deberia
  // esperarla para ver su pedido confirmado.
  await new Promise((r) => setTimeout(r, Number(process.env.LATENCIA_ENVIO_MS || 100)));

  log.info(`[${canal.toUpperCase()}] -> ${destinatario}`, { asunto, cuerpo });
  return { exitoso: true, proveedor: `${canal}-simulado` };
};

/**
 * Procesa un evento de dominio: busca la plantilla, la renderiza y envia.
 *
 * La deduplicacion es clave. RabbitMQ garantiza entrega "al menos una vez", de
 * modo que un evento puede llegar dos veces si el ack se pierde. El indice
 * unico sobre clave_dedupe impide que el cliente reciba dos correos por el
 * mismo pedido.
 */
export const procesarEvento = async (evento: EventoDominio): Promise<void> => {
  const datos = evento.datos as Record<string, unknown>;

  const plantilla = await coleccionPlantillas().findOne({ clave: evento.nombre, activo: true });

  if (!plantilla) {
    log.warn('No hay plantilla para el evento, se ignora', { evento: evento.nombre });
    return;
  }

  // Los eventos que no van dirigidos a un cliente (alertas de reposicion, por
  // ejemplo) se enrutan al buzon de operaciones.
  const destinatario =
    (datos.email as string | undefined) ??
    (datos.destinatario as string | undefined) ??
    (process.env.CORREO_OPERACIONES || 'operaciones@tienda.co');

  const variables: Record<string, unknown> = {
    ...datos,
    total: datos.total !== undefined ? formatearMoneda(datos.total) : undefined,
    items: Array.isArray(datos.items) ? datos.items.length : datos.items
  };

  const asunto = renderizar(String(plantilla.asunto), variables);
  const cuerpo = renderizar(String(plantilla.cuerpo), variables);

  // La clave de deduplicacion combina el evento con el identificador del
  // agregado afectado: el mismo evento sobre el mismo pedido se envia una vez.
  const claveDedupe = [
    evento.nombre,
    datos.pedido_id ?? datos.sku ?? datos.cliente_id ?? '',
    datos.estado ?? ''
  ].join(':');

  try {
    await coleccionMensajes().insertOne({
      evento: evento.nombre,
      canal: plantilla.canal,
      destinatario,
      asunto,
      cuerpo,
      estado: 'pendiente',
      clave_dedupe: claveDedupe,
      request_id: evento.request_id,
      datos_evento: datos,
      creado_en: new Date()
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      log.info('Evento duplicado, no se reenvia', { evento: evento.nombre, clave: claveDedupe });
      return;
    }
    throw error;
  }

  const resultado = await enviar(String(plantilla.canal), destinatario, asunto, cuerpo);

  await coleccionMensajes().updateOne(
    { clave_dedupe: claveDedupe },
    {
      $set: {
        estado: resultado.exitoso ? 'enviado' : 'fallido',
        proveedor: resultado.proveedor,
        enviado_en: new Date()
      }
    }
  );
};

/**
 * Suscripciones del servicio.
 *
 * Un solo consumidor atiende todos los eventos que generan notificaciones. El
 * patron 'pedido.*' captura confirmaciones y cancelaciones; los demas se
 * enumeran explicitamente.
 */
export const registrarSuscripciones = async (bus: BusEventos): Promise<void> => {
  await bus.suscribir(
    {
      cola: 'notificaciones.envio',
      patrones: ['pedido.*', 'pago.rechazado', 'inventario.stock_minimo', 'carrito.abandonado'],
      maxIntentos: 3
    },
    procesarEvento
  );
};

// ---------------------------------------------------------------------------
// API de consulta. El servicio no expone un endpoint para "enviar": eso solo
// ocurre por eventos. Estos endpoints son para auditar lo enviado.
// ---------------------------------------------------------------------------

/** GET /mensajes */
export const listarMensajes = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const filtro: Record<string, unknown> = {};
  if (req.query.destinatario) filtro.destinatario = String(req.query.destinatario);
  if (req.query.evento) filtro.evento = String(req.query.evento);
  if (req.query.estado) filtro.estado = String(req.query.estado);

  // Un cliente solo puede ver sus propios mensajes.
  if (req.usuario?.rol === 'cliente') filtro.destinatario = req.usuario.email;

  const mensajes = await coleccionMensajes()
    .find(filtro, { projection: { datos_evento: 0 } })
    .sort({ creado_en: -1 })
    .limit(Math.min(Number(req.query.limite ?? 50), 200))
    .toArray();

  res.status(200).json(mensajes);
};

/** GET /plantillas */
export const listarPlantillas = async (_req: PeticionAutenticada, res: Response): Promise<void> => {
  const plantillas = await coleccionPlantillas().find({}).sort({ clave: 1 }).toArray();
  res.status(200).json(plantillas);
};

/** PATCH /plantillas/:clave */
export const actualizarPlantilla = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const cambios: Record<string, unknown> = {};
  for (const campo of ['asunto', 'cuerpo', 'canal', 'activo']) {
    if (req.body?.[campo] !== undefined) cambios[campo] = req.body[campo];
  }

  const resultado = await coleccionPlantillas().findOneAndUpdate(
    { clave: req.params.clave },
    { $set: { ...cambios, actualizado_en: new Date() } },
    { returnDocument: 'after' }
  );

  if (!resultado) throw errorNoEncontrado('Plantilla no encontrada.');
  res.status(200).json({ mensaje: 'Plantilla actualizada.', plantilla: resultado });
};
