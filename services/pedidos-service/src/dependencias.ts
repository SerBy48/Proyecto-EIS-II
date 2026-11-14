import { ClienteServicio } from '@ecommerce/shared';

/**
 * Clientes hacia los servicios de los que depende el orquestador.
 *
 * Las cuatro conexiones son SINCRONAS, tal como asigna la tabla de la
 * Actividad 5: el resultado de cada una condiciona si el pedido puede
 * continuar. Ninguna admite consistencia eventual.
 *
 * Los timeouts estan calibrados por servicio: la pasarela de pagos es
 * intrinsecamente mas lenta que una consulta de precio, asi que darle el mismo
 * timeout que al catalogo produciria falsos negativos.
 */

export const clientes = new ClienteServicio({
  nombre: 'clientes',
  urlBase: process.env.URL_CLIENTES || 'http://localhost:3002',
  timeoutMs: Number(process.env.TIMEOUT_CLIENTES_MS || 2000)
});

export const catalogo = new ClienteServicio({
  nombre: 'catalogo',
  urlBase: process.env.URL_CATALOGO || 'http://localhost:3003',
  timeoutMs: Number(process.env.TIMEOUT_CATALOGO_MS || 2000)
});

export const inventario = new ClienteServicio({
  nombre: 'inventario',
  urlBase: process.env.URL_INVENTARIO || 'http://localhost:3004',
  timeoutMs: Number(process.env.TIMEOUT_INVENTARIO_MS || 3000),
  // La reserva de stock es la operacion mas delicada: se le permite un
  // reintento menos para no prolongar el bloqueo sobre el SKU.
  reintentos: 1
});

export const carrito = new ClienteServicio({
  nombre: 'carrito',
  urlBase: process.env.URL_CARRITO || 'http://localhost:3005',
  timeoutMs: Number(process.env.TIMEOUT_CARRITO_MS || 2000)
});

export const pagos = new ClienteServicio({
  nombre: 'pagos',
  urlBase: process.env.URL_PAGOS || 'http://localhost:3007',
  // Una pasarela externa puede tardar varios segundos: el timeout debe
  // reflejarlo o se cancelarian cobros que en realidad iban a aprobarse.
  timeoutMs: Number(process.env.TIMEOUT_PAGOS_MS || 10000),
  // El cobro NO se reintenta automaticamente: aunque la operacion es
  // idempotente por clave, un reintento a ciegas sobre un pago es el tipo de
  // riesgo que conviene resolver por conciliacion y no por retry.
  reintentos: 0
});

export const metricasCircuitos = () => ({
  circuitos: {
    clientes: clientes.metricas,
    catalogo: catalogo.metricas,
    inventario: inventario.metricas,
    carrito: carrito.metricas,
    pagos: pagos.metricas
  }
});
