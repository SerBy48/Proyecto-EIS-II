import { bigserial, boolean, integer, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';

/**
 * Esquema de auth_db para Drizzle ORM.
 *
 * REFLEJA infra/postgres/01-auth.sql, que sigue siendo la unica fuente del
 * esquema: aqui no se crean tablas ni se migra (no se usa drizzle-kit push).
 * Si se cambia el SQL, hay que cambiar este archivo (docs/adr/0006).
 *
 * Las propiedades se llaman igual que las columnas (snake_case) para que las
 * filas se serialicen con la misma forma que antes de adoptar el ORM: las
 * respuestas de la API no cambian.
 */

export const usuarios = pgTable('usuarios', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 150 }).notNull(),
  password_hash: varchar('password_hash', { length: 255 }).notNull(),
  rol: varchar('rol', { length: 20, enum: ['cliente', 'vendedor', 'administrador'] }).notNull(),
  cliente_id: integer('cliente_id'),
  activo: boolean('activo').notNull().default(true),
  intentos_fallidos: integer('intentos_fallidos').notNull().default(0),
  bloqueado_hasta: timestamp('bloqueado_hasta', { withTimezone: true }),
  ultimo_acceso: timestamp('ultimo_acceso', { withTimezone: true }),
  creado_en: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow()
});

export const tokensRenovacion = pgTable('tokens_renovacion', {
  id: serial('id').primaryKey(),
  usuario_id: integer('usuario_id')
    .notNull()
    .references(() => usuarios.id, { onDelete: 'cascade' }),
  token_hash: varchar('token_hash', { length: 64 }).notNull(),
  expira_en: timestamp('expira_en', { withTimezone: true }).notNull(),
  revocado_en: timestamp('revocado_en', { withTimezone: true }),
  creado_en: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow()
});

export const auditoriaAccesos = pgTable('auditoria_accesos', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  usuario_id: integer('usuario_id'),
  email: varchar('email', { length: 150 }),
  accion: varchar('accion', { length: 30 }).notNull(),
  exitoso: boolean('exitoso').notNull(),
  ip: varchar('ip', { length: 45 }),
  request_id: varchar('request_id', { length: 64 }),
  creado_en: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow()
});

export type Usuario = typeof usuarios.$inferSelect;
