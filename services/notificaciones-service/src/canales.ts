import nodemailer, { Transporter } from 'nodemailer';
import { crearLogger } from '@ecommerce/shared';

/**
 * Canales de envio (patron Adaptador).
 *
 * El procesamiento de eventos no sabe como se entrega un mensaje: le pide al
 * canal que lo envie. Cambiar de proveedor (Mailpit hoy; SendGrid, SES o un
 * SMTP corporativo en produccion) es cambiar variables de entorno, no codigo.
 *
 *   CANAL_CORREO=smtp      correo real por SMTP (Mailpit en el laboratorio)
 *   CANAL_CORREO=registro  solo log; comportamiento anterior, util sin Mailpit
 *
 * SMS y push siguen simulados: no hay proveedor de pruebas equivalente.
 */

const log = crearLogger('notificaciones-service');

export interface MensajeSaliente {
  destinatario: string;
  asunto: string;
  /** Texto plano, sin escapar. */
  texto: string;
  /** Version HTML con los datos del usuario escapados (hallazgo S-11). */
  html?: string;
}

export interface ResultadoEnvio {
  proveedor: string;
  id_externo?: string;
}

export interface CanalEnvio {
  readonly nombre: string;
  /** Entrega el mensaje o lanza un error: quien llama decide si reintenta. */
  enviar(mensaje: MensajeSaliente): Promise<ResultadoEnvio>;
  /** Para el /health. Un canal sin dependencias externas siempre esta disponible. */
  verificar(): Promise<boolean>;
}

/** Registra el envio en el log, con la latencia de un proveedor externo. */
export class CanalRegistro implements CanalEnvio {
  constructor(readonly nombre: string) {}

  async enviar(mensaje: MensajeSaliente): Promise<ResultadoEnvio> {
    await new Promise((r) => setTimeout(r, Number(process.env.LATENCIA_ENVIO_MS || 100)));
    log.info(`[${this.nombre.toUpperCase()}] -> ${mensaje.destinatario}`, {
      asunto: mensaje.asunto,
      cuerpo: mensaje.texto
    });
    return { proveedor: `${this.nombre}-simulado` };
  }

  async verificar(): Promise<boolean> {
    return true;
  }
}

/** Correo real por SMTP con nodemailer. */
export class CanalSmtp implements CanalEnvio {
  readonly nombre = 'email';
  private readonly transporte: Transporter;
  private readonly remitente: string;

  constructor() {
    const host = process.env.SMTP_HOST || 'localhost';
    const puerto = Number(process.env.SMTP_PUERTO || 1025);
    this.remitente = process.env.CORREO_REMITENTE || 'Tienda en linea <no-responder@tienda.co>';
    this.transporte = nodemailer.createTransport({
      host,
      port: puerto,
      // Mailpit no usa TLS. Con un proveedor real: SMTP_SEGURO=true y credenciales.
      secure: process.env.SMTP_SEGURO === 'true',
      auth: process.env.SMTP_USUARIO
        ? { user: process.env.SMTP_USUARIO, pass: process.env.SMTP_CLAVE ?? '' }
        : undefined,
      connectionTimeout: Number(process.env.SMTP_TIMEOUT_MS || 5000),
      greetingTimeout: Number(process.env.SMTP_TIMEOUT_MS || 5000),
      socketTimeout: Number(process.env.SMTP_TIMEOUT_MS || 5000)
    });
    log.info('Canal de correo: SMTP', { host, puerto });
  }

  async enviar(mensaje: MensajeSaliente): Promise<ResultadoEnvio> {
    const info = await this.transporte.sendMail({
      from: this.remitente,
      to: mensaje.destinatario,
      subject: mensaje.asunto,
      text: mensaje.texto,
      html: mensaje.html
    });
    return { proveedor: 'smtp', id_externo: info.messageId };
  }

  async verificar(): Promise<boolean> {
    try {
      return await this.transporte.verify();
    } catch {
      return false;
    }
  }
}

/** Canal de correo segun CANAL_CORREO (registro por defecto: no exige Mailpit). */
export const crearCanalCorreo = (): CanalEnvio =>
  process.env.CANAL_CORREO === 'smtp' ? new CanalSmtp() : new CanalRegistro('email');

let canalCorreo: CanalEnvio | undefined;
const canalesSimulados = new Map<string, CanalEnvio>();

/** El canal que corresponde a una plantilla (email, sms o push). */
export const canalPara = (canal: string): CanalEnvio => {
  if (canal === 'email') return (canalCorreo ??= crearCanalCorreo());
  if (!canalesSimulados.has(canal)) canalesSimulados.set(canal, new CanalRegistro(canal));
  return canalesSimulados.get(canal)!;
};

/** Salud del canal de correo; no es critica: los eventos esperan en la cola. */
export const verificarCorreo = (): Promise<boolean> => canalPara('email').verificar();
