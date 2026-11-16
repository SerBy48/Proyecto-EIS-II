import { ClienteServicio, ErrorApp } from '@ecommerce/shared';

/**
 * Adaptadores hacia los servicios de dominio, con timeout y circuit breaker.
 *
 * Catalogo: datos publicos (la disponibilidad ya viene de inventario a traves
 * del catalogo, que degrada sin stock si inventario cae).
 *
 * Pedidos: SIEMPRE con el Authorization del usuario (opcion `autorizacion`),
 * nunca como llamada interna. Asi pedidos-service aplica su RBAC y su
 * autorizacion por dato: el asistente no puede ver un pedido que el usuario no
 * veria por la API (invariantes 1 y 11, docs/adr/0007).
 */

const catalogo = new ClienteServicio({
  nombre: 'catalogo',
  urlBase: process.env.URL_CATALOGO || 'http://localhost:3003',
  timeoutMs: Number(process.env.TIMEOUT_CATALOGO_MS || 2000),
  reintentos: 1
});

const pedidos = new ClienteServicio({
  nombre: 'pedidos',
  urlBase: process.env.URL_PEDIDOS || 'http://localhost:3006',
  timeoutMs: Number(process.env.TIMEOUT_PEDIDOS_MS || 3000),
  reintentos: 1
});

export const metricasAdaptadores = () => ({ circuito_catalogo: catalogo.metricas, circuito_pedidos: pedidos.metricas });

export interface ProductoResumen {
  sku: string;
  nombre: string;
  precio_final: number;
  disponible: number | null;
  hay_stock: boolean | null;
}

export interface PedidoResumen {
  id: number;
  numero: string;
  estado: string;
  total: string;
  creado_en: string;
  cantidad_items?: number;
}

const resumir = (p: ProductoResumen): ProductoResumen => ({
  sku: p.sku,
  nombre: p.nombre,
  precio_final: p.precio_final,
  disponible: p.disponible ?? null,
  hay_stock: p.hay_stock ?? null
});

export const buscarProductos = async (consulta: string, requestId?: string, limite = 3): Promise<ProductoResumen[]> => {
  const parametros = new URLSearchParams({ q: consulta, limite: String(limite) });
  const pagina = await catalogo.pedir<{ productos: ProductoResumen[] }>({ ruta: `/productos?${parametros}`, requestId });
  return pagina.productos.map(resumir);
};

/** Producto por SKU, o null si no existe. */
export const productoPorSku = async (sku: string, requestId?: string): Promise<ProductoResumen | null> => {
  try {
    return resumir(await catalogo.pedir<ProductoResumen>({ ruta: `/productos/${encodeURIComponent(sku)}`, requestId }));
  } catch (error) {
    if (error instanceof ErrorApp && error.estado === 404) return null;
    throw error;
  }
};

export const listarCategorias = (requestId?: string) =>
  catalogo.pedir<Array<{ categoria: string; productos: number }>>({ ruta: '/categorias', requestId });

/** Pedidos del usuario autenticado, con SU token. */
export const pedidosDelUsuario = (autorizacion: string, requestId?: string) =>
  pedidos.pedir<PedidoResumen[]>({ ruta: '/', autorizacion, requestId });

/** Un pedido del usuario, o null si no existe o es de otra persona (pedidos responde 404). */
export const pedidoDelUsuario = async (id: string, autorizacion: string, requestId?: string): Promise<PedidoResumen | null> => {
  try {
    return await pedidos.pedir<PedidoResumen>({ ruta: `/${encodeURIComponent(id)}`, autorizacion, requestId });
  } catch (error) {
    if (error instanceof ErrorApp && (error.estado === 404 || error.estado === 403)) return null;
    throw error;
  }
};

/** ¿El error indica que el servicio no esta disponible (y no una respuesta de negocio)? */
export const esServicioCaido = (error: unknown): boolean =>
  !(error instanceof ErrorApp) || error.estado >= 500;
