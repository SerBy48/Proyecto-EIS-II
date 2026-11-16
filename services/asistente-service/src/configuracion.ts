/**
 * Valores de la tienda que citan las respuestas del asistente.
 *
 * Los de dinero e impuestos son las MISMAS variables que usa el carrito
 * (carrito-service/src/totales.ts): si cambia el costo de envio, el asistente
 * lo dice bien sin tocar el texto de la FAQ. Los demas son textos de
 * laboratorio configurables.
 */

export const moneda = (valor: number): string =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor);

export const variablesDeLaTienda = (): Record<string, string> => ({
  costo_envio: moneda(Number(process.env.COSTO_ENVIO_BASE || 15000)),
  umbral_envio_gratis: moneda(Number(process.env.UMBRAL_ENVIO_GRATIS || 500000)),
  porcentaje_iva: String(Number(process.env.PORCENTAJE_IVA || 19)),
  dias_entrega: process.env.DIAS_ENTREGA || '2 a 5',
  dias_retracto: process.env.DIAS_RETRACTO || '5',
  horario_atencion: process.env.HORARIO_ATENCION || 'de lunes a viernes de 8:00 a. m. a 6:00 p. m.'
});

/** Sustituye {{variable}}; una variable desconocida se deja tal cual para notarla. */
export const completarPlantilla = (texto: string, variables = variablesDeLaTienda()): string =>
  texto.replace(/\{\{(\w+)\}\}/g, (original, nombre: string) => variables[nombre] ?? original);

/** Longitud maxima de un mensaje del usuario. */
export const LONGITUD_MAXIMA_MENSAJE = Number(process.env.ASISTENTE_LONGITUD_MAXIMA || 500);

/**
 * Oculta datos sensibles antes de guardar la conversacion: correos, numeros
 * largos (tarjetas, cuentas, documentos) y telefonos. Las conversaciones se
 * guardan para medir que intenciones no se entienden, no para tener datos
 * personales (si alguien escribe su tarjeta en el chat, no debe quedar).
 */
export const enmascarar = (texto: string): string =>
  texto
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[correo]')
    // Un numero de pedido (PED-202611-001105) no es un dato sensible y se conserva.
    .replace(/(?<![A-Za-z]-)\b(?:\d[ -]?){12,19}\b/g, '[numero]')
    .replace(/\b\d{7,11}\b/g, '[numero]');
