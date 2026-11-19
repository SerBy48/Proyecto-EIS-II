import { describe, expect, it } from 'vitest';
import { descuentoVigente, precioFinal, validarProducto } from '../src/gestion';
import { tipoPorContenido } from '../src/imagenes';

const secciones = [{ categoria: 'tecnologia', subcategorias: ['audio', 'accesorios'] }];
const ahora = new Date('2026-11-18T12:00:00-05:00');
const alta = { sku: 'sku-tec-061', nombre: 'Audífonos de prueba', subcategoria: 'audio', precio: 200000 };

describe('gestion del catalogo: validacion del panel (RF-48)', () => {
  it('un alta valida normaliza el SKU, pone marca por defecto y la categoria de la tienda', () => {
    expect(validarProducto(alta, { parcial: false, secciones, ahora })).toMatchObject({
      sku: 'SKU-TEC-061',
      marca: 'Sin marca',
      categoria: 'tecnologia',
      subcategoria: 'audio',
      precio: 200000
    });
  });

  it('rechaza precios fuera de rango, descuentos de mas del 90 % y secciones que no existen', () => {
    const editar = (cuerpo: Record<string, unknown>) => () => validarProducto(cuerpo, { parcial: true, secciones, ahora });
    expect(editar({ precio: -1 })).toThrow(/precio/);
    expect(editar({ precio: 1500.5 })).toThrow(/entero/);
    expect(editar({ descuento_porcentaje: 100 })).toThrow(/descuento/);
    expect(editar({ subcategoria: 'hogar' })).toThrow(/no existe/);
    expect(editar({ activo: 'si' })).toThrow(/true o false/);
    expect(editar({ imagenes: ['https://otro.sitio/x.png'] })).toThrow(/imagenes/);
  });

  it('campos que el panel no puede escribir se ignoran (_id, creado_en)', () => {
    const r = validarProducto({ precio: 5000, _id: 'x', creado_en: 'ayer' }, { parcial: true, secciones, ahora });
    expect(r).toEqual({ precio: 5000 });
  });

  it('la fecha de fin de la oferta debe ser futura; una fecha sola vale hasta el final del dia', () => {
    const r = validarProducto({ descuento_porcentaje: 15, oferta_hasta: '2026-11-30' }, { parcial: true, secciones, ahora });
    expect((r.oferta_hasta as Date).toISOString()).toBe('2026-12-01T04:59:59.000Z');
    expect(() => validarProducto({ oferta_hasta: '2026-11-01' }, { parcial: true, secciones, ahora })).toThrow(/posterior/);
    expect(validarProducto({ oferta_hasta: null }, { parcial: true, secciones, ahora })).toEqual({ oferta_hasta: null });
  });

  it('quitar el descuento quita tambien la fecha de fin', () => {
    expect(validarProducto({ descuento_porcentaje: 0 }, { parcial: true, secciones, ahora })).toEqual({ descuento_porcentaje: 0, oferta_hasta: null });
  });
});

describe('oferta con fecha de fin', () => {
  it('el descuento vale hasta la fecha de fin y luego vuelve el precio de lista', () => {
    const producto = { precio: 100000, descuento_porcentaje: 20, oferta_hasta: new Date('2026-11-20T00:00:00Z') };
    expect(descuentoVigente(producto, new Date('2026-11-19T00:00:00Z'))).toBe(20);
    expect(descuentoVigente(producto, new Date('2026-11-21T00:00:00Z'))).toBe(0);
    expect(descuentoVigente({ ...producto, oferta_hasta: null }, new Date('2030-01-01'))).toBe(20);
    expect(precioFinal(100000, 20)).toBe(80000);
  });
});

describe('subida de imagenes: el tipo se decide por el contenido (V-24)', () => {
  const relleno = Buffer.alloc(16);
  it('reconoce JPEG, PNG y WebP', () => {
    expect(tipoPorContenido(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), relleno]))).toBe('image/jpeg');
    expect(tipoPorContenido(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), relleno]))).toBe('image/png');
    expect(tipoPorContenido(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), relleno]))).toBe('image/webp');
  });

  it('rechaza un HTML o un SVG aunque digan ser imagen', () => {
    expect(tipoPorContenido(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull();
    expect(tipoPorContenido(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'))).toBeNull();
    expect(tipoPorContenido(Buffer.from('GIF89a......'))).toBeNull();
  });
});
