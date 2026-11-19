import amqp, { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import { crearLogger } from './logger';
import { EventoDominio, NombreEvento } from './tipos';

/**
 * Bus de eventos sobre RabbitMQ para la comunicacion ASINCRONA
 * (Actividad 5, Opcion B del documento).
 *
 * Topologia:
 *   - Un exchange de tipo "topic" llamado ecommerce.eventos.
 *   - Cada consumidor declara su propia cola duradera y la enlaza a los
 *     patrones que le interesan. Varios servicios pueden reaccionar al mismo
 *     evento sin conocerse entre si.
 *   - Cada cola tiene una dead letter queue asociada: los mensajes que fallan
 *     repetidamente no se pierden ni bloquean la cola principal.
 *
 * Los mensajes se publican como persistentes, de modo que si el servicio de
 * notificaciones esta caido los eventos quedan almacenados y se consumen al
 * restablecerse (Actividad 6, punto d: disponibilidad).
 */

const EXCHANGE = 'ecommerce.eventos';
const EXCHANGE_DLQ = 'ecommerce.eventos.dlq';

export interface OpcionesSuscripcion {
  /** Nombre de la cola duradera de este consumidor. */
  cola: string;
  /** Patrones de routing key, por ejemplo ['pedido.*', 'pago.aprobado']. */
  patrones: string[];
  /** Intentos antes de enviar el mensaje a la dead letter queue. */
  maxIntentos?: number;
}

type Manejador = (evento: EventoDominio) => Promise<void>;

/** Espera maxima entre reintentos de conexion con el broker. */
const ESPERA_MAXIMA_MS = 30_000;

export class BusEventos {
  private conexion?: ChannelModel;
  private canal?: Channel;
  private conectando?: Promise<void>;
  private readonly log = crearLogger('bus-eventos');
  private readonly url: string;
  private cerrado = false;
  private reconectando = false;
  /**
   * Suscripciones registradas. Se recuerdan para volver a declararlas en cada
   * reconexion: un canal nuevo no conserva los consumidores del anterior.
   */
  private readonly suscripciones: Array<{ opciones: OpcionesSuscripcion; manejador: Manejador }> = [];

  constructor(private readonly servicio: string) {
    this.url = process.env.RABBITMQ_URL || 'amqp://ecommerce:ecommerce@localhost:5672';
  }

  get conectado(): boolean {
    return Boolean(this.canal);
  }

  /**
   * Un intento de conexion. Si falla, deja en marcha la reconexion en segundo
   * plano y propaga el error a quien llamo.
   *
   * Antes, si el PRIMER intento fallaba (el servicio arrancaba antes que
   * RabbitMQ), nadie volvia a intentarlo: notificaciones quedaba sin
   * suscripcion hasta reiniciarlo. Y tras una caida del broker se reconectaba
   * el canal pero no los consumidores. Ahora ambos casos se recuperan solos
   * (docs/calidad/RENDIMIENTO.md 9.6, arranque en frio).
   */
  async conectar(): Promise<void> {
    if (this.canal) return;
    if (this.conectando) return this.conectando;

    this.conectando = (async () => {
      const conexion = await amqp.connect(this.url, { clientProperties: { connection_name: this.servicio } });
      const canal = await conexion.createChannel();

      await canal.assertExchange(EXCHANGE, 'topic', { durable: true });
      await canal.assertExchange(EXCHANGE_DLQ, 'topic', { durable: true });

      conexion.on('error', (e) => this.log.error('Error de conexion con el broker', { error: e.message }));
      conexion.on('close', () => {
        this.canal = undefined;
        this.conexion = undefined;
        if (!this.cerrado) {
          this.log.warn('Conexion con el broker cerrada; se reintentara');
          this.reconectarEnSegundoPlano();
        }
      });

      this.conexion = conexion;
      this.canal = canal;
      for (const { opciones, manejador } of this.suscripciones) {
        await this.prepararSuscripcion(canal, opciones, manejador);
      }
      this.log.info('Conectado al message broker', { exchange: EXCHANGE, suscripciones: this.suscripciones.length });
    })();

    try {
      await this.conectando;
    } catch (error) {
      this.reconectarEnSegundoPlano();
      throw error;
    } finally {
      this.conectando = undefined;
    }
  }

  /** Reintenta con espera exponencial (1 s, 2 s, 4 s... hasta 30 s) hasta conectar. */
  private reconectarEnSegundoPlano(): void {
    if (this.reconectando || this.cerrado) return;
    this.reconectando = true;
    let espera = Number(process.env.BUS_ESPERA_INICIAL_MS || 1000);
    const intentar = (): void => {
      if (this.cerrado || this.canal) {
        this.reconectando = false;
        return;
      }
      this.conectar()
        .then(() => {
          this.reconectando = false;
          this.log.info('Reconectado al message broker');
        })
        .catch((error) => {
          this.log.warn('Broker no disponible, se reintentara', {
            espera_ms: espera,
            error: error instanceof Error ? error.message : String(error)
          });
          setTimeout(intentar, espera).unref?.();
          espera = Math.min(espera * 2, ESPERA_MAXIMA_MS);
        });
    };
    setTimeout(intentar, espera).unref?.();
    espera = Math.min(espera * 2, ESPERA_MAXIMA_MS);
  }

  /**
   * Publica un evento de dominio. Si el broker no esta disponible el evento se
   * registra y la operacion principal continua: publicar una notificacion
   * nunca debe tumbar una venta ya confirmada.
   */
  async publicar<T>(nombre: NombreEvento, datos: T, requestId?: string): Promise<boolean> {
    const evento: EventoDominio<T> = {
      nombre,
      ocurrido_en: new Date().toISOString(),
      request_id: requestId,
      datos
    };

    // Durante una caida del broker no se espera a otro intento de conexion: la
    // reconexion ya corre en segundo plano y la operacion principal sigue.
    if (!this.canal && this.reconectando) {
      this.log.error('No fue posible publicar el evento: broker no disponible', { evento: nombre, request_id: requestId });
      return false;
    }

    try {
      await this.conectar();
      const publicado = this.canal!.publish(
        EXCHANGE,
        nombre,
        Buffer.from(JSON.stringify(evento)),
        {
          persistent: true,
          contentType: 'application/json',
          messageId: `${nombre}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
          headers: { 'x-request-id': requestId ?? '', 'x-origen': this.servicio }
        }
      );
      this.log.info('Evento publicado', { evento: nombre, request_id: requestId });
      return publicado;
    } catch (error) {
      this.log.error('No fue posible publicar el evento', {
        evento: nombre,
        request_id: requestId,
        error: error instanceof Error ? error.message : error
      });
      return false;
    }
  }

  /**
   * Suscribe un manejador. El mensaje se confirma (ack) solo si el manejador
   * termina sin lanzar; si falla, se reencola hasta maxIntentos y despues se
   * envia a la dead letter queue.
   */
  async suscribir(opciones: OpcionesSuscripcion, manejador: Manejador): Promise<void> {
    this.suscripciones.push({ opciones, manejador });
    if (this.canal) {
      await this.prepararSuscripcion(this.canal, opciones, manejador);
      return;
    }
    // Sin broker todavia: la suscripcion queda registrada y se declara al
    // conectar (lo hace conectar(), ahora o en un reintento). No se lanza: el
    // servicio arranca igual y su /health muestra el broker como caido.
    await this.conectar().catch((error) =>
      this.log.warn('Broker no disponible; la suscripcion se activara al conectar', {
        cola: opciones.cola,
        error: error instanceof Error ? error.message : String(error)
      })
    );
  }

  /** Declara la cola, su DLQ y los enlaces, y empieza a consumir. */
  private async prepararSuscripcion(canal: Channel, opciones: OpcionesSuscripcion, manejador: Manejador): Promise<void> {
    const maxIntentos = opciones.maxIntentos ?? 3;
    const colaFallidos = `${opciones.cola}.fallidos`;

    await canal.assertQueue(colaFallidos, { durable: true });
    await canal.bindQueue(colaFallidos, EXCHANGE_DLQ, opciones.cola);

    await canal.assertQueue(opciones.cola, {
      durable: true,
      deadLetterExchange: EXCHANGE_DLQ,
      deadLetterRoutingKey: opciones.cola
    });

    for (const patron of opciones.patrones) {
      await canal.bindQueue(opciones.cola, EXCHANGE, patron);
    }

    // Un mensaje a la vez por consumidor: reparte la carga entre replicas.
    await canal.prefetch(1);

    await canal.consume(opciones.cola, async (mensaje: ConsumeMessage | null) => {
      if (!mensaje) return;

      const intentos = Number(mensaje.properties.headers?.['x-intentos'] ?? 0) + 1;
      let evento: EventoDominio | undefined;

      try {
        evento = JSON.parse(mensaje.content.toString()) as EventoDominio;
        await manejador(evento);
        canal.ack(mensaje);
      } catch (error) {
        const mensajeError = error instanceof Error ? error.message : String(error);

        if (intentos >= maxIntentos) {
          this.log.error('Evento enviado a la dead letter queue', {
            evento: evento?.nombre,
            intentos,
            error: mensajeError
          });
          // nack sin requeue: el deadLetterExchange lo recoge.
          canal.nack(mensaje, false, false);
          return;
        }

        this.log.warn('Fallo al procesar el evento, se reencola', {
          evento: evento?.nombre,
          intentos,
          error: mensajeError
        });

        // Se reencola directo en la cola de ESTE consumidor. Antes se publicaba
        // de nuevo en el exchange, y el reintento llegaba tambien a las demas
        // colas ligadas al evento (clientes.historial lo procesaba otra vez).
        canal.ack(mensaje);
        canal.sendToQueue(opciones.cola, mensaje.content, {
          persistent: true,
          contentType: mensaje.properties.contentType,
          messageId: mensaje.properties.messageId,
          headers: { ...mensaje.properties.headers, 'x-intentos': intentos }
        });
      }
    });

    this.log.info('Suscripcion activa', { cola: opciones.cola, patrones: opciones.patrones });
  }

  async cerrar(): Promise<void> {
    this.cerrado = true;
    try {
      await this.canal?.close();
      await this.conexion?.close();
    } catch {
      /* ya estaba cerrado */
    }
  }
}
