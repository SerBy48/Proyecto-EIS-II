import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * El broker se simula: lo que se prueba es la politica del bus (publicar nunca
 * lanza; reintento en la propia cola; dead letter queue al agotar intentos), no
 * RabbitMQ. La integracion real la cubren test:e2e y test:http.
 */
const canal = {
  assertExchange: vi.fn(async () => ({})),
  assertQueue: vi.fn(async () => ({})),
  bindQueue: vi.fn(async () => ({})),
  prefetch: vi.fn(async () => undefined),
  consume: vi.fn(async (_cola: string, manejador: (m: unknown) => Promise<void>) => {
    consumidor = manejador;
    return { consumerTag: 'c1' };
  }),
  publish: vi.fn(() => true),
  sendToQueue: vi.fn(() => true),
  ack: vi.fn(),
  nack: vi.fn(),
  close: vi.fn(async () => undefined)
};
const conexion = { createChannel: vi.fn(async () => canal), on: vi.fn(), close: vi.fn(async () => undefined) };
const conectar = vi.fn(async () => conexion);
let consumidor: (m: unknown) => Promise<void>;

vi.mock('amqplib', () => ({ default: { connect: (...a: unknown[]) => conectar(...(a as [])) } }));

const { BusEventos } = await import('../src/bus-eventos');

const mensaje = (intentosPrevios?: number) => ({
  content: Buffer.from(JSON.stringify({ nombre: 'pedido.confirmado', datos: { pedido_id: 1 } })),
  fields: { routingKey: 'pedido.confirmado' },
  properties: {
    contentType: 'application/json',
    messageId: 'm1',
    headers: intentosPrevios === undefined ? {} : { 'x-intentos': intentosPrevios }
  }
});

beforeEach(() => vi.clearAllMocks());

describe('BusEventos.publicar (invariante 12)', () => {
  it('publica en el exchange topic con la routing key del evento y mensaje persistente', async () => {
    const bus = new BusEventos('prueba');
    await expect(bus.publicar('pedido.confirmado', { pedido_id: 1 }, 'req-1')).resolves.toBe(true);
    const [exchange, clave, contenido, opciones] = canal.publish.mock.calls[0] as unknown as [string, string, Buffer, any];
    expect(exchange).toBe('ecommerce.eventos');
    expect(clave).toBe('pedido.confirmado');
    expect(JSON.parse(contenido.toString())).toMatchObject({ nombre: 'pedido.confirmado', request_id: 'req-1' });
    expect(opciones.persistent).toBe(true);
  });

  it('si el broker no responde devuelve false y NO lanza: la venta no se cae', async () => {
    conectar.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const bus = new BusEventos('prueba');
    await expect(bus.publicar('pedido.confirmado', {})).resolves.toBe(false);
  });
});

describe('BusEventos: arranque y reconexion (Fase 5)', () => {
  it('si el broker no esta al arrancar, suscribir no lanza y la suscripcion se activa al reconectar', async () => {
    vi.useFakeTimers();
    try {
      conectar.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const bus = new BusEventos('prueba');
      await expect(bus.suscribir({ cola: 'cola.prueba', patrones: ['pedido.*'] }, async () => undefined)).resolves.toBeUndefined();
      expect(bus.conectado).toBe(false);
      expect(canal.consume).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1_000); // primer reintento
      expect(bus.conectado).toBe(true);
      expect(canal.consume).toHaveBeenCalledWith('cola.prueba', expect.any(Function));
      await bus.cerrar();
    } finally {
      vi.useRealTimers();
    }
  });

  it('tras una caida del broker vuelve a declarar los consumidores en el canal nuevo', async () => {
    vi.useFakeTimers();
    try {
      const bus = new BusEventos('prueba');
      await bus.suscribir({ cola: 'cola.prueba', patrones: ['pedido.*'] }, async () => undefined);
      expect(canal.consume).toHaveBeenCalledTimes(1);

      // La conexion se cierra: se invoca el manejador "close" registrado.
      const alCerrar = (conexion.on.mock.calls as unknown as Array<[string, () => void]>).find(([e]) => e === 'close')![1];
      alCerrar();
      expect(bus.conectado).toBe(false);
      // Mientras reconecta, publicar no espera: devuelve false al instante.
      await expect(bus.publicar('pedido.confirmado', {})).resolves.toBe(false);

      await vi.advanceTimersByTimeAsync(1_000);
      expect(bus.conectado).toBe(true);
      expect(canal.consume).toHaveBeenCalledTimes(2);
      await bus.cerrar();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('BusEventos.suscribir: reintentos y dead letter queue', () => {
  const suscribir = async (manejador: () => Promise<void>) => {
    const bus = new BusEventos('prueba');
    await bus.suscribir({ cola: 'notificaciones.envio', patrones: ['pedido.*'], maxIntentos: 3 }, manejador);
  };

  it('declara la cola con su dead letter exchange y la cola de fallidos', async () => {
    await suscribir(async () => undefined);
    expect(canal.assertQueue).toHaveBeenCalledWith('notificaciones.envio.fallidos', { durable: true });
    expect(canal.assertQueue).toHaveBeenCalledWith('notificaciones.envio', {
      durable: true,
      deadLetterExchange: 'ecommerce.eventos.dlq',
      deadLetterRoutingKey: 'notificaciones.envio'
    });
    expect(canal.bindQueue).toHaveBeenCalledWith('notificaciones.envio', 'ecommerce.eventos', 'pedido.*');
  });

  it('si el manejador termina, confirma el mensaje (ack)', async () => {
    await suscribir(async () => undefined);
    const m = mensaje();
    await consumidor(m);
    expect(canal.ack).toHaveBeenCalledWith(m);
    expect(canal.nack).not.toHaveBeenCalled();
  });

  it('si falla, lo reencola en SU cola con el contador de intentos (no en el exchange)', async () => {
    await suscribir(async () => {
      throw new Error('SMTP caido');
    });
    await consumidor(mensaje());
    expect(canal.ack).toHaveBeenCalled();
    expect(canal.publish).not.toHaveBeenCalled(); // no le llega de nuevo a otras colas
    const [cola, , opciones] = canal.sendToQueue.mock.calls[0] as unknown as [string, Buffer, any];
    expect(cola).toBe('notificaciones.envio');
    expect(opciones.headers['x-intentos']).toBe(1);
  });

  it('al agotar los intentos lo rechaza sin reencolar: va a la dead letter queue', async () => {
    await suscribir(async () => {
      throw new Error('SMTP caido');
    });
    const m = mensaje(2); // tercer intento
    await consumidor(m);
    expect(canal.nack).toHaveBeenCalledWith(m, false, false);
    expect(canal.sendToQueue).not.toHaveBeenCalled();
  });

  it('un mensaje que no es JSON tambien termina en la DLQ tras los intentos', async () => {
    await suscribir(async () => undefined);
    const roto = { ...mensaje(2), content: Buffer.from('{no es json') };
    await consumidor(roto);
    expect(canal.nack).toHaveBeenCalledWith(roto, false, false);
  });
});
