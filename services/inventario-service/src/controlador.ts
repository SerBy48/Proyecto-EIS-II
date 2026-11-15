import { Response } from 'express';
import {
  BusEventos,
  ClienteServicio,
  ErrorApp,
  Eventos,
  PeticionAutenticada,
  crearLogger,
  errorNoEncontrado,
  errorSolicitud,
  errorStockInsuficiente,
  exigirCampos
} from '@ecommerce/shared';
import { pool } from './db';

const log = crearLogger('inventario-service');

/**
 * GET /disponibilidad?skus=A,B,C
 *
 * Consulta masiva usada por el servicio de catalogo (paso 6 del flujo de
 * compra). Se resuelve en una sola consulta con ANY($1) en lugar de una por
 * SKU: el catalogo pide la disponibilidad de los veinte productos de una
 * pagina de resultados a la vez.
 */
export const disponibilidad = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const parametro = String(req.query.skus ?? '').trim();
  if (!parametro) throw errorSolicitud('Indique el parametro skus separado por comas.');

  const skus = parametro.split(',').map((s) => s.trim()).filter(Boolean);
  if (skus.length > 100) throw errorSolicitud('Maximo 100 SKU por consulta.');

  const { rows } = await pool.query(
    `SELECT sku,
            SUM(cantidad_disponible)::INT AS disponible,
            SUM(cantidad_reservada)::INT  AS reservado,
            BOOL_OR(cantidad_disponible > 0) AS hay_stock,
            MIN(stock_minimo)::INT AS stock_minimo
       FROM stock
      WHERE sku = ANY($1::VARCHAR[])
      GROUP BY sku`,
    [skus]
  );

  // Los SKU sin registro de stock se reportan como agotados, no se omiten:
  // el catalogo necesita una respuesta por cada producto que pregunto.
  const porSku = new Map(rows.map((r) => [r.sku, r]));
  const respuesta = skus.map((sku) => {
    const fila = porSku.get(sku);
    return fila
      ? {
          sku,
          disponible: fila.disponible,
          reservado: fila.reservado,
          hay_stock: fila.hay_stock,
          stock_minimo: fila.stock_minimo
        }
      : { sku, disponible: 0, reservado: 0, hay_stock: false, stock_minimo: 0 };
  });

  res.status(200).json(respuesta);
};

/** GET /stock/:sku - detalle por bodega. */
export const stockPorSku = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const { rows } = await pool.query(
    `SELECT s.sku, b.codigo AS bodega, b.ciudad,
            s.cantidad_disponible, s.cantidad_reservada, s.stock_minimo, s.version, s.actualizado_en
       FROM stock s JOIN bodegas b ON b.id = s.bodega_id
      WHERE s.sku = $1
      ORDER BY b.codigo`,
    [req.params.sku]
  );
  if (!rows.length) throw errorNoEncontrado(`No hay registro de inventario para ${req.params.sku}.`);
  res.status(200).json(rows);
};

/**
 * POST /reservas
 *
 * La operacion critica del sistema. Resuelve la pregunta 5 del analisis:
 * garantizar que dos clientes no compren la ultima unidad disponible.
 *
 * Toda la logica de concurrencia vive en la funcion SQL reservar_stock, que
 * combina los cinco mecanismos que exige el documento: descuento condicional
 * atomico, bloqueo optimista por version, serializacion por SKU, reserva con
 * vigencia limitada e idempotencia por clave unica.
 *
 * La clave de idempotencia es obligatoria: sin ella un reintento del servicio
 * de pedidos tras un timeout descontaria stock dos veces.
 */
