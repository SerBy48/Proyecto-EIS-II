import { describe, expect, it } from 'vitest';
import { validarProveedor } from '../../../services/inventario-service/src/proveedores';
// @ts-ignore modulo JavaScript de la web, sin tipos
import { reglas, soloTelefono, validar } from '../src/servicios/reglas.js';

/**
 * F5e: la web valida junto al campo con las MISMAS reglas que el servicio.
 * Si una cambia y la otra no, el usuario veria un error que el formulario no
 * le anuncio (o al reves). Cada valor se prueba en los dos lados.
 */
const aceptaElServidor = (campos: Record<string, unknown>) => {
  try {
    validarProveedor(campos, true);
    return true;
  } catch {
    return false;
  }
};

describe('validaciones de la web = validaciones del servidor (proveedores)', () => {
  const telefonos = ['6015550101', '(601) 555 0101', '+57 300 123 4567', '601-555-0101', '601-ABC-0101', 'telefono', '12345', '1234567890123456'];
  it.each(telefonos)('telefono %s', (t) => {
    expect(reglas.telefonoProveedor(t) === null).toBe(aceptaElServidor({ telefono: t }));
  });

  const correos = ['compras@proveedor.com', 'Compras@X.co', 'no-es-correo', 'ana@correo', 'con espacio@x.co', '@x.co', 'a@b.c'];
  it.each(correos)('correo %s', (c) => {
    expect(reglas.correo(c) === null).toBe(aceptaElServidor({ email: c }));
  });

  const nits = ['900123456-1', '900.123.456-1', '900123456', '12', 'ABC123456', '900123456-12'];
  it.each(nits)('NIT %s', (n) => {
    expect(reglas.nit(n) === null).toBe(aceptaElServidor({ nit: n }));
  });

  it('las letras no entran en un campo de telefono', () => {
    expect(soloTelefono('601abc 555-0101')).toBe('601 555-0101');
    expect(soloTelefono('+57 (300) x123')).toBe('+57 (300) 123');
  });

  it('validar devuelve solo los campos con error, con un mensaje en espanol', () => {
    const errores = validar(
      { nombre: 'AB', nit: '900123456-1', telefono: '601', email: 'sin-arroba' },
      { nombre: [reglas.minimo(3, 'La razón social')], nit: [reglas.nit], telefono: [reglas.telefonoProveedor], email: [reglas.correo] }
    );
    expect(Object.keys(errores).sort()).toEqual(['email', 'nombre', 'telefono']);
    expect(errores.email).toMatch(/@/);
  });
});

describe('telefono y documento del cliente (clientes-service)', () => {
  it('acepta numeros, espacios y guiones; rechaza letras', () => {
    expect(reglas.telefonoCliente('300 123 4567')).toBeNull();
    expect(reglas.telefonoCliente('+57 300-123-4567')).toBeNull();
    expect(reglas.telefonoCliente('300 ABC 4567')).toMatch(/números/);
    expect(reglas.documento('1075123456')).toBeNull();
    expect(reglas.documento('12')).toMatch(/mínimo 4/);
  });
});
