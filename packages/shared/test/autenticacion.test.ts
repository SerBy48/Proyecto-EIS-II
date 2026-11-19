import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import {
  CABECERA_LLAMADA_INTERNA,
  detectarLlamadaInterna,
  firmarAcceso,
  firmarRenovacion,
  requiereRol,
  verificarAcceso,
  verificarRenovacion,
  verificarSecretos
} from '../src/autenticacion';
import { ErrorApp } from '../src/errores';
import { ClaimsToken, PeticionAutenticada } from '../src/tipos';

const ana: ClaimsToken = { sub: 3, email: 'ana@correo.co', rol: 'cliente', cliente_id: 1 };

/** Ejecuta un middleware y devuelve el error que paso a next() (o undefined). */
const ejecutar = (middleware: (req: PeticionAutenticada, res: never, next: (e?: unknown) => void) => void, req: object) => {
  let resultado: unknown = 'sin-llamar';
  middleware(req as PeticionAutenticada, undefined as never, (e?: unknown) => {
    resultado = e;
  });
  return resultado as ErrorApp | undefined;
};

const conToken = (token: string, extra: object = {}) => ({ headers: { authorization: `Bearer ${token}` }, ...extra });

describe('JWT de acceso y de renovacion', () => {
  it('firma y verifica los claims', () => {
    const claims = verificarAcceso(firmarAcceso(ana));
    expect(claims).toMatchObject(ana);
  });

  it('rechaza un token manipulado (rol cambiado sin la firma)', () => {
    const [cabecera, , firma] = firmarAcceso(ana).split('.');
    const cuerpoForjado = Buffer.from(JSON.stringify({ ...ana, rol: 'administrador' })).toString('base64url');
    expect(() => verificarAcceso(`${cabecera}.${cuerpoForjado}.${firma}`)).toThrow();
  });

  it('rechaza un token firmado con otro secreto', () => {
    const forjado = jwt.sign({ ...ana, rol: 'administrador' }, 'FirmaSecretaEcommerceDesarrollo');
    expect(() => verificarAcceso(forjado)).toThrow();
  });

  it('rechaza un token expirado', () => {
    const vencido = jwt.sign({ ...ana, exp: Math.floor(Date.now() / 1000) - 10 }, process.env.JWT_SECRET!);
    expect(() => verificarAcceso(vencido)).toThrow(jwt.TokenExpiredError);
  });

  it('un token de renovacion no sirve como token de acceso (secretos distintos)', () => {
    const renovacion = firmarRenovacion({ sub: 3 });
    expect(verificarRenovacion(renovacion).sub).toBe(3);
    expect(() => verificarAcceso(renovacion)).toThrow();
  });
});

describe('verificarSecretos (invariante 13)', () => {
  const conSecreto = (nombre: string, valor: string | undefined, prueba: () => void) => {
    const original = process.env[nombre];
    if (valor === undefined) delete process.env[nombre];
    else process.env[nombre] = valor;
    try {
      prueba();
    } finally {
      process.env[nombre] = original;
    }
  };

  it('acepta secretos largos y propios', () => {
    expect(() => verificarSecretos()).not.toThrow();
  });

  it('falla si falta un secreto', () => {
    conSecreto('JWT_SECRET', undefined, () => expect(() => verificarSecretos()).toThrow(/JWT_SECRET no esta definido/));
  });

  it('falla con menos de 32 caracteres', () => {
    conSecreto('INTERNAL_TOKEN', 'corto', () => expect(() => verificarSecretos()).toThrow(/menos de 32/));
  });

  it('falla con un valor que estuvo publicado en el repositorio', () => {
    conSecreto('JWT_SECRET', 'FirmaSecretaEcommerceDesarrollo', () =>
      expect(() => verificarSecretos()).toThrow(/valor publicado/)
    );
  });
});

describe('requiereRol (RBAC)', () => {
  it('sin token responde 401', () => {
    const error = ejecutar(requiereRol(), { headers: {} });
    expect(error?.estado).toBe(401);
  });

  it('con token invalido responde 401', () => {
    const error = ejecutar(requiereRol(), conToken('no-es-un-jwt'));
    expect(error?.estado).toBe(401);
    expect(error?.message).toBe('Token invalido.');
  });

  it('con token expirado lo dice en el mensaje', () => {
    const vencido = jwt.sign({ ...ana, exp: Math.floor(Date.now() / 1000) - 10 }, process.env.JWT_SECRET!);
    expect(ejecutar(requiereRol(), conToken(vencido))?.message).toBe('Token expirado.');
  });

  it('con un rol no permitido responde 403', () => {
    const error = ejecutar(requiereRol('administrador', 'vendedor'), conToken(firmarAcceso(ana)));
    expect(error?.estado).toBe(403);
  });

  it('con el rol permitido pasa y deja la identidad en la peticion', () => {
    const req = conToken(firmarAcceso(ana)) as PeticionAutenticada;
    expect(ejecutar(requiereRol('cliente'), req)).toBeUndefined();
    expect(req.usuario?.cliente_id).toBe(1);
  });

  it('una llamada interna ya autenticada pasa sin JWT', () => {
    expect(ejecutar(requiereRol('administrador'), { headers: {}, esLlamadaInterna: true })).toBeUndefined();
  });
});

describe('detectarLlamadaInterna (invariante 11: exige DOS condiciones)', () => {
  const secreto = () => process.env.INTERNAL_TOKEN!;

  it('secreto + cabecera de llamada interna: es interna', () => {
    const req = { headers: { 'x-internal-token': secreto(), [CABECERA_LLAMADA_INTERNA]: '1' } } as unknown as PeticionAutenticada;
    ejecutar(detectarLlamadaInterna, req);
    expect(req.esLlamadaInterna).toBe(true);
  });

  it('solo el secreto (lo que envia el gateway): NO es interna', () => {
    const req = { headers: { 'x-internal-token': secreto() } } as unknown as PeticionAutenticada;
    ejecutar(detectarLlamadaInterna, req);
    expect(req.esLlamadaInterna).toBeUndefined();
  });

  it('cabecera de llamada interna con un secreto falso: NO es interna', () => {
    const req = { headers: { 'x-internal-token': 'adivinado', [CABECERA_LLAMADA_INTERNA]: '1' } } as unknown as PeticionAutenticada;
    ejecutar(detectarLlamadaInterna, req);
    expect(req.esLlamadaInterna).toBeUndefined();
  });

  it('la identidad propagada solo se acepta con el secreto valido', () => {
    const cabecerasUsuario = { 'x-usuario-id': '1', 'x-usuario-rol': 'administrador' };
    const sinSecreto = { headers: { ...cabecerasUsuario } } as unknown as PeticionAutenticada;
    ejecutar(detectarLlamadaInterna, sinSecreto);
    expect(sinSecreto.usuario).toBeUndefined();

    const conSecreto = { headers: { ...cabecerasUsuario, 'x-internal-token': secreto() } } as unknown as PeticionAutenticada;
    ejecutar(detectarLlamadaInterna, conSecreto);
    expect(conSecreto.usuario?.rol).toBe('administrador');
  });
});
