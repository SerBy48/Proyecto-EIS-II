import { createHash, randomBytes } from 'node:crypto';
import { Response } from 'express';
import {
  ClienteServicio,
  ErrorApp,
  PeticionAutenticada,
  Rol,
  errorConflicto,
  errorNoAutenticado,
  errorProhibido,
  errorDePostgres,
  errorSolicitud,
  exigirCampos,
  firmarAcceso,
  firmarRenovacion,
  verificarRenovacion
} from '@ecommerce/shared';
import * as repositorio from './repositorio';
import { compararHash, generarHash } from './pool-hash';

const RONDAS_BCRYPT = 10;
const MAX_INTENTOS = 5;
const MINUTOS_BLOQUEO = 15;

/** Servicio de clientes: confirma que un cliente_id pertenece a quien se registra. */
const clientes = new ClienteServicio({
  nombre: 'clientes',
  urlBase: process.env.URL_CLIENTES || 'http://localhost:3002',
  timeoutMs: Number(process.env.HTTP_TIMEOUT_MS || 3000)
});

/** Coincide con la columna usuarios.email (VARCHAR(150)). */
const LONGITUD_MAXIMA_CORREO = 150;
const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Normaliza y valida un correo. Antes se aceptaba cualquier texto: el escaneo
 * activo de ZAP creo usuarios con "correos" como http://www.google.com/
 * (docs/calidad/SEGURIDAD.md, hallazgo S-10).
 */
const validarCorreo = (email: unknown): string => {
  const correo = String(email ?? '').trim().toLowerCase();
  if (correo.length > LONGITUD_MAXIMA_CORREO || !FORMATO_CORREO.test(correo)) {
    throw errorSolicitud('El correo no tiene un formato valido.');
  }
  return correo;
};

/**
 * Comprueba que el cliente_id del registro le pertenece a quien se registra.
 *
 * El registro publico recibia cliente_id en el cuerpo y lo guardaba sin mas:
 * cualquiera podia registrarse con el id de otra persona y, como el JWT lleva
 * ese cliente_id, leer su perfil, direcciones e historial (hallazgo S-01; rompe
 * el invariante 1). Ahora el cliente debe existir, su correo debe ser el mismo
 * de la cuenta y no puede tener ya otra cuenta.
 */
const verificarClienteDelRegistro = async (clienteId: unknown, correo: string, requestId?: string): Promise<number> => {
  const id = Number(clienteId);
  if (!Number.isInteger(id) || id <= 0) throw errorSolicitud('cliente_id debe ser un entero positivo.');

  let cliente: { id: number; email: string };
  try {
    cliente = await clientes.pedir<{ id: number; email: string }>({ ruta: `/${id}`, requestId });
  } catch (error) {
    if (error instanceof ErrorApp && error.estado === 404) throw errorSolicitud('El cliente indicado no existe.');
    throw error;
  }

  if (String(cliente.email).trim().toLowerCase() !== correo) {
    throw errorProhibido('El cliente indicado no corresponde a este correo.');
  }

  if (await repositorio.clienteTieneCuenta(id)) throw errorConflicto('Ese cliente ya tiene una cuenta.');
  return id;
};

/**
 * Senal que se activa si el cliente cierra la conexion antes de recibir la
 * respuesta: el pool de hash descarta entonces la tarea sin calcularla.
 */
const senalDeCancelacion = (res: Response): AbortSignal => {
  const control = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) control.abort();
  });
  return control.signal;
};

/**
 * Ejecuta una operacion del pool de hash. Si el pool esta saturado, anade
 * Retry-After al 503 para que el cliente sepa cuando reintentar.
 */
const conPoolHash = async <T>(res: Response, operacion: (senal: AbortSignal) => Promise<T>): Promise<T> => {
  try {
    return await operacion(senalDeCancelacion(res));
  } catch (error) {
    if (error instanceof ErrorApp && error.codigo === 'SERVICIO_SATURADO') res.setHeader('Retry-After', '2');
    throw error;
  }
};

const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

const { auditar } = repositorio;

/**
 * POST /registro
 * Alta de un cliente. El rol 'cliente' es el unico autoasignable: los roles
 * vendedor y administrador los crea un administrador desde /usuarios.
 */
