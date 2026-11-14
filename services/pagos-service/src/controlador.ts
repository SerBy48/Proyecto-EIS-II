import { randomUUID } from 'node:crypto';
import { Response } from 'express';
import {
  BusEventos,
  ErrorApp,
  Eventos,
  PeticionAutenticada,
  crearLogger,
  errorNoEncontrado,
  errorSolicitud,
  exigirCampos
} from '@ecommerce/shared';
import { pool } from './db';
import { autorizar, reembolsar } from './pasarela';

const log = crearLogger('pagos-service');

let bus: BusEventos;
export const inyectarBus = (instancia: BusEventos): void => {
  bus = instancia;
};

const MEDIOS = ['tarjeta_credito', 'tarjeta_debito', 'pse', 'efecty'];

/**
 * POST /cobros
 *
 * Autoriza y captura el pago de un pedido (paso 12 del flujo de compra).
 * Es una llamada SINCRONA desde el servicio de pedidos porque el resultado
 * determina el estado del pedido: no se puede despachar mercancia sin saber si
 * el cobro fue autorizado.
 *
 * La idempotencia es obligatoria: si la red corta la respuesta y pedidos
 * reintenta, no se puede cobrar dos veces al mismo cliente. La clave unica en
 * base de datos es lo que lo garantiza, no una comprobacion en memoria.
 */
export const cobrar = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const faltantes = exigirCampos(req.body, ['pedido_id', 'cliente_id', 'monto', 'medio_pago']);
  if (faltantes.length) throw errorSolicitud(`Campos obligatorios: ${faltantes.join(', ')}`);

  const clave =
    (req.headers['idempotency-key'] as string | undefined) ??
    (req.body.clave_idempotencia as string | undefined);
  if (!clave) throw errorSolicitud('Se requiere la cabecera Idempotency-Key para cobrar.');

  const { pedido_id, numero_pedido, cliente_id, monto, medio_pago, token_medio_pago, moneda } =
    req.body as {
      pedido_id: number;
      numero_pedido?: string;
      cliente_id: number;
      monto: number;
      medio_pago: string;
      token_medio_pago?: string;
      moneda?: string;
    };

  if (!MEDIOS.includes(medio_pago)) {
    throw errorSolicitud(`El medio de pago debe ser uno de: ${MEDIOS.join(', ')}`);
  }
  if (!(Number(monto) > 0)) throw errorSolicitud('El monto debe ser mayor que cero.');

  // 1. Idempotencia: si esta clave ya produjo una transaccion, se devuelve esa.
  const previa = await pool.query(
    `SELECT id, referencia, estado, monto, codigo_autorizacion, codigo_rechazo, mensaje_pasarela
       FROM transacciones WHERE clave_idempotencia = $1`,
    [clave]
  );

  if (previa.rowCount) {
    const t = previa.rows[0];
    log.con({ request_id: req.requestId }).info('Cobro idempotente, se devuelve la transaccion existente', {
      referencia: t.referencia
    });
    res.status(200).json({
      idempotente: true,
      aprobado: t.estado === 'aprobada',
      transaccion: t
    });
    return;
  }

  // 2. Se registra la transaccion como iniciada ANTES de llamar a la pasarela.
  //    Si el proceso muere a mitad de camino queda el rastro de que se intento,
  //    que es lo que permite conciliar despues.
  const referencia = `TRX-${randomUUID().slice(0, 12).toUpperCase()}`;

  const creada = await pool.query(
    `INSERT INTO transacciones
       (referencia, pedido_id, numero_pedido, cliente_id, monto, moneda, medio_pago,
        token_medio_pago, estado, clave_idempotencia, request_id)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'COP'), $7, $8, 'iniciada', $9, $10)
     RETURNING id, referencia`,
    [
      referencia,
      pedido_id,
      numero_pedido ?? null,
      cliente_id,
      monto,
      moneda ?? null,
      medio_pago,
      token_medio_pago ?? null,
      clave,
      req.requestId ?? null
    ]
  );

  const transaccionId = creada.rows[0].id as number;

  // 3. Llamada a la pasarela externa.
  let respuesta;
  try {
    respuesta = await autorizar({
      monto: Number(monto),
      moneda: moneda ?? 'COP',
      medio_pago,
      token_medio_pago: token_medio_pago ?? '',
      referencia
    });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);

    await pool.query(
      `INSERT INTO auditoria_pasarela (transaccion_id, operacion, exitoso, codigo_respuesta, carga_enmascarada, request_id)
       VALUES ($1, 'autorizar', FALSE, 'ERROR_TECNICO', $2, $3)`,
      [transaccionId, JSON.stringify({ monto, medio_pago, token_medio_pago: '***' }), req.requestId ?? null]
    );

    // La transaccion queda como iniciada, no como rechazada: no se sabe si la
    // pasarela alcanzo a procesarla. Ese caso se resuelve por conciliacion, no
    // asumiendo un resultado.
    log.con({ request_id: req.requestId }).error('Error tecnico de la pasarela', {
      referencia,
      error: mensaje
    });
    throw new ErrorApp(
      502,
      'La pasarela de pagos no respondio correctamente.',
      'PASARELA_NO_DISPONIBLE',
      { referencia }
    );
  }

  // 4. Se persiste el resultado.
  const estado = respuesta.aprobado ? 'aprobada' : 'rechazada';

  const actualizada = await pool.query(
    `UPDATE transacciones
        SET estado = $2,
            codigo_autorizacion = $3,
            codigo_rechazo = $4,
            mensaje_pasarela = $5,
            ultimos_cuatro = $6,
            marca = $7,
            resuelto_en = NOW()
      WHERE id = $1
      RETURNING id, referencia, pedido_id, monto, moneda, medio_pago, estado,
                codigo_autorizacion, codigo_rechazo, mensaje_pasarela,
                ultimos_cuatro, marca, creado_en, resuelto_en`,
    [
      transaccionId,
      estado,
      respuesta.codigo_autorizacion ?? null,
      respuesta.codigo_rechazo ?? null,
      respuesta.mensaje,
      respuesta.ultimos_cuatro ?? null,
      respuesta.marca ?? null
    ]
  );

  await pool.query(
    `INSERT INTO auditoria_pasarela
       (transaccion_id, operacion, exitoso, codigo_respuesta, latencia_ms, carga_enmascarada, request_id)
     VALUES ($1, 'autorizar', $2, $3, $4, $5, $6)`,
    [
      transaccionId,
      respuesta.aprobado,
      respuesta.codigo_autorizacion ?? respuesta.codigo_rechazo ?? null,
      respuesta.latencia_ms,
      JSON.stringify({ monto, medio_pago, token_medio_pago: '***', ultimos_cuatro: respuesta.ultimos_cuatro }),
      req.requestId ?? null
    ]
  );

  // 5. Evento asincrono. Informativo: quien necesita el resultado ahora mismo
  //    es el servicio de pedidos, y ya lo recibe en esta respuesta HTTP.
  await bus?.publicar(
    respuesta.aprobado ? Eventos.PAGO_APROBADO : Eventos.PAGO_RECHAZADO,
    {
      transaccion_id: transaccionId,
      referencia,
      pedido_id,
      numero_pedido,
      cliente_id,
      monto,
      motivo: respuesta.codigo_rechazo
    },
    req.requestId
  );

  log.con({ request_id: req.requestId }).info('Cobro procesado', {
    referencia,
    estado,
    pedido_id
  });

  res.status(respuesta.aprobado ? 201 : 200).json({
    aprobado: respuesta.aprobado,
    transaccion: actualizada.rows[0]
  });
};

