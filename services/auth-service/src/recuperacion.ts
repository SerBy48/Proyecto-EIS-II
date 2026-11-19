import { createHash, randomBytes } from 'node:crypto';
import { Response } from 'express';
import { BusEventos, ErrorApp, Eventos, PeticionAutenticada, crearLogger, errorSolicitud } from '@ecommerce/shared';
import * as repositorio from './repositorio';
import { generarHash } from './pool-hash';

/**
 * Recuperacion de contrasena desde el inicio de sesion (RF-54).
 *
 *   1. POST /recuperar { email }: si la cuenta existe y esta activa, se crea un
 *      enlace de un solo uso que vence en 30 minutos y se publica el evento
 *      auth.recuperacion_solicitada; notificaciones envia el correo. La
 *      respuesta es SIEMPRE la misma: distinguir "no existe" permitiria
 *      enumerar las cuentas registradas (como en el login).
 *   2. POST /restablecer { token, password }: consume el enlace, cambia la
 *      contrasena, desbloquea la cuenta y cierra todas sus sesiones.
 *
 * El token viaja en el fragmento de la URL (#restablecer=...): el navegador no
 * lo envia al servidor web, asi que no queda en los registros de nginx. En la
 * base solo se guarda su hash SHA-256.
 */

const log = crearLogger('auth-service');

export const MINUTOS_VIGENCIA = 30;
/** Enlaces por cuenta cada 15 minutos; el gateway limita ademas por IP. */
const MAXIMO_POR_CUENTA = 3;
const RONDAS_BCRYPT = 10;
const FORMATO_TOKEN = /^[a-f0-9]{64}$/;

export const MENSAJE_RECUPERACION =
  'Si el correo corresponde a una cuenta activa, te enviamos un enlace para crear una contraseña nueva. Revisa tu bandeja de entrada; el enlace vence en 30 minutos.';

let bus: BusEventos | undefined;
export const inyectarBus = (instancia: BusEventos): void => {
  bus = instancia;
};

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

/** Direccion publica de la web, a la que apunta el enlace del correo. */
export const urlWeb = (): string => (process.env.URL_WEB || 'http://localhost:8081').replace(/\/+$/, '');

export const enlaceDeRestablecimiento = (token: string): string => `${urlWeb()}/#restablecer=${token}`;

/** POST /recuperar { email } */
export const solicitarRecuperacion = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const correo = String(req.body?.email ?? '').trim().toLowerCase();
  if (!correo || correo.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) {
    throw errorSolicitud('Escribe el correo con el que te registraste.');
  }

  const usuario = await repositorio.buscarUsuarioPorCorreo(correo);
  if (usuario?.activo && (await repositorio.contarRestablecimientosRecientes(usuario.id, 15)) < MAXIMO_POR_CUENTA) {
    const token = randomBytes(32).toString('hex');
    const solicitud = await repositorio.crearRestablecimiento(usuario.id, hashToken(token), MINUTOS_VIGENCIA, req.ip);
    // Publicar nunca tumba la operacion (invariante 12): si el broker no esta,
    // el usuario puede pedir otro enlace.
    const publicado = await bus?.publicar(
      Eventos.RECUPERACION_SOLICITADA,
      {
        email: usuario.email,
        solicitud,
        minutos: MINUTOS_VIGENCIA,
        enlace: enlaceDeRestablecimiento(token),
        // Campos que van solo en el correo: notificaciones no los guarda.
        secretos: ['enlace']
      },
      req.requestId
    );
    if (!publicado) log.warn('No se publico la recuperacion de contrasena', { usuario_id: usuario.id });
    await repositorio.auditar({ usuario_id: usuario.id, email: correo, accion: 'recuperacion_solicitada', exitoso: true, ip: req.ip, request_id: req.requestId });
  } else {
    await repositorio.auditar({ usuario_id: usuario?.id ?? null, email: correo, accion: 'recuperacion_solicitada', exitoso: false, ip: req.ip, request_id: req.requestId });
  }

  res.status(202).json({ mensaje: MENSAJE_RECUPERACION });
};

/** POST /restablecer { token, password } */
export const restablecer = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const { token, password } = (req.body ?? {}) as { token?: unknown; password?: unknown };
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw errorSolicitud('La contraseña nueva debe tener entre 8 y 128 caracteres.');
  }
  const invalido = new ErrorApp(400, 'El enlace no es válido o ya venció. Solicita uno nuevo desde «¿Olvidaste tu contraseña?».', 'ENLACE_INVALIDO');
  if (typeof token !== 'string' || !FORMATO_TOKEN.test(token)) throw invalido;

  const hash = await generarHash(password, RONDAS_BCRYPT);
  const usuario = await repositorio.restablecerContrasena(hashToken(token), hash);
  if (!usuario) {
    await repositorio.auditar({ accion: 'restablecer_contrasena', exitoso: false, ip: req.ip, request_id: req.requestId });
    throw invalido;
  }
  await repositorio.auditar({ usuario_id: usuario.id, email: usuario.email, accion: 'restablecer_contrasena', exitoso: true, ip: req.ip, request_id: req.requestId });
  res.status(200).json({ mensaje: 'Tu contraseña se actualizó. Inicia sesión con la nueva.' });
};
