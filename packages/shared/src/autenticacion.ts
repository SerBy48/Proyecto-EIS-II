import jwt from 'jsonwebtoken';
import { Response, NextFunction } from 'express';
import { ClaimsToken, PeticionAutenticada, Rol } from './tipos';
import { errorNoAutenticado, errorProhibido } from './errores';

const secreto = () => process.env.JWT_SECRET || 'FirmaSecretaEcommerceDesarrollo';
const secretoRenovacion = () => process.env.JWT_REFRESH_SECRET || 'FirmaRenovacionEcommerceDesarrollo';

/** Vigencia corta del token de acceso; la renovacion usa el refresh token. */
export const firmarAcceso = (claims: ClaimsToken): string =>
  jwt.sign(claims, secreto(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m'
  } as jwt.SignOptions);

export const firmarRenovacion = (claims: Pick<ClaimsToken, 'sub'>): string =>
  jwt.sign(claims, secretoRenovacion(), {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  } as jwt.SignOptions);

// jwt.verify declara string | JwtPayload; el doble paso por unknown es
// deliberado: nosotros firmamos estos tokens y conocemos su forma exacta.
export const verificarAcceso = (token: string): ClaimsToken =>
  jwt.verify(token, secreto()) as unknown as ClaimsToken;

export const verificarRenovacion = (token: string): { sub: number } =>
  jwt.verify(token, secretoRenovacion()) as unknown as { sub: number };

const extraerToken = (cabecera?: string): string | undefined => {
  if (!cabecera) return undefined;
  const [esquema, valor] = cabecera.split(' ');
  return esquema?.toLowerCase() === 'bearer' ? valor : undefined;
};

/**
 * Autenticacion opcional: si hay token lo valida y completa req.usuario,
 * pero no rechaza la peticion. Se usa en rutas publicas que se enriquecen
 * cuando el visitante esta identificado (por ejemplo el catalogo).
 */
export const autenticacionOpcional = (
  req: PeticionAutenticada,
  _res: Response,
  next: NextFunction
): void => {
  const token = extraerToken(req.headers.authorization);
  if (token) {
    try {
      req.usuario = verificarAcceso(token);
    } catch {
      /* token invalido en ruta publica: se ignora */
    }
  }
  next();
};

/**
 * Control de acceso basado en roles (seccion 5.3 del documento).
 *
 * Uso: router.post('/', requiereRol('administrador', 'vendedor'), controlador)
 *      router.get('/mios', requiereRol('cliente'), controlador)
 *
 * Sin argumentos exige unicamente que el usuario este autenticado.
 */
export const requiereRol = (...rolesPermitidos: Rol[]) => {
  return (req: PeticionAutenticada, _res: Response, next: NextFunction): void => {
    // Las llamadas entre microservicios viajan por la red privada y se
    // autentican con el secreto interno, no con un JWT de usuario.
    if (req.esLlamadaInterna) return next();

    const token = extraerToken(req.headers.authorization);
    if (!token) return next(errorNoAutenticado('Acceso denegado. Token no provisto.'));

    try {
      req.usuario = verificarAcceso(token);
    } catch (error) {
      const expirado = error instanceof jwt.TokenExpiredError;
      return next(errorNoAutenticado(expirado ? 'Token expirado.' : 'Token invalido.'));
    }

    if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(req.usuario.rol)) {
      return next(errorProhibido());
    }

    next();
  };
};

/** Cabecera con la que un microservicio se identifica ante otro. */
export const CABECERA_LLAMADA_INTERNA = 'x-llamada-interna';

/**
 * Autenticacion mutua entre servicios internos.
 *
 * Una peticion se considera interna solo si cumple DOS condiciones:
 *   1. trae el secreto compartido en x-internal-token, y
 *   2. se declara explicitamente como interna con x-llamada-interna.
 *
 * Las dos son necesarias. El API Gateway tambien envia el secreto compartido en
 * todo lo que enruta (asi los servicios saben que la peticion no llego por un
 * atajo a la red privada), pero NO envia la segunda cabecera. Si bastara el
 * secreto, cualquier usuario autenticado pasaria por servicio interno y se
 * saltaria el control de rol: un cliente podria mover inventario.
 *
 * El gateway, por su parte, elimina estas cabeceras si vienen del exterior,
 * para que nadie pueda inyectarlas.
 */
export const detectarLlamadaInterna = (
  req: PeticionAutenticada,
  _res: Response,
  next: NextFunction
): void => {
  const secreto = req.headers['x-internal-token'];
  const esperado = process.env.INTERNAL_TOKEN || 'secreto-interno-desarrollo';
  const seDeclaraInterna = req.headers[CABECERA_LLAMADA_INTERNA] === '1';

  if (typeof secreto === 'string' && secreto === esperado && seDeclaraInterna) {
    req.esLlamadaInterna = true;
  }

  // La identidad del usuario final se propaga a lo largo de toda la cadena de
  // llamadas para que las validaciones de propiedad del dato sigan aplicando,
  // incluso entre servicios. Se acepta solo si el secreto compartido es valido.
  if (typeof secreto === 'string' && secreto === esperado) {
    const idUsuario = req.headers['x-usuario-id'];
    const rol = req.headers['x-usuario-rol'];
    if (typeof idUsuario === 'string' && typeof rol === 'string') {
      req.usuario = {
        sub: Number(idUsuario),
        email: String(req.headers['x-usuario-email'] || ''),
        rol: rol as Rol,
        cliente_id: req.headers['x-cliente-id'] ? Number(req.headers['x-cliente-id']) : undefined
      };
    }
  }

  next();
};
