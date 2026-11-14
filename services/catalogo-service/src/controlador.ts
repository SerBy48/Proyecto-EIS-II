import { Response } from 'express';
import {
  ClienteServicio,
  PeticionAutenticada,
  crearLogger,
  errorConflicto,
  errorNoEncontrado,
  errorSolicitud,
  exigirCampos
} from '@ecommerce/shared';
import { coleccionProductos, coleccionPromociones } from './db';

const log = crearLogger('catalogo-service');

/**
 * Cliente hacia el servicio de inventario.
 *
 * Esta es la conexion "Catalogo -> Inventario" de la tabla de asignacion del
 * documento: SINCRONA, porque la disponibilidad que se muestra al cliente debe
 * ser la real. Mostrar "disponible" sobre un producto agotado es exactamente
 * el problema de sobreventa que la arquitectura busca eliminar.
 *
 * Aun asi la llamada esta protegida con circuit breaker y con una alternativa:
 * si inventario no responde, el catalogo sigue mostrando los productos pero
 * marca la disponibilidad como desconocida. Eso es degradacion elegante: es
 * mejor un catalogo sin el indicador de stock que un catalogo caido.
 */
const inventario = new ClienteServicio({
  nombre: 'inventario',
  urlBase: process.env.URL_INVENTARIO || 'http://localhost:3004',
  timeoutMs: Number(process.env.HTTP_TIMEOUT_MS || 2000)
});

export const metricasInventario = () => ({ circuito_inventario: inventario.metricas });

interface Disponibilidad {
  sku: string;
  disponible: number;
  hay_stock: boolean;
}

const consultarDisponibilidad = async (
  skus: string[],
  requestId?: string
): Promise<Map<string, Disponibilidad | null>> => {
  const mapa = new Map<string, Disponibilidad | null>();
  if (!skus.length) return mapa;

  try {
    const datos = await inventario.pedir<Disponibilidad[]>({
      ruta: `/disponibilidad?skus=${encodeURIComponent(skus.join(','))}`,
      requestId,
      // Degradacion elegante si el circuito esta abierto.
      alternativa: () => []
    });
    for (const d of datos) mapa.set(d.sku, d);
  } catch (error) {
    log.con({ request_id: requestId }).warn('Inventario no disponible, el catalogo responde sin stock', {
      error: error instanceof Error ? error.message : error
    });
  }

  for (const sku of skus) if (!mapa.has(sku)) mapa.set(sku, null);
  return mapa;
};

/** Calcula el precio final aplicando el descuento vigente del producto. */
const precioFinal = (precio: number, descuento = 0): number =>
  Math.round(precio * (1 - descuento / 100));

const proyectar = (producto: Record<string, unknown>, disp: Disponibilidad | null) => ({
  sku: producto.sku,
  nombre: producto.nombre,
  descripcion: producto.descripcion,
  categoria: producto.categoria,
  marca: producto.marca,
  precio: producto.precio,
  descuento_porcentaje: producto.descuento_porcentaje ?? 0,
  precio_final: precioFinal(Number(producto.precio), Number(producto.descuento_porcentaje ?? 0)),
  imagenes: producto.imagenes ?? [],
  atributos: producto.atributos ?? {},
  // null significa "no se pudo consultar", que es distinto de "agotado".
  disponible: disp ? disp.disponible : null,
  hay_stock: disp ? disp.hay_stock : null
});

/**
 * GET /productos
 * Busqueda y filtrado por categoria, marca, precio y texto (seccion 5.5).
 */
export const listarProductos = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const {
    q,
    categoria,
    marca,
    precio_min,
    precio_max,
    orden,
    pagina = '1',
    limite = '20'
  } = req.query as Record<string, string>;

  const porPagina = Math.min(Number(limite) || 20, 100);
  const saltar = (Math.max(Number(pagina) || 1, 1) - 1) * porPagina;

  const filtro: Record<string, unknown> = { activo: true };
  if (categoria) filtro.categoria = categoria;
  if (marca) filtro.marca = marca;
  if (precio_min || precio_max) {
    filtro.precio = {
      ...(precio_min ? { $gte: Number(precio_min) } : {}),
      ...(precio_max ? { $lte: Number(precio_max) } : {})
    };
  }
  if (q) filtro.$text = { $search: q };

  const ordenamiento: Record<string, 1 | -1> =
    orden === 'precio_asc' ? { precio: 1 }
    : orden === 'precio_desc' ? { precio: -1 }
    : orden === 'nombre' ? { nombre: 1 }
    : q ? { score: -1 } // relevancia cuando hay busqueda de texto
    : { creado_en: -1 };

  const coleccion = coleccionProductos();
  const consulta = coleccion.find(filtro);

  if (q) {
    consulta.project({ score: { $meta: 'textScore' } });
  }

  const [productos, total] = await Promise.all([
    consulta.sort(ordenamiento).skip(saltar).limit(porPagina).toArray(),
    coleccion.countDocuments(filtro)
  ]);

  const disponibilidad = await consultarDisponibilidad(
    productos.map((p) => String(p.sku)),
    req.requestId
  );

  res.status(200).json({
    total,
    pagina: Number(pagina) || 1,
    por_pagina: porPagina,
    productos: productos.map((p) => proyectar(p, disponibilidad.get(String(p.sku)) ?? null))
  });
};

