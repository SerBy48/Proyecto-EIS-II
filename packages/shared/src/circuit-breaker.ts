import { crearLogger } from './logger';
import { errorServicioNoDisponible } from './errores';

/**
 * Circuit breaker (Actividad 6, punto f del documento).
 *
 * Cuando un servicio dependiente acumula fallos consecutivos, el circuito se
 * abre y las llamadas siguientes fallan de inmediato durante un intervalo, en
 * lugar de quedarse esperando un timeout. Eso evita el efecto domino: que la
 * lentitud del servicio de pagos agote los hilos del servicio de pedidos y
 * este arrastre al API Gateway.
 *
 * Estados:
 *   cerrado      -> las llamadas pasan normalmente
 *   abierto      -> se rechazan sin intentar, hasta que pase el tiempo de espera
 *   semiabierto  -> se permite una llamada de prueba; si funciona, cierra
 */
export type EstadoCircuito = 'cerrado' | 'abierto' | 'semiabierto';

export interface OpcionesCircuito {
  /** Fallos consecutivos que abren el circuito. */
  umbralFallos?: number;
  /** Milisegundos que el circuito permanece abierto antes de probar de nuevo. */
  esperaReapertura?: number;
  /** Exitos seguidos en semiabierto que vuelven a cerrar el circuito. */
  umbralRecuperacion?: number;
}

export class CircuitBreaker {
  private estado: EstadoCircuito = 'cerrado';
  private fallosConsecutivos = 0;
  private exitosConsecutivos = 0;
  private abiertoHasta = 0;

  private readonly umbralFallos: number;
  private readonly esperaReapertura: number;
  private readonly umbralRecuperacion: number;
  private readonly log = crearLogger('circuit-breaker');

  constructor(
    private readonly nombre: string,
    opciones: OpcionesCircuito = {}
  ) {
    this.umbralFallos = opciones.umbralFallos ?? Number(process.env.CB_UMBRAL_FALLOS || 5);
    this.esperaReapertura = opciones.esperaReapertura ?? Number(process.env.CB_ESPERA_MS || 15000);
    this.umbralRecuperacion = opciones.umbralRecuperacion ?? 2;
  }

  get estadoActual(): EstadoCircuito {
    return this.estado;
  }

  /** Metricas para el endpoint /health del servicio. */
  get metricas() {
    return {
      nombre: this.nombre,
      estado: this.estado,
      fallos_consecutivos: this.fallosConsecutivos,
      reabre_en_ms: this.estado === 'abierto' ? Math.max(0, this.abiertoHasta - Date.now()) : 0
    };
  }

  async ejecutar<T>(operacion: () => Promise<T>, alternativa?: () => T | Promise<T>): Promise<T> {
    if (this.estado === 'abierto') {
      if (Date.now() < this.abiertoHasta) {
        // Degradacion elegante: si quien llama ofrece una alternativa, se usa.
        if (alternativa) return await alternativa();
        throw errorServicioNoDisponible(this.nombre);
      }
      this.estado = 'semiabierto';
      this.exitosConsecutivos = 0;
      this.log.warn('Circuito en prueba', { servicio: this.nombre });
    }

    try {
      const resultado = await operacion();
      this.registrarExito();
      return resultado;
    } catch (error) {
      // registrarFallo informa si este fallo fue el que abrio el circuito, para
      // ofrecer la alternativa de inmediato en lugar de propagar el error.
      const seAbrio = this.registrarFallo();
      if (seAbrio && alternativa) return await alternativa();
      throw error;
    }
  }

  private registrarExito(): void {
    this.fallosConsecutivos = 0;
    if (this.estado === 'semiabierto') {
      this.exitosConsecutivos += 1;
      if (this.exitosConsecutivos >= this.umbralRecuperacion) {
        this.estado = 'cerrado';
        this.log.info('Circuito cerrado', { servicio: this.nombre });
      }
    }
  }

  /** Devuelve true si este fallo abrio el circuito. */
  private registrarFallo(): boolean {
    this.fallosConsecutivos += 1;
    this.exitosConsecutivos = 0;

    // Un fallo en semiabierto vuelve a abrir el circuito de inmediato: la
    // llamada de prueba demostro que el servicio sigue caido.
    const debeAbrir =
      this.estado === 'semiabierto' || this.fallosConsecutivos >= this.umbralFallos;
    if (!debeAbrir) return false;

    this.estado = 'abierto';
    this.abiertoHasta = Date.now() + this.esperaReapertura;
    this.log.error('Circuito abierto', {
      servicio: this.nombre,
      fallos: this.fallosConsecutivos,
      reabre_en_ms: this.esperaReapertura
    });
    return true;
  }
}