/**
 * POST /transacciones/:referencia/reembolsar
 * Compensacion cuando el pedido se cancela despues de un cobro aprobado.
 */
export const reembolsarTransaccion = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const { rows } = await pool.query(
    `SELECT id, referencia, monto, estado FROM transacciones WHERE referencia = $1`,
    [req.params.referencia]
  );
  const transaccion = rows[0];
  if (!transaccion) throw errorNoEncontrado('Transaccion no encontrada.');

  if (transaccion.estado === 'reembolsada') {
    res.status(200).json({ mensaje: 'La transaccion ya estaba reembolsada.', idempotente: true });
    return;
  }
  if (transaccion.estado !== 'aprobada') {
    throw errorSolicitud(`Solo se pueden reembolsar transacciones aprobadas (estado actual: ${transaccion.estado}).`);
  }

  const monto = Number(req.body?.monto ?? transaccion.monto);
  const motivo = String(req.body?.motivo ?? 'Cancelacion del pedido');

  const resultado = await reembolsar(transaccion.referencia, monto);

  await pool.query(
    `INSERT INTO reembolsos (transaccion_id, monto, motivo, estado, referencia_pasarela)
     VALUES ($1, $2, $3, $4, $5)`,
    [transaccion.id, monto, motivo, resultado.exitoso ? 'procesado' : 'fallido', resultado.referencia_pasarela]
  );

  if (resultado.exitoso) {
    await pool.query(`UPDATE transacciones SET estado = 'reembolsada' WHERE id = $1`, [transaccion.id]);
  }

  res.status(200).json({ mensaje: resultado.mensaje, reembolso: resultado, monto });
};

/** GET /transacciones/:referencia */
export const obtenerTransaccion = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const { rows } = await pool.query(
    `SELECT referencia, pedido_id, numero_pedido, cliente_id, monto, moneda, medio_pago,
            estado, codigo_autorizacion, codigo_rechazo, mensaje_pasarela,
            ultimos_cuatro, marca, creado_en, resuelto_en
       FROM transacciones WHERE referencia = $1`,
    [req.params.referencia]
  );
  if (!rows[0]) throw errorNoEncontrado('Transaccion no encontrada.');

  // Autorizacion a nivel de dato: un cliente solo ve sus propias transacciones.
  if (req.usuario?.rol === 'cliente' && req.usuario.cliente_id !== rows[0].cliente_id) {
    throw errorNoEncontrado('Transaccion no encontrada.');
  }

  res.status(200).json(rows[0]);
};

/** GET /transacciones?cliente_id= - historial de pagos. */
export const listarTransacciones = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const esCliente = req.usuario?.rol === 'cliente';
  const clienteId = esCliente ? req.usuario!.cliente_id : req.query.cliente_id ? Number(req.query.cliente_id) : null;

  const { rows } = await pool.query(
    `SELECT referencia, pedido_id, numero_pedido, monto, medio_pago, estado,
            ultimos_cuatro, marca, creado_en
       FROM transacciones
      WHERE ($1::INT IS NULL OR cliente_id = $1)
      ORDER BY creado_en DESC
      LIMIT 100`,
    [clienteId ?? null]
  );
  res.status(200).json(rows);
};
