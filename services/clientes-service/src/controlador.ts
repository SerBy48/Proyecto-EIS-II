import { Response } from 'express';
import {
  BusEventos,
  Eventos,
  PeticionAutenticada,
  errorConflicto,
  errorNoEncontrado,
  errorProhibido,
  errorSolicitud,
  exigirCampos
} from '@ecommerce/shared';
import { pool } from './db';

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
    const { rows } = await pool.query(
      `INSERT INTO clientes (nombre, apellido, email, telefono, documento, tipo_documento)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'CC'))
       RETURNING id, nombre, apellido, email, telefono, documento, activo, creado_en`,
      [nombre, apellido, String(email).toLowerCase(), telefono ?? null, documento ?? null, tipo_documento ?? null]
    );
    res.status(201).json({ mensaje: 'Cliente registrado.', cliente: rows[0] });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw errorConflicto('Ya existe un cliente con ese correo o documento.');
    }
    throw error;
  }
};

/** GET /:id - perfil del cliente. */
export const obtenerCliente = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  exigirPropiedad(req, id);

  const { rows } = await pool.query(
    `SELECT id, nombre, apellido, email, telefono, documento, tipo_documento, activo, creado_en
       FROM clientes WHERE id = $1`,
    [id]
  );
  if (!rows[0]) throw errorNoEncontrado('Cliente no encontrado.');
  res.status(200).json(rows[0]);
};

/** PATCH /:id - actualiza datos personales. */
export const actualizarCliente = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  exigirPropiedad(req, id);

  const permitidos = ['nombre', 'apellido', 'telefono'];
  const campos = Object.keys(req.body ?? {}).filter((c) => permitidos.includes(c));
  if (!campos.length) throw errorSolicitud(`Indique al menos uno de: ${permitidos.join(', ')}`);

  const asignaciones = campos.map((c, i) => `${c} = $${i + 2}`).join(', ');
  const valores = campos.map((c) => req.body[c]);

  const { rows } = await pool.query(
    `UPDATE clientes SET ${asignaciones}, actualizado_en = NOW()
      WHERE id = $1
      RETURNING id, nombre, apellido, email, telefono, activo`,
    [id, ...valores]
  );
  if (!rows[0]) throw errorNoEncontrado('Cliente no encontrado.');
  res.status(200).json({ mensaje: 'Cliente actualizado.', cliente: rows[0] });
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

  const { rows } = await pool.query(
    // Columnas calificadas con "d.": clientes y direcciones tienen ambas "id" y,
    // sin el alias, PostgreSQL rechaza la consulta ("column reference is
    // ambiguous") y la ruta respondia siempre 500.
    `SELECT d.id, d.tipo, d.etiqueta, d.linea1, d.linea2, d.ciudad, d.departamento, d.pais,
            d.codigo_postal, d.predeterminada
       FROM clientes c JOIN direcciones d ON d.cliente_id = c.id
      WHERE c.id = $1
      ORDER BY d.predeterminada DESC, d.id`,
    [id]
  );
  res.status(200).json(rows);
};

/** POST /:id/direcciones - agrega una direccion. */
export const crearDireccion = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  exigirPropiedad(req, id);

  const faltantes = exigirCampos(req.body, ['linea1', 'ciudad']);
  if (faltantes.length) throw errorSolicitud(`Campos obligatorios: ${faltantes.join(', ')}`);

  const { tipo, etiqueta, linea1, linea2, ciudad, departamento, pais, codigo_postal, predeterminada } = req.body;

  const existe = await pool.query(`SELECT 1 FROM clientes WHERE id = $1`, [id]);
  if (!existe.rowCount) throw errorNoEncontrado('Cliente no encontrado.');

  // Si la nueva es predeterminada, se quita la marca a la anterior del mismo
  // tipo: el indice unico parcial no admite dos predeterminadas.
  if (predeterminada) {
    await pool.query(
      `UPDATE direcciones SET predeterminada = FALSE
        WHERE cliente_id = $1 AND tipo = COALESCE($2, 'envio')`,
      [id, tipo ?? null]
    );
  }

  const { rows } = await pool.query(
    `INSERT INTO direcciones
       (cliente_id, tipo, etiqueta, linea1, linea2, ciudad, departamento, pais, codigo_postal, predeterminada)
     VALUES ($1, COALESCE($2, 'envio'), $3, $4, $5, $6, $7, COALESCE($8, 'Colombia'), $9, COALESCE($10, FALSE))
     RETURNING *`,
    [id, tipo ?? null, etiqueta ?? null, linea1, linea2 ?? null, ciudad, departamento ?? null, pais ?? null, codigo_postal ?? null, predeterminada ?? null]
  );

  res.status(201).json({ mensaje: 'Direccion agregada.', direccion: rows[0] });
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

  const { rows } = await pool.query(
    `SELECT id, nombre, apellido, email, telefono, activo FROM clientes WHERE id = $1`,
    [id]
  );
  const cliente = rows[0];
  if (!cliente) throw errorNoEncontrado('Cliente no encontrado.');
  if (!cliente.activo) throw errorProhibido('El cliente se encuentra inactivo.');

  const direcciones = await pool.query(
    `SELECT id, tipo, linea1, linea2, ciudad, departamento, pais, codigo_postal, predeterminada
       FROM direcciones
      WHERE cliente_id = $1 AND tipo = 'envio'
        AND ($2::INT IS NULL OR id = $2)
      ORDER BY predeterminada DESC, id
      LIMIT 1`,
    [id, direccionId ?? null]
  );

  if (!direcciones.rowCount) {
    throw errorSolicitud('El cliente no tiene una direccion de envio registrada.');
  }

  res.status(200).json({
    valido: true,
    cliente: {
      id: cliente.id,
      nombre: `${cliente.nombre} ${cliente.apellido}`,
      email: cliente.email,
      telefono: cliente.telefono
    },
    direccion_envio: direcciones.rows[0]
  });
};

/** GET /:id/historial - historial de compras (proyeccion por eventos). */
export const historialCompras = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  exigirPropiedad(req, id);

  const { rows } = await pool.query(
    `SELECT pedido_id, numero_pedido, total, estado, items, fecha
       FROM historial_compras
      WHERE cliente_id = $1
      ORDER BY fecha DESC
      LIMIT 50`,
    [id]
  );
  res.status(200).json(rows);
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

      await pool.query(
        `INSERT INTO historial_compras (cliente_id, pedido_id, numero_pedido, total, estado, items)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (pedido_id) DO UPDATE SET estado = EXCLUDED.estado`,
        [d.cliente_id, d.pedido_id, d.numero, d.total, d.estado, d.items?.length ?? 0]
      );
    }
  );

  // El evento de carrito abandonado no se usa aqui, pero queda declarado para
  // mostrar que varios servicios pueden suscribirse al mismo hecho de negocio.
  void Eventos.CARRITO_ABANDONADO;
};
