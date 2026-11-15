/**
 * Renderizado de las plantillas de notificacion.
 *
 * Las plantillas interpolan datos que controla el usuario: {{nombre}} viene del
 * perfil del cliente y {{motivo}} del pedido. La API guarda ese texto tal cual
 * (un cliente puede llamarse "<img src=x onerror=...>"), y la web no corre
 * riesgo porque React escapa todo lo que muestra. Un correo, en cambio, lo
 * renderiza un cliente de correo como HTML: sin escapar, el nombre de un
 * cliente inyectaria marcado en los mensajes (hallazgo S-11 de
 * docs/calidad/SEGURIDAD.md). Por eso los valores se escapan en el canal email.
 *
 * Push y SMS son texto plano: escapar ahi solo mostraria "&amp;" al usuario.
 */

const ENTIDADES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

/** Escapa los cinco caracteres con significado en HTML. */
export const escaparHtml = (texto: string): string => texto.replace(/[&<>"']/g, (c) => ENTIDADES[c]);

/** ¿El canal muestra el mensaje como HTML? */
export const canalConHtml = (canal: string): boolean => canal === 'email';

/**
 * Sustituye los marcadores {{campo}} de la plantilla. Con escapar = true, cada
 * valor se escapa como HTML; el texto fijo de la plantilla (que solo edita un
 * administrador) se respeta.
 */
export const renderizar = (plantilla: string, datos: Record<string, unknown>, escapar = false): string =>
  plantilla.replace(/\{\{(\w+)\}\}/g, (_coincidencia, campo: string) => {
    const valor = datos[campo];
    const texto = valor === undefined || valor === null ? '' : String(valor);
    return escapar ? escaparHtml(texto) : texto;
  });
