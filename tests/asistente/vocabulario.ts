/**
 * Vocabulario del catalogo para medir el motor sin servicios: las subcategorias,
 * sus sinonimos y las marcas se leen de la MISMA semilla que carga MongoDB
 * (infra/mongo/init-mongo.js), ejecutandola contra una base simulada. Asi las
 * pruebas no mantienen una copia que pueda desalinearse con la tienda.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Vocabulario } from '../../services/asistente-service/src/motor';

interface Documento {
  slug?: string;
  sku?: string;
  subcategorias?: Vocabulario['subcategorias'];
  [campo: string]: unknown;
}

export const semillaDelCatalogo = (): { categorias: Documento[]; productos: Documento[] } => {
  const fuente = readFileSync(path.resolve(__dirname, '../../infra/mongo/init-mongo.js'), 'utf8');
  const insertados: Record<string, Documento[]> = {};
  const coleccion = (nombre: string) => ({
    createIndex: () => undefined,
    insertMany: (documentos: Documento[]) => {
      insertados[nombre] = [...(insertados[nombre] ?? []), ...documentos];
    }
  });
  const base = (nombreBase: string) =>
    new Proxy({} as Record<string, unknown>, {
      get: (_objetivo, propiedad: string) =>
        propiedad === 'createUser' || propiedad === 'createCollection' ? () => undefined : coleccion(`${nombreBase}.${propiedad}`)
    });
  const db = { getSiblingDB: base };
  new Function('db', 'print', fuente)(db, () => undefined);
  return { categorias: insertados['catalogo_db.categorias'] ?? [], productos: insertados['catalogo_db.productos'] ?? [] };
};

export const vocabularioDelCatalogo = (): Vocabulario => {
  const { categorias, productos } = semillaDelCatalogo();
  return {
    categorias: categorias.map((c) => String(c.slug)),
    subcategorias: categorias.flatMap((c) => c.subcategorias ?? []),
    marcas: [...new Set(productos.map((p) => String(p.marca)))]
  };
};
