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
import { CAMPOS_DIRECCION, CAMPOS_EDITABLES, CampoDireccion } from './repositorio';
import { DEPARTAMENTOS, departamentoOficial } from './departamentos';

/** Texto recortado con largo maximo; null si viene vacio y no es obligatorio. */
const textoValido = (valor: unknown, campo: string, maximo: number, obligatorio = true): string | null => {
  if (valor === undefined || valor === null || (typeof valor === 'string' && !valor.trim())) {
    if (obligatorio) throw errorSolicitud(`El campo ${campo} es obligatorio.`);
    return null;
  }
  if (typeof valor !== 'string') throw errorSolicitud(`El campo ${campo} debe ser un texto.`);
  const limpio = valor.trim();
  if (limpio.length > maximo) throw errorSolicitud(`El campo ${campo} admite hasta ${maximo} caracteres.`);
  return limpio;
};

const validarDepartamento = (valor: unknown): string => {
  const texto = textoValido(valor, 'departamento', 100)!;
  const oficial = departamentoOficial(texto);
  if (!oficial) throw errorSolicitud('El departamento no es un departamento de Colombia.');
  return oficial;
};

const LARGOS_DIRECCION: Record<CampoDireccion, number> = {
  etiqueta: 50, linea1: 200, linea2: 200, ciudad: 100, departamento: 100, codigo_postal: 20
};
const OBLIGATORIOS_DIRECCION: CampoDireccion[] = ['linea1', 'ciudad', 'departamento'];

/** Valida los campos de una direccion. Con parcial, solo los que vienen. */
const validarDireccion = (cuerpo: Record<string, unknown>, parcial: boolean): Partial<Record<CampoDireccion, string | null>> => {
  const datos: Partial<Record<CampoDireccion, string | null>> = {};
  for (const campo of CAMPOS_DIRECCION) {
    if (parcial && !Object.hasOwn(cuerpo, campo)) continue;
    datos[campo] = campo === 'departamento'
      ? validarDepartamento(cuerpo[campo])
      : textoValido(cuerpo[campo], campo === 'linea1' ? 'direccion' : campo, LARGOS_DIRECCION[campo], OBLIGATORIOS_DIRECCION.includes(campo));
  }
  if (datos.codigo_postal && !/^\d{6}$/.test(datos.codigo_postal)) throw errorSolicitud('El codigo postal tiene 6 digitos.');
  return datos;
};

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

  // Lista blanca: el correo y el estado no se cambian por aqui (el correo es
  // la identidad de la cuenta en auth-service).
  const cuerpo = typeof req.body === 'object' && req.body !== null ? req.body : {};
  const cambios: repositorio.CambiosCliente = {};
  for (const campo of CAMPOS_EDITABLES) {
    if (!Object.hasOwn(cuerpo, campo)) continue;
    if (campo === 'nombre' || campo === 'apellido') {
      cambios[campo] = textoValido(cuerpo[campo], campo, 100)!;
    } else if (campo === 'telefono') {
      const telefono = textoValido(cuerpo[campo], campo, 30, false);
      if (telefono && !/^\+?[\d\s-]{7,20}$/.test(telefono)) throw errorSolicitud('El telefono solo admite numeros, espacios y guiones.');
      cambios.telefono = telefono;
    } else if (campo === 'documento') {
      const documento = textoValido(cuerpo[campo], campo, 30, false);
      if (documento && !/^[A-Za-z0-9-]{4,30}$/.test(documento)) throw errorSolicitud('El documento solo admite letras, numeros y guiones.');
      cambios.documento = documento;
    } else if (campo === 'tipo_documento') {
      if (!['CC', 'CE', 'NIT', 'PAS'].includes(String(cuerpo[campo]))) throw errorSolicitud('El tipo de documento debe ser CC, CE, NIT o PAS.');
      cambios.tipo_documento = String(cuerpo[campo]) as repositorio.CambiosCliente['tipo_documento'];
    }
  }
  if (!Object.keys(cambios).length) {
    throw errorSolicitud(`Indique al menos uno de: ${CAMPOS_EDITABLES.join(', ')}`);
  }

  try {
    const cliente = await repositorio.actualizarCliente(id, cambios);
    if (!cliente) throw errorNoEncontrado('Cliente no encontrado.');
    res.status(200).json({ mensaje: 'Cliente actualizado.', cliente });
  } catch (error) {
    if (errorDePostgres(error)?.code === '23505') throw errorConflicto('Ese documento ya esta registrado en otra cuenta.');
    throw error;
  }
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

  const cuerpo = typeof req.body === 'object' && req.body !== null ? req.body : {};
  const datos = validarDireccion(cuerpo, false);
  const tipo = cuerpo.tipo ?? 'envio';
  if (tipo !== 'envio' && tipo !== 'facturacion') throw errorSolicitud("El tipo debe ser 'envio' o 'facturacion'.");

  if (!(await repositorio.existeCliente(id))) throw errorNoEncontrado('Cliente no encontrado.');

  // La primera direccion de un tipo queda como predeterminada aunque no se pida.
  const existentes = (await repositorio.listarDirecciones(id)).filter((d) => d.tipo === tipo);
  const direccion = await repositorio.crearDireccion(id, {
    tipo,
    etiqueta: datos.etiqueta,
    linea1: datos.linea1!,
    linea2: datos.linea2,
    ciudad: datos.ciudad!,
    departamento: datos.departamento,
    codigo_postal: datos.codigo_postal,
    predeterminada: cuerpo.predeterminada === true || existentes.length === 0
  });

  res.status(201).json({ mensaje: 'Direccion agregada.', direccion });
};

