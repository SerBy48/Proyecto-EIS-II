import { PoolClient } from 'pg';
import {
  BusEventos,
  ClaimsToken,
  ErrorApp,
  Eventos,
  crearLogger,
  enTransaccion,
  errorConflicto,
  errorSolicitud
} from '@ecommerce/shared';
import { pool } from './db';
import { carrito, catalogo, clientes, inventario, pagos } from './dependencias';
import { verificarLimites } from './limites-compra';

/**
 * ORQUESTADOR DE LA COMPRA - patron Saga con transacciones compensatorias.
 *
 * El checkout abarca cuatro servicios con cuatro bases de datos distintas, asi
 * que no existe un COMMIT que lo cubra todo. La alternativa es una saga: una
 * secuencia de pasos locales, cada uno con su compensacion, ejecutados en
 * orden y deshechos en orden inverso si algo falla.
 *
 * Pasos (numerados segun el flujo de la Actividad 4 del documento):
 *
 *   9. validar_cliente    -> clientes-service      (sin compensacion: solo lee)
 *  10. verificar_precios  -> catalogo-service      (sin compensacion: solo lee)
 *  11. reservar_stock     -> inventario-service    COMPENSA: liberar_reserva
 *      crear_pedido       -> local                 COMPENSA: estado=cancelado
 *  12. cobrar             -> pagos-service         COMPENSA: reembolsar
 *  13. confirmar_reserva  -> inventario-service    (descuento definitivo)
 *  14. estado=pagado      -> local
 *  15. publicar evento    -> broker (asincrono)
 *
 * El orden no es arbitrario. Se reserva el stock ANTES de cobrar porque cobrar
 * y luego descubrir que no hay unidades obliga a un reembolso, que es peor
 * experiencia que un "producto agotado" antes de pedir la tarjeta.
 */

const log = crearLogger('saga-checkout');

export interface EntradaCheckout {
  cliente_id: number;
  direccion_id?: number;
  medio_pago: string;
  token_medio_pago?: string;
  clave_idempotencia: string;
  requestId?: string;
  usuario: ClaimsToken;
}

interface ItemCarrito {
  sku: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
}

interface Compensacion {
  paso: string;
  ejecutar: () => Promise<void>;
}

/** Registra cada paso de la saga para poder auditar que ocurrio. */
const registrarPaso = async (
  clave: string,
  paso: string,
  estado: 'iniciado' | 'completado' | 'fallido' | 'compensado',
  detalle?: unknown,
  pedidoId?: number
): Promise<void> => {
  await pool
    .query(
      `INSERT INTO saga_pasos (pedido_id, clave_idempotencia, paso, estado, detalle)
       VALUES ($1, $2, $3, $4, $5)`,
      [pedidoId ?? null, clave, paso, estado, detalle ? JSON.stringify(detalle) : null]
    )
    .catch(() => undefined);
};

