import { Response } from 'express';
import { ErrorApp, PeticionAutenticada, errorNoEncontrado, errorSolicitud } from '@ecommerce/shared';
import { pool } from './db';
import { busDeEventos, contactoDelCliente } from './controlador';
import { clientes } from './dependencias';

/** Cuantas veces puede el cliente cambiar la direccion de un pedido ya creado. */
export const MAXIMO_CAMBIOS_DIRECCION = 2;

/** Estados en los que el pedido aun no sale de la bodega. */
export const ESTADOS_CON_DIRECCION_EDITABLE = ['creado', 'pagado', 'en_preparacion'] as const;

/** Frase del correo: cuantos cambios de direccion le quedan al pedido. */
const textoRestantes = (n: number): string =>
  n <= 0
    ? 'Ya usaste los cambios de dirección de este pedido.'
    : 'Puedes cambiarla ' + (n === 1 ? 'una vez más.' : n + ' veces más.');

/** Estados que impiden eliminar la cuenta: el pedido sigue en curso. */
export const ESTADOS_EN_CURSO = ['creado', 'pagado', 'en_preparacion', 'enviado'] as const;

/**
 * PATCH /:id/direccion { direccion_id } - el cliente cambia la direccion de
 * envio de su pedido, como maximo dos veces y solo antes de que salga.
 *
 * La direccion se toma de clientes-service con la identidad del cliente (la
 * misma validacion del checkout: debe ser una direccion de envio SUYA) y se
 * guarda como copia en el pedido, igual que al comprar.
 *
 * El limite se aplica en UNA sentencia condicional: dos clics simultaneos no
 * pueden contar como un solo cambio ni superar el maximo, porque PostgreSQL
 * serializa las dos actualizaciones sobre la fila y la segunda vuelve a evaluar
 * el WHERE con el contador ya incrementado. El CHECK de la tabla es la ultima
 * defensa.
 */
export const cambiarDireccion = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const yo = req.usuario;
  if (!yo?.cliente_id) throw new ErrorApp(403, 'Solo el cliente dueño del pedido puede cambiar su dirección.', 'ACCESO_DENEGADO');
  if (!/^\d+$/.test(String(req.params.id))) throw errorNoEncontrado('Pedido no encontrado.');
  const pedidoId = Number(req.params.id);
  const direccionId = Number(req.body?.direccion_id);
  if (!Number.isInteger(direccionId) || direccionId <= 0) throw errorSolicitud('Indica la direccion_id de una de tus direcciones.');

  const actual = await pool.query(
    'SELECT id, numero, cliente_id, estado, total, cambios_direccion, direccion_envio FROM pedidos WHERE id = $1',
    [pedidoId]
  );
  const pedido = actual.rows[0];
  // Un pedido ajeno se responde como inexistente (invariante 1).
  if (!pedido || pedido.cliente_id !== yo.cliente_id) throw errorNoEncontrado('Pedido no encontrado.');
  if (Number(pedido.direccion_envio?.id) === direccionId) {
    throw errorSolicitud('Esa ya es la dirección de envío del pedido.');
  }

  // La direccion debe ser de envio y del propio cliente (clientes lo valida).
  let direccion: Record<string, unknown>;
  try {
    const validacion = await clientes.pedir<{ direccion_envio: Record<string, unknown> }>({
      ruta: `/${yo.cliente_id}/validar?direccion_id=${direccionId}`,
      requestId: req.requestId
    });
    direccion = validacion.direccion_envio;
  } catch (error) {
    if (error instanceof ErrorApp && error.estado === 400) throw errorSolicitud('Esa dirección no existe en tu perfil.');
    throw error;
  }
  if (Number(direccion.id) !== direccionId) throw errorSolicitud('Esa dirección no existe en tu perfil.');

  const { rows } = await pool.query(
    `UPDATE pedidos
        SET direccion_envio = $3, cambios_direccion = cambios_direccion + 1, request_id = $4
      WHERE id = $1 AND cliente_id = $2
        AND estado = ANY($5::VARCHAR[])
        AND cambios_direccion < $6
      RETURNING id, numero, estado, direccion_envio, cambios_direccion, actualizado_en`,
    [pedidoId, yo.cliente_id, JSON.stringify(direccion), req.requestId ?? null, ESTADOS_CON_DIRECCION_EDITABLE, MAXIMO_CAMBIOS_DIRECCION]
  );

  if (!rows.length) {
    // Se relee para explicar el motivo: otro cambio pudo ganar la carrera.
    const ahora = (await pool.query('SELECT estado, cambios_direccion FROM pedidos WHERE id = $1', [pedidoId])).rows[0];
    if (ahora && !(ESTADOS_CON_DIRECCION_EDITABLE as readonly string[]).includes(ahora.estado)) {
      throw new ErrorApp(409, `El pedido está ${ahora.estado === 'enviado' ? 'enviado' : ahora.estado} y ya no se puede cambiar su dirección.`, 'DIRECCION_NO_EDITABLE');
    }
    throw new ErrorApp(409, `Ya cambiaste la dirección de este pedido ${MAXIMO_CAMBIOS_DIRECCION} veces, que es el máximo.`, 'LIMITE_CAMBIOS_DIRECCION');
  }

  const cambiado = rows[0];
  await pool.query(
    `INSERT INTO historial_estados (pedido_id, estado_anterior, estado_nuevo, motivo, request_id)
     VALUES ($1, $2, $2, $3, $4)`,
    [pedidoId, cambiado.estado, `Cambio de direccion ${cambiado.cambios_direccion} de ${MAXIMO_CAMBIOS_DIRECCION}`, req.requestId ?? null]
  );

  const d = cambiado.direccion_envio as Record<string, string | null>;
  await busDeEventos()?.publicar(
    'pedido.direccion_cambiada',
    {
      pedido_id: cambiado.id,
      numero: cambiado.numero,
      cliente_id: yo.cliente_id,
      estado: cambiado.estado,
      cambio: cambiado.cambios_direccion,
      cambios_restantes: MAXIMO_CAMBIOS_DIRECCION - cambiado.cambios_direccion,
      restantes_texto: textoRestantes(MAXIMO_CAMBIOS_DIRECCION - cambiado.cambios_direccion),
      direccion: [d.linea1, d.linea2, d.ciudad, d.departamento].filter(Boolean).join(', '),
      ...(await contactoDelCliente(yo.cliente_id, req))
    },
    req.requestId
  );

  res.status(200).json({
    mensaje: 'Dirección de envío actualizada.',
    pedido: cambiado,
    cambios_restantes: MAXIMO_CAMBIOS_DIRECCION - cambiado.cambios_direccion
  });
};

/**
 * GET /internos/clientes/:clienteId/pendientes - interno (auth-service).
 * Pedidos que impiden eliminar la cuenta: creados, pagados, en preparacion o
 * enviados.
 */
export const pedidosEnCurso = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const clienteId = Number(req.params.clienteId);
  if (!Number.isInteger(clienteId) || clienteId <= 0) throw errorSolicitud('clienteId no es valido.');
  const { rows } = await pool.query(
    `SELECT numero, estado FROM pedidos
      WHERE cliente_id = $1 AND estado = ANY($2::VARCHAR[])
      ORDER BY creado_en DESC`,
    [clienteId, ESTADOS_EN_CURSO]
  );
  res.status(200).json({ pendientes: rows });
};
