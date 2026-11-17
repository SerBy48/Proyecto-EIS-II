import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from './db';
import { clientes, direcciones, historialCompras } from './esquema';

/**
 * Repositorio de clientes_db (patron Repository, docs/adr/0006).
 *
 * El controlador decide la autorizacion y las reglas; este modulo solo lee y
 * escribe. Drizzle envia todas las consultas parametrizadas (invariante 8).
 */

/** Campos del perfil que el propio cliente puede cambiar. */
export const CAMPOS_EDITABLES = ['nombre', 'apellido', 'telefono', 'documento', 'tipo_documento'] as const;
export type CampoEditable = (typeof CAMPOS_EDITABLES)[number];

export const crearCliente = async (datos: {
  nombre: string;
  apellido: string;
  email: string;
  telefono?: string | null;
  documento?: string | null;
  tipo_documento?: 'CC' | 'CE' | 'NIT' | 'PAS' | null;
}) => {
  const [cliente] = await db
    .insert(clientes)
    .values({
      nombre: datos.nombre,
      apellido: datos.apellido,
      email: datos.email,
      telefono: datos.telefono ?? null,
      documento: datos.documento ?? null,
      tipo_documento: datos.tipo_documento ?? 'CC'
    })
    .returning({
      id: clientes.id,
      nombre: clientes.nombre,
      apellido: clientes.apellido,
      email: clientes.email,
      telefono: clientes.telefono,
      documento: clientes.documento,
      activo: clientes.activo,
      creado_en: clientes.creado_en
    });
  return cliente;
};

export const obtenerCliente = async (id: number) => {
  const [cliente] = await db
    .select({
      id: clientes.id,
      nombre: clientes.nombre,
      apellido: clientes.apellido,
      email: clientes.email,
      telefono: clientes.telefono,
      documento: clientes.documento,
      tipo_documento: clientes.tipo_documento,
      activo: clientes.activo,
      creado_en: clientes.creado_en
    })
    .from(clientes)
    .where(eq(clientes.id, id));
  return cliente ?? null;
};

export const existeCliente = async (id: number): Promise<boolean> => {
  const filas = await db.select({ id: clientes.id }).from(clientes).where(eq(clientes.id, id));
  return filas.length > 0;
};

export interface CambiosCliente {
  nombre?: string;
  apellido?: string;
  telefono?: string | null;
  documento?: string | null;
  tipo_documento?: 'CC' | 'CE' | 'NIT' | 'PAS';
}

export const actualizarCliente = async (id: number, cambios: CambiosCliente) => {
  const [cliente] = await db
    .update(clientes)
    .set({ ...cambios, actualizado_en: sql`NOW()` })
    .where(eq(clientes.id, id))
    .returning({
      id: clientes.id,
      nombre: clientes.nombre,
      apellido: clientes.apellido,
      email: clientes.email,
      telefono: clientes.telefono,
      activo: clientes.activo
    });
  return cliente ?? null;
};

/** Columnas de una direccion que ven el cliente y el orquestador. */
const columnasDireccion = {
  id: direcciones.id,
  tipo: direcciones.tipo,
  etiqueta: direcciones.etiqueta,
  linea1: direcciones.linea1,
  linea2: direcciones.linea2,
  ciudad: direcciones.ciudad,
  departamento: direcciones.departamento,
  pais: direcciones.pais,
  codigo_postal: direcciones.codigo_postal,
  predeterminada: direcciones.predeterminada
};

export const listarDirecciones = (clienteId: number) =>
  db
    .select(columnasDireccion)
    .from(direcciones)
    .where(eq(direcciones.cliente_id, clienteId))
    .orderBy(desc(direcciones.predeterminada), direcciones.id);

/**
 * Agrega una direccion. Si es predeterminada, primero quita la marca a la
 * anterior del mismo tipo: el indice unico parcial no admite dos. Las dos
 * escrituras van en una transaccion; antes eran sentencias sueltas y un fallo
 * del INSERT dejaba al cliente sin direccion predeterminada.
 */