export const ejecutarCheckout = async (
  entrada: EntradaCheckout,
  bus?: BusEventos
): Promise<Record<string, unknown>> => {
  const { cliente_id, clave_idempotencia: clave, requestId, usuario } = entrada;
  const registro = log.con({ request_id: requestId, clave });

  // ---------------------------------------------------------------------
  // Idempotencia del checkout: un doble clic en "Pagar" no crea dos pedidos.
  // ---------------------------------------------------------------------
  const existente = await pool.query(
    `SELECT id, numero, estado, total FROM pedidos WHERE clave_idempotencia = $1`,
    [clave]
  );
  if (existente.rowCount) {
    registro.info('Checkout idempotente: el pedido ya existia');
    const pedido = existente.rows[0];
    return { idempotente: true, pedido_id: pedido.id, numero: pedido.numero, estado: pedido.estado, total: Number(pedido.total) };
  }

  const compensaciones: Compensacion[] = [];
  let pedidoId: number | undefined;

  /** Deshace los pasos ya ejecutados, en orden inverso. */
  const compensar = async (motivo: string): Promise<void> => {
    registro.warn('Compensando la saga', { motivo, pasos: compensaciones.length });
    for (const compensacion of [...compensaciones].reverse()) {
      try {
        await compensacion.ejecutar();
        await registrarPaso(clave, compensacion.paso, 'compensado', { motivo }, pedidoId);
        registro.info('Paso compensado', { paso: compensacion.paso });
      } catch (error) {
        // Una compensacion fallida es lo peor que puede pasar en una saga:
        // deja el sistema en estado inconsistente. Se registra con el maximo
        // detalle para resolverlo manualmente y se sigue con las demas.
        registro.error('FALLO LA COMPENSACION - requiere intervencion manual', {
          paso: compensacion.paso,
          error: error instanceof Error ? error.message : error
        });
        await registrarPaso(clave, compensacion.paso, 'fallido', {
          motivo: 'compensacion_fallida',
          error: error instanceof Error ? error.message : String(error)
        }, pedidoId);
      }
    }
  };

  try {
    // ============================================================= PASO 9 ===
    // Validar el cliente y su direccion de envio.
    await registrarPaso(clave, 'validar_cliente', 'iniciado');

    const validacion = await clientes.pedir<{
      cliente: { id: number; nombre: string; email: string };
      direccion_envio: Record<string, unknown>;
    }>({
      ruta: `/${cliente_id}/validar${entrada.direccion_id ? `?direccion_id=${entrada.direccion_id}` : ''}`,
      requestId,
      usuario
    });

    await registrarPaso(clave, 'validar_cliente', 'completado', { cliente_id });

    // ============================================================ PASO 8b ===
    // Leer el carrito con sus totales ya calculados.
    await registrarPaso(clave, 'leer_carrito', 'iniciado');

    const datosCarrito = await carrito.pedir<{
      items: ItemCarrito[];
      totales: { subtotal: number; descuento: number; impuestos: number; envio: number; total: number };
    }>({ ruta: `/${cliente_id}/checkout`, requestId, usuario });

    if (!datosCarrito.items?.length) throw errorSolicitud('El carrito esta vacio.');

    await registrarPaso(clave, 'leer_carrito', 'completado', { items: datosCarrito.items.length });

    // ============================================================ PASO 10 ===
    // Verificar el precio vigente de cada item contra el catalogo.
    //
    // El precio que se cobra NUNCA viene del cliente ni se da por bueno del
    // carrito: se relee del servicio propietario. Si cambio desde que el
    // cliente lo agrego, se rechaza el checkout y se le muestra el nuevo
    // precio, en lugar de cobrarle algo que no acepto.
    await registrarPaso(clave, 'verificar_precios', 'iniciado');

    const itemsVerificados: ItemCarrito[] = [];
    const discrepancias: Array<{ sku: string; precio_carrito: number; precio_actual: number }> = [];

    for (const item of datosCarrito.items) {
      const precio = await catalogo.pedir<{ sku: string; nombre: string; precio_final: number }>({
        ruta: `/productos/${encodeURIComponent(item.sku)}/precio`,
        requestId,
        usuario
      });

      if (precio.precio_final !== item.precio_unitario) {
        discrepancias.push({
          sku: item.sku,
          precio_carrito: item.precio_unitario,
          precio_actual: precio.precio_final
        });
      }

      itemsVerificados.push({
        sku: item.sku,
        nombre: precio.nombre,
        cantidad: item.cantidad,
        precio_unitario: precio.precio_final
      });
    }

    if (discrepancias.length) {
      await registrarPaso(clave, 'verificar_precios', 'fallido', { discrepancias });
      throw errorConflicto(
        'El precio de uno o mas productos cambio. Revise su carrito antes de pagar.',
        { discrepancias }
      );
    }

    await registrarPaso(clave, 'verificar_precios', 'completado');

    // =========================================================== PASO 10b ===
    // Limite por cliente (RF-47): debe dejar al menos 5 unidades para los
    // demas, contando sus pedidos en curso. Solo lee: sin compensacion.
    await registrarPaso(clave, 'verificar_limites', 'iniciado');
    try {
      await verificarLimites(cliente_id, itemsVerificados, { requestId, usuario });
    } catch (error) {
      if (error instanceof ErrorApp && error.codigo === 'LIMITE_POR_CLIENTE') {
        await registrarPaso(clave, 'verificar_limites', 'fallido', error.detalle);
      }
      throw error;
    }
    await registrarPaso(clave, 'verificar_limites', 'completado');

    // Los totales se recalculan sobre los precios verificados, conservando el
    // descuento y el envio que calculo el carrito.
    const subtotal = itemsVerificados.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0);
    const descuento = datosCarrito.totales.descuento;
    const envio = datosCarrito.totales.envio;
    const impuestos = Math.round((subtotal - descuento) * (Number(process.env.PORCENTAJE_IVA || 19) / 100));
    const total = subtotal - descuento + impuestos + envio;

    // ============================================================ PASO 11 ===
    // Reservar el stock. Es el primer paso con efecto lateral, y por tanto el
    // primero que necesita compensacion.
    await registrarPaso(clave, 'reservar_stock', 'iniciado');

    const reservas: Array<{ sku: string; reserva_id: string }> = [];

    for (const item of itemsVerificados) {
      // La clave de idempotencia incluye el SKU: cada item tiene su reserva
      // independiente, y un reintento del mismo item no duplica el descuento.
      const claveReserva = `${clave}:${item.sku}`;

      const reserva = await inventario.pedir<{ reserva_id: string; disponible_restante: number }>({
        metodo: 'POST',
        ruta: '/reservas',
        cuerpo: { sku: item.sku, cantidad: item.cantidad, pedido_id: clave },
        claveIdempotencia: claveReserva,
        requestId,
        usuario
      });

      reservas.push({ sku: item.sku, reserva_id: reserva.reserva_id });

      // Se agrega la compensacion inmediatamente despues de cada reserva, no
      // al final del bucle: si el tercer item falla, los dos primeros ya
      // tienen su liberacion registrada.
      compensaciones.push({
        paso: `liberar_reserva:${item.sku}`,
        ejecutar: async () => {
          await inventario.pedir({
            metodo: 'POST',
            ruta: `/reservas/${reserva.reserva_id}/liberar`,
            cuerpo: { motivo: 'saga_compensada' },
            requestId,
            usuario
          });
        }
      });
    }

    await registrarPaso(clave, 'reservar_stock', 'completado', { reservas });

    // ======================================================== PASO 13a ======
    // Registrar el pedido. A partir de aqui existe un numero de pedido que el
    // cliente puede consultar, incluso si el pago falla despues.
    await registrarPaso(clave, 'crear_pedido', 'iniciado');

    const resultado = await enTransaccion(pool, async (cliente: PoolClient) => {
      const { rows } = await cliente.query(
        `INSERT INTO pedidos
           (numero, cliente_id, direccion_envio, estado, subtotal, impuestos, envio, descuento, total,
            clave_idempotencia, request_id)
         VALUES (generar_numero_pedido(), $1, $2, 'creado', $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, numero, estado, total, creado_en`,
        [
          cliente_id,
          JSON.stringify(validacion.direccion_envio),
          subtotal,
          impuestos,
          envio,
          descuento,
          total,
          clave,
          requestId ?? null
        ]
      );

      const pedido = rows[0];

      for (const item of itemsVerificados) {
        const reserva = reservas.find((r) => r.sku === item.sku);
        await cliente.query(
          `INSERT INTO pedido_items (pedido_id, sku, nombre, cantidad, precio_unitario, subtotal, reserva_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            pedido.id,
            item.sku,
            item.nombre,
            item.cantidad,
            item.precio_unitario,
            item.precio_unitario * item.cantidad,
            reserva?.reserva_id ?? null
          ]
        );
      }

      await cliente.query(
        `INSERT INTO historial_estados (pedido_id, estado_anterior, estado_nuevo, motivo, request_id)
         VALUES ($1, NULL, 'creado', 'checkout iniciado', $2)`,
        [pedido.id, requestId ?? null]
      );

      return pedido;
    });

    pedidoId = resultado.id as number;

    compensaciones.push({
      paso: 'cancelar_pedido',
      ejecutar: async () => {
        await pool.query(
          `UPDATE pedidos SET estado = 'cancelado', motivo_cancelacion = $2 WHERE id = $1 AND estado != 'cancelado'`,
          [pedidoId, 'Saga compensada: el pago no se completo.']
        );
      }
    });

    await registrarPaso(clave, 'crear_pedido', 'completado', { numero: resultado.numero }, pedidoId);

    // ============================================================ PASO 12 ===
    // Cobrar. El resultado determina el estado final del pedido.
    await registrarPaso(clave, 'cobrar', 'iniciado', undefined, pedidoId);

    let cobro: { aprobado: boolean; transaccion: { referencia: string; codigo_rechazo?: string; mensaje_pasarela?: string } };

    try {
      cobro = await pagos.pedir({
        metodo: 'POST',
        ruta: '/cobros',
        cuerpo: {
          pedido_id: pedidoId,
          numero_pedido: resultado.numero,
          cliente_id,
          monto: total,
          medio_pago: entrada.medio_pago,
          token_medio_pago: entrada.token_medio_pago,
          // Para que el aviso de pago rechazado le llegue al cliente (H-F5c-02).
          contacto: { email: validacion.cliente.email, nombre: validacion.cliente.nombre }
        },
        claveIdempotencia: `${clave}:pago`,
        requestId,
        usuario
      });
    } catch (error) {
      // Error tecnico de la pasarela: se compensa y se informa. No se asume
      // que el cobro fallo ni que se hizo; queda registrado para conciliar.
      await registrarPaso(clave, 'cobrar', 'fallido', {
        error: error instanceof Error ? error.message : String(error)
      }, pedidoId);
      await compensar('error_tecnico_pasarela');

      await bus?.publicar(
        Eventos.PEDIDO_CANCELADO,
        {
          pedido_id: pedidoId,
          numero: resultado.numero,
          cliente_id,
          total,
          estado: 'cancelado',
          motivo: 'No fue posible procesar el pago.',
          detalle_cobro: 'No se realizo ningun cobro.',
          email: validacion.cliente.email,
          nombre: validacion.cliente.nombre
        },
        requestId
      );

      throw error;
    }

    // -------------------------------------------------- pago RECHAZADO ------
    if (!cobro.aprobado) {
      const motivo = cobro.transaccion.mensaje_pasarela ?? 'Pago rechazado.';

      await registrarPaso(clave, 'cobrar', 'fallido', {
        codigo: cobro.transaccion.codigo_rechazo
      }, pedidoId);

      // Compensacion: las unidades reservadas vuelven al inventario y quedan
      // disponibles para otro cliente. Esto es exactamente el escenario que
      // describe el documento en la Actividad 6, punto f.
      await compensar('pago_rechazado');

      await pool.query(
        `UPDATE pedidos SET transaccion_pago_id = $2 WHERE id = $1`,
        [pedidoId, cobro.transaccion.referencia]
      );

      await bus?.publicar(
        Eventos.PEDIDO_CANCELADO,
        {
          pedido_id: pedidoId,
          numero: resultado.numero,
          cliente_id,
          total,
          estado: 'cancelado',
          motivo,
          detalle_cobro: 'No se realizo ningun cobro.',
          email: validacion.cliente.email,
          nombre: validacion.cliente.nombre
        },
        requestId
      );

      registro.info('Pedido cancelado por rechazo del pago', {
        pedido_id: pedidoId,
        numero: resultado.numero
      });

      // 402 Payment Required: el pedido existe pero no pudo pagarse.
      throw new ErrorApp(402, motivo, 'PAGO_RECHAZADO', {
        pedido_id: pedidoId,
        numero: resultado.numero,
        referencia: cobro.transaccion.referencia
      });
    }

    await registrarPaso(clave, 'cobrar', 'completado', {
      referencia: cobro.transaccion.referencia
    }, pedidoId);

    // ============================================================ PASO 13 ===
    // Pago aprobado: la reserva se convierte en descuento definitivo.
    //
    // Si esto fallara ahora, el cliente ya pago. Por eso NO se compensa hacia
    // atras: se registra el fallo para resolverlo hacia adelante (el stock
    // quedaria como reservado y un operador lo ajusta). Compensar aqui
    // significaria devolverle el dinero a un cliente que si compro.
    await registrarPaso(clave, 'confirmar_reserva', 'iniciado', undefined, pedidoId);

    for (const reserva of reservas) {
      try {
        await inventario.pedir({
          metodo: 'POST',
          ruta: `/reservas/${reserva.reserva_id}/confirmar`,
          requestId,
          usuario
        });
      } catch (error) {
        registro.error('No se pudo confirmar la reserva tras un pago aprobado', {
          reserva_id: reserva.reserva_id,
          sku: reserva.sku,
          error: error instanceof Error ? error.message : error
        });
        await registrarPaso(clave, `confirmar_reserva:${reserva.sku}`, 'fallido', {
          reserva_id: reserva.reserva_id,
          nota: 'El pago fue aprobado. Requiere ajuste manual de inventario.'
        }, pedidoId);
      }
    }

    await registrarPaso(clave, 'confirmar_reserva', 'completado', undefined, pedidoId);

    // ============================================================ PASO 14 ===
    const actualizado = await pool.query(
      `UPDATE pedidos
          SET estado = 'pagado', transaccion_pago_id = $2
        WHERE id = $1
        RETURNING id, numero, estado, subtotal, impuestos, envio, descuento, total, creado_en`,
      [pedidoId, cobro.transaccion.referencia]
    );

    // Se vacia el carrito. Si falla no se compensa nada: el pedido es valido y
    // un carrito con items sobrantes es una molestia, no una inconsistencia.
    await carrito
      .pedir({ metodo: 'DELETE', ruta: `/${cliente_id}`, requestId, usuario })
      .catch(() => registro.warn('No se pudo vaciar el carrito tras la compra'));

    // ============================================================ PASO 15 ===
    // Evento ASINCRONO hacia notificaciones, facturacion y analitica.
    //
    // Es asincrono por diseno (Actividad 5, Opcion B): el cliente ya tiene su
    // pedido confirmado y puede seguir navegando. Si el proveedor de correo
    // tarda dos minutos, la compra no se ve afectada.
    await bus?.publicar(
      Eventos.PEDIDO_CONFIRMADO,
      {
        pedido_id: pedidoId,
        numero: resultado.numero,
        cliente_id,
        email: validacion.cliente.email,
        nombre: validacion.cliente.nombre,
        total,
        estado: 'pagado',
        items: itemsVerificados,
        referencia_pago: cobro.transaccion.referencia
      },
      requestId
    );

    registro.info('Compra completada', { pedido_id: pedidoId, numero: resultado.numero, total });

    return {
      idempotente: false,
      pedido: actualizado.rows[0],
      items: itemsVerificados,
      pago: {
        referencia: cobro.transaccion.referencia,
        estado: 'aprobada'
      }
    };
  } catch (error) {
    // Los errores de los pasos de solo lectura (validacion, precios) llegan
    // aqui sin compensaciones pendientes, asi que no hay nada que deshacer.
    if (compensaciones.length && !(error instanceof ErrorApp && error.codigo === 'PAGO_RECHAZADO')) {
      const yaCompensado = await pool.query(
        `SELECT 1 FROM saga_pasos WHERE clave_idempotencia = $1 AND estado = 'compensado' LIMIT 1`,
        [clave]
      );
      if (!yaCompensado.rowCount) {
        await compensar(error instanceof Error ? error.message : 'error_desconocido');
      }
    }
    throw error;
  }
};
