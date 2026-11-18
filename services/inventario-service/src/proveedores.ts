import { Response } from 'express';
import { PeticionAutenticada, errorConflicto, errorNoEncontrado, errorSolicitud } from '@ecommerce/shared';
import { pool } from './db';

/**
 * Proveedores y soporte de las entradas de mercancia (RF-51).
 * Inventario sigue siendo el unico que escribe el stock (invariante 3): el
 * proveedor es un dato de la entrada, no otro camino para cambiar cantidades.
 */

const PATRON_NIT = /^\d{6,12}(-\d)?$/;
const PATRON_TELEFONO = /^\+?\d{7,15}$/;
const PATRON_CORREO = /^[^\s@]{1,64}@[^\s@]{1,120}\.[^\s@]{2,}$/;

const textoOpcional = (valor: unknown, campo: string, maximo: number): string | undefined => {
  if (valor === undefined || valor === null || valor === '') return undefined;
  if (typeof valor !== 'string') throw errorSolicitud(`El campo ${campo} debe ser texto.`);
  const limpio = valor.trim();
  if (limpio.length > maximo) throw errorSolicitud(`El campo ${campo} admite maximo ${maximo} caracteres.`);
  return limpio || undefined;
};

export interface DatosEntrada {
  cantidad: number;
  bodega_id?: number;
  proveedor_id?: number;
  costo_unitario?: number;
  documento?: string;
  observacion?: string;
}

/** Valida el cuerpo de POST /stock/:sku/entrada. Solo la cantidad es obligatoria. */
export const validarEntrada = (cuerpo: unknown): DatosEntrada => {
  const c = (cuerpo ?? {}) as Record<string, unknown>;
  if (!Number.isInteger(c.cantidad) || (c.cantidad as number) <= 0 || (c.cantidad as number) > 100_000) {
    throw errorSolicitud('La cantidad debe ser un entero positivo (maximo 100.000 por entrada).');
  }
  const datos: DatosEntrada = { cantidad: c.cantidad as number };
  for (const campo of ['bodega_id', 'proveedor_id'] as const) {
    if (c[campo] === undefined || c[campo] === null || c[campo] === '') continue;
    if (!Number.isInteger(c[campo]) || (c[campo] as number) <= 0) {
      throw errorSolicitud(campo === 'bodega_id' ? 'La bodega debe ser un identificador entero.' : 'El proveedor debe ser un identificador entero.');
    }
    datos[campo] = c[campo] as number;
  }
  if (c.costo_unitario !== undefined && c.costo_unitario !== null && c.costo_unitario !== '') {
    if (!Number.isInteger(c.costo_unitario) || (c.costo_unitario as number) < 0 || (c.costo_unitario as number) > 100_000_000) {
      throw errorSolicitud('El costo unitario debe ser un entero en pesos, entre 0 y 100.000.000.');
    }
    datos.costo_unitario = c.costo_unitario as number;
  }
  datos.documento = textoOpcional(c.documento, 'documento (factura o remision)', 40);
  datos.observacion = textoOpcional(c.observacion, 'observacion', 300);
  return datos;
};

export interface DatosProveedor {
  nombre?: string;
  nit?: string;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  activo?: boolean;
}

export const validarProveedor = (cuerpo: unknown, parcial: boolean): DatosProveedor => {
  const c = (cuerpo ?? {}) as Record<string, unknown>;
  const datos: DatosProveedor = {};
  if (!parcial || c.nombre !== undefined) {
    const nombre = textoOpcional(c.nombre, 'nombre', 120);
    if (!nombre || nombre.length < 3) throw errorSolicitud('El nombre del proveedor debe tener al menos 3 caracteres.');
    datos.nombre = nombre;
  }
  if (!parcial || c.nit !== undefined) {
    const nit = textoOpcional(c.nit, 'NIT', 20)?.replace(/[.\s]/g, '');
    if (!nit || !PATRON_NIT.test(nit)) throw errorSolicitud('El NIT debe tener de 6 a 12 digitos y, opcional, el digito de verificacion (900123456-1).');
    datos.nit = nit;
  }
  if (c.contacto !== undefined) datos.contacto = textoOpcional(c.contacto, 'contacto', 120) ?? null;
  if (c.telefono !== undefined) {
    const telefono = textoOpcional(c.telefono, 'telefono', 20)?.replace(/[\s()-]/g, '');
    if (telefono && !PATRON_TELEFONO.test(telefono)) throw errorSolicitud('El telefono debe tener de 7 a 15 digitos.');
    datos.telefono = telefono ?? null;
  }
  if (c.email !== undefined) {
    const email = textoOpcional(c.email, 'correo', 160)?.toLowerCase();
    if (email && !PATRON_CORREO.test(email)) throw errorSolicitud('El correo del proveedor no es valido.');
    datos.email = email ?? null;
  }
  if (c.activo !== undefined) {
    if (typeof c.activo !== 'boolean') throw errorSolicitud('El campo activo debe ser true o false.');
    datos.activo = c.activo;
  }
  return datos;
};

