import { describe, expect, it } from 'vitest';
import { filtroTolerante, palabrasDeBusqueda, patronSinTildes } from '../src/busqueda';
import { semillaDelCatalogo } from '../../../tests/asistente/vocabulario';

describe('busqueda tolerante del catalogo', () => {
  it('normaliza, quita palabras vacias y pasa a singular', () => {
    expect(palabrasDeBusqueda('Los Audífonos de la oficina')).toEqual(['audifono', 'oficina']);
    expect(palabrasDeBusqueda('portat')).toEqual(['portat']);
  });

  it('el patron encuentra la palabra con o sin tildes', () => {
    const regex = new RegExp(patronSinTildes('audifono'), 'i');
    expect(regex.test('Audífonos Sony WH-1000XM5')).toBe(true);
    expect(regex.test('Parlante Bluetooth JBL Flip 6')).toBe(false);
  });

  it('lo que escribe el usuario no llega como expresion regular: los simbolos se descartan', () => {
    const filtro = filtroTolerante('rtx.*(4070|x)+') as { $and: Array<{ $or: Array<{ nombre: { $regex: string } }> }> };
    const patrones = filtro.$and.map((y) => y.$or[0].nombre.$regex);
    expect(patrones).toEqual(['rtx', '4070']);
    expect(filtroTolerante('.* (a|b)')).toBeNull();
    // Y si una palabra trajera un simbolo, se escapa.
    expect(patronSinTildes('a.b')).toBe('[aá]\\.b');
  });

  it('limita la consulta a cinco palabras y sin palabras devuelve null', () => {
    const filtro = filtroTolerante('uno dos tres cuatro cinco seis siete') as { $and: unknown[] };
    expect(filtro.$and).toHaveLength(5);
    expect(filtroTolerante('de la')).toBeNull();
  });
});

describe('semilla del catalogo de SerByTek', () => {
  const { categorias, productos } = semillaDelCatalogo();

  it('60 productos de tecnologia, SKU unicos, todos en una subcategoria definida', () => {
    const subcategorias = new Set(categorias.flatMap((c) => (c.subcategorias ?? []).map((s) => s.slug)));
    expect(productos).toHaveLength(60);
    expect(new Set(productos.map((p) => p.sku)).size).toBe(60);
    expect(productos.every((p) => p.categoria === 'tecnologia' && subcategorias.has(String(p.subcategoria)))).toBe(true);
  });

  it('cada producto tiene su foto en la web (clients/web/public)', async () => {
    const { existsSync } = await import('node:fs');
    const path = await import('node:path');
    const faltan = productos.filter((p) => {
      const url = (p.imagenes as string[] | undefined)?.[0];
      return !url || !existsSync(path.resolve(__dirname, '../../../clients/web/public', `.${url}`));
    });
    expect(faltan.map((p) => p.sku)).toEqual([]);
  });

  it('cada producto tiene stock en la semilla de inventario y viceversa', async () => {
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const sql = readFileSync(path.resolve(__dirname, '../../../infra/postgres/06-datos-prueba.sql'), 'utf8');
    const conStock = new Set([...sql.matchAll(/\('(SKU-[A-Z]+-\d{3})', \d+,/g)].map((m) => m[1]));
    expect([...conStock].sort()).toEqual(productos.map((p) => String(p.sku)).sort());
  });
});
