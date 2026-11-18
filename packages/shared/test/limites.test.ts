import { describe, expect, it } from 'vitest';
import { limiteDeCompra } from '../src/limites';

describe('limite de compra por cliente (RF-47): deja 5 unidades, minimo 1', () => {
  it('con stock de sobra, el cliente puede llevar todo menos 5', () => {
    expect(limiteDeCompra(20, 0, 5)).toEqual({ maximo_total: 15, puede_agregar: 15 });
  });

  it('con 6 unidades o menos, una por cliente (la ultima unidad se puede comprar)', () => {
    expect(limiteDeCompra(6, 0, 5).puede_agregar).toBe(1);
    expect(limiteDeCompra(1, 0, 5).puede_agregar).toBe(1);
    expect(limiteDeCompra(0, 0, 5)).toEqual({ maximo_total: 0, puede_agregar: 0 });
  });

  it('suma lo que el cliente ya tiene en pedidos en curso: repetir pedidos no lo evade', () => {
    // Habia 20; ya compro 3 (quedan 17): puede llevar 12 mas y quedan 5.
    expect(limiteDeCompra(17, 3, 5)).toEqual({ maximo_total: 15, puede_agregar: 12 });
    // Ya compro 15 (quedan 5): no puede agregar mas.
    expect(limiteDeCompra(5, 15, 5).puede_agregar).toBe(0);
    // Otro cliente sin pedidos sobre esas 5: una.
    expect(limiteDeCompra(5, 0, 5).puede_agregar).toBe(1);
  });

  it('nunca permite mas de lo disponible', () => {
    expect(limiteDeCompra(3, 0, 0).puede_agregar).toBe(3);
  });
});