/** GET /productos/:sku */
export const obtenerProducto = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const producto = await coleccionProductos().findOne({ sku: req.params.sku, activo: true });
  if (!producto) throw errorNoEncontrado(`Producto ${req.params.sku} no encontrado.`);

  const disponibilidad = await consultarDisponibilidad([req.params.sku], req.requestId);
  res.status(200).json(proyectar(producto, disponibilidad.get(req.params.sku) ?? null));
};

/**
 * GET /productos/:sku/precio - endpoint interno.
 *
 * El servicio de pedidos lo consulta en el paso 10 del flujo para verificar el
 * precio vigente. El precio que se cobra nunca lo envia el cliente: siempre se
 * relee del catalogo, o cualquiera podria comprar un portatil por mil pesos
 * manipulando la peticion.
 */
export const precioVigente = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const producto = await coleccionProductos().findOne(
    { sku: req.params.sku, activo: true },
    { projection: { sku: 1, nombre: 1, precio: 1, descuento_porcentaje: 1 } }
  );
  if (!producto) throw errorNoEncontrado(`Producto ${req.params.sku} no encontrado o inactivo.`);

  res.status(200).json({
    sku: producto.sku,
    nombre: producto.nombre,
    precio_lista: producto.precio,
    descuento_porcentaje: producto.descuento_porcentaje ?? 0,
    precio_final: precioFinal(Number(producto.precio), Number(producto.descuento_porcentaje ?? 0))
  });
};

/** GET /categorias */
export const listarCategorias = async (_req: PeticionAutenticada, res: Response): Promise<void> => {
  const agregado = await coleccionProductos()
    .aggregate([
      { $match: { activo: true } },
      { $group: { _id: '$categoria', productos: { $sum: 1 }, precio_min: { $min: '$precio' } } },
      { $sort: { _id: 1 } }
    ])
    .toArray();

  res.status(200).json(
    agregado.map((c) => ({ categoria: c._id, productos: c.productos, precio_min: c.precio_min }))
  );
};

/** POST /productos - alta de producto (vendedor o administrador). */
export const crearProducto = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const faltantes = exigirCampos(req.body, ['sku', 'nombre', 'categoria', 'precio']);
  if (faltantes.length) throw errorSolicitud(`Campos obligatorios: ${faltantes.join(', ')}`);

  const documento = {
    sku: String(req.body.sku).toUpperCase(),
    nombre: req.body.nombre,
    descripcion: req.body.descripcion ?? '',
    categoria: req.body.categoria,
    marca: req.body.marca ?? 'Sin marca',
    precio: Number(req.body.precio),
    descuento_porcentaje: Number(req.body.descuento_porcentaje ?? 0),
    imagenes: req.body.imagenes ?? [],
    atributos: req.body.atributos ?? {},
    activo: true,
    creado_en: new Date()
  };

  try {
    await coleccionProductos().insertOne(documento);
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      throw errorConflicto(`Ya existe un producto con el SKU ${documento.sku}.`);
    }
    throw error;
  }

  res.status(201).json({ mensaje: 'Producto creado.', producto: documento });
};

/** PATCH /productos/:sku - actualiza precio, descuento o estado. */
export const actualizarProducto = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const permitidos = ['nombre', 'descripcion', 'precio', 'descuento_porcentaje', 'activo', 'imagenes', 'atributos', 'marca'];
  const cambios: Record<string, unknown> = {};
  for (const campo of permitidos) {
    if (req.body?.[campo] !== undefined) cambios[campo] = req.body[campo];
  }
  if (!Object.keys(cambios).length) {
    throw errorSolicitud(`Indique al menos uno de: ${permitidos.join(', ')}`);
  }

  const resultado = await coleccionProductos().findOneAndUpdate(
    { sku: req.params.sku },
    { $set: { ...cambios, actualizado_en: new Date() } },
    { returnDocument: 'after' }
  );

  if (!resultado) throw errorNoEncontrado(`Producto ${req.params.sku} no encontrado.`);
  res.status(200).json({ mensaje: 'Producto actualizado.', producto: resultado });
};

/**
 * GET /promociones/:codigo - valida un cupon.
 * El servicio de carrito lo consulta para aplicar descuentos.
 */
export const validarPromocion = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const promocion = await coleccionPromociones().findOne({
    codigo: String(req.params.codigo).toUpperCase(),
    activo: true
  });

  if (!promocion) throw errorNoEncontrado('Cupon no encontrado.');

  if (promocion.vigente_hasta && new Date(promocion.vigente_hasta) < new Date()) {
    throw errorSolicitud('El cupon esta vencido.');
  }

  res.status(200).json({
    codigo: promocion.codigo,
    descripcion: promocion.descripcion,
    tipo: promocion.tipo,
    valor: promocion.valor,
    minimo_compra: promocion.minimo_compra ?? 0,
    vigente_hasta: promocion.vigente_hasta
  });
};
