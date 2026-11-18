import { Response } from 'express';
import { ClaimsToken, ErrorApp, PeticionAutenticada, errorSolicitud, limiteDeCompra, reservaPorCliente } from '@ecommerce/shared';
import { pool } from './db';
import { inventario } from './dependencias';
import { ESTADOS_EN_CURSO } from './direccion-pedido';

/**
 * Limite de compra por cliente (RF-47): un cliente debe dejar al menos 5
 * unidades de cada producto para los demas (minimo 1 por cliente), sumando
 * lo que ya tiene en pedidos en curso. La regla esta en
 * packages/shared/src/limites.ts; aqui se juntan los dos datos que necesita:
 * el stock libre (inventario) y los pedidos del cliente (esta base).
 *
 * No reemplaza la reserva atomica de inventario: dos checkouts simultaneos
 * del mismo cliente podrian pasar los dos esta verificacion, pero nunca se
 * vende mas de lo que hay (invariante 3). Es una regla comercial, no de
 * concurrencia.
 */

export interface LimiteSku {
  sku: string;
  disponible: number;
  en_curso: number;
  maximo_total: number;
  puede_agregar: number;
}

/** Unidades por SKU en pedidos en curso del cliente. */
const unidadesEnCurso = async (clienteId: number, skus: string[]): Promise<Map<string, number>> => {
  const { rows } = await pool.query(
    `SELECT i.sku, SUM(i.cantidad)::INT AS unidades
       FROM pedido_items i JOIN pedidos p ON p.id = i.pedido_id
      WHERE p.cliente_id = $1 AND p.estado = ANY($2) AND i.sku = ANY($3::VARCHAR[])
      GROUP BY i.sku`,
    [clienteId, ESTADOS_EN_CURSO, skus]
  );
  return new Map(rows.map((r) => [String(r.sku), Number(r.unidades)]));
};

export const calcularLimites = async (
  clienteId: number,
  skus: string[],
  contexto: { requestId?: string; usuario?: ClaimsToken }
): Promise<LimiteSku[]> => {
  const unicos = [...new Set(skus)];
  if (!unicos.length) return [];
  const [stock, propios] = await Promise.all([
    inventario.pedir<Array<{ sku: string; disponible: number }>>({
      ruta: `/disponibilidad?skus=${encodeURIComponent(unicos.join(','))}`,
      requestId: contexto.requestId,
      usuario: contexto.usuario
    }),
    unidadesEnCurso(clienteId, unicos)
  ]);
  const libre = new Map(stock.map((d) => [d.sku, Number(d.disponible)]));
  return unicos.map((sku) => {
    const disponible = libre.get(sku) ?? 0;
    const en_curso = propios.get(sku) ?? 0;
    return { sku, disponible, en_curso, ...limiteDeCompra(disponible, en_curso) };
  });
};

/**
 * Paso de la saga: si alguna cantidad del carrito supera el limite, el
 * checkout se rechaza ANTES de reservar (no hay nada que compensar) con un
 * mensaje que dice cuanto puede llevar.
 */
export const verificarLimites = async (
  clienteId: number,
  items: Array<{ sku: string; nombre?: string; cantidad: number }>,
  contexto: { requestId?: string; usuario?: ClaimsToken }
): Promise<void> => {
  const limites = await calcularLimites(clienteId, items.map((i) => i.sku), contexto);
  const porSku = new Map(limites.map((l) => [l.sku, l]));
  const excedidos = items
    .map((i) => ({ item: i, limite: porSku.get(i.sku)! }))
    .filter(({ item, limite }) => limite.disponible > 0 && item.cantidad > limite.puede_agregar);
  if (!excedidos.length) return;

  const [{ item, limite }] = excedidos;
  const nombre = item.nombre ?? item.sku;
  const detalle = limite.en_curso
    ? ` (ya tienes ${limite.en_curso} en pedidos en curso)`
    : '';
  const mensaje = limite.puede_agregar
    ? `De ${nombre} puedes llevar máximo ${limite.puede_agregar} ${limite.puede_agregar === 1 ? 'unidad' : 'unidades'}${detalle}. Ajusta la cantidad en tu carrito.`
    : `Ya alcanzaste el máximo de ${nombre} por cliente${detalle}. Quítalo del carrito para continuar.`;
  throw new ErrorApp(409, mensaje, 'LIMITE_POR_CLIENTE', {
    reserva_por_cliente: reservaPorCliente(),
    excedidos: excedidos.map(({ item: i, limite: l }) => ({ sku: i.sku, cantidad: i.cantidad, puede_agregar: l.puede_agregar, en_curso: l.en_curso }))
  });
};

/** GET /limites?skus=A,B - cuanto puede agregar el cliente de cada producto. */
export const consultarLimites = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const clienteId = req.usuario?.rol === 'cliente' ? req.usuario.cliente_id : Number(req.query.cliente_id);
  if (!Number.isInteger(clienteId) || !clienteId) {
    throw errorSolicitud('Indique cliente_id para consultar los límites de un cliente.');
  }
  const parametro = typeof req.query.skus === 'string' ? req.query.skus : '';
  const skus = parametro.split(',').map((s) => s.trim()).filter(Boolean);
  if (!skus.length || skus.length > 50) throw errorSolicitud('Indique de 1 a 50 SKU separados por comas.');
  res.status(200).json({
    reserva_por_cliente: reservaPorCliente(),
    limites: await calcularLimites(Number(clienteId), skus, { requestId: req.requestId, usuario: req.usuario })
  });
};