/** PATCH /:id/direcciones/:direccionId - edita una direccion propia o la marca como predeterminada. */
export const actualizarDireccion = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  exigirPropiedad(req, id);
  const cuerpo = typeof req.body === 'object' && req.body !== null ? req.body : {};
  const cambios = validarDireccion(cuerpo, true) as repositorio.CambiosDireccion;
  const predeterminada = cuerpo.predeterminada === undefined ? undefined : cuerpo.predeterminada === true;
  if (!Object.keys(cambios).length && predeterminada === undefined) {
    throw errorSolicitud(`Indique al menos uno de: ${CAMPOS_DIRECCION.join(', ')}, predeterminada`);
  }
  if (predeterminada === false) throw errorSolicitud('Para cambiar la predeterminada, marca otra direccion como predeterminada.');
  const direccion = await repositorio.actualizarDireccion(id, Number(req.params.direccionId), cambios, predeterminada);
  if (!direccion) throw errorNoEncontrado('Direccion no encontrada.');
  res.status(200).json({ mensaje: 'Direccion actualizada.', direccion });
};

/** DELETE /:id/direcciones/:direccionId - elimina una direccion propia. */
export const eliminarDireccion = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  exigirPropiedad(req, id);
  const eliminada = await repositorio.eliminarDireccion(id, Number(req.params.direccionId));
  if (!eliminada) throw errorNoEncontrado('Direccion no encontrada.');
  res.status(200).json({ mensaje: 'Direccion eliminada.' });
};

/** GET /departamentos - lista publica para el selector de la web. */
export const listarDepartamentos = async (_req: PeticionAutenticada, res: Response): Promise<void> => {
  res.status(200).json(DEPARTAMENTOS);
};

/**
 * POST /:id/anonimizar - interno (auth-service, al eliminar una cuenta).
 * Borra las direcciones, reemplaza los datos personales y desactiva el perfil.
 */
export const anonimizarCliente = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const cliente = await repositorio.anonimizarCliente(Number(req.params.id));
  if (!cliente) throw errorNoEncontrado('Cliente no encontrado.');
  res.status(200).json({ mensaje: 'Datos personales eliminados.', cliente_id: cliente.id });
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
