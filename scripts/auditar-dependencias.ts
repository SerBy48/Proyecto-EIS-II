/**
 * Auditoria de dependencias de produccion (CI, paso "Dependencias de
 * produccion sin vulnerabilidades altas").
 *
 * Igual que `npm audit --omit=dev --audit-level=high`, pero con una lista de
 * avisos ACEPTADOS por escrito, como los riesgos aceptados de test:seguridad
 * (V-13 = S-09). Cada aviso aceptado lleva su justificacion y una fecha de
 * revision: pasada esa fecha el CI vuelve a fallar y obliga a revisarlo.
 * Cualquier otro aviso alto o critico hace fallar el paso.
 *
 *   npm run auditar:dependencias
 */
import { execSync } from 'node:child_process';

interface AvisoAceptado {
  justificacion: string;
  /** AAAA-MM-DD: desde ese dia el aviso vuelve a hacer fallar el CI. */
  revisarAntesDe: string;
}

const ACEPTADOS: Record<string, AvisoAceptado> = {
  // docs/calidad/SEGURIDAD.md, seccion 11.
  'GHSA-fc5q-39xc-vjpf': {
    justificacion:
      'ReDoS de picomatch al compilar patrones extglob. Llega por http-proxy-middleware -> micromatch en el gateway, ' +
      'que monta el proxy por prefijo de Express sin pathFilter ni globs: no compila patrones, y ninguno viene del usuario. ' +
      'No hay version corregida (afecta <= 4.0.7); npm solo propone bajar http-proxy-middleware a 0.19.2.',
    revisarAntesDe: '2027-01-31'
  }
};

const NIVELES_QUE_FALLAN = new Set(['high', 'critical']);

interface Via {
  url?: string;
  title?: string;
  severity?: string;
  range?: string;
}

const salida = (() => {
  try {
    return execSync('npm audit --omit=dev --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    // npm audit sale con codigo distinto de 0 cuando encuentra avisos.
    return String((error as { stdout?: string }).stdout ?? '');
  }
})();

let informe: { vulnerabilities?: Record<string, { severity: string; via: Array<string | Via> }> };
try {
  informe = JSON.parse(salida);
} catch {
  console.error('No se pudo leer la salida de npm audit:\n' + salida.slice(0, 500));
  process.exit(2);
}

const hoy = new Date().toISOString().slice(0, 10);
const avisos = new Map<string, { paquete: string; severidad: string; titulo: string; rango: string }>();
for (const [paquete, v] of Object.entries(informe.vulnerabilities ?? {})) {
  for (const via of v.via) {
    if (typeof via === 'string' || !via.url) continue; // dependencia transitiva: el aviso esta en otro paquete
    const id = via.url.split('/').pop()!;
    avisos.set(id, { paquete, severidad: via.severity ?? v.severity, titulo: via.title ?? '', rango: via.range ?? '' });
  }
}

let abiertos = 0;
for (const [id, a] of avisos) {
  if (!NIVELES_QUE_FALLAN.has(a.severidad)) {
    console.log(`  info      ${id} (${a.severidad}) ${a.paquete}: ${a.titulo}`);
    continue;
  }
  const aceptado = ACEPTADOS[id];
  if (aceptado && hoy <= aceptado.revisarAntesDe) {
    console.log(`  aceptado  ${id} (${a.severidad}) ${a.paquete} ${a.rango}: ${a.titulo}\n            Revisar antes del ${aceptado.revisarAntesDe}. ${aceptado.justificacion}`);
    continue;
  }
  abiertos++;
  console.log(
    `  FALLA     ${id} (${a.severidad}) ${a.paquete} ${a.rango}: ${a.titulo}` +
      (aceptado ? `\n            Su aceptacion vencio el ${aceptado.revisarAntesDe}: revisarla.` : '')
  );
}

console.log(`\n${avisos.size} avisos en dependencias de produccion; ${abiertos} altos o criticos sin aceptar.`);
process.exit(abiertos ? 1 : 0);