export const registro = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const faltantes = exigirCampos(req.body, ['email', 'password']);
  if (faltantes.length) throw errorSolicitud(`Campos obligatorios: ${faltantes.join(', ')}`);

  const { email, password, cliente_id } = req.body as {
    email: string;
    password: string;
    cliente_id?: number;
  };

  const correo = validarCorreo(email);
  if (String(password).length < 8) {
    throw errorSolicitud('La contrasena debe tener al menos 8 caracteres.');
  }

  const clienteId =
    cliente_id === undefined || cliente_id === null
      ? null
      : await verificarClienteDelRegistro(cliente_id, correo, req.requestId);

  const hash = await conPoolHash(res, (senal) => generarHash(String(password), RONDAS_BCRYPT, senal));

  try {
    const usuario = await repositorio.crearCuentaCliente(correo, hash, clienteId);

    await auditar({ usuario_id: usuario.id, email, accion: 'registro', exitoso: true, request_id: req.requestId });
    res.status(201).json({ mensaje: 'Usuario registrado.', usuario });
  } catch (error) {
    const pg = errorDePostgres(error);
    if (pg?.code === '23505') {
      throw errorConflicto(
        pg.constraint === 'uq_usuarios_cliente'
          ? 'Ese cliente ya tiene una cuenta.'
          : 'El correo ya se encuentra registrado.'
      );
    }
    throw error;
  }
};

/**
 * POST /login
 * Valida credenciales y emite el par de tokens.
 *
 * El mensaje de error es el mismo para usuario inexistente y contrasena
 * incorrecta: distinguirlos permitiria enumerar las cuentas registradas.
 */
export const login = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const faltantes = exigirCampos(req.body, ['email', 'password']);
  if (faltantes.length) throw errorSolicitud(`Campos obligatorios: ${faltantes.join(', ')}`);

  const { email, password } = req.body as { email: string; password: string };
  const correo = String(email).toLowerCase();
  const ip = req.ip;

  const usuario = await repositorio.buscarUsuarioPorCorreo(correo);

  if (!usuario) {
    await auditar({ email: correo, accion: 'login', exitoso: false, ip, request_id: req.requestId });
    throw errorNoAutenticado('Credenciales invalidas.');
  }

  if (usuario.bloqueado_hasta && usuario.bloqueado_hasta > new Date()) {
    await auditar({ usuario_id: usuario.id, email: correo, accion: 'login_bloqueado', exitoso: false, ip, request_id: req.requestId });
    throw new ErrorApp(
      429,
      'Cuenta bloqueada temporalmente por intentos fallidos. Intente mas tarde.',
      'CUENTA_BLOQUEADA'
    );
  }

  if (!usuario.activo) {
    await auditar({ usuario_id: usuario.id, email: correo, accion: 'login_inactivo', exitoso: false, ip, request_id: req.requestId });
    throw errorNoAutenticado('La cuenta se encuentra inactiva.');
  }

  const valida = await conPoolHash(res, (senal) => compararHash(String(password), usuario.password_hash, senal));

  if (!valida) {
    // Proteccion contra fuerza bruta: bloqueo temporal tras N intentos.
    const intentos = usuario.intentos_fallidos + 1;
    const bloquear = intentos >= MAX_INTENTOS;
    await repositorio.registrarIntentoFallido(usuario.id, intentos, bloquear, MINUTOS_BLOQUEO);

    await auditar({ usuario_id: usuario.id, email: correo, accion: 'login', exitoso: false, ip, request_id: req.requestId });
    throw errorNoAutenticado('Credenciales invalidas.');
  }

  const claims = {
    sub: usuario.id,
    email: usuario.email,
    rol: usuario.rol,
    ...(usuario.cliente_id !== null ? { cliente_id: usuario.cliente_id } : {})
  };

  const token = firmarAcceso(claims);
  const refresh = randomBytes(32).toString('hex');
  const refreshFirmado = firmarRenovacion({ sub: usuario.id });

  await repositorio.guardarTokenRenovacion(usuario.id, hashToken(refresh));
  await repositorio.registrarAccesoExitoso(usuario.id);

  await auditar({ usuario_id: usuario.id, email: correo, accion: 'login', exitoso: true, ip, request_id: req.requestId });

  res.status(200).json({
    mensaje: 'Autenticacion exitosa.',
    token,
    refresh_token: `${refreshFirmado}.${refresh}`,
    expira_en: process.env.JWT_EXPIRES_IN || '15m',
    usuario: {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      cliente_id: usuario.cliente_id
    }
  });
};

