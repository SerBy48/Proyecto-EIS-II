/**
 * Cabeceras de seguridad de la web (hallazgo S-08 de docs/calidad/SEGURIDAD.md).
 *
 * El gateway no envia CSP a proposito: sus respuestas son JSON, y la politica
 * le corresponde a quien sirve el HTML. Pero la web tampoco la enviaba, y ZAP
 * marco la ausencia de CSP, de proteccion contra clickjacking y de nosniff.
 *
 * Estas cabeceras las aplica `vite preview` (el build de produccion) y son la
 * referencia para el servidor que publique la web en un despliegue real
 * (nginx, CDN); ver la seccion 8 de SEGURIDAD.md.
 *
 * La CSP es estricta porque la web lo permite: no carga scripts, estilos,
 * fuentes ni imagenes de otros dominios, y el index.html no tiene scripts en
 * linea. Si algun dia se agrega un recurso externo, hay que declararlo aqui.
 */

/** Origen de la API si se configura fuera del mismo dominio (VITE_API_URL). */
const origenApi = (() => {
  try {
    return process.env.VITE_API_URL ? new URL(process.env.VITE_API_URL).origin : '';
  } catch {
    return '';
  }
})();

export const POLITICA_CONTENIDO = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self'${origenApi ? ` ${origenApi}` : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ');

/** Cabeceras que no dependen de la CSP: sirven tambien en desarrollo. */
export const CABECERAS_BASICAS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin'
};

/**
 * Juego completo para el build de produccion. COEP require-corp es seguro
 * porque todos los recursos son del mismo origen.
 */
export const CABECERAS_PRODUCCION = {
  ...CABECERAS_BASICAS,
  'Content-Security-Policy': POLITICA_CONTENIDO,
  'Cross-Origin-Embedder-Policy': 'require-corp'
};
