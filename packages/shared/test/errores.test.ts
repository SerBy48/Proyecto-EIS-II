import { describe, expect, it } from 'vitest';
import { ErrorApp, errorDePostgres, esFalloDelServicio, traducirErrorDeEntrada } from '../src/errores';

describe('errorDePostgres', () => {
  it('lee el error directo del driver pg', () => {
    expect(errorDePostgres({ code: '23505', constraint: 'usuarios_email_key' })).toEqual({
      code: '23505',
      constraint: 'usuarios_email_key'
    });
  });

  it('desenvuelve el error que envuelve Drizzle (DrizzleQueryError.cause)', () => {
    const envuelto = Object.assign(new Error('Failed query'), {
      cause: { code: '23505', constraint: 'uq_usuarios_cliente' }
    });
    expect(errorDePostgres(envuelto)?.constraint).toBe('uq_usuarios_cliente');
  });

  it('no confunde los codigos de Node ni los de la aplicacion con SQLSTATE', () => {
    expect(errorDePostgres({ code: 'ECONNREFUSED' })).toBeNull();
    expect(errorDePostgres(new ErrorApp(404, 'x', 'NO_ENCONTRADO'))).toBeNull();
    expect(errorDePostgres(null)).toBeNull();
  });
});

describe('traducirErrorDeEntrada', () => {
  it('un valor demasiado largo (22001) es un 400, no un 500', () => {
    const traducido = traducirErrorDeEntrada({ code: '22001' });
    expect(traducido?.estado).toBe(400);
    expect(traducido?.codigo).toBe('VALOR_INVALIDO');
  });

  it('tambien cuando el error viene envuelto por el ORM', () => {
    expect(traducirErrorDeEntrada({ cause: { code: '23514' } })?.estado).toBe(400);
  });

  it('JSON invalido y cuerpo demasiado grande', () => {
    expect(traducirErrorDeEntrada({ type: 'entity.parse.failed' })?.codigo).toBe('JSON_INVALIDO');
    expect(traducirErrorDeEntrada({ type: 'entity.too.large' })?.estado).toBe(413);
  });

  it('no traduce un error del servidor (p. ej. 23505 o una conexion caida)', () => {
    expect(traducirErrorDeEntrada({ code: '23505' })).toBeNull();
    expect(traducirErrorDeEntrada(new Error('boom'))).toBeNull();
  });
});

describe('esFalloDelServicio (criterio de reintentos y del circuit breaker)', () => {
  it.each([
    [new ErrorApp(500, 'x'), true],
    [new ErrorApp(503, 'x'), true],
    [new ErrorApp(504, 'x', 'TIMEOUT'), true],
    [new TypeError('fetch failed'), true],
    [new ErrorApp(400, 'x'), false],
    [new ErrorApp(404, 'x'), false],
    [new ErrorApp(409, 'x', 'STOCK_INSUFICIENTE'), false]
  ])('%o -> %s', (error, esperado) => {
    expect(esFalloDelServicio(error)).toBe(esperado);
  });
});
