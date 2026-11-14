import { Response } from 'express';
import {
  ClienteServicio,
  PeticionAutenticada,
  errorNoEncontrado,
  errorProhibido,
  errorSolicitud,
  exigirCampos
} from '@ecommerce/shared';
import { redis } from './db';

/**
 * Servicio de carrito (seccion 5.7 del documento).
 *
 * El almacenamiento es clave-valor en memoria con expiracion, tal como indica
 * la tabla de bases de datos: un carrito no es un dato que deba sobrevivir para
 * siempre, y Redis permite que caduque solo tras un periodo de inactividad.
 *
 * "Persistir el carrito entre sesiones y dispositivos" se cumple porque la
 * clave es el identificador del cliente, no la sesion del navegador: el mismo
 * carrito aparece en el movil y en la web.
 */

const TTL_SEGUNDOS = Number(process.env.TTL_CARRITO_SEGUNDOS || 7 * 24 * 60 * 60); // 7 dias
const IVA = Number(process.env.PORCENTAJE_IVA || 19);
const ENVIO_BASE = Number(process.env.COSTO_ENVIO_BASE || 15000);
const UMBRAL_ENVIO_GRATIS = Number(process.env.UMBRAL_ENVIO_GRATIS || 500000);

const catalogo = new ClienteServicio({
  nombre: 'catalogo',
  urlBase: process.env.URL_CATALOGO || 'http://localhost:3003'
});

export const metricasCarrito = () => ({ circuito_catalogo: catalogo.metricas });

const clave = (clienteId: number) => `carrito:${clienteId}`;

interface ItemCarrito {
  sku: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
}

interface CarritoGuardado {
  cliente_id: number;
  items: ItemCarrito[];
  cupon?: string;
  actualizado_en: string;
}

/** Un cliente solo puede tocar su propio carrito. */
const exigirPropiedad = (req: PeticionAutenticada, clienteId: number): void => {
  const usuario = req.usuario;
  if (!usuario) return;
  if (usuario.rol === 'administrador') return;
  if (usuario.cliente_id !== clienteId) {
    throw errorProhibido('Solo puede operar sobre su propio carrito.');
  }
};

const leer = async (clienteId: number): Promise<CarritoGuardado> => {
  const crudo = await redis.get(clave(clienteId));
  if (!crudo) {
    return { cliente_id: clienteId, items: [], actualizado_en: new Date().toISOString() };
  }
  return JSON.parse(crudo) as CarritoGuardado;
};

const guardar = async (carrito: CarritoGuardado): Promise<void> => {
  carrito.actualizado_en = new Date().toISOString();
  // Cada escritura renueva el TTL: el carrito caduca por inactividad, no por
  // antiguedad. Un cliente que vuelve cada dia no pierde su seleccion.
  await redis.set(clave(carrito.cliente_id), JSON.stringify(carrito), 'EX', TTL_SEGUNDOS);
};

interface Totales {
  subtotal: number;
  descuento: number;
  impuestos: number;
  envio: number;
  total: number;
  cupon_aplicado?: string;
}

/**
 * Calcula los totales del carrito (seccion 5.7: subtotales, impuestos y costo
 * de envio estimado, mas la aplicacion de cupones).
 *
 * El descuento se aplica sobre el subtotal y ANTES del IVA, y el envio se
 * calcula sobre el subtotal ya descontado. El orden importa para que las cifras
 * cuadren con las del pedido.
 */
const calcularTotales = async (
  carrito: CarritoGuardado,
  requestId?: string
): Promise<Totales> => {
  const subtotal = carrito.items.reduce((suma, i) => suma + i.precio_unitario * i.cantidad, 0);

  let descuento = 0;
  let envio = subtotal >= UMBRAL_ENVIO_GRATIS || subtotal === 0 ? 0 : ENVIO_BASE;
  let cuponAplicado: string | undefined;

  if (carrito.cupon) {
    try {
      const promocion = await catalogo.pedir<{
        codigo: string;
        tipo: string;
        valor: number;
        minimo_compra: number;
      }>({ ruta: `/promociones/${encodeURIComponent(carrito.cupon)}`, requestId });

      if (subtotal >= (promocion.minimo_compra ?? 0)) {
        cuponAplicado = promocion.codigo;
        if (promocion.tipo === 'porcentaje') {
          descuento = Math.round(subtotal * (promocion.valor / 100));
        } else if (promocion.tipo === 'monto_fijo') {
          descuento = Math.min(promocion.valor, subtotal);
        } else if (promocion.tipo === 'envio_gratis') {
          envio = 0;
        }
      }
    } catch {
      // Cupon invalido o catalogo caido: el carrito sigue funcionando sin el.
      cuponAplicado = undefined;
    }
  }

  const baseImponible = subtotal - descuento;
  const impuestos = Math.round(baseImponible * (IVA / 100));

  return {
    subtotal,
    descuento,
    impuestos,
    envio,
    total: baseImponible + impuestos + envio,
    ...(cuponAplicado ? { cupon_aplicado: cuponAplicado } : {})
  };
};

const responder = async (res: Response, carrito: CarritoGuardado, requestId?: string) => {
  const totales = await calcularTotales(carrito, requestId);
  res.status(200).json({
    cliente_id: carrito.cliente_id,
    items: carrito.items,
    cupon: carrito.cupon ?? null,
    totales,
    cantidad_items: carrito.items.reduce((s, i) => s + i.cantidad, 0),
    actualizado_en: carrito.actualizado_en
  });
};