export const crearReserva = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const faltantes = exigirCampos(req.body, ['sku', 'cantidad']);
  if (faltantes.length) throw errorSolicitud(`Campos obligatorios: ${faltantes.join(', ')}`);

  const clave =
    (req.headers['idempotency-key'] as string | undefined) ??
    (req.body.clave_idempotencia as string | undefined);
  if (!clave) {
    throw errorSolicitud('Se requiere la cabecera Idempotency-Key para reservar stock.');
  }

  const { sku, cantidad, pedido_id, minutos_vigencia } = req.body as {
    sku: string;
    cantidad: number;
    pedido_id?: string;
    minutos_vigencia?: number;
  };

  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw errorSolicitud('La cantidad debe ser un entero positivo.');
  }

  const { rows } = await pool.query(
    `SELECT * FROM reservar_stock($1, $2, $3, $4, $5, $6)`,
    [
      sku,
      cantidad,
      clave,
      pedido_id ?? null,
      minutos_vigencia ?? Number(process.env.MINUTOS_RESERVA || 15),
      req.requestId ?? null
    ]
  );

  const resultado = rows[0];

  if (resultado.resultado === 'sin_stock') {
    log.con({ request_id: req.requestId }).warn('Reserva rechazada por falta de stock', {
      sku,
      solicitado: cantidad,
      disponible: resultado.disponible
    });
    // 409: es un conflicto de negocio, no un error del cliente ni del servidor.
    // El cliente HTTP compartido no reintenta los 4xx, que es lo correcto aqui.
    throw errorStockInsuficiente(sku, cantidad, resultado.disponible);
  }

  // Alerta de reposicion cuando el stock cae por debajo del minimo.
  // Se publica como evento asincrono: no condiciona la venta en curso.
  await verificarStockMinimo(sku, req.requestId);

  const esIdempotente = resultado.resultado === 'idempotente';

  // 201 solo cuando de verdad se creo una reserva. Un reintento con la misma
  // clave no crea nada, asi que responde 200: devolver 201 sobre un recurso que
  // ya existia es incorrecto, y ademas seria inconsistente con los servicios de
  // pagos y pedidos, que ya distinguen los dos casos.
  res.status(esIdempotente ? 200 : 201).json({
    mensaje: esIdempotente
      ? 'La reserva ya existia para esta clave de idempotencia.'
      : 'Stock reservado.',
    idempotente: esIdempotente,
    reserva_id: resultado.reserva_id,
    sku,
    cantidad,
    disponible_restante: resultado.disponible,
    expira_en: resultado.expira_en
  });
};

/**
 * POST /reservas/:id/confirmar
 * El pago fue aprobado: el descuento se vuelve definitivo (paso 13 del flujo).
 */
export const confirmarReserva = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const { rows } = await pool.query(`SELECT confirmar_reserva($1, $2) AS resultado`, [
    req.params.id,
    req.requestId ?? null
  ]);

  const resultado = rows[0].resultado as string;

  if (resultado === 'no_encontrada') throw errorNoEncontrado('Reserva no encontrada.');
  if (resultado.startsWith('estado_invalido')) {
    throw errorSolicitud(`La reserva no esta activa (${resultado.split(':')[1]}).`);
  }

  res.status(200).json({
    mensaje: resultado === 'ya_confirmada' ? 'La reserva ya estaba confirmada.' : 'Reserva confirmada.',
    reserva_id: req.params.id,
    resultado
  });
};

/**
 * POST /reservas/:id/liberar
 *
 * Transaccion compensatoria del patron Saga: el pago se rechazo despues de
 * haber reservado el stock, asi que las unidades vuelven a estar disponibles.
 * Es idempotente a proposito: el orquestador puede reintentar la compensacion
 * sin miedo a devolver unidades dos veces.
 */
export const liberarReserva = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const motivo = (req.body?.motivo as string | undefined) ?? 'liberada';

  const { rows } = await pool.query(`SELECT liberar_reserva($1, $2, $3) AS resultado`, [
    req.params.id,
    motivo,
    req.requestId ?? null
  ]);

  const resultado = rows[0].resultado as string;

  if (resultado === 'no_encontrada') throw errorNoEncontrado('Reserva no encontrada.');
  if (resultado.startsWith('estado_invalido')) {
    throw errorSolicitud(`La reserva no puede liberarse (${resultado.split(':')[1]}).`);
  }

  log.con({ request_id: req.requestId }).info('Reserva liberada', {
    reserva_id: req.params.id,
    motivo,
    resultado
  });

  res.status(200).json({
    mensaje: resultado === 'ya_liberada' ? 'La reserva ya estaba liberada.' : 'Reserva liberada.',
    reserva_id: req.params.id,
    resultado
  });
};

