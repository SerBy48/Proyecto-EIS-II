import { bigserial, boolean, integer, numeric, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';

/**
 * Esquema de clientes_db para Drizzle ORM.
 *
 * REFLEJA infra/postgres/02-clientes.sql, que sigue siendo la unica fuente del
 * esquema (no se usa drizzle-kit push). Si cambia el SQL, cambia este archivo
 * (docs/adr/0006). Las propiedades se llaman como las columnas para que las
 * respuestas de la API conserven su forma.
 */

export const clientes = pgTable('clientes', {
  id: serial('id').primaryKey(),
  nombre: varchar('nombre', { length: 100 }).notNull(),
  apellido: varchar('apellido', { length: 100 }).notNull(),
  email: varchar('email', { length: 150 }).notNull(),
  telefono: varchar('telefono', { length: 30 }),
  documento: varchar('documento', { length: 30 }),
  tipo_documento: varchar('tipo_documento', { length: 10, enum: ['CC', 'CE', 'NIT', 'PAS'] }).default('CC'),
  activo: boolean('activo').notNull().default(true),
  creado_en: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow()
});

export const direcciones = pgTable('direcciones', {
  id: serial('id').primaryKey(),
  cliente_id: integer('cliente_id')
    .notNull()
    .references(() => clientes.id, { onDelete: 'cascade' }),
  tipo: varchar('tipo', { length: 15, enum: ['envio', 'facturacion'] }).notNull().default('envio'),
  etiqueta: varchar('etiqueta', { length: 50 }),
  linea1: varchar('linea1', { length: 200 }).notNull(),
  linea2: varchar('linea2', { length: 200 }),
  ciudad: varchar('ciudad', { length: 100 }).notNull(),
  departamento: varchar('departamento', { length: 100 }),
  pais: varchar('pais', { length: 60 }).notNull().default('Colombia'),
  codigo_postal: varchar('codigo_postal', { length: 20 }),
  predeterminada: boolean('predeterminada').notNull().default(false),
  creado_en: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow()
});

/** Proyeccion del historial de compras, alimentada por eventos de pedidos. */
export const historialCompras = pgTable('historial_compras', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  cliente_id: integer('cliente_id')
    .notNull()
    .references(() => clientes.id, { onDelete: 'cascade' }),
  pedido_id: integer('pedido_id').notNull().unique(),
  numero_pedido: varchar('numero_pedido', { length: 30 }).notNull(),
  // NUMERIC llega como texto, igual que con el driver pg directo.
  total: numeric('total', { precision: 12, scale: 2 }).notNull(),
  estado: varchar('estado', { length: 20 }).notNull(),
  items: integer('items').notNull().default(0),
  fecha: timestamp('fecha', { withTimezone: true }).notNull().defaultNow()
});
