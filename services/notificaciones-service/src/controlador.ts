import { Response } from 'express';
import {
  BusEventos,
  EventoDominio,
  PeticionAutenticada,
  crearLogger,
  errorNoEncontrado
} from '@ecommerce/shared';
import { coleccionMensajes, coleccionPlantillas } from './db';
import { canalPara } from './canales';
import { canalConHtml, renderizar } from './plantillas';

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


const formatearMoneda = (valor: unknown): string => {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return String(valor ?? '');
  return `$${numero.toLocaleString('es-CO')}`;
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

  // En el correo, los datos del usuario se escapan como HTML (hallazgo S-11).
  // Se guarda la version escapada; el texto plano va solo en el envio.
  const canal = String(plantilla.canal);
  const conHtml = canalConHtml(canal);
  const asunto = renderizar(String(plantilla.asunto), variables);
  const texto = renderizar(String(plantilla.cuerpo), variables);
  const cuerpo = renderizar(String(plantilla.cuerpo), variables, conHtml);

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
    if ((error as { code?: number }).code !== 11000) throw error;
    // Ya existe un mensaje con esta clave. Si se envio, es un duplicado del
    // broker y se ignora. Si quedo pendiente o fallido, es un REINTENTO del
    // mismo evento tras un fallo del proveedor: hay que volver a enviarlo. Antes
    // todo se trataba como duplicado y un fallo de envio perdia el mensaje.
    const previo = await coleccionMensajes().findOne({ clave_dedupe: claveDedupe }, { projection: { estado: 1 } });
    if (previo?.estado === 'enviado') {
      log.info('Evento duplicado, no se reenvia', { evento: evento.nombre, clave: claveDedupe });
      return;
    }
  }

  try {
    const resultado = await canalPara(canal).enviar({
      destinatario,
      asunto,
      texto,
      html: conHtml ? `<p>${cuerpo.replace(/\n/g, '<br>')}</p>` : undefined
    });
    await coleccionMensajes().updateOne(
      { clave_dedupe: claveDedupe },
      {
        $set: { estado: 'enviado', proveedor: resultado.proveedor, id_externo: resultado.id_externo, enviado_en: new Date() },
        $inc: { intentos: 1 }
      }
    );
  } catch (error) {
    // El fallo queda registrado y se relanza: el bus reintenta el evento y, al
    // agotar los intentos, lo deja en la dead letter queue. Nunca se pierde
    // (mismo principio de la invariante 12, del lado del consumidor).
    await coleccionMensajes().updateOne(
      { clave_dedupe: claveDedupe },
      {
        $set: { estado: 'fallido', ultimo_error: (error as Error).message, fallido_en: new Date() },
        $inc: { intentos: 1 }
      }
    );
    throw error;
  }
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
