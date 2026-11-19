/**
 * Validaciones de los formularios de la web (F5e). Son las MISMAS reglas que
 * aplica el servicio dueno del dato; el servidor sigue siendo la autoridad,
 * pero el usuario ve el error junto al campo y antes de enviar, no al final.
 *
 *   inventario-service/src/proveedores.ts   NIT, telefono y correo del proveedor
 *   clientes-service/src/controlador.ts     telefono y documento del cliente
 *   auth-service                            correo de la cuenta
 *
 * Cada regla recibe el valor y devuelve el mensaje de error o null.
 */

// Igual que PATRON_CORREO del backend: algo@dominio.ext, sin espacios.
const PATRON_CORREO = /^[^\s@]{1,64}@[^\s@]{1,120}\.[^\s@]{2,}$/;
const PATRON_NIT = /^\d{6,12}(-\d)?$/;

export const reglas = {
  obligatorio: (nombre) => (v) => (String(v ?? '').trim() ? null : `Escribe ${nombre}.`),

  minimo: (n, nombre) => (v) => {
    const t = String(v ?? '').trim();
    return !t || t.length >= n ? null : `${nombre} debe tener al menos ${n} caracteres.`;
  },

  correo: (v) => {
    const t = String(v ?? '').trim();
    if (!t) return null;
    if (!t.includes('@')) return 'El correo debe tener una @, por ejemplo nombre@empresa.com.';
    return PATRON_CORREO.test(t) ? null : 'Revisa el correo: debe tener la forma nombre@empresa.com, sin espacios.';
  },

  /** Proveedor: de 7 a 15 digitos; se aceptan espacios, guiones, parentesis y un + inicial. */
  telefonoProveedor: (v) => {
    const t = String(v ?? '').replace(/[\s()-]/g, '');
    if (!t) return null;
    if (!/^\+?\d+$/.test(t)) return 'El teléfono solo admite números (y un + al inicio para el indicativo).';
    return t.replace('+', '').length >= 7 && t.replace('+', '').length <= 15 ? null : 'El teléfono debe tener de 7 a 15 dígitos.';
  },

  /** Cliente: numeros, espacios y guiones, de 7 a 20 caracteres (regla de clientes-service). */
  telefonoCliente: (v) => {
    const t = String(v ?? '').trim();
    if (!t) return null;
    if (!/^\+?[\d\s-]+$/.test(t)) return 'El teléfono solo admite números, espacios y guiones.';
    return t.length >= 7 && t.length <= 20 ? null : 'El teléfono debe tener de 7 a 20 caracteres.';
  },

  nit: (v) => {
    const t = String(v ?? '').replace(/[.\s]/g, '');
    if (!t) return 'Escribe el NIT.';
    return PATRON_NIT.test(t) ? null : 'El NIT tiene de 6 a 12 dígitos y, si quieres, el dígito de verificación: 900123456-1.';
  },

  documento: (v) => {
    const t = String(v ?? '').trim();
    if (!t) return null;
    return /^[A-Za-z0-9-]{4,30}$/.test(t) ? null : 'El documento solo admite letras, números y guiones (mínimo 4).';
  }
};

/** Aplica las reglas de cada campo y devuelve { campo: mensaje } solo con los que fallan. */
export const validar = (datos, esquema) => {
  const errores = {};
  for (const [campo, lista] of Object.entries(esquema)) {
    for (const regla of lista) {
      const error = regla(datos[campo]);
      if (error) {
        errores[campo] = error;
        break;
      }
    }
  }
  return errores;
};

/** Mientras se escribe un telefono solo entran los caracteres validos (las letras no). */
export const soloTelefono = (v) => v.replace(/[^\d\s()+-]/g, '');

