import { randomUUID } from 'node:crypto';
import { crearLogger } from '@ecommerce/shared';

/**
 * Simulador de la pasarela de pagos externa.
 *
 * En produccion aqui iria el SDK del proveedor real (Wompi, PayU, Stripe). Lo
 * relevante para la arquitectura es que:
 *   - la plataforma nunca recibe ni almacena el numero de tarjeta: el cliente
 *     lo entrega directamente a la pasarela, que devuelve un token;
 *   - este servicio solo maneja ese token.
 *
 * El resultado es DETERMINISTA segun el token recibido, para que las pruebas
 * sean reproducibles:
 *
 *   tok_ok_...        -> aprobado
 *   tok_rechazo_...   -> rechazado (fondos insuficientes)
 *   tok_lento_...     -> aprobado, pero tarda LATENCIA_LENTA_MS (prueba de timeout)
 *   tok_error_...     -> error de la pasarela (prueba de reintentos)
 *   cualquier otro    -> aprobado
 */

const log = crearLogger('pasarela-simulada');

export interface SolicitudPasarela {
  monto: number;
  moneda: string;
  medio_pago: string;
  token_medio_pago: string;
  referencia: string;
}

export interface RespuestaPasarela {
  aprobado: boolean;
  codigo_autorizacion?: string;
  codigo_rechazo?: string;
  mensaje: string;
  latencia_ms: number;
  ultimos_cuatro?: string;
  marca?: string;
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MARCAS = ['VISA', 'MASTERCARD', 'AMEX'];

export const autorizar = async (solicitud: SolicitudPasarela): Promise<RespuestaPasarela> => {
  const inicio = Date.now();
  const token = solicitud.token_medio_pago ?? '';

  // Latencia base realista de una pasarela externa.
  const latenciaBase = Number(process.env.PASARELA_LATENCIA_MS || 150);

  if (token.startsWith('tok_lento')) {
    await esperar(Number(process.env.PASARELA_LATENCIA_LENTA_MS || 5000));
  } else if (token.startsWith('tok_error')) {
    await esperar(latenciaBase);
    log.warn('La pasarela devolvio un error tecnico', { referencia: solicitud.referencia });
    throw new Error('La pasarela de pagos no esta disponible (simulado).');
  } else {
    await esperar(latenciaBase);
  }

  const latencia = Date.now() - inicio;
  const ultimosCuatro = token.slice(-4).padStart(4, '0');
  const marca = MARCAS[token.length % MARCAS.length];

  if (token.startsWith('tok_rechazo')) {
    return {
      aprobado: false,
      codigo_rechazo: 'FONDOS_INSUFICIENTES',
      mensaje: 'La entidad emisora rechazo la transaccion por fondos insuficientes.',
      latencia_ms: latencia,
      ultimos_cuatro: ultimosCuatro,
      marca
    };
  }

  // Limite de monto: una pasarela real tiene topes por transaccion.
  const topeMaximo = Number(process.env.PASARELA_MONTO_MAXIMO || 50_000_000);
  if (solicitud.monto > topeMaximo) {
    return {
      aprobado: false,
      codigo_rechazo: 'MONTO_EXCEDE_LIMITE',
      mensaje: `El monto supera el limite permitido por transaccion (${topeMaximo}).`,
      latencia_ms: latencia,
      ultimos_cuatro: ultimosCuatro,
      marca
    };
  }

  return {
    aprobado: true,
    codigo_autorizacion: `AUT-${randomUUID().slice(0, 8).toUpperCase()}`,
    mensaje: 'Transaccion aprobada.',
    latencia_ms: latencia,
    ultimos_cuatro: ultimosCuatro,
    marca
  };
};

export const reembolsar = async (
  referencia: string,
  monto: number
): Promise<{ exitoso: boolean; referencia_pasarela: string; mensaje: string }> => {
  await esperar(Number(process.env.PASARELA_LATENCIA_MS || 150));
  log.info('Reembolso procesado en la pasarela', { referencia, monto });
  return {
    exitoso: true,
    referencia_pasarela: `REF-${randomUUID().slice(0, 8).toUpperCase()}`,
    mensaje: 'Reembolso procesado.'
  };
};
