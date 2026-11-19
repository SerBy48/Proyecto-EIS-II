import express from 'express';
import { describe, expect, it } from 'vitest';
import { proxiesDeConfianza } from '../src/proxies';

describe('proxies de confianza del gateway (despliegue en la nube)', () => {
  it('por defecto 1 (nginx); acepta 2 y 3', () => {
    expect(proxiesDeConfianza(undefined)).toBe(1);
    expect(proxiesDeConfianza('2')).toBe(2);
    expect(proxiesDeConfianza('3')).toBe(3);
  });

  it('un valor invalido vuelve a 1: nunca se confia de mas en X-Forwarded-For', () => {
    for (const v of ['0', '-1', '4', '1.5', 'true', 'abc', '']) expect(proxiesDeConfianza(v)).toBe(1);
  });

  it('con 2, Express toma la IP de la persona y no la del proxy ni la que inventa el cliente', () => {
    const app = express();
    app.set('trust proxy', proxiesDeConfianza('2'));
    const ipDe = (xff: string, remota: string) => {
      // Peticion simulada: remota = nginx; X-Forwarded-For = lo que escribio el
      // cliente, lo que agrego Caddy y lo que agrego nginx.
      const req = Object.create(app.request, {
        headers: { value: { 'x-forwarded-for': xff } },
        socket: { value: { remoteAddress: remota } },
        connection: { value: { remoteAddress: remota } },
        app: { value: app }
      });
      return req.ip as string;
    };
    // Caddy agrega la IP real de la persona; nginx, la de Caddy.
    expect(ipDe('203.0.113.7, 172.18.0.5', '172.18.0.9')).toBe('203.0.113.7');
    // Un cliente que escribe su propio X-Forwarded-For no elige su IP.
    expect(ipDe('1.2.3.4, 203.0.113.7, 172.18.0.5', '172.18.0.9')).toBe('203.0.113.7');
    // Con 1 (sin el ajuste), detras de Caddy todos serian la IP de Caddy.
    app.set('trust proxy', 1);
    expect(ipDe('203.0.113.7, 172.18.0.5', '172.18.0.9')).toBe('172.18.0.5');
  });
});
