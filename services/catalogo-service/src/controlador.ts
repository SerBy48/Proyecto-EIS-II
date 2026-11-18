import { Response } from 'express';
import {
  ClienteServicio,
  PeticionAutenticada,
  crearLogger,
  errorConflicto,
  errorNoEncontrado,
  errorSolicitud,
  textoDeConsulta
} from '@ecommerce/shared';
import { Sort } from 'mongodb';
import { filtroTolerante } from './busqueda';
import { coleccionCategorias, coleccionHistorialPrecios, coleccionProductos, coleccionPromociones } from './db';
import { PREFIJO_IMAGENES, Seccion, descuentoVigente, filtroEnOferta, precioFinal, validarProducto } from './gestion';

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
  maximo_por_cliente?: number;
}

const esPersonal = (req: PeticionAutenticada) => req.usuario?.rol === 'administrador' || req.usuario?.rol === 'vendedor';

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

/** Las fotos de la semilla se guardaron como /productos/x.webp (F5b); hoy las sirve el catalogo. */
const rutaImagen = (ruta: unknown): string =>
  typeof ruta === 'string' && ruta.startsWith('/productos/') ? `${PREFIJO_IMAGENES}${ruta.slice('/productos/'.length)}` : String(ruta);

const proyectar = (producto: Record<string, unknown>, disp: Disponibilidad | null, personal = false) => {
  // El descuento que se muestra y se cobra es el vigente: una oferta vencida
  // vuelve sola al precio de lista.
  const descuento = descuentoVigente(producto);
  return {
    sku: producto.sku,
    nombre: producto.nombre,
    descripcion: producto.descripcion,
    categoria: producto.categoria,
    subcategoria: producto.subcategoria ?? null,
    marca: producto.marca,
    precio: producto.precio,
    descuento_porcentaje: descuento,
    oferta_hasta: descuento ? (producto.oferta_hasta ?? null) : null,
    precio_final: precioFinal(Number(producto.precio), descuento),
    imagenes: ((producto.imagenes ?? []) as unknown[]).map(rutaImagen),
    atributos: producto.atributos ?? {},
    // null significa "no se pudo consultar", que es distinto de "agotado".
    disponible: disp ? disp.disponible : null,
    hay_stock: disp ? disp.hay_stock : null,
    // Lo maximo que un cliente puede llevar (RF-47); el carrito lo muestra.
    maximo_por_cliente: disp ? (disp.maximo_por_cliente ?? null) : null,
    // El panel necesita lo configurado aunque la oferta ya haya vencido.
    ...(personal
      ? {
          activo: producto.activo !== false,
          descuento_configurado: Number(producto.descuento_porcentaje ?? 0),
          oferta_hasta_configurada: producto.oferta_hasta ?? null
        }
      : {})
  };
};

/**
 * GET /productos
 * Busqueda y filtrado por categoria, subcategoria, marca, precio, oferta y
 * texto (seccion 5.5). Si el indice de texto no encuentra nada, se repite con
 * la busqueda tolerante (palabras a medio escribir, plurales, tildes).
 */
