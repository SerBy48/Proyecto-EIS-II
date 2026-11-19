/**
 * Errores de aplicacion con codigo HTTP asociado.
 * Permite que los controladores lancen errores semanticos y que un unico
 * middleware los traduzca a respuestas JSON coherentes en todos los servicios.
 */
export class ErrorApp extends Error {
  constructor(
    public readonly estado: number,
    mensaje: string,
    public readonly codigo?: string,
    public readonly detalle?: unknown
  ) {
    super(mensaje);
    this.name = 'ErrorApp';
  }
}

export const errorSolicitud = (mensaje: string, detalle?: unknown) =>
  new ErrorApp(400, mensaje, 'SOLICITUD_INVALIDA', detalle);

export const errorNoAutenticado = (mensaje = 'Token no provisto o invalido.') =>
  new ErrorApp(401, mensaje, 'NO_AUTENTICADO');

export const errorProhibido = (mensaje = 'No tiene permisos para esta accion.') =>
  new ErrorApp(403, mensaje, 'PROHIBIDO');

export const errorNoEncontrado = (mensaje = 'Recurso no encontrado.') =>
  new ErrorApp(404, mensaje, 'NO_ENCONTRADO');

export const errorConflicto = (mensaje: string, detalle?: unknown) =>
  new ErrorApp(409, mensaje, 'CONFLICTO', detalle);

/** Stock insuficiente: caso de negocio, no un fallo tecnico. */
export const errorStockInsuficiente = (sku: string, solicitado: number, disponible: number) =>
  new ErrorApp(409, `Stock insuficiente para el producto ${sku}.`, 'STOCK_INSUFICIENTE', {
    sku,
    solicitado,
    disponible
  });

/**
 * Errores de PostgreSQL que solo pueden venir de una entrada invalida del
 * cliente: un texto mas largo que la columna, un "abc" donde va un entero o
 * un UUID, un id fuera de rango, un byte nulo o un valor que viola un CHECK.
 *
 * Antes se respondian con 500. El escaneo activo de ZAP produjo asi ~750
 * errores del servidor (hallazgo S-06 de docs/calidad/SEGURIDAD.md), y esos 500
 * ademas abrian los circuit breakers de quien llamaba. La base ya rechaza el
 * dato; aqui solo se traduce el rechazo a 400, sin revelar la columna ni la
 * consulta.
 */
const ERRORES_DE_ENTRADA_PG: Record<string, string> = {
  '22001': 'Un campo supera la longitud permitida.', // string_data_right_truncation
  '22003': 'Un valor numerico esta fuera del rango permitido.', // numeric_value_out_of_range
  '22007': 'Una fecha no tiene un formato valido.', // invalid_datetime_format
  '22008': 'Una fecha esta fuera del rango permitido.', // datetime_field_overflow
  '22021': 'El texto contiene caracteres no permitidos.', // character_not_in_repertoire (byte nulo)
  '22P02': 'Un parametro no tiene el formato esperado.', // invalid_text_representation (NaN, UUID)
  '23502': 'Falta un campo obligatorio.', // not_null_violation
  '23514': 'Un valor no esta entre los permitidos.' // check_violation
};

/**
 * Convierte en un 400 los errores que provoca una entrada mal formada: el
 * JSON invalido o demasiado grande (body-parser) y los rechazos de PostgreSQL
 * de la tabla anterior. Devuelve null si el error es del servidor.
 */
export const traducirErrorDeEntrada = (error: unknown): ErrorApp | null => {
  const e = error as { type?: string };
  if (e?.type === 'entity.parse.failed') {
    return new ErrorApp(400, 'El cuerpo de la peticion no es un JSON valido.', 'JSON_INVALIDO');
  }
  if (e?.type === 'entity.too.large') {
    return new ErrorApp(413, 'El cuerpo de la peticion es demasiado grande.', 'CUERPO_DEMASIADO_GRANDE');
  }
  const codigo = errorDePostgres(error)?.code;
  const mensaje = codigo ? ERRORES_DE_ENTRADA_PG[codigo] : undefined;
  return mensaje ? new ErrorApp(400, mensaje, 'VALOR_INVALIDO') : null;
};

/** Lo que interesa de un error del driver de PostgreSQL. */
export interface ErrorPostgres {
  code: string;
  constraint?: string;
}

/**
 * Devuelve el error de PostgreSQL, venga directo del driver `pg` o envuelto
 * por el ORM.
 *
 * Drizzle envuelve los errores del driver en un DrizzleQueryError y deja el
 * original en `cause`. Sin desenvolverlo, un correo duplicado (23505) o un
 * valor demasiado largo (22001) dejarian de traducirse a 409 o 400 y llegarian
 * al cliente como 500 (docs/adr/0006-estrategia-orm.md).
 */
export const errorDePostgres = (error: unknown): ErrorPostgres | null => {
  for (let actual = error, nivel = 0; actual && nivel < 3; nivel++) {
    const e = actual as { code?: unknown; constraint?: string; cause?: unknown };
    // Los codigos SQLSTATE tienen 5 caracteres; asi no se confunden con los
    // de Node (ECONNREFUSED) ni con los de ErrorApp.
    if (typeof e.code === 'string' && /^[0-9A-Z]{5}$/.test(e.code)) {
      return { code: e.code, constraint: e.constraint };
    }
    actual = e.cause;
  }
  return null;
};

/**
 * ¿El error indica que el servicio llamado esta caido o degradado?
 *
 * Solo lo son los errores de red, los 5xx y los timeouts. Un 4xx (404 de un
 * producto inexistente, 409 de stock) es una respuesta de negocio valida: el
 * servicio funciona. Este criterio decide tanto los reintentos (invariante 7)
 * como lo que cuenta un circuit breaker: si contara los 4xx, un cliente con
 * seis peticiones a SKU inexistentes abriria el circuito para todos
 * (docs/calidad/SEGURIDAD.md, hallazgo S-04).
 */
export const esFalloDelServicio = (error: unknown): boolean =>
  !(error instanceof ErrorApp) || error.estado >= 500 || error.codigo === 'TIMEOUT';

/** El circuito hacia un servicio dependiente esta abierto. */
export const errorServicioNoDisponible = (servicio: string) =>
  new ErrorApp(503, `El servicio de ${servicio} no esta disponible en este momento.`, 'SERVICIO_NO_DISPONIBLE');
