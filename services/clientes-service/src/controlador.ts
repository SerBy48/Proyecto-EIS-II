import { Response } from 'express';
import {
  BusEventos,
  Eventos,
  PeticionAutenticada,
  errorConflicto,
  errorDePostgres,
  errorNoEncontrado,
  errorProhibido,
  errorSolicitud,
  exigirCampos
} from '@ecommerce/shared';
import * as repositorio from './repositorio';
import { CAMPOS_EDITABLES, CampoEditable } from './repositorio';

/**
 * Autorizacion a nivel de dato (principio de minimo privilegio):
 * un cliente solo puede leer y modificar su propio perfil. Un vendedor o
 * administrador puede consultar cualquiera.
 */
const exigirPropiedad = (req: PeticionAutenticada, clienteId: number): void => {
  const usuario = req.usuario;
  if (!usuario) return; // llamada interna sin identidad propagada
  if (usuario.rol === 'administrador' || usuario.rol === 'vendedor') return;
  if (usuario.cliente_id !== clienteId) {
    throw errorProhibido('Solo puede consultar su propia informacion.');
  }
};

/** POST / - registra un cliente. */
export const crearCliente = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const faltantes = exigirCampos(req.body, ['nombre', 'apellido', 'email']);
  if (faltantes.length) throw errorSolicitud(`Campos obligatorios: ${faltantes.join(', ')}`);

  const { nombre, apellido, email, telefono, documento, tipo_documento } = req.body;

  try {
    const cliente = await repositorio.crearCliente({
      nombre,
      apellido,
      email: String(email).toLowerCase(),
      telefono,
      documento,
      tipo_documento
    });
    res.status(201).json({ mensaje: 'Cliente registrado.', cliente });
  } catch (error) {
    if (errorDePostgres(error)?.code === '23505') {
      throw errorConflicto('Ya existe un cliente con ese correo o documento.');
    }
    throw error;
  }
};

/** GET /:id - perfil del cliente. */
export const obtenerCliente = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  exigirPropiedad(req, id);

  const cliente = await repositorio.obtenerCliente(id);
  if (!cliente) throw errorNoEncontrado('Cliente no encontrado.');
  res.status(200).json(cliente);
};

/** PATCH /:id - actualiza datos personales. */
export const actualizarCliente = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  exigirPropiedad(req, id);

  // Lista blanca: el correo, el documento y el estado no se cambian por aqui.
  const cuerpo = typeof req.body === 'object' && req.body !== null ? req.body : {};
  const cambios: Partial<Record<CampoEditable, string>> = {};
  for (const campo of CAMPOS_EDITABLES) {
    if (Object.hasOwn(cuerpo, campo)) cambios[campo] = cuerpo[campo];
  }
  if (!Object.keys(cambios).length) {
    throw errorSolicitud(`Indique al menos uno de: ${CAMPOS_EDITABLES.join(', ')}`);
  }

  const cliente = await repositorio.actualizarCliente(id, cambios);
  if (!cliente) throw errorNoEncontrado('Cliente no encontrado.');
  res.status(200).json({ mensaje: 'Cliente actualizado.', cliente });
};

/**
 * GET /:id/direcciones - direcciones del cliente.
 * El servicio de pedidos llama a este endpoint durante el checkout para
 * validar que el cliente tenga una direccion de envio valida (paso 9 del
 * flujo de compra).
 */
export const listarDirecciones = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  exigirPropiedad(req, id);
  res.status(200).json(await repositorio.listarDirecciones(id));
};

/** POST /:id/direcciones - agrega una direccion. */
export const crearDireccion = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  exigirPropiedad(req, id);

  const faltantes = exigirCampos(req.body, ['linea1', 'ciudad']);
  if (faltantes.length) throw errorSolicitud(`Campos obligatorios: ${faltantes.join(', ')}`);

  if (!(await repositorio.existeCliente(id))) throw errorNoEncontrado('Cliente no encontrado.');

  const { tipo, etiqueta, linea1, linea2, ciudad, departamento, pais, codigo_postal, predeterminada } = req.body;
  const direccion = await repositorio.crearDireccion(id, {
    tipo,
    etiqueta,
    linea1,
    linea2,
    ciudad,
    departamento,
    pais,
    codigo_postal,
    predeterminada
  });

  res.status(201).json({ mensaje: 'Direccion agregada.', direccion });
};

/**
 * GET /:id/validar - endpoint interno que consume el servicio de pedidos.
 *
 * Devuelve en una sola llamada lo que el orquestador necesita para el paso 9
 * del flujo: que el cliente exista, este activo y tenga direccion de envio.
 * Evita que pedidos tenga que hacer dos peticiones y que conozca el modelo
 * interno de clientes.
 */
export const validarParaCompra = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  const direccionId = req.query.direccion_id ? Number(req.query.direccion_id) : undefined;

  const cliente = await repositorio.datosParaCompra(id);
  if (!cliente) throw errorNoEncontrado('Cliente no encontrado.');
  if (!cliente.activo) throw errorProhibido('El cliente se encuentra inactivo.');

  const direccion = await repositorio.direccionDeEnvio(id, direccionId);
  if (!direccion) throw errorSolicitud('El cliente no tiene una direccion de envio registrada.');

  res.status(200).json({
    valido: true,
    cliente: {
      id: cliente.id,
      nombre: `${cliente.nombre} ${cliente.apellido}`,
      email: cliente.email,
      telefono: cliente.telefono
    },
    direccion_envio: direccion
  });
};

/** GET /:id/historial - historial de compras (proyeccion por eventos). */
export const historialCompras = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  exigirPropiedad(req, id);
  res.status(200).json(await repositorio.historialDeCompras(id));
};

/**
 * Consumidor del evento "pedido.confirmado".
 *
 * Actualiza la proyeccion del historial sin consultar la base de pedidos. Es
 * consistencia eventual: durante unos milisegundos el historial puede no
 * reflejar el ultimo pedido, y eso es perfectamente aceptable para esta vista.
 */
export const registrarSuscripciones = async (bus: BusEventos): Promise<void> => {
  await bus.suscribir(
    { cola: 'clientes.historial', patrones: ['pedido.confirmado', 'pedido.cancelado'] },
    async (evento) => {
      const d = evento.datos as {
        pedido_id: number;
        numero: string;
        cliente_id: number;
        total: number;
        estado: string;
        items?: unknown[];
      };

      await repositorio.proyectarPedido({ ...d, items: d.items?.length ?? 0 });
    }
  );

  // El evento de carrito abandonado no se usa aqui, pero queda declarado para
  // mostrar que varios servicios pueden suscribirse al mismo hecho de negocio.
  void Eventos.CARRITO_ABANDONADO;
};