/** GET /reservas/:id */
export const obtenerReserva = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const { rows } = await pool.query(
    `SELECT id, sku, cantidad, pedido_id, estado, expira_en, creado_en, cerrado_en
       FROM reservas WHERE id = $1`,
    [req.params.id]
  );
  if (!rows[0]) throw errorNoEncontrado('Reserva no encontrada.');
  res.status(200).json(rows[0]);
};

/**
 * Cliente hacia el catalogo, usado solo para confirmar que un SKU existe antes
 * de abrirle su primer registro de inventario. Es una operacion administrativa
 * de bajo trafico; el circuit breaker y el timeout vienen del cliente comun.
 */
const catalogo = new ClienteServicio({
  nombre: 'catalogo',
  urlBase: process.env.URL_CATALOGO || 'http://localhost:3003',
  timeoutMs: Number(process.env.HTTP_TIMEOUT_MS || 3000)
});

/**
 * POST /stock/:sku/entrada - ingreso de mercancia (vendedor o administrador).
 *
 * Si el SKU todavia no tiene registro de inventario (un producto recien creado
 * en el catalogo), la primera entrada lo abre. Antes no habia ninguna forma de
 * hacerlo por la API: el producto quedaba agotado para siempre. El registro
 * solo se abre si el catalogo confirma que el producto existe, para que un SKU
 * mal escrito no deje filas huerfanas.
 *
 * Sin bodega_id, la entrada va a UNA sola bodega: la que ya tenga el SKU (la de
 * menor id) o, si es nuevo, la primera bodega activa. Antes la actualizacion
 * sin bodega sumaba la cantidad en todas las bodegas del SKU a la vez.
 */
export const registrarEntrada = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const { cantidad, bodega_id } = req.body as { cantidad: number; bodega_id?: number };
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw errorSolicitud('La cantidad debe ser un entero positivo.');
  }
  if (bodega_id !== undefined && !Number.isInteger(bodega_id)) {
    throw errorSolicitud('La bodega debe ser un identificador entero.');
  }
  const sku = req.params.sku;

  const existente = await pool.query(
    `SELECT 1 FROM stock WHERE sku = $1 AND ($2::INT IS NULL OR bodega_id = $2) LIMIT 1`,
    [sku, bodega_id ?? null]
  );

  if (!existente.rowCount) {
    try {
      await catalogo.pedir({ ruta: `/productos/${encodeURIComponent(sku)}/precio`, requestId: req.requestId });
    } catch (error) {
      if (error instanceof ErrorApp && error.estado === 404) {
        throw errorNoEncontrado(`El producto ${sku} no existe en el catalogo.`);
      }
      throw error;
    }
  }

  let rows: Array<{ sku: string; bodega_id: number; cantidad_disponible: number; version: number }>;
  try {
    ({ rows } = await pool.query(
    `WITH destino AS (
       SELECT COALESCE(
                $3::INT,
                (SELECT MIN(bodega_id) FROM stock WHERE sku = $1),
                (SELECT MIN(id) FROM bodegas WHERE activa)
              ) AS bodega_id
     )
     INSERT INTO stock (sku, bodega_id, cantidad_disponible)
     SELECT $1, destino.bodega_id, $2 FROM destino WHERE destino.bodega_id IS NOT NULL
     ON CONFLICT (sku, bodega_id) DO UPDATE
        SET cantidad_disponible = stock.cantidad_disponible + EXCLUDED.cantidad_disponible,
            version = stock.version + 1,
            actualizado_en = NOW()
     RETURNING sku, bodega_id, cantidad_disponible, version`,
    [sku, cantidad, bodega_id ?? null]
    ));
  } catch (error) {
    // 23503: la bodega indicada no existe (violacion de la llave foranea).
    if ((error as { code?: string }).code === '23503') throw errorSolicitud(`La bodega ${bodega_id} no existe.`);
    throw error;
  }

  if (!rows[0]) throw errorNoEncontrado(`No hay una bodega disponible para ${sku}.`);

  await pool.query(
    `INSERT INTO movimientos (sku, bodega_id, tipo, cantidad, saldo_despues, referencia, request_id)
     VALUES ($1, $2, 'entrada', $3, $4, $5, $6)`,
    [
      rows[0].sku,
      rows[0].bodega_id,
      cantidad,
      rows[0].cantidad_disponible,
      `entrada-manual:${req.usuario?.sub ?? 'interno'}`,
      req.requestId ?? null
    ]
  );

  res.status(200).json({ mensaje: 'Entrada registrada.', stock: rows[0] });
};

