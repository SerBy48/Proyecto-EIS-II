import { describe, expect, it } from 'vitest';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { columnasDelSql } from '../../../tests/unitarias/esquema-sql';
import { auditoriaAccesos, restablecimientosContrasena, tokensRenovacion, usuarios } from '../src/esquema';

const columnasDeDrizzle = (tabla: PgTable) =>
  getTableConfig(tabla).columns.map((c) => ({ nombre: c.name, obligatoria: c.notNull }));

describe('El esquema Drizzle de auth_db refleja infra/postgres/01-auth.sql', () => {
  it.each([
    ['usuarios', usuarios],
    ['tokens_renovacion', tokensRenovacion],
    ['restablecimientos_contrasena', restablecimientosContrasena],
    ['auditoria_accesos', auditoriaAccesos]
  ])('%s: mismas columnas y mismos NOT NULL', (nombre, tabla) => {
    expect(getTableConfig(tabla).name).toBe(nombre);
    const ordenar = (c: { nombre: string }[]) => [...c].sort((a, b) => a.nombre.localeCompare(b.nombre));
    expect(ordenar(columnasDeDrizzle(tabla))).toEqual(ordenar(columnasDelSql('01-auth.sql', nombre)));
  });
});