const COLUMNAS = 'id, nombre, nit, contacto, telefono, email, activo, creado_en';

/** GET /proveedores?todos=true - por defecto solo los activos. */
export const listarProveedores = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const todos = req.query.todos === 'true';
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS} FROM proveedores ${todos ? '' : 'WHERE activo'} ORDER BY nombre LIMIT 200`
  );
  res.status(200).json(rows);
};

const traducirDuplicado = (error: unknown): never => {
  if ((error as { code?: string }).code === '23505') throw errorConflicto('Ya existe un proveedor con ese NIT.');
  throw error;
};

/** POST /proveedores */
export const crearProveedor = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const d = validarProveedor(req.body, false);
  const { rows } = await pool
    .query(
      `INSERT INTO proveedores (nombre, nit, contacto, telefono, email) VALUES ($1, $2, $3, $4, $5) RETURNING ${COLUMNAS}`,
      [d.nombre, d.nit, d.contacto ?? null, d.telefono ?? null, d.email ?? null]
    )
    .catch(traducirDuplicado);
  res.status(201).json(rows[0]);
};

/** PATCH /proveedores/:id - editar datos o desactivar (no se borra: tiene entradas). */
export const actualizarProveedor = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  if (!/^\d+$/.test(String(req.params.id))) throw errorNoEncontrado('Proveedor no encontrado.');
  const d = validarProveedor(req.body, true);
  const campos = Object.keys(d) as Array<keyof DatosProveedor>;
  if (!campos.length) throw errorSolicitud('Indique al menos uno de: nombre, nit, contacto, telefono, email, activo.');
  // Los nombres de columna salen de una lista fija; los valores van parametrizados (invariante 8).
  const asignaciones = campos.map((c, i) => `${c} = $${i + 2}`).join(', ');
  const { rows } = await pool
    .query(`UPDATE proveedores SET ${asignaciones} WHERE id = $1 RETURNING ${COLUMNAS}`, [Number(req.params.id), ...campos.map((c) => d[c])])
    .catch(traducirDuplicado);
  if (!rows[0]) throw errorNoEncontrado('Proveedor no encontrado.');
  res.status(200).json(rows[0]);
};

/** GET /entradas?sku=&proveedor_id= - las ultimas 100 entradas con su proveedor. */
export const listarEntradas = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const sku = typeof req.query.sku === 'string' && req.query.sku ? req.query.sku : null;
  const proveedor = typeof req.query.proveedor_id === 'string' && /^\d+$/.test(req.query.proveedor_id) ? Number(req.query.proveedor_id) : null;
  const { rows } = await pool.query(
    `SELECT e.id, e.sku, b.codigo AS bodega, e.cantidad, e.costo_unitario, e.documento, e.observacion,
            e.registrado_por, e.creado_en, p.id AS proveedor_id, p.nombre AS proveedor, p.contacto AS proveedor_contacto
       FROM entradas e
       JOIN bodegas b ON b.id = e.bodega_id
       LEFT JOIN proveedores p ON p.id = e.proveedor_id
      WHERE ($1::VARCHAR IS NULL OR e.sku = $1) AND ($2::INT IS NULL OR e.proveedor_id = $2)
      ORDER BY e.creado_en DESC, e.id DESC
      LIMIT 100`,
    [sku, proveedor]
  );
  res.status(200).json(rows.map((r) => ({ ...r, costo_unitario: r.costo_unitario === null ? null : Number(r.costo_unitario) })));
};