export const listarProductos = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  // Solo texto: un objeto como ?categoria[$ne]=x llegaria al filtro de
  // MongoDB como operador (inyeccion NoSQL, hallazgo S-05).
  const parametro = (nombre: string) => textoDeConsulta(req.query[nombre], nombre);
  const q = parametro('q')?.trim();
  const categoria = parametro('categoria');
  const subcategoria = parametro('subcategoria');
  const marca = parametro('marca');
  const precio_min = parametro('precio_min');
  const precio_max = parametro('precio_max');
  const en_oferta = parametro('en_oferta');
  const orden = parametro('orden');
  const pagina = parametro('pagina') ?? '1';
  const limite = parametro('limite') ?? '20';

  const porPagina = Math.min(Number(limite) || 20, 100);
  const saltar = (Math.max(Number(pagina) || 1, 1) - 1) * porPagina;

  // El panel de Productos ve tambien los inactivos (para volver a activarlos).
  const personal = esPersonal(req);
  const incluirInactivos = personal && parametro('incluir_inactivos') === 'true';
  const base: Record<string, unknown> = incluirInactivos ? {} : { activo: true };
  if (categoria) base.categoria = categoria;
  if (subcategoria) base.subcategoria = subcategoria;
  if (marca) base.marca = marca;
  if (precio_min || precio_max) {
    base.precio = {
      ...(precio_min ? { $gte: Number(precio_min) } : {}),
      ...(precio_max ? { $lte: Number(precio_max) } : {})
    };
  }
  if (en_oferta === 'true') Object.assign(base, filtroEnOferta());
  // ?skus=A,B: los productos de esos SKU (el panel pone nombre a las alertas
  // de reposicion y al historial de entradas, que inventario guarda por SKU).
  const skus = parametro('skus');
  if (skus !== undefined) {
    const lista = [...new Set(skus.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))];
    if (!lista.length || lista.length > 100 || !lista.every((s) => /^SKU-[A-Z0-9-]{1,40}$/.test(s))) {
      throw errorSolicitud('skus debe ser una lista de 1 a 100 SKU separados por comas.');
    }
    base.sku = { $in: lista };
  }

  const ordenFijo: Record<string, 1 | -1> | undefined =
    orden === 'precio_asc' ? { precio: 1 }
    : orden === 'precio_desc' ? { precio: -1 }
    : orden === 'nombre' ? { nombre: 1 }
    : orden === 'descuento' ? { descuento_porcentaje: -1, precio: 1 }
    : undefined;

  const coleccion = coleccionProductos();
  const buscar = (filtro: Record<string, unknown>, porRelevancia: boolean) => {
    const consulta = coleccion.find(filtro);
    if (porRelevancia) consulta.project({ score: { $meta: 'textScore' } });
    // Relevancia cuando hay busqueda de texto; si no, los mas recientes.
    const ordenamiento = ordenFijo ?? (porRelevancia ? { score: { $meta: 'textScore' } } : { creado_en: -1 });
    return Promise.all([
      consulta.sort(ordenamiento as Sort).skip(saltar).limit(porPagina).toArray(),
      coleccion.countDocuments(filtro)
    ]);
  };

  // Un SKU completo (SKU-TEC-004) se busca tal cual: el indice de texto lo parte en palabras.
  const esSku = Boolean(q && /^SKU-[A-Z0-9-]+$/i.test(q));
  let [productos, total] = esSku
    ? await buscar({ ...base, sku: q!.toUpperCase() }, false)
    : q ? await buscar({ ...base, $text: { $search: q } }, true) : await buscar(base, false);
  let busqueda: 'texto' | 'tolerante' | undefined = q ? 'texto' : undefined;

  if (q && !esSku && total === 0) {
    const tolerante = filtroTolerante(q);
    if (tolerante) {
      [productos, total] = await buscar({ ...base, ...tolerante }, false);
      busqueda = 'tolerante';
    }
  }

  const disponibilidad = await consultarDisponibilidad(
    productos.map((p) => String(p.sku)),
    req.requestId
  );

  res.status(200).json({
    total,
    pagina: Number(pagina) || 1,
    por_pagina: porPagina,
    ...(busqueda ? { busqueda } : {}),
    productos: productos.map((p) => proyectar(p, disponibilidad.get(String(p.sku)) ?? null, incluirInactivos))
  });
};

/** GET /productos/:sku (el personal ve tambien un producto inactivo). */
export const obtenerProducto = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const personal = esPersonal(req);
  const producto = await coleccionProductos().findOne(personal ? { sku: req.params.sku } : { sku: req.params.sku, activo: true });
  if (!producto) throw errorNoEncontrado(`Producto ${req.params.sku} no encontrado.`);

  const disponibilidad = await consultarDisponibilidad([req.params.sku], req.requestId);
  res.status(200).json(proyectar(producto, disponibilidad.get(req.params.sku) ?? null, personal));
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
    { projection: { sku: 1, nombre: 1, precio: 1, descuento_porcentaje: 1, oferta_hasta: 1 } }
  );
  if (!producto) throw errorNoEncontrado(`Producto ${req.params.sku} no encontrado o inactivo.`);

  // El mismo descuento vigente que ve el cliente: si la oferta vencio entre el
  // carrito y el pago, el orquestador detecta el cambio de precio (paso 10).
  const descuento = descuentoVigente(producto);
  res.status(200).json({
    sku: producto.sku,
    nombre: producto.nombre,
    precio_lista: producto.precio,
    descuento_porcentaje: descuento,
    precio_final: precioFinal(Number(producto.precio), descuento)
  });
};

