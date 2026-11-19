import { CABECERA_LLAMADA_INTERNA } from './autenticacion';
import { CircuitBreaker, OpcionesCircuito } from './circuit-breaker';
import { ErrorApp, esFalloDelServicio } from './errores';
import { leerSecreto } from './autenticacion';
import { crearLogger } from './logger';
import { ClaimsToken } from './tipos';

/**
 * Cliente HTTP para la comunicacion SINCRONA entre microservicios
 * (Actividad 5, Opcion A del documento).
 *
 * Incorpora los tres mecanismos que el documento exige para que el
 * acoplamiento temporal no se vuelva un problema:
 *   - timeout, para no esperar indefinidamente
 *   - reintentos con espera exponencial, solo en fallos transitorios
 *   - circuit breaker por servicio destino
 *
 * Los reintentos se aplican unicamente a errores de red y a respuestas 5xx.
 * Un 409 de stock insuficiente es una respuesta de negocio valida y NO se
 * reintenta: reintentarla no cambiaria el resultado y podria duplicar efectos.
 */

export interface OpcionesClienteServicio {
  nombre: string;
  urlBase: string;
  timeoutMs?: number;
  reintentos?: number;
  circuito?: OpcionesCircuito;
}

export interface OpcionesPeticion {
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  ruta: string;
  cuerpo?: unknown;
  requestId?: string;
  /** Identidad del usuario final, propagada para las validaciones de propiedad. */
  usuario?: ClaimsToken;
  /** Clave de idempotencia para operaciones que no deben duplicarse. */
  claveIdempotencia?: string;
  /** Valor alternativo si el circuito esta abierto (degradacion elegante). */
  alternativa?: () => unknown;
  /**
   * Cabecera Authorization del usuario final ("Bearer <jwt>"). Con ella la
   * llamada viaja COMO ESE USUARIO, igual que si llegara por el gateway: se
   * envia el secreto compartido pero NO x-llamada-interna, asi que el servicio
   * destino aplica su control de rol y su autorizacion por dato (invariante
   * 11). La usa el asistente para consultar pedidos: un cliente no puede ver
   * por el chat lo que no veria por la API.
   */
  autorizacion?: string;
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class ClienteServicio {
  private readonly breaker: CircuitBreaker;
  private readonly timeoutMs: number;
  private readonly reintentos: number;
  private readonly log;

  constructor(private readonly opciones: OpcionesClienteServicio) {
    this.breaker = new CircuitBreaker(opciones.nombre, opciones.circuito);
    this.timeoutMs = opciones.timeoutMs ?? Number(process.env.HTTP_TIMEOUT_MS || 3000);
    this.reintentos = opciones.reintentos ?? Number(process.env.HTTP_REINTENTOS || 2);
    this.log = crearLogger(`cliente:${opciones.nombre}`);
  }

  get metricas() {
    return this.breaker.metricas;
  }

  async pedir<T>(opciones: OpcionesPeticion): Promise<T> {
    const ejecutar = () => this.conReintentos<T>(opciones);
    return this.breaker.ejecutar(
      ejecutar,
      opciones.alternativa as (() => T) | undefined
    );
  }

  private async conReintentos<T>(opciones: OpcionesPeticion): Promise<T> {
    let ultimoError: unknown;

    for (let intento = 0; intento <= this.reintentos; intento++) {
      try {
        return await this.llamar<T>(opciones);
      } catch (error) {
        ultimoError = error;

        // Los errores de negocio (4xx) no se reintentan.
        if (!esFalloDelServicio(error) || intento === this.reintentos) break;

        // Espera exponencial con jitter para no sincronizar los reintentos
        // de todas las instancias durante un incidente.
        const espera = Math.min(2 ** intento * 100, 2000) + Math.random() * 100;
        this.log.warn('Reintentando llamada', {
          ruta: opciones.ruta,
          intento: intento + 1,
          espera_ms: Math.round(espera)
        });
        await esperar(espera);
      }
    }

    throw ultimoError;
  }

  private async llamar<T>(opciones: OpcionesPeticion): Promise<T> {
    const { metodo = 'GET', ruta, cuerpo, requestId, usuario, claveIdempotencia, autorizacion } = opciones;
    const url = `${this.opciones.urlBase}${ruta}`;

    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), this.timeoutMs);

    // Las dos cabeceras juntas identifican una llamada entre microservicios:
    // el secreto compartido la autentica y x-llamada-interna la declara. El API
    // Gateway envia solo la primera, de modo que el trafico de usuario nunca
    // pasa por interno ni se salta el control de rol.
    const cabeceras: Record<string, string> = {
      'content-type': 'application/json',
      'x-internal-token': leerSecreto('INTERNAL_TOKEN')
    };
    if (autorizacion) cabeceras.authorization = autorizacion;
    else cabeceras[CABECERA_LLAMADA_INTERNA] = '1';
    if (requestId) cabeceras['x-request-id'] = requestId;
    if (claveIdempotencia) cabeceras['idempotency-key'] = claveIdempotencia;
    // Con la identidad del usuario en el token no se propagan las cabeceras
    // x-usuario-*: las escribiria el servicio a partir de un JWT ya verificado.
    if (usuario && !autorizacion) {
      cabeceras['x-usuario-id'] = String(usuario.sub);
      cabeceras['x-usuario-rol'] = usuario.rol;
      cabeceras['x-usuario-email'] = usuario.email;
      if (usuario.cliente_id !== undefined) {
        cabeceras['x-cliente-id'] = String(usuario.cliente_id);
      }
    }

    try {
      const respuesta = await fetch(url, {
        method: metodo,
        headers: cabeceras,
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
        signal: controlador.signal
      });

      const texto = await respuesta.text();
      const datos = texto ? JSON.parse(texto) : null;

      if (!respuesta.ok) {
        throw new ErrorApp(
          respuesta.status,
          datos?.mensaje || `El servicio de ${this.opciones.nombre} respondio ${respuesta.status}`,
          datos?.codigo,
          datos?.detalle
        );
      }

      return datos as T;
    } catch (error) {
      if (error instanceof ErrorApp) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ErrorApp(
          504,
          `Tiempo de espera agotado hacia el servicio de ${this.opciones.nombre}.`,
          'TIMEOUT'
        );
      }
      throw new ErrorApp(
        503,
        `No fue posible contactar al servicio de ${this.opciones.nombre}.`,
        'SERVICIO_NO_DISPONIBLE',
        error instanceof Error ? error.message : error
      );
    } finally {
      clearTimeout(temporizador);
    }
  }
}
