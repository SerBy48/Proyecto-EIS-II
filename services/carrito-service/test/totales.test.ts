import { describe, expect, it } from 'vitest';
import { calcularTotales } from '../src/totales';

const reglas = { porcentajeIva: 19, envioBase: 15_000, umbralEnvioGratis: 500_000 };
const item = (precio: number, cantidad = 1) => ({ precio_unitario: precio, cantidad });

describe('calcularTotales', () => {
  it('carrito vacio: todo en cero, sin costo de envio', () => {
    expect(calcularTotales([], null, reglas)).toEqual({ subtotal: 0, descuento: 0, impuestos: 0, envio: 0, total: 0 });
  });

  it('suma precio x cantidad, aplica el IVA del 19 % y el envio base', () => {
    const t = calcularTotales([item(100_000, 2), item(50_000)], null, reglas);
    expect(t.subtotal).toBe(250_000);
    expect(t.impuestos).toBe(47_500);
    expect(t.envio).toBe(15_000);
    expect(t.total).toBe(312_500);
  });

  it('envio gratis desde el umbral (incluido)', () => {
    expect(calcularTotales([item(500_000)], null, reglas).envio).toBe(0);
    expect(calcularTotales([item(499_999)], null, reglas).envio).toBe(15_000);
  });

  it('el descuento porcentual se aplica ANTES del IVA', () => {
    const t = calcularTotales([item(329_000)], { codigo: 'BIENVENIDA10', tipo: 'porcentaje', valor: 10 }, reglas);
    // Mismas cifras que devolvio el gateway para este carrito.
    expect(t).toEqual({
      subtotal: 329_000,
      descuento: 32_900,
      impuestos: 56_259,
      envio: 15_000,
      total: 367_359,
      cupon_aplicado: 'BIENVENIDA10'
    });
  });

  it('el envio se decide sobre el subtotal sin descuento: el cupon no quita el envio gratis', () => {
    const t = calcularTotales([item(520_000)], { codigo: 'C', tipo: 'porcentaje', valor: 10 }, reglas);
    expect(t.subtotal - t.descuento).toBeLessThan(reglas.umbralEnvioGratis);
    expect(t.envio).toBe(0);
  });

  it('un monto fijo nunca deja el subtotal en negativo', () => {
    const t = calcularTotales([item(20_000)], { codigo: 'F', tipo: 'monto_fijo', valor: 50_000 }, reglas);
    expect(t.descuento).toBe(20_000);
    expect(t.impuestos).toBe(0);
  });

  it('un cupon de envio gratis elimina el envio sin descontar el subtotal', () => {
    const t = calcularTotales([item(100_000)], { codigo: 'E', tipo: 'envio_gratis', valor: 0 }, reglas);
    expect(t.envio).toBe(0);
    expect(t.descuento).toBe(0);
    expect(t.cupon_aplicado).toBe('E');
  });

  it('sin alcanzar el minimo de compra el cupon no se aplica', () => {
    const t = calcularTotales([item(50_000)], { codigo: 'M', tipo: 'porcentaje', valor: 10, minimo_compra: 100_000 }, reglas);
    expect(t.descuento).toBe(0);
    expect(t.cupon_aplicado).toBeUndefined();
  });

  it('el total cuadra siempre: subtotal - descuento + impuestos + envio', () => {
    for (const precio of [1, 999, 15_000, 333_333, 1_250_000]) {
      const t = calcularTotales([item(precio, 3)], { codigo: 'P', tipo: 'porcentaje', valor: 7 }, reglas);
      expect(t.total).toBe(t.subtotal - t.descuento + t.impuestos + t.envio);
    }
  });
});