interface DefinicionSubcategoria {
  slug: string;
  nombre: string;
  orden?: number;
  sinonimos?: string[];
}

interface Conteo {
  productos: number;
  precio_min: number;
}

/**
 * GET /categorias
 * Cada categoria con su conteo de productos activos y sus subcategorias, en el
 * orden definido en catalogo_db.categorias. Los sinonimos de cada subcategoria
 * los usa el asistente para entender "audifonos" o "laptop": una subcategoria
 * nueva no exige tocar las reglas del asistente.
 */
export const listarCategorias = async (_req: PeticionAutenticada, res: Response): Promise<void> => {
  const [conteos, definiciones, marcas] = await Promise.all([
    coleccionProductos()
      .aggregate([
        { $match: { activo: true } },
        {
          $group: {
            _id: { categoria: '$categoria', subcategoria: '$subcategoria' },
            productos: { $sum: 1 },
            precio_min: { $min: '$precio' }
          }
        }
      ])
      .toArray(),
    coleccionCategorias().find({}).sort({ orden: 1 }).toArray(),
    coleccionProductos()
      .aggregate([
        { $match: { activo: true } },
        { $group: { _id: { categoria: '$categoria', marca: '$marca' }, productos: { $sum: 1 } } },
        { $sort: { '_id.marca': 1 } }
      ])
      .toArray()
  ]);

  const porCategoria = new Map<string, Conteo & { subs: Map<string, Conteo> }>();
  for (const c of conteos) {
    const clave = String(c._id.categoria);
    const actual = porCategoria.get(clave) ?? { productos: 0, precio_min: Number.MAX_SAFE_INTEGER, subs: new Map() };
    actual.productos += c.productos;
    actual.precio_min = Math.min(actual.precio_min, c.precio_min);
    if (c._id.subcategoria) actual.subs.set(String(c._id.subcategoria), { productos: c.productos, precio_min: c.precio_min });
    porCategoria.set(clave, actual);
  }

  const definidas = new Map(definiciones.map((d) => [String(d.slug), d]));
  // Primero las definidas (en su orden), luego las que solo existen en los productos.
  const claves = [
    ...definiciones.map((d) => String(d.slug)).filter((slug) => porCategoria.has(slug)),
    ...[...porCategoria.keys()].filter((slug) => !definidas.has(slug)).sort()
  ];

  res.status(200).json(
    claves.map((slug) => {
      const datos = porCategoria.get(slug)!;
      const definicion = definidas.get(slug);
      const subDefinidas = ((definicion?.subcategorias ?? []) as DefinicionSubcategoria[])
        .slice()
        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
      const conocidas = new Set(subDefinidas.map((s) => s.slug));
      const subcategorias = [
        ...subDefinidas.filter((s) => datos.subs.has(s.slug)),
        ...[...datos.subs.keys()]
          .filter((s) => !conocidas.has(s))
          .sort()
          .map((s): DefinicionSubcategoria => ({ slug: s, nombre: s }))
      ].map((s) => ({
        slug: s.slug,
        nombre: s.nombre,
        productos: datos.subs.get(s.slug)!.productos,
        precio_min: datos.subs.get(s.slug)!.precio_min,
        sinonimos: s.sinonimos ?? []
      }));
      return {
        categoria: slug,
        // Marcas de la categoria: el asistente las reconoce sin reglas propias.
        marcas: marcas
          .filter((m) => String(m._id.categoria) === slug && m._id.marca)
          .map((m) => ({ nombre: String(m._id.marca), productos: m.productos })),
        nombre: String(definicion?.nombre ?? slug),
        productos: datos.productos,
        precio_min: datos.precio_min,
        subcategorias
      };
    })
  );
};

/** Secciones validas, leidas de catalogo_db.categorias. */
const seccionesDefinidas = async (): Promise<Seccion[]> => {
  const definiciones = await coleccionCategorias().find({}, { projection: { slug: 1, subcategorias: 1 } }).toArray();
  return definiciones.map((d) => ({
    categoria: String(d.slug),
    subcategorias: ((d.subcategorias ?? []) as DefinicionSubcategoria[]).map((s) => s.slug)
  }));
};

