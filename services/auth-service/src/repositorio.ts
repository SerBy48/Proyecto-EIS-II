import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { Rol } from '@ecommerce/shared';
import { db } from './db';
import { auditoriaAccesos, tokensRenovacion, usuarios } from './esquema';

/**
 * Repositorio de auth_db (patron Repository, docs/adr/0006).
 *
 * Es el unico modulo que conoce la base de datos: el controlador trabaja con
 * funciones de negocio y no con SQL. Las consultas las construye Drizzle, que
 * siempre las envia parametrizadas (invariante 8).
 *
 * Los errores del driver llegan envueltos en un DrizzleQueryError; quien
 * necesite el codigo de PostgreSQL usa errorDePostgres() de la libreria
 * compartida.
 */

/** Vigencia del refresh token. */
const VIGENCIA_RENOVACION = sql`NOW() + INTERVAL '7 days'`;

/** Columnas que se devuelven al crear un usuario (sin el hash). */
const usuarioPublico = {
  id: usuarios.id,
  email: usuarios.email,
  rol: usuarios.rol,
  activo: usuarios.activo
};

export const buscarUsuarioPorCorreo = async (correo: string) => {
  const [usuario] = await db
    .select({
      id: usuarios.id,
      email: usuarios.email,
      password_hash: usuarios.password_hash,
      rol: usuarios.rol,
      cliente_id: usuarios.cliente_id,
      activo: usuarios.activo,
      intentos_fallidos: usuarios.intentos_fallidos,
      bloqueado_hasta: usuarios.bloqueado_hasta
    })
    .from(usuarios)
    .where(eq(usuarios.email, correo));
  return usuario ?? null;
};

export const clienteTieneCuenta = async (clienteId: number): Promise<boolean> => {
  const filas = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(eq(usuarios.cliente_id, clienteId))
    .limit(1);
  return filas.length > 0;
};

/**
 * Alta de una cuenta de cliente (registro publico). El indice unico
 * uq_usuarios_cliente cierra la carrera entre dos registros simultaneos.
 */
export const crearCuentaCliente = async (email: string, passwordHash: string, clienteId: number | null) => {
  const [usuario] = await db
    .insert(usuarios)
    .values({ email, password_hash: passwordHash, rol: 'cliente', cliente_id: clienteId })
    .returning({ ...usuarioPublico, cliente_id: usuarios.cliente_id });
  return usuario;
};

/** Alta de un usuario interno (vendedor o administrador), sin cliente asociado. */
export const crearUsuarioInterno = async (email: string, passwordHash: string, rol: Rol) => {
  const [usuario] = await db
    .insert(usuarios)
    .values({ email, password_hash: passwordHash, rol })
    .returning(usuarioPublico);
  return usuario;
};

/**
 * Cuenta un intento fallido. Al llegar al maximo, bloquea la cuenta durante
 * `minutosBloqueo` y reinicia el contador.
 */
export const registrarIntentoFallido = async (
  usuarioId: number,
  intentos: number,
  bloquear: boolean,
  minutosBloqueo: number
): Promise<void> => {
  await db
    .update(usuarios)
    .set({
      intentos_fallidos: bloquear ? 0 : intentos,
      ...(bloquear ? { bloqueado_hasta: sql`NOW() + make_interval(mins => ${minutosBloqueo})` } : {})
    })
    .where(eq(usuarios.id, usuarioId));
};

export const registrarAccesoExitoso = async (usuarioId: number): Promise<void> => {
  await db
    .update(usuarios)
    .set({ intentos_fallidos: 0, bloqueado_hasta: null, ultimo_acceso: sql`NOW()` })
    .where(eq(usuarios.id, usuarioId));
};

export const guardarTokenRenovacion = async (usuarioId: number, tokenHash: string): Promise<void> => {
  await db.insert(tokensRenovacion).values({
    usuario_id: usuarioId,
    token_hash: tokenHash,
    expira_en: VIGENCIA_RENOVACION
  });
};

/** Token de renovacion vigente (no revocado ni vencido) junto con su usuario. */
export const buscarTokenVigente = async (tokenHash: string, usuarioId: number) => {
  const [fila] = await db
    .select({
      id: tokensRenovacion.id,
      usuario_id: usuarios.id,
      email: usuarios.email,
      rol: usuarios.rol,
      cliente_id: usuarios.cliente_id,
      activo: usuarios.activo
    })
    .from(tokensRenovacion)
    .innerJoin(usuarios, eq(usuarios.id, tokensRenovacion.usuario_id))
    .where(
      and(
        eq(tokensRenovacion.token_hash, tokenHash),
        eq(tokensRenovacion.usuario_id, usuarioId),
        isNull(tokensRenovacion.revocado_en),
        gt(tokensRenovacion.expira_en, sql`NOW()`)
      )
    );
  return fila ?? null;
};

