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
