import jwt from 'jsonwebtoken';
import { Response, NextFunction } from 'express';
import { ClaimsToken, PeticionAutenticada, Rol } from './tipos';
import { errorNoAutenticado, errorProhibido } from './errores';

/**
 * Secretos del sistema. NO tienen valor por defecto.
 *
 * Antes, cada uno tenia un respaldo escrito en el codigo y en
 * docker-compose.yml. Ese valor publico era el que corria en el despliegue,
 * asi que cualquiera con acceso al repositorio podia forjar un token de
 * administrador o llamar a los servicios internos saltandose el gateway
 * (docs/calidad/SEGURIDAD.md, hallazgos S-02 y S-03). Ahora el servicio no
 * arranca sin un secreto propio, largo y distinto de los valores publicados.
 */
export const SECRETOS_REQUERIDOS = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'INTERNAL_TOKEN'] as const;
type NombreSecreto = (typeof SECRETOS_REQUERIDOS)[number];

const LONGITUD_MINIMA_SECRETO = 32;

/** Valores que alguna vez estuvieron publicados en el repositorio. */
const SECRETOS_PUBLICADOS = new Set([
  'FirmaSecretaEcommerceDesarrollo',
  'FirmaRenovacionEcommerceDesarrollo',
  'secreto-interno-desarrollo'
]);

/** Describe por que un secreto no es aceptable, o null si lo es. */
const problemaDelSecreto = (nombre: NombreSecreto): string | null => {
  const valor = process.env[nombre];
  if (!valor) return `${nombre} no esta definido`;
  if (SECRETOS_PUBLICADOS.has(valor)) return `${nombre} usa un valor publicado en el repositorio`;
  if (valor.length < LONGITUD_MINIMA_SECRETO) return `${nombre} tiene menos de ${LONGITUD_MINIMA_SECRETO} caracteres`;
  return null;
};

/**
 * Comprueba los tres secretos al arrancar y lanza un error que los enumera
 * todos. Lo llaman crearServicio() y el gateway antes de escuchar.
 */
export const verificarSecretos = (): void => {
  const problemas = SECRETOS_REQUERIDOS.map(problemaDelSecreto).filter((p): p is string => p !== null);
  if (problemas.length) {
    throw new Error(
      `Configuracion insegura: ${problemas.join('; ')}. ` +
        'Genere cada secreto con "openssl rand -hex 32" y definalo en .env (ver .env.example).'
    );
  }
};

/** Lee un secreto ya verificado; falla si no esta definido. */
export const leerSecreto = (nombre: NombreSecreto): string => {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`${nombre} no esta definido.`);
  return valor;
};

const secreto = () => leerSecreto('JWT_SECRET');
const secretoRenovacion = () => leerSecreto('JWT_REFRESH_SECRET');

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

/**
 * Restringe una ruta a las llamadas entre servicios. Va DESPUES de
 * requiereRol(): un administrador con su token pasa el control de rol, pero no
 * este. Sirve para operaciones que solo tienen sentido dentro de un flujo de
 * otro servicio, como anonimizar un perfil al eliminar la cuenta.
 */
export const soloLlamadaInterna = (req: PeticionAutenticada, _res: Response, next: NextFunction): void => {
  if (req.esLlamadaInterna) return next();
  next(errorProhibido('Esta operacion solo la invoca otro servicio.'));
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
  const esperado = leerSecreto('INTERNAL_TOKEN');
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