/**
 * Rotacion: revoca el token usado y guarda el nuevo en una sola transaccion.
 * Antes eran dos sentencias sueltas; si la segunda fallaba, el usuario se
 * quedaba sin ningun refresh valido.
 */
export const rotarTokenRenovacion = async (
  tokenId: number,
  usuarioId: number,
  nuevoHash: string
): Promise<void> => {
  await db.transaction(async (tx) => {
    await tx
      .update(tokensRenovacion)
      .set({ revocado_en: sql`NOW()` })
      .where(eq(tokensRenovacion.id, tokenId));
    await tx.insert(tokensRenovacion).values({
      usuario_id: usuarioId,
      token_hash: nuevoHash,
      expira_en: VIGENCIA_RENOVACION
    });
  });
};

/** Revoca todos los refresh tokens vigentes del usuario; devuelve cuantos. */
export const revocarTokensDelUsuario = async (usuarioId: number): Promise<number> => {
  const revocados = await db
    .update(tokensRenovacion)
    .set({ revocado_en: sql`NOW()` })
    .where(and(eq(tokensRenovacion.usuario_id, usuarioId), isNull(tokensRenovacion.revocado_en)))
    .returning({ id: tokensRenovacion.id });
  return revocados.length;
};

export const obtenerPerfil = async (usuarioId: number) => {
  const [usuario] = await db
    .select({
      id: usuarios.id,
      email: usuarios.email,
      rol: usuarios.rol,
      cliente_id: usuarios.cliente_id,
      activo: usuarios.activo,
      ultimo_acceso: usuarios.ultimo_acceso,
      creado_en: usuarios.creado_en
    })
    .from(usuarios)
    .where(eq(usuarios.id, usuarioId));
  return usuario ?? null;
};

/** Registro de auditoria. Nunca debe tumbar la operacion que audita. */
export const auditar = async (datos: {
  usuario_id?: number | null;
  email?: string;
  accion: string;
  exitoso: boolean;
  ip?: string;
  request_id?: string;
}): Promise<void> => {
  await db
    .insert(auditoriaAccesos)
    .values({
      usuario_id: datos.usuario_id ?? null,
      email: datos.email ?? null,
      accion: datos.accion,
      exitoso: datos.exitoso,
      ip: datos.ip ?? null,
      request_id: datos.request_id ?? null
    })
    .catch(() => undefined);
};

// ------------------------------------------------- administracion de usuarios

const columnasAdministracion = {
  id: usuarios.id,
  email: usuarios.email,
  rol: usuarios.rol,
  activo: usuarios.activo,
  cliente_id: usuarios.cliente_id,
  ultimo_acceso: usuarios.ultimo_acceso,
  creado_en: usuarios.creado_en
};

/** Usuarios, opcionalmente de un rol, del mas reciente al mas antiguo. */
export const listarUsuarios = (rol?: Rol) =>
  db
    .select(columnasAdministracion)
    .from(usuarios)
    .where(rol ? eq(usuarios.rol, rol) : undefined)
    .orderBy(sql`${usuarios.creado_en} DESC`)
    .limit(200);

export const obtenerUsuario = async (id: number) => {
  const [usuario] = await db
    .select({ ...columnasAdministracion, password_hash: usuarios.password_hash })
    .from(usuarios)
    .where(eq(usuarios.id, id));
  return usuario ?? null;
};

export const actualizarUsuario = async (id: number, cambios: { rol?: Rol; activo?: boolean }) => {
  const [usuario] = await db.update(usuarios).set(cambios).where(eq(usuarios.id, id)).returning(columnasAdministracion);
  return usuario ?? null;
};

/**
 * Anonimiza una cuenta eliminada: el correo deja de identificar a la persona
 * (y queda libre para registrarse de nuevo), la contrasena se reemplaza por el
 * hash de un valor aleatorio que nadie conoce y la cuenta queda inactiva. La
 * fila se conserva porque la auditoria y los pedidos la referencian por id.
 */
export const anonimizarUsuario = async (id: number, hashAleatorio: string) => {
  const [usuario] = await db
    .update(usuarios)
    .set({ email: `eliminado-${id}@cuenta-eliminada.invalid`, password_hash: hashAleatorio, activo: false })
    .where(eq(usuarios.id, id))
    .returning({ id: usuarios.id });
  return usuario ?? null;
};
