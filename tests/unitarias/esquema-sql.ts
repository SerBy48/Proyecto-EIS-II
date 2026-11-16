import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Columnas de un CREATE TABLE de infra/postgres, para compararlas con el
 * esquema de Drizzle en las pruebas de cada servicio.
 *
 * El SQL es la unica fuente del esquema y Drizzle lo refleja a mano
 * (docs/adr/0006). Esta comparacion detecta la deriva: una columna agregada en
 * el SQL y olvidada en esquema.ts, o un NOT NULL distinto.
 */
export interface ColumnaSql {
  nombre: string;
  obligatoria: boolean;
}

export const columnasDelSql = (archivo: string, tabla: string): ColumnaSql[] => {
  const sql = readFileSync(path.resolve(__dirname, '../../infra/postgres', archivo), 'utf8');
  const bloque = sql.match(new RegExp(`CREATE TABLE ${tabla} \\(([\\s\\S]*?)\\n\\);`))?.[1];
  if (!bloque) throw new Error(`No se encontro CREATE TABLE ${tabla} en ${archivo}`);
  return bloque
    .split('\n')
    .map((linea) => linea.replace(/--.*$/, '').trim())
    // "nombre TIPO ...": descarta CHECK, UNIQUE y comentarios. El nombre admite
    // digitos (linea1, linea2).
    .filter((linea) => /^[a-z_][a-z0-9_]*\s+[A-Z]/.test(linea))
    .map((linea) => ({
      nombre: linea.split(/\s+/)[0],
      obligatoria: /NOT NULL|PRIMARY KEY/.test(linea)
    }));
};
