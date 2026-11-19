import { describe, expect, it } from 'vitest';
import { validarEntrada, validarProveedor } from '../src/proveedores';

describe('entrada de mercancia (RF-51)', () => {
  it('solo la cantidad es obligatoria; lo demas se normaliza', () => {
    expect(validarEntrada({ cantidad: 10 })).toEqual({ cantidad: 10, documento: undefined, observacion: undefined });
    expect(validarEntrada({ cantidad: 5, proveedor_id: 2, costo_unitario: 180000, documento: ' FV-1020 ', observacion: '' })).toMatchObject({
      cantidad: 5,
      proveedor_id: 2,
      costo_unitario: 180000,
      documento: 'FV-1020',
      observacion: undefined
    });
  });

  it('rechaza cantidades, costos y proveedores invalidos', () => {
    expect(() => validarEntrada({ cantidad: 0 })).toThrow(/cantidad/);
    expect(() => validarEntrada({ cantidad: '5' })).toThrow(/cantidad/);
    expect(() => validarEntrada({ cantidad: 1, costo_unitario: -3 })).toThrow(/costo/);
    expect(() => validarEntrada({ cantidad: 1, proveedor_id: 'x' })).toThrow(/proveedor/);
    expect(() => validarEntrada({ cantidad: 1, documento: 'x'.repeat(41) })).toThrow(/40/);
  });
});

describe('proveedores', () => {
  it('valida NIT, telefono y correo, y quita puntos y espacios', () => {
    expect(validarProveedor({ nombre: 'Distribuidora X', nit: '900.123.456-1', telefono: '(601) 555 0101', email: 'Compras@X.co' }, false)).toEqual({
      nombre: 'Distribuidora X',
      nit: '900123456-1',
      telefono: '6015550101',
      email: 'compras@x.co'
    });
    expect(() => validarProveedor({ nombre: 'AB', nit: '900123456' }, false)).toThrow(/nombre/);
    expect(() => validarProveedor({ nombre: 'Proveedor', nit: '12' }, false)).toThrow(/NIT/);
    expect(() => validarProveedor({ email: 'no-es-correo' }, true)).toThrow(/correo/);
    expect(() => validarProveedor({ telefono: '601-ABC-0101' }, true)).toThrow(/telefono/);
  });

  it('una edicion parcial solo trae lo que cambia', () => {
    expect(validarProveedor({ activo: false }, true)).toEqual({ activo: false });
  });
});