export const crearDireccion = (
  clienteId: number,
  datos: {
    tipo?: 'envio' | 'facturacion' | null;
    etiqueta?: string | null;
    linea1: string;
    linea2?: string | null;
    ciudad: string;
    departamento?: string | null;
    pais?: string | null;
    codigo_postal?: string | null;
    predeterminada?: boolean | null;
  }
) =>
  db.transaction(async (tx) => {
    const tipo = datos.tipo ?? 'envio';
    if (datos.predeterminada) {
      await tx
        .update(direcciones)
        .set({ predeterminada: false })
        .where(and(eq(direcciones.cliente_id, clienteId), eq(direcciones.tipo, tipo)));
    }
    const [direccion] = await tx
      .insert(direcciones)
      .values({
        cliente_id: clienteId,
        tipo,
        etiqueta: datos.etiqueta ?? null,
        linea1: datos.linea1,
        linea2: datos.linea2 ?? null,
        ciudad: datos.ciudad,
        departamento: datos.departamento ?? null,
        pais: datos.pais ?? 'Colombia',
        codigo_postal: datos.codigo_postal ?? null,
        predeterminada: datos.predeterminada ?? false
      })
      .returning();
    return direccion;
  });

/** Datos que el orquestador de pedidos necesita para validar la compra. */
export const datosParaCompra = async (clienteId: number) => {
  const [cliente] = await db
    .select({
      id: clientes.id,
      nombre: clientes.nombre,
      apellido: clientes.apellido,
      email: clientes.email,
      telefono: clientes.telefono,
      activo: clientes.activo
    })
    .from(clientes)
    .where(eq(clientes.id, clienteId));
  return cliente ?? null;
};

/** Direccion de envio: la indicada, o la predeterminada, o la mas antigua. */
export const direccionDeEnvio = async (clienteId: number, direccionId?: number) => {
  const [direccion] = await db
    .select({
      id: direcciones.id,
      tipo: direcciones.tipo,
      linea1: direcciones.linea1,
      linea2: direcciones.linea2,
      ciudad: direcciones.ciudad,
      departamento: direcciones.departamento,
      pais: direcciones.pais,
      codigo_postal: direcciones.codigo_postal,
      predeterminada: direcciones.predeterminada
    })
    .from(direcciones)
    .where(
      and(
        eq(direcciones.cliente_id, clienteId),
        eq(direcciones.tipo, 'envio'),
        direccionId === undefined ? undefined : eq(direcciones.id, direccionId)
      )
    )
    .orderBy(desc(direcciones.predeterminada), direcciones.id)
    .limit(1);
  return direccion ?? null;
};

export const historialDeCompras = (clienteId: number) =>
  db
    .select({
      pedido_id: historialCompras.pedido_id,
      numero_pedido: historialCompras.numero_pedido,
      total: historialCompras.total,
      estado: historialCompras.estado,
      items: historialCompras.items,
      fecha: historialCompras.fecha
    })
    .from(historialCompras)
    .where(eq(historialCompras.cliente_id, clienteId))
    .orderBy(desc(historialCompras.fecha))
    .limit(50);

/**
 * Proyecta un evento de pedido en el historial. Es idempotente: si el evento
 * llega dos veces (entrega "al menos una vez"), solo se actualiza el estado.
 */
export const proyectarPedido = async (datos: {
  cliente_id: number;
  pedido_id: number;
  numero: string;
  total: number;
  estado: string;
  items: number;
}): Promise<void> => {
  await db
    .insert(historialCompras)
    .values({
      cliente_id: datos.cliente_id,
      pedido_id: datos.pedido_id,
      numero_pedido: datos.numero,
      total: String(datos.total),
      estado: datos.estado,
      items: datos.items
    })
    .onConflictDoUpdate({ target: historialCompras.pedido_id, set: { estado: sql`EXCLUDED.estado` } });
};

