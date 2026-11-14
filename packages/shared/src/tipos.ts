import { Request } from 'express';

/** Roles del sistema (Actividad 1, seccion 5.3 del documento). */
export type Rol = 'cliente' | 'vendedor' | 'administrador';

/** Claims que viajan firmados dentro del JWT. */
export interface ClaimsToken {
  sub: number;
  email: string;
  rol: Rol;
  /** Presente solo para usuarios con rol cliente. */
  cliente_id?: number;
}

/**
 * Peticion autenticada. El API Gateway valida el token y reenvia los datos
 * del usuario; cada servicio los expone aqui.
 */
export interface PeticionAutenticada extends Request {
  usuario?: ClaimsToken;
  /** Identificador de correlacion propagado por toda la cadena de llamadas. */
  requestId?: string;
  /** True cuando la llamada proviene de otro microservicio (red privada). */
  esLlamadaInterna?: boolean;
}

/** Estados del ciclo de vida de un pedido (seccion 5.8). */
export type EstadoPedido =
  | 'creado'
  | 'pagado'
  | 'en_preparacion'
  | 'enviado'
  | 'entregado'
  | 'cancelado';

/** Estados de una reserva de inventario. */
export type EstadoReserva = 'activa' | 'confirmada' | 'liberada' | 'expirada';

/** Estados de una transaccion de pago. */
export type EstadoPago = 'iniciada' | 'aprobada' | 'rechazada' | 'reembolsada';

/** Nombres de los eventos de dominio publicados en el message broker. */
export const Eventos = {
  PEDIDO_CONFIRMADO: 'pedido.confirmado',
  PEDIDO_CANCELADO: 'pedido.cancelado',
  PAGO_APROBADO: 'pago.aprobado',
  PAGO_RECHAZADO: 'pago.rechazado',
  STOCK_MINIMO: 'inventario.stock_minimo',
  RESERVA_EXPIRADA: 'inventario.reserva_expirada',
  CARRITO_ABANDONADO: 'carrito.abandonado'
} as const;

export type NombreEvento = (typeof Eventos)[keyof typeof Eventos];

/** Sobre estandar de todo evento publicado en el broker. */
export interface EventoDominio<T = unknown> {
  nombre: NombreEvento;
  ocurrido_en: string;
  request_id?: string;
  datos: T;
}
