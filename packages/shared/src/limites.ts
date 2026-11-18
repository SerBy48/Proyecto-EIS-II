/**
 * Limite de compra por cliente (RF-47).
 *
 * Un solo cliente no puede llevarse todo el stock de un producto: debe dejar
 * al menos STOCK_RESERVA_CLIENTE unidades (5 por defecto) para los demas. Si
 * quedan pocas unidades, se le permite al menos una, para que un producto con
 * stock bajo siga a la venta (la ultima unidad de SKU-TEC-004 se puede comprar).
 *
 * El limite suma lo que el cliente ya tiene en pedidos en curso del mismo
 * producto: repetir pedidos no lo evade.
 *
 *   total permitido = max(1, disponible + en_curso - reserva)   (0 si no hay stock)
 *   puede agregar   = max(0, total permitido - en_curso)
 *
 * "disponible" es lo que inventario tiene libre ahora; lo que el cliente ya
 * pidio ya salio de ahi, por eso se suma de vuelta antes de restar la reserva.
 */
export const reservaPorCliente = (): number => {
  const valor = Number(process.env.STOCK_RESERVA_CLIENTE ?? 5);
  return Number.isInteger(valor) && valor >= 0 ? valor : 5;
};

export interface LimiteCompra {
  /** Unidades que el cliente puede tener en total entre carrito y pedidos en curso. */
  maximo_total: number;
  /** Unidades que aun puede agregar. */
  puede_agregar: number;
}

export const limiteDeCompra = (disponible: number, enCurso = 0, reserva = reservaPorCliente()): LimiteCompra => {
  const libre = Math.max(0, Math.trunc(disponible));
  const propio = Math.max(0, Math.trunc(enCurso));
  const maximo_total = libre === 0 ? 0 : Math.max(1, libre + propio - reserva);
  return { maximo_total, puede_agregar: Math.max(0, Math.min(libre, maximo_total - propio)) };
};
