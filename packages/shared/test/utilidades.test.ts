import { describe, expect, it, vi } from 'vitest';
import { asincrono, enteroPositivo, exigirCampos, textoDeConsulta } from '../src/utilidades';

describe('exigirCampos', () => {
  it('devuelve los campos ausentes, nulos o vacios', () => {
    expect(exigirCampos({ email: 'a@b.co', password: '', nombre: null }, ['email', 'password', 'nombre', 'x'])).toEqual([
      'password',
      'nombre',
      'x'
    ]);
  });

  it('acepta 0 y false como valores presentes', () => {
    expect(exigirCampos({ cantidad: 0, activo: false }, ['cantidad', 'activo'])).toEqual([]);
  });

  it('no falla con un cuerpo ausente', () => {
    expect(exigirCampos(undefined as never, ['email'])).toEqual(['email']);
  });
});

describe('textoDeConsulta (hallazgo S-05, inyeccion NoSQL)', () => {
  it('acepta texto y ausencia', () => {
    expect(textoDeConsulta('tecnologia', 'categoria')).toBe('tecnologia');
    expect(textoDeConsulta(undefined, 'categoria')).toBeUndefined();
  });

  it('rechaza con 400 un objeto como ?categoria[$ne]=x', () => {
    expect(() => textoDeConsulta({ $ne: 'x' }, 'categoria')).toThrow(/debe ser un texto simple/);
    try {
      textoDeConsulta(['a', 'b'], 'q');
    } catch (error) {
      expect((error as { estado: number }).estado).toBe(400);
    }
  });
});

describe('enteroPositivo', () => {
  it.each([
    ['5', 5],
    [3, 3],
    ['0', undefined],
    ['-2', undefined],
    ['1.5', undefined],
    ['abc', undefined]
  ])('%o -> %o', (valor, esperado) => {
    expect(enteroPositivo(valor)).toBe(esperado);
  });
});

describe('asincrono', () => {
  it('lleva al middleware de errores una promesa rechazada (si no, la peticion queda colgada)', async () => {
    const next = vi.fn();
    const error = new Error('boom');
    asincrono(async () => {
      throw error;
    })({} as never, {} as never, next);
    await new Promise((r) => setImmediate(r));
    expect(next).toHaveBeenCalledWith(error);
  });
});
