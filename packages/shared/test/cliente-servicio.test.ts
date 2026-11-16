import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClienteServicio } from '../src/cliente-servicio';
import { ErrorApp } from '../src/errores';

/** Respuesta HTTP simulada para fetch. */
const respuesta = (estado: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'content-type': 'application/json' } });

/** fetch simulado que devuelve, en orden, las respuestas indicadas. */
const simularFetch = (...secuencia: Array<Response | Error>) => {
  const fetchSimulado = vi.fn(async () => {
    const siguiente = secuencia.shift();
    if (!siguiente) throw new Error('No hay mas respuestas simuladas');
    if (siguiente instanceof Error) throw siguiente;
    return siguiente;
  });
  vi.stubGlobal('fetch', fetchSimulado);
  return fetchSimulado;
};

const cliente = (opciones: Partial<ConstructorParameters<typeof ClienteServicio>[0]> = {}) =>
  new ClienteServicio({
    nombre: 'inventario',
    urlBase: 'http://inventario:3004',
    timeoutMs: 200,
    reintentos: 2,
    circuito: { umbralFallos: 50 },
    ...opciones
  });

afterEach(() => vi.unstubAllGlobals());

describe('ClienteServicio: reintentos (invariante 7)', () => {
  it('reintenta un 5xx y devuelve la respuesta cuando el servicio se recupera', async () => {
    const fetchSimulado = simularFetch(respuesta(503, { mensaje: 'ocupado' }), respuesta(200, { disponible: 3 }));
    await expect(cliente().pedir({ ruta: '/stock/SKU-1' })).resolves.toEqual({ disponible: 3 });
    expect(fetchSimulado).toHaveBeenCalledTimes(2);
  });

  it('reintenta los errores de red y, si persisten, responde 503 SERVICIO_NO_DISPONIBLE', async () => {
    const fetchSimulado = simularFetch(new TypeError('fetch failed'), new TypeError('fetch failed'), new TypeError('fetch failed'));
    const error = await cliente().pedir({ ruta: '/stock/SKU-1' }).catch((e) => e);
    expect(fetchSimulado).toHaveBeenCalledTimes(3); // 1 intento + 2 reintentos
    expect(error).toBeInstanceOf(ErrorApp);
    expect(error.estado).toBe(503);
    expect(error.codigo).toBe('SERVICIO_NO_DISPONIBLE');
  });

  it('NO reintenta un 409: es una respuesta de negocio valida', async () => {
    const fetchSimulado = simularFetch(respuesta(409, { mensaje: 'Stock insuficiente', codigo: 'STOCK_INSUFICIENTE' }));
    const error = await cliente().pedir({ metodo: 'POST', ruta: '/reservas' }).catch((e) => e);
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
    expect(error.estado).toBe(409);
    expect(error.codigo).toBe('STOCK_INSUFICIENTE');
    expect(error.message).toBe('Stock insuficiente');
  });

  it('NO reintenta ningun 4xx (404)', async () => {
    const fetchSimulado = simularFetch(respuesta(404, { mensaje: 'No existe', codigo: 'NO_ENCONTRADO' }));
    await expect(cliente().pedir({ ruta: '/stock/X' })).rejects.toMatchObject({ estado: 404 });
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
  });

  it('con reintentos: 0 (el cobro) hace un solo intento aunque falle con 5xx', async () => {
    const fetchSimulado = simularFetch(respuesta(502, { mensaje: 'pasarela' }));
    await expect(cliente({ nombre: 'pagos', reintentos: 0 }).pedir({ metodo: 'POST', ruta: '/cobros' })).rejects.toMatchObject({
      estado: 502
    });
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
  });

  it('un servicio que no responde a tiempo da 504 TIMEOUT', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolver, rechazar) => {
            init.signal?.addEventListener('abort', () => {
              const error = new Error('abortado');
              error.name = 'AbortError';
              rechazar(error);
            });
          })
      )
    );
    const error = await cliente({ reintentos: 0, timeoutMs: 50 }).pedir({ ruta: '/lento' }).catch((e) => e);
    expect(error.estado).toBe(504);
    expect(error.codigo).toBe('TIMEOUT');
  });
});

describe('ClienteServicio: cabeceras de la llamada interna', () => {
  it('envia el secreto Y la declaracion de llamada interna (invariante 11)', async () => {
    const fetchSimulado = simularFetch(respuesta(200, {}));
    await cliente().pedir({ ruta: '/x' });
    const cabeceras = (fetchSimulado.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
    expect(cabeceras['x-internal-token']).toBe(process.env.INTERNAL_TOKEN);
    expect(cabeceras['x-llamada-interna']).toBe('1');
  });

  it('propaga la clave de idempotencia, el request_id y la identidad del usuario', async () => {
    const fetchSimulado = simularFetch(respuesta(201, {}));
    await cliente().pedir({
      metodo: 'POST',
      ruta: '/reservas',
      cuerpo: { sku: 'SKU-1', cantidad: 1 },
      claveIdempotencia: 'clave-1',
      requestId: 'req-1',
      usuario: { sub: 3, email: 'ana@correo.co', rol: 'cliente', cliente_id: 1 }
    });
    const [url, init] = fetchSimulado.mock.calls[0] as unknown as [string, RequestInit];
    const cabeceras = init.headers as Record<string, string>;
    expect(url).toBe('http://inventario:3004/reservas');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ sku: 'SKU-1', cantidad: 1 });
    expect(cabeceras['idempotency-key']).toBe('clave-1');
    expect(cabeceras['x-request-id']).toBe('req-1');
    expect(cabeceras['x-usuario-rol']).toBe('cliente');
    expect(cabeceras['x-cliente-id']).toBe('1');
  });
});

describe('ClienteServicio: circuit breaker', () => {
  it('tras abrirse, no llama al servicio y usa la alternativa', async () => {
    const fetchSimulado = simularFetch(respuesta(500, {}), respuesta(500, {}));
    const c = cliente({ reintentos: 0, circuito: { umbralFallos: 2, esperaReapertura: 60_000 } });
    await c.pedir({ ruta: '/x' }).catch(() => undefined);
    await c.pedir({ ruta: '/x' }).catch(() => undefined);
    expect(c.metricas.estado).toBe('abierto');
    await expect(c.pedir({ ruta: '/x', alternativa: () => [] })).resolves.toEqual([]);
    expect(fetchSimulado).toHaveBeenCalledTimes(2);
  });
});
