import React from 'react';

// Las reglas (sin JSX) viven en reglas.js para probarlas con Vitest contra las
// del backend (clients/web/test/reglas.test.ts).
export { reglas, validar, soloTelefono } from './reglas.js';

/** Atributos de accesibilidad de un campo con su mensaje de error (WCAG 3.3.1). */
export const atributosError = (id, error) =>
  error ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } : { 'aria-invalid': undefined };

/** Mensaje de error debajo del campo. */
export function ErrorCampo({ id, error }) {
  if (!error) return null;
  return (
    <p id={`${id}-error`} className="text-red-700 text-xs mt-1">
      {error}
    </p>
  );
}