/**
 * POST /renovar
 * Cambia un refresh token valido por un nuevo token de acceso.
 * El refresh usado se revoca y se emite otro (rotacion): si alguien
 * intercepta un refresh y lo usa, el legitimo deja de funcionar y el robo
 * se hace evidente.
 */
export const renovar = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const { refresh_token } = req.body as { refresh_token?: string };
  if (!refresh_token) throw errorSolicitud('Se requiere refresh_token.');

  const separador = refresh_token.lastIndexOf('.');
  const parteFirmada = refresh_token.slice(0, separador);
  const parteAleatoria = refresh_token.slice(separador + 1);

  let sub: number;
  try {
    ({ sub } = verificarRenovacion(parteFirmada));
  } catch {
    throw errorNoAutenticado('Refresh token invalido o expirado.');
  }

  const registro = await repositorio.buscarTokenVigente(hashToken(parteAleatoria), sub);
  if (!registro) throw errorNoAutenticado('Refresh token revocado o inexistente.');
  if (!registro.activo) throw errorNoAutenticado('La cuenta se encuentra inactiva.');

  const nuevoAleatorio = randomBytes(32).toString('hex');
  await repositorio.rotarTokenRenovacion(registro.id, registro.usuario_id, hashToken(nuevoAleatorio));

  const claims = {
    sub: registro.usuario_id,
    email: registro.email,
    rol: registro.rol,
    ...(registro.cliente_id !== null ? { cliente_id: registro.cliente_id } : {})
  };

  res.status(200).json({
    token: firmarAcceso(claims),
    refresh_token: `${firmarRenovacion({ sub: registro.usuario_id })}.${nuevoAleatorio}`,
    expira_en: process.env.JWT_EXPIRES_IN || '15m'
  });
};

/**
 * POST /logout
 * Revoca todos los refresh tokens del usuario. El token de acceso sigue siendo
 * valido hasta que expire (15 minutos): esa es la contrapartida conocida de los
 * tokens sin estado, y la razon de que su vigencia sea corta.
 */
export const logout = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const usuarioId = req.usuario!.sub;
  const revocados = await repositorio.revocarTokensDelUsuario(usuarioId);
  await auditar({ usuario_id: usuarioId, accion: 'logout', exitoso: true, request_id: req.requestId });
  res.status(200).json({ mensaje: 'Sesion cerrada.', tokens_revocados: revocados });
};

/** GET /perfil - devuelve los claims del token actual. */
export const perfil = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const usuario = await repositorio.obtenerPerfil(req.usuario!.sub);
  if (!usuario) throw errorNoAutenticado();
  res.status(200).json(usuario);
};

/**
 * POST /usuarios - creacion de usuarios internos (solo administrador).
 * Es la via para dar de alta vendedores y otros administradores.
 */
export const crearUsuarioInterno = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const faltantes = exigirCampos(req.body, ['email', 'password', 'rol']);
  if (faltantes.length) throw errorSolicitud(`Campos obligatorios: ${faltantes.join(', ')}`);

  const { email, password, rol } = req.body as { email: string; password: string; rol: Rol };
  const correo = validarCorreo(email);
  if (String(password).length < 8) {
    throw errorSolicitud('La contrasena debe tener al menos 8 caracteres.');
  }
  if (!['cliente', 'vendedor', 'administrador'].includes(rol)) {
    throw errorSolicitud("El rol debe ser 'cliente', 'vendedor' o 'administrador'.");
  }

  const hash = await conPoolHash(res, (senal) => generarHash(String(password), RONDAS_BCRYPT, senal));

  try {
    const usuario = await repositorio.crearUsuarioInterno(correo, hash, rol);
    res.status(201).json({ mensaje: 'Usuario creado.', usuario });
  } catch (error) {
    if (errorDePostgres(error)?.code === '23505') {
      throw errorConflicto('El correo ya se encuentra registrado.');
    }
    throw error;
  }
};

/**
 * POST /verificar - usado por el API Gateway y por otros servicios.
 * Permite validar un token sin duplicar la logica de verificacion.
 */
export const verificarTokenRemoto = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  res.status(200).json({ valido: true, usuario: req.usuario });
};
