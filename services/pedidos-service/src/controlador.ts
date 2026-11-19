import { randomUUID } from 'node:crypto';
import { Response } from 'express';
import {
  BusEventos,
  EstadoPedido,
  crearLogger,
  PeticionAutenticada,
  errorNoEncontrado,
  errorProhibido,
  errorSolicitud,
  exigirCampos
} from '@ecommerce/shared';
import { pool } from './db';
import { ejecutarCheckout } from './saga-checkout';
import { clientes, inventario, pagos } from './dependencias';

let bus: BusEventos;
const log = crearLogger('pedidos');

/**
 * Correo y nombre del cliente para los eventos que le notifican un cambio de
 * su pedido (hallazgo H-F5-01: sin ellos, notificaciones enviaba el correo al
 * buzon de operaciones con un "Hola ,"). Se consulta con la identidad de quien
 * hace el cambio: el propio cliente o el personal interno.
 *
 * Si clientes no responde, el evento sale sin contacto y el cambio de estado se
 * mantiene: un correo nunca tumba la operacion principal (invariante 12).
 */
export const contactoDelCliente = async (
  clienteId: number,
  req: PeticionAutenticada
): Promise<{ email?: string; nombre?: string }> => {
  try {
    const cliente = await clientes.pedir<{ nombre: string; apellido: string; email: string }>({
      ruta: `/${clienteId}`,
      requestId: req.requestId,
      usuario: req.usuario!
    });
    return { email: cliente.email, nombre: `${cliente.nombre} ${cliente.apellido}`.trim() };
  } catch (error) {
    log.warn('Sin contacto del cliente para la notificacion', {
      cliente_id: clienteId,
      error: (error as Error).message
    });
    return {};
  }
};
export const inyectarBus = (instancia: BusEventos): void => {
  bus = instancia;
};

/** El bus de eventos del servicio (para los modulos que publican fuera de este archivo). */
export const busDeEventos = (): BusEventos | undefined => bus;

/** Transiciones de estado permitidas (seccion 5.8 del documento). */
const TRANSICIONES: Record<EstadoPedido, EstadoPedido[]> = {
  creado: ['pagado', 'cancelado'],
  pagado: ['en_preparacion', 'cancelado'],
  en_preparacion: ['enviado', 'cancelado'],
  enviado: ['entregado'],
  entregado: [],
  cancelado: []
};

/**
 * POST /checkout
 *
 * Punto de entrada de la compra (paso 8 del flujo). Delega toda la
 * orquestacion a la saga; aqui solo se valida la entrada y se resuelve de quien
 * es el carrito.
 */
export const checkout = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const faltantes = exigirCampos(req.body, ['medio_pago']);
  if (faltantes.length) throw errorSolicitud(`Campos obligatorios: ${faltantes.join(', ')}`);

  // Un cliente compra siempre para si mismo; el identificador sale del token,
  // no del cuerpo de la peticion. Un administrador puede comprar en nombre de
  // otro (venta telefonica) indicando cliente_id.
  const esCliente = req.usuario?.rol === 'cliente';
  const clienteId = esCliente ? req.usuario!.cliente_id : Number(req.body.cliente_id);

  if (!clienteId) {
    throw errorSolicitud(
      esCliente
        ? 'El usuario no tiene un cliente asociado.'
        : 'Indique cliente_id para comprar en nombre de un cliente.'
    );
  }

  // La clave de idempotencia la propone el cliente para que un reintento suyo
  // sea reconocible; si no la envia, se genera una.
  const clave =
    (req.headers['idempotency-key'] as string | undefined) ??
    (req.body.clave_idempotencia as string | undefined) ??
    `checkout:${clienteId}:${randomUUID()}`;

  const resultado = await ejecutarCheckout(
    {
      cliente_id: clienteId,
      direccion_id: req.body.direccion_id ? Number(req.body.direccion_id) : undefined,
      medio_pago: String(req.body.medio_pago),
      token_medio_pago: req.body.token_medio_pago ? String(req.body.token_medio_pago) : undefined,
      clave_idempotencia: clave,
      requestId: req.requestId,
      usuario: req.usuario!
    },
    bus
  );

  res.status(resultado.idempotente ? 200 : 201).json({
    mensaje: resultado.idempotente ? 'El pedido ya habia sido procesado.' : 'Compra confirmada.',
    ...resultado
  });
};

const exigirPropiedadPedido = (req: PeticionAutenticada, clienteIdDelPedido: number): void => {
  if (req.usuario?.rol === 'cliente' && req.usuario.cliente_id !== clienteIdDelPedido) {
    // Se responde 404 y no 403: confirmar que el pedido existe pero es de otro
    // ya filtra informacion.
    throw errorNoEncontrado('Pedido no encontrado.');
  }
};

/**
 * Distingue si el parametro de ruta es un id numerico o un numero de pedido.
 *
 * Es necesario separarlos: una condicion `WHERE id = $1 OR numero = $1` hace que
 * PostgreSQL intente convertir el texto a entero para evaluar la primera parte,
 * y falla con un error de sintaxis ante un valor como 'PED-202609-001001'.
 */