/** GET /movimientos/:sku - libro de movimientos. */
export const movimientos = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const { rows } = await pool.query(
    `SELECT tipo, cantidad, saldo_despues, referencia, creado_en
       FROM movimientos WHERE sku = $1
      ORDER BY creado_en DESC LIMIT 100`,
    [req.params.sku]
  );
  res.status(200).json(rows);
};

/** GET /alertas - productos por debajo del stock minimo. */
export const alertasReposicion = async (_req: PeticionAutenticada, res: Response): Promise<void> => {
  const { rows } = await pool.query(
    `SELECT s.sku, b.codigo AS bodega, s.cantidad_disponible, s.stock_minimo
       FROM stock s JOIN bodegas b ON b.id = s.bodega_id
      WHERE s.cantidad_disponible <= s.stock_minimo
      ORDER BY s.cantidad_disponible`
  );
  res.status(200).json(rows);
};

// ---------------------------------------------------------------------------
// Tareas de fondo y eventos
// ---------------------------------------------------------------------------

let bus: BusEventos;
export const inyectarBus = (instancia: BusEventos): void => {
  bus = instancia;
};

/** Publica la alerta de reposicion si el stock cayo al minimo. */
const verificarStockMinimo = async (sku: string, requestId?: string): Promise<void> => {
  const { rows } = await pool.query(
    `SELECT sku, cantidad_disponible, stock_minimo
       FROM stock WHERE sku = $1 AND cantidad_disponible <= stock_minimo`,
    [sku]
  );
  if (!rows.length || !bus) return;

  await bus.publicar(
    Eventos.STOCK_MINIMO,
    { sku, disponible: rows[0].cantidad_disponible, minimo: rows[0].stock_minimo },
    requestId
  );
};

/**
 * Barrido de reservas expiradas.
 *
 * Sin esto, un cliente que abandona el pago dejaria unidades bloqueadas para
 * siempre y el producto apareceria agotado sin estarlo. El barrido usa
 * FOR UPDATE SKIP LOCKED, asi que varias instancias del servicio pueden
 * ejecutarlo a la vez sin pisarse.
 */
export const iniciarBarridoReservas = (): NodeJS.Timeout => {
  const intervalo = Number(process.env.INTERVALO_BARRIDO_MS || 60_000);

  return setInterval(() => {
    void (async () => {
      try {
        const { rows } = await pool.query(`SELECT * FROM expirar_reservas()`);
        if (!rows.length) return;

        log.info('Reservas expiradas y stock devuelto', { cantidad: rows.length });

        for (const fila of rows) {
          await bus?.publicar(Eventos.RESERVA_EXPIRADA, {
            reserva_id: fila.reserva_id,
            sku: fila.sku,
            cantidad: fila.cantidad
          });
        }
      } catch (error) {
        log.error('Fallo el barrido de reservas', {
          error: error instanceof Error ? error.message : error
        });
      }
    })();
  }, intervalo);
};