/** Campos de una direccion que se pueden cambiar. */
export const CAMPOS_DIRECCION = ['etiqueta', 'linea1', 'linea2', 'ciudad', 'departamento', 'codigo_postal'] as const;
export type CampoDireccion = (typeof CAMPOS_DIRECCION)[number];
export interface CambiosDireccion {
  etiqueta?: string | null;
  linea1?: string;
  linea2?: string | null;
  ciudad?: string;
  departamento?: string | null;
  codigo_postal?: string | null;
}

/**
 * Actualiza una direccion del cliente. Si se marca como predeterminada, la
 * anterior del mismo tipo deja de serlo en la misma transaccion (el indice
 * unico parcial no admite dos). Devuelve null si la direccion no es suya.
 */
export const actualizarDireccion = (
  clienteId: number,
  direccionId: number,
  cambios: CambiosDireccion,
  predeterminada?: boolean
) =>
  db.transaction(async (tx) => {
    const [actual] = await tx
      .select({ id: direcciones.id, tipo: direcciones.tipo })
      .from(direcciones)
      .where(and(eq(direcciones.id, direccionId), eq(direcciones.cliente_id, clienteId)));
    if (!actual) return null;
    if (predeterminada) {
      await tx
        .update(direcciones)
        .set({ predeterminada: false })
        .where(and(eq(direcciones.cliente_id, clienteId), eq(direcciones.tipo, actual.tipo)));
    }
    const [direccion] = await tx
      .update(direcciones)
      .set({ ...cambios, ...(predeterminada !== undefined ? { predeterminada } : {}) })
      .where(eq(direcciones.id, direccionId))
      .returning(columnasDireccion);
    return direccion;
  });

/**
 * Elimina una direccion del cliente. Si era la predeterminada, la mas antigua
 * que quede del mismo tipo pasa a serlo: el cliente no se queda sin direccion
 * predeterminada mientras tenga alguna. Devuelve false si no es suya.
 */
export const eliminarDireccion = (clienteId: number, direccionId: number) =>
  db.transaction(async (tx) => {
    const [borrada] = await tx
      .delete(direcciones)
      .where(and(eq(direcciones.id, direccionId), eq(direcciones.cliente_id, clienteId)))
      .returning({ tipo: direcciones.tipo, predeterminada: direcciones.predeterminada });
    if (!borrada) return false;
    if (borrada.predeterminada) {
      const [siguiente] = await tx
        .select({ id: direcciones.id })
        .from(direcciones)
        .where(and(eq(direcciones.cliente_id, clienteId), eq(direcciones.tipo, borrada.tipo)))
        .orderBy(direcciones.id)
        .limit(1);
      if (siguiente) await tx.update(direcciones).set({ predeterminada: true }).where(eq(direcciones.id, siguiente.id));
    }
    return true;
  });

/**
 * Anonimiza el perfil de un cliente que elimino su cuenta: borra sus
 * direcciones, reemplaza sus datos personales y lo desactiva (pedidos ya no lo
 * acepta en el checkout). Es idempotente. El historial de compras se conserva:
 * solo tiene numeros de pedido y totales.
 */
export const anonimizarCliente = (clienteId: number) =>
  db.transaction(async (tx) => {
    await tx.delete(direcciones).where(eq(direcciones.cliente_id, clienteId));
    const [cliente] = await tx
      .update(clientes)
      .set({
        nombre: 'Cliente',
        apellido: 'eliminado',
        email: `eliminado-${clienteId}@cuenta-eliminada.invalid`,
        telefono: null,
        documento: null,
        activo: false,
        actualizado_en: sql`NOW()`
      })
      .where(eq(clientes.id, clienteId))
      .returning({ id: clientes.id });
    return cliente ?? null;
  });
