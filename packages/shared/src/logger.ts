/**
 * Registro estructurado con identificador de correlacion.
 *
 * En una arquitectura distribuida una sola compra atraviesa seis servicios,
 * asi que los mensajes incluyen el request_id que el API Gateway genera y que
 * se propaga por toda la cadena. Eso permite reconstruir la traza completa.
 *
 * Los campos sensibles se enmascaran antes de escribirse (requisito de
 * seguridad: "enmascaramiento de la informacion sensible en los registros").
 */

type Nivel = 'debug' | 'info' | 'warn' | 'error';

const CAMPOS_SENSIBLES = [
  'password',
  'contrasena',
  'password_hash',
  'token',
  'authorization',
  'numero_tarjeta',
  'cvv',
  'token_tarjeta'
];

const enmascarar = (valor: unknown): unknown => {
  if (valor === null || valor === undefined) return valor;
  if (Array.isArray(valor)) return valor.map(enmascarar);
  if (typeof valor === 'object') {
    const salida: Record<string, unknown> = {};
    for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
      salida[clave] = CAMPOS_SENSIBLES.includes(clave.toLowerCase()) ? '***' : enmascarar(v);
    }
    return salida;
  }
  return valor;
};

export interface Logger {
  debug(mensaje: string, datos?: Record<string, unknown>): void;
  info(mensaje: string, datos?: Record<string, unknown>): void;
  warn(mensaje: string, datos?: Record<string, unknown>): void;
  error(mensaje: string, datos?: Record<string, unknown>): void;
  /** Devuelve un logger hijo que arrastra el request_id en cada mensaje. */
  con(contexto: Record<string, unknown>): Logger;
}

const NIVELES: Record<Nivel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export const crearLogger = (servicio: string, contextoBase: Record<string, unknown> = {}): Logger => {
  const nivelMinimo = NIVELES[(process.env.LOG_LEVEL as Nivel) || 'info'] ?? 20;

  const escribir = (nivel: Nivel, mensaje: string, datos?: Record<string, unknown>) => {
    if (NIVELES[nivel] < nivelMinimo) return;

    const registro = {
      hora: new Date().toISOString(),
      nivel,
      servicio,
      mensaje,
      ...contextoBase,
      ...(datos ? (enmascarar(datos) as Record<string, unknown>) : {})
    };

    const salida = process.env.LOG_FORMATO === 'json'
      ? JSON.stringify(registro)
      : `${registro.hora} ${nivel.toUpperCase().padEnd(5)} [${servicio}]${
          contextoBase.request_id ? ` (${contextoBase.request_id})` : ''
        } ${mensaje}${datos ? ' ' + JSON.stringify(enmascarar(datos)) : ''}`;

    if (nivel === 'error') console.error(salida);
    else if (nivel === 'warn') console.warn(salida);
    else console.log(salida);
  };

  return {
    debug: (m, d) => escribir('debug', m, d),
    info: (m, d) => escribir('info', m, d),
    warn: (m, d) => escribir('warn', m, d),
    error: (m, d) => escribir('error', m, d),
    con: (contexto) => crearLogger(servicio, { ...contextoBase, ...contexto })
  };
};