const identificarPedido = (parametro: string): { esId: boolean; valor: string } => ({
  esId: /^\d+$/.test(parametro),
  valor: parametro
});

/**
 * Para las rutas que solo aceptan el id numerico. Un valor no numerico se
 * responde como 404 en lugar de dejar que PostgreSQL falle con un 500 al
 * intentar convertirlo.
 */
const exigirIdNumerico = (parametro: string): number => {
  if (!/^\d+$/.test(parametro)) throw errorNoEncontrado('Pedido no encontrado.');
  return Number(parametro);
};

/** GET /:id — acepta el id numerico o el numero de pedido (PED-...). */
export const obtenerPedido = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const { esId, valor } = identificarPedido(String(req.params.id));

  const columnas = `id, numero, cliente_id, direccion_envio, estado, subtotal, impuestos,
                    envio, descuento, total, transaccion_pago_id, motivo_cancelacion,
                    cambios_direccion, creado_en, actualizado_en`;

  const { rows } = esId
    ? await pool.query(`SELECT ${columnas} FROM pedidos WHERE id = $1`, [Number(valor)])
    : await pool.query(`SELECT ${columnas} FROM pedidos WHERE numero = $1`, [valor]);
  const pedido = rows[0];
  if (!pedido) throw errorNoEncontrado('Pedido no encontrado.');
  exigirPropiedadPedido(req, pedido.cliente_id);

  const items = await pool.query(
    `SELECT sku, nombre, cantidad, precio_unitario, subtotal, reserva_id
       FROM pedido_items WHERE pedido_id = $1 ORDER BY id`,
    [pedido.id]
  );

  const historial = await pool.query(
    `SELECT estado_anterior, estado_nuevo, motivo, creado_en
       FROM historial_estados WHERE pedido_id = $1 ORDER BY creado_en`,
    [pedido.id]
  );

  res.status(200).json({ ...pedido, items: items.rows, historial: historial.rows });
};

/** GET / - lista de pedidos. Un cliente ve solo los suyos. */
export const listarPedidos = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const esCliente = req.usuario?.rol === 'cliente';
  const clienteId = esCliente
    ? req.usuario!.cliente_id
    : req.query.cliente_id
      ? Number(req.query.cliente_id)
      : null;

  const estado = req.query.estado ? String(req.query.estado) : null;

  const { rows } = await pool.query(
    `SELECT p.id, p.numero, p.cliente_id, p.estado, p.total, p.creado_en, p.actualizado_en,
            COUNT(i.id)::INT AS cantidad_items
       FROM pedidos p LEFT JOIN pedido_items i ON i.pedido_id = p.id
      WHERE ($1::INT IS NULL OR p.cliente_id = $1)
        AND ($2::VARCHAR IS NULL OR p.estado = $2)
      GROUP BY p.id
      ORDER BY p.creado_en DESC
      LIMIT 100`,
    [clienteId ?? null, estado]
  );

  res.status(200).json(rows);
};

/**
 * PATCH /:id/estado
 * Avance del pedido en su ciclo de vida (en_preparacion, enviado, entregado).
 * Solo personal interno. Valida que la transicion sea legal.
 */
export const cambiarEstado = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const nuevo = String(req.body?.estado ?? '') as EstadoPedido;
  if (!Object.keys(TRANSICIONES).includes(nuevo)) {
    throw errorSolicitud(`Estado invalido. Valores permitidos: ${Object.keys(TRANSICIONES).join(', ')}`);
  }

  const actual = await pool.query(
    `SELECT id, numero, cliente_id, estado, total FROM pedidos WHERE id = $1`,
    [exigirIdNumerico(String(req.params.id))]
  );
  const pedido = actual.rows[0];
  if (!pedido) throw errorNoEncontrado('Pedido no encontrado.');

  const permitidas = TRANSICIONES[pedido.estado as EstadoPedido];
  if (!permitidas.includes(nuevo)) {
    throw errorSolicitud(
      `No se puede pasar de '${pedido.estado}' a '${nuevo}'. Transiciones validas: ${
        permitidas.length ? permitidas.join(', ') : 'ninguna (estado final)'
      }.`
    );
  }

  const { rows } = await pool.query(
    `UPDATE pedidos SET estado = $2, motivo_cancelacion = $3, request_id = $4
      WHERE id = $1
      RETURNING id, numero, estado, actualizado_en`,
    [pedido.id, nuevo, req.body?.motivo ?? null, req.requestId ?? null]
  );

  // El cambio de estado se publica como evento: notificaciones informa al
  // cliente del despacho sin que pedidos sepa como se envia un correo.
  await bus?.publicar(
    nuevo === 'cancelado' ? 'pedido.cancelado' : 'pedido.confirmado',
    {
      pedido_id: pedido.id,
      numero: pedido.numero,
      cliente_id: pedido.cliente_id,
      total: Number(pedido.total),
      estado: nuevo,
      motivo: req.body?.motivo,
      guia: req.body?.guia,
      // Cancelar por aqui no reembolsa (eso lo hace POST /:id/cancelar).
      ...(nuevo === 'cancelado' ? { detalle_cobro: 'Si hubo un cobro, el reembolso se gestiona aparte.' } : {}),
      ...(await contactoDelCliente(pedido.cliente_id, req))
    },
    req.requestId
  );

  res.status(200).json({ mensaje: `Pedido actualizado a '${nuevo}'.`, pedido: rows[0] });
};