const CAMPOS_DE_PRECIO = ['precio', 'descuento_porcentaje', 'oferta_hasta'] as const;
const valoresDePrecio = (p: Record<string, unknown> | null) => ({
  precio: p ? Number(p.precio) : null,
  descuento_porcentaje: p ? Number(p.descuento_porcentaje ?? 0) : null,
  oferta_hasta: p?.oferta_hasta ?? null
});

/** Deja constancia de quien cambio el precio o la oferta (RF-48). */
const registrarCambioDePrecio = async (
  req: PeticionAutenticada,
  sku: string,
  antes: Record<string, unknown> | null,
  despues: Record<string, unknown>
): Promise<void> => {
  const a = valoresDePrecio(antes);
  const d = valoresDePrecio(despues);
  const igual = (x: unknown, y: unknown) => (x instanceof Date || y instanceof Date ? String(x && new Date(String(x)).getTime()) === String(y && new Date(String(y)).getTime()) : x === y);
  if (antes && CAMPOS_DE_PRECIO.every((c) => igual(a[c], d[c]))) return;
  await coleccionHistorialPrecios().insertOne({
    sku,
    antes: antes ? a : null,
    despues: d,
    usuario: req.usuario?.email ?? null,
    rol: req.usuario?.rol ?? null,
    fecha: new Date()
  });
};

/**
 * POST /productos - alta de producto (vendedor o administrador).
 * Sin foto propia, el producto muestra la de su seccion hasta que se suba una.
 */
export const crearProducto = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const datos = validarProducto(req.body, { parcial: false, secciones: await seccionesDefinidas() });
  const documento: Record<string, unknown> = {
    descripcion: '',
    atributos: {},
    descuento_porcentaje: 0,
    oferta_hasta: null,
    ...datos,
    imagenes: (datos.imagenes as string[] | undefined)?.length ? datos.imagenes : [`${PREFIJO_IMAGENES}${datos.subcategoria}.webp`],
    activo: datos.activo ?? true,
    creado_en: new Date(),
    creado_por: req.usuario?.email ?? null
  };

  try {
    await coleccionProductos().insertOne(documento);
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      throw errorConflicto(`Ya existe un producto con el SKU ${documento.sku}.`);
    }
    throw error;
  }

  await registrarCambioDePrecio(req, String(documento.sku), null, documento);
  log.con({ request_id: req.requestId }).info('Producto creado', { sku: documento.sku, por: req.usuario?.email });
  const { _id, ...producto } = documento as Record<string, unknown>;
  void _id;
  res.status(201).json({ mensaje: 'Producto creado.', producto });
};

/** PATCH /productos/:sku - edita datos, precio, oferta (con su fecha de fin), estado o fotos. */
export const actualizarProducto = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const cambios = validarProducto(req.body ?? {}, { parcial: true, secciones: await seccionesDefinidas() });
  if (!Object.keys(cambios).length) {
    throw errorSolicitud('Indique al menos uno de: nombre, descripcion, marca, subcategoria, precio, descuento_porcentaje, oferta_hasta, activo, imagenes, atributos.');
  }

  const anterior = await coleccionProductos().findOneAndUpdate(
    { sku: req.params.sku },
    { $set: { ...cambios, actualizado_en: new Date(), actualizado_por: req.usuario?.email ?? null } },
    { returnDocument: 'before' }
  );
  if (!anterior) throw errorNoEncontrado(`Producto ${req.params.sku} no encontrado.`);

  const resultado = { ...anterior, ...cambios };
  await registrarCambioDePrecio(req, req.params.sku, anterior, resultado);
  const { _id, ...producto } = resultado;
  void _id;
  res.status(200).json({ mensaje: 'Producto actualizado.', producto: proyectar(producto, null, true) });
};

/** GET /productos/:sku/historial-precios - personal interno. */
export const historialPrecios = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const cambios = await coleccionHistorialPrecios()
    .find({ sku: req.params.sku }, { projection: { _id: 0 } })
    .sort({ fecha: -1 })
    .limit(50)
    .toArray();
  res.status(200).json(cambios);
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