/** GET /:clienteId */
export const verCarrito = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const clienteId = Number(req.params.clienteId);
  exigirPropiedad(req, clienteId);
  await responder(res, await leer(clienteId), req.requestId);
};

/**
 * POST /:clienteId/items
 *
 * Agrega un item. El precio NO lo envia el cliente: se consulta al catalogo,
 * que es su propietario. Si el catalogo esta caido, no se puede agregar al
 * carrito con un precio inventado; se devuelve un 503 explicito.
 */
export const agregarItem = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const clienteId = Number(req.params.clienteId);
  exigirPropiedad(req, clienteId);

  const faltantes = exigirCampos(req.body, ['sku']);
  if (faltantes.length) throw errorSolicitud(`Campos obligatorios: ${faltantes.join(', ')}`);

  const sku = String(req.body.sku).toUpperCase();
  const cantidad = Number(req.body.cantidad ?? 1);
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw errorSolicitud('La cantidad debe ser un entero positivo.');
  }

  const producto = await catalogo.pedir<{ sku: string; nombre: string; precio_final: number }>({
    ruta: `/productos/${encodeURIComponent(sku)}/precio`,
    requestId: req.requestId
  });

  const carrito = await leer(clienteId);
  const existente = carrito.items.find((i) => i.sku === sku);

  if (existente) {
    existente.cantidad += cantidad;
    // El precio se refresca: si bajo desde que lo agrego, el cliente gana.
    existente.precio_unitario = producto.precio_final;
  } else {
    carrito.items.push({
      sku,
      nombre: producto.nombre,
      cantidad,
      precio_unitario: producto.precio_final
    });
  }

  await guardar(carrito);
  await responder(res, carrito, req.requestId);
};

/** PATCH /:clienteId/items/:sku - cambia la cantidad. */
export const actualizarItem = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const clienteId = Number(req.params.clienteId);
  exigirPropiedad(req, clienteId);

  const cantidad = Number(req.body?.cantidad);
  if (!Number.isInteger(cantidad) || cantidad < 0) {
    throw errorSolicitud('La cantidad debe ser un entero mayor o igual a cero.');
  }

  const carrito = await leer(clienteId);
  const sku = String(req.params.sku).toUpperCase();
  const indice = carrito.items.findIndex((i) => i.sku === sku);
  if (indice === -1) throw errorNoEncontrado('El producto no esta en el carrito.');

  if (cantidad === 0) carrito.items.splice(indice, 1);
  else carrito.items[indice].cantidad = cantidad;

  await guardar(carrito);
  await responder(res, carrito, req.requestId);
};

/** DELETE /:clienteId/items/:sku */
export const eliminarItem = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const clienteId = Number(req.params.clienteId);
  exigirPropiedad(req, clienteId);

  const carrito = await leer(clienteId);
  const sku = String(req.params.sku).toUpperCase();
  const antes = carrito.items.length;
  carrito.items = carrito.items.filter((i) => i.sku !== sku);
  if (carrito.items.length === antes) throw errorNoEncontrado('El producto no esta en el carrito.');

  await guardar(carrito);
  await responder(res, carrito, req.requestId);
};

/** POST /:clienteId/cupon */
export const aplicarCupon = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const clienteId = Number(req.params.clienteId);
  exigirPropiedad(req, clienteId);

  const codigo = String(req.body?.codigo ?? '').toUpperCase();
  if (!codigo) throw errorSolicitud('Indique el codigo del cupon.');

  // Se valida contra el catalogo antes de guardarlo, para dar un error claro.
  await catalogo.pedir({ ruta: `/promociones/${encodeURIComponent(codigo)}`, requestId: req.requestId });

  const carrito = await leer(clienteId);
  carrito.cupon = codigo;
  await guardar(carrito);
  await responder(res, carrito, req.requestId);
};

/** DELETE /:clienteId/cupon */
export const quitarCupon = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const clienteId = Number(req.params.clienteId);
  exigirPropiedad(req, clienteId);

  const carrito = await leer(clienteId);
  delete carrito.cupon;
  await guardar(carrito);
  await responder(res, carrito, req.requestId);
};

/**
 * DELETE /:clienteId
 * Vacia el carrito. El servicio de pedidos lo invoca tras confirmar la compra.
 */
export const vaciarCarrito = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const clienteId = Number(req.params.clienteId);
  exigirPropiedad(req, clienteId);
  await redis.del(clave(clienteId));
  res.status(200).json({ mensaje: 'Carrito vaciado.', cliente_id: clienteId });
};

/**
 * GET /:clienteId/checkout - endpoint interno.
 *
 * Entrega al servicio de pedidos el contenido del carrito con sus totales ya
 * calculados. El orquestador no reimplementa el calculo de impuestos ni de
 * envio: eso pertenece al carrito.
 */
export const datosCheckout = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const clienteId = Number(req.params.clienteId);
  const carrito = await leer(clienteId);

  if (!carrito.items.length) throw errorSolicitud('El carrito esta vacio.');

  const totales = await calcularTotales(carrito, req.requestId);
  res.status(200).json({ cliente_id: clienteId, items: carrito.items, cupon: carrito.cupon ?? null, totales });
};
