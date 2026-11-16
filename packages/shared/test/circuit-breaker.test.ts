import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CircuitBreaker } from '../src/circuit-breaker';
import { ErrorApp, errorNoEncontrado } from '../src/errores';

const falla = () => Promise.reject(new ErrorApp(503, 'caido'));
const funciona = () => Promise.resolve('ok');

describe('CircuitBreaker: transiciones de estado', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-15T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  const nuevo = () => new CircuitBreaker('prueba', { umbralFallos: 3, esperaReapertura: 10_000, umbralRecuperacion: 2 });

  it('arranca cerrado y deja pasar las llamadas', async () => {
    const cb = nuevo();
    expect(cb.estadoActual).toBe('cerrado');
    await expect(cb.ejecutar(funciona)).resolves.toBe('ok');
  });

  it('se abre al alcanzar el umbral de fallos consecutivos', async () => {
    const cb = nuevo();
    for (let i = 0; i < 2; i++) await expect(cb.ejecutar(falla)).rejects.toThrow('caido');
    expect(cb.estadoActual).toBe('cerrado');
    await expect(cb.ejecutar(falla)).rejects.toThrow('caido');
    expect(cb.estadoActual).toBe('abierto');
  });

  it('un exito reinicia la cuenta de fallos consecutivos', async () => {
    const cb = nuevo();
    await expect(cb.ejecutar(falla)).rejects.toThrow();
    await expect(cb.ejecutar(falla)).rejects.toThrow();
    await cb.ejecutar(funciona);
    await expect(cb.ejecutar(falla)).rejects.toThrow();
    expect(cb.estadoActual).toBe('cerrado');
  });

  it('abierto, rechaza de inmediato con 503 sin invocar la operacion', async () => {
    const cb = nuevo();
    for (let i = 0; i < 3; i++) await cb.ejecutar(falla).catch(() => undefined);
    const operacion = vi.fn(funciona);
    const error = await cb.ejecutar(operacion).catch((e) => e);
    expect(operacion).not.toHaveBeenCalled();
    expect(error).toBeInstanceOf(ErrorApp);
    expect(error.estado).toBe(503);
    expect(error.codigo).toBe('SERVICIO_NO_DISPONIBLE');
  });

  it('abierto, usa la alternativa si la hay (degradacion elegante)', async () => {
    const cb = nuevo();
    for (let i = 0; i < 3; i++) await cb.ejecutar(falla).catch(() => undefined);
    await expect(cb.ejecutar(funciona, () => 'sin stock')).resolves.toBe('sin stock');
  });

  it('el fallo que abre el circuito ya responde con la alternativa', async () => {
    const cb = nuevo();
    await cb.ejecutar(falla).catch(() => undefined);
    await cb.ejecutar(falla).catch(() => undefined);
    await expect(cb.ejecutar(falla, () => 'degradado')).resolves.toBe('degradado');
    expect(cb.estadoActual).toBe('abierto');
  });

  it('tras la espera pasa a semiabierto y se cierra con exitos seguidos', async () => {
    const cb = nuevo();
    for (let i = 0; i < 3; i++) await cb.ejecutar(falla).catch(() => undefined);
    vi.advanceTimersByTime(10_001);
    await cb.ejecutar(funciona);
    expect(cb.estadoActual).toBe('semiabierto');
    await cb.ejecutar(funciona);
    expect(cb.estadoActual).toBe('cerrado');
  });

  it('un fallo en semiabierto lo vuelve a abrir de inmediato', async () => {
    const cb = nuevo();
    for (let i = 0; i < 3; i++) await cb.ejecutar(falla).catch(() => undefined);
    vi.advanceTimersByTime(10_001);
    await expect(cb.ejecutar(falla)).rejects.toThrow();
    expect(cb.estadoActual).toBe('abierto');
    expect(cb.metricas.reabre_en_ms).toBe(10_000);
  });

  it('R7: en semiabierto pasa UNA llamada de prueba; las concurrentes reciben la alternativa al instante', async () => {
    const cb = nuevo();
    for (let i = 0; i < 3; i++) await cb.ejecutar(falla).catch(() => undefined);
    vi.advanceTimersByTime(10_001);

    let liberar!: (v: string) => void;
    const prueba = vi.fn(() => new Promise<string>((r) => (liberar = r)));
    const otra = vi.fn(funciona);

    const enVuelo = cb.ejecutar(prueba, () => 'alternativa');
    const concurrentes = await Promise.all([1, 2, 3].map(() => cb.ejecutar(otra, () => 'alternativa')));

    expect(prueba).toHaveBeenCalledTimes(1);
    expect(otra).not.toHaveBeenCalled(); // no esperaron a la dependencia
    expect(concurrentes).toEqual(['alternativa', 'alternativa', 'alternativa']);
    expect(cb.estadoActual).toBe('semiabierto');

    liberar('ok');
    await expect(enVuelo).resolves.toBe('ok');
    // Terminada la prueba, la siguiente llamada vuelve a probar y cierra el circuito.
    await expect(cb.ejecutar(funciona)).resolves.toBe('ok');
    expect(cb.estadoActual).toBe('cerrado');
  });

  it('R7: sin alternativa, las concurrentes en semiabierto fallan rapido con 503', async () => {
    const cb = nuevo();
    for (let i = 0; i < 3; i++) await cb.ejecutar(falla).catch(() => undefined);
    vi.advanceTimersByTime(10_001);
    const enVuelo = cb.ejecutar(() => new Promise<string>(() => undefined));
    const error = await cb.ejecutar(funciona).catch((e) => e);
    expect(error.codigo).toBe('SERVICIO_NO_DISPONIBLE');
    void enVuelo;
  });

  it('invariante 14: los 4xx no cuentan como fallo del servicio', async () => {
    const cb = nuevo();
    for (let i = 0; i < 10; i++) {
      await expect(cb.ejecutar(() => Promise.reject(errorNoEncontrado('SKU inexistente')))).rejects.toThrow(
        'SKU inexistente'
      );
    }
    expect(cb.estadoActual).toBe('cerrado');
  });

  it('los timeouts si cuentan, aunque no sean 5xx', async () => {
    const cb = nuevo();
    const timeout = () => Promise.reject(new ErrorApp(504, 'lento', 'TIMEOUT'));
    for (let i = 0; i < 3; i++) await cb.ejecutar(timeout).catch(() => undefined);
    expect(cb.estadoActual).toBe('abierto');
  });

  it('los errores de red (no ErrorApp) cuentan como fallo', async () => {
    const cb = nuevo();
    for (let i = 0; i < 3; i++) await cb.ejecutar(() => Promise.reject(new TypeError('fetch failed'))).catch(() => undefined);
    expect(cb.estadoActual).toBe('abierto');
  });
});