/**
 * POST /:id/cancelar
 *
 * Cancelacion posterior a la compra. Ejecuta las compensaciones hacia
 * adelante: reembolsa el pago y devuelve las unidades al inventario.
 */
export const cancelarPedido = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const actual = await pool.query(
    `SELECT id, numero, cliente_id, estado, total, transaccion_pago_id FROM pedidos WHERE id = $1`,
    [exigirIdNumerico(String(req.params.id))]
  );
  const pedido = actual.rows[0];
  if (!pedido) throw errorNoEncontrado('Pedido no encontrado.');

  // Un cliente puede cancelar su pedido mientras no haya salido de la bodega.
  const esCliente = req.usuario?.rol === 'cliente';
  if (esCliente && req.usuario!.cliente_id !== pedido.cliente_id) {
    throw errorNoEncontrado('Pedido no encontrado.');
  }

  // Antes de la regla de estados del cliente: repetir la cancelacion debe ser
  // idempotente para todos, no un 403 para el cliente.
  if (pedido.estado === 'cancelado') {
    res.status(200).json({ mensaje: 'El pedido ya estaba cancelado.', idempotente: true });
    return;
  }

  if (esCliente && !['creado', 'pagado'].includes(pedido.estado)) {
    throw errorProhibido('El pedido ya esta en preparacion. Contacte al servicio al cliente.');
  }
  if (['enviado', 'entregado'].includes(pedido.estado)) {
    throw errorSolicitud(`No se puede cancelar un pedido en estado '${pedido.estado}'.`);
  }

  const motivo = String(req.body?.motivo ?? 'Cancelado por solicitud del cliente');
  const compensaciones: string[] = [];

  // 1. Reembolso, si hubo cobro aprobado.
  if (pedido.transaccion_pago_id) {
    try {
      await pagos.pedir({
        metodo: 'POST',
        ruta: `/transacciones/${pedido.transaccion_pago_id}/reembolsar`,
        cuerpo: { motivo },
        requestId: req.requestId,
        usuario: req.usuario!
      });
      compensaciones.push('reembolso_procesado');
    } catch {
      compensaciones.push('reembolso_pendiente');
    }
  }

  // 2. Devolucion del inventario.
  const items = await pool.query(
    `SELECT sku, cantidad, reserva_id FROM pedido_items WHERE pedido_id = $1`,
    [pedido.id]
  );

  for (const item of items.rows) {
    if (!item.reserva_id) continue;
    try {
      // Si la reserva ya fue confirmada, liberarla no aplica: se registra una
      // entrada de mercancia por devolucion, que es el movimiento correcto.
      await inventario.pedir({
        metodo: 'POST',
        ruta: `/stock/${encodeURIComponent(item.sku)}/entrada`,
        cuerpo: { cantidad: item.cantidad },
        requestId: req.requestId,
        usuario: req.usuario!
      });
      compensaciones.push(`stock_devuelto:${item.sku}`);
    } catch {
      compensaciones.push(`stock_pendiente:${item.sku}`);
    }
  }

  const { rows } = await pool.query(
    `UPDATE pedidos SET estado = 'cancelado', motivo_cancelacion = $2, request_id = $3
      WHERE id = $1 RETURNING id, numero, estado`,
    [pedido.id, motivo, req.requestId ?? null]
  );

  await bus?.publicar(
    'pedido.cancelado',
    {
      pedido_id: pedido.id,
      numero: pedido.numero,
      cliente_id: pedido.cliente_id,
      total: Number(pedido.total),
      estado: 'cancelado',
      motivo,
      detalle_cobro: compensaciones.includes('reembolso_procesado')
        ? 'El reembolso del pago ya fue procesado.'
        : compensaciones.includes('reembolso_pendiente')
          ? 'El reembolso del pago esta en tramite.'
          : 'No se realizo ningun cobro.',
      ...(await contactoDelCliente(pedido.cliente_id, req))
    },
    req.requestId
  );

  res.status(200).json({ mensaje: 'Pedido cancelado.', pedido: rows[0], compensaciones });
};

/**
 * GET /:id/saga - bitacora de la saga.
 * Herramienta de diagnostico: muestra paso por paso que ocurrio en el checkout,
 * incluidas las compensaciones. Es la respuesta a la mayor desventaja de la
 * comunicacion distribuida, que es la dificultad de depuracion.
 */
export const bitacoraSaga = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const { rows } = await pool.query(
    `SELECT paso, estado, detalle, creado_en
       FROM saga_pasos
      WHERE pedido_id = $1
         OR clave_idempotencia = (SELECT clave_idempotencia FROM pedidos WHERE id = $1)
      ORDER BY creado_en, id`,
    [exigirIdNumerico(String(req.params.id))]
  );
  res.status(200).json(rows);
};
