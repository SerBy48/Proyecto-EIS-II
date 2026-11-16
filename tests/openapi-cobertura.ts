/**
 * Cobertura de la especificacion OpenAPI frente al codigo (npm run test:openapi).
 *
 * No necesita los servicios en marcha: lee el codigo fuente. Comprueba que:
 *   1. Cada ruta de los routers esta documentada exactamente una vez, en la
 *      especificacion publica o en la interna (x-interna).
 *   2. Cada operacion documentada existe en el codigo.
 *   3. Los roles (x-roles) coinciden con requiereRol() y con la lista blanca de
 *      rutas publicas del gateway, y las publicas no piden token (security: []).
 *   4. El empaquetado que sirve el gateway esta al dia con docs/openapi/.
 *
 * Si alguien agrega una ruta y no la documenta, o cambia un rol en el codigo y
 * no en la documentacion, esta prueba falla (docs/adr/0008).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const RAIZ = path.resolve(__dirname, '..');
const leer = (relativa: string) => readFileSync(path.join(RAIZ, relativa), 'utf8');

const verde = (t: string) => `\x1b[32m${t}\x1b[0m`;
const rojo = (t: string) => `\x1b[31m${t}\x1b[0m`;
const gris = (t: string) => `\x1b[90m${t}\x1b[0m`;

const METODOS = ['get', 'post', 'put', 'patch', 'delete'] as const;

interface Operacion {
  metodo: string;
  ruta: string; // con los parametros normalizados a {}
  rutaOriginal: string;
  roles: string[];
  publica: boolean;
  interna?: boolean;
}

const fallos: string[] = [];
let comprobaciones = 0;
const comprobar = (condicion: boolean, mensaje: string): void => {
  comprobaciones++;
  if (!condicion) fallos.push(mensaje);
};

const normalizar = (ruta: string): string =>
  ruta.replace(/:[A-Za-z_]+/g, '{}').replace(/\{[^}]+\}/g, '{}').replace(/\/$/, '') || '/';

const clave = (o: { metodo: string; ruta: string }) => `${o.metodo.toUpperCase()} ${o.ruta}`;

// ---------------------------------------------------------------- el codigo
const fuenteGateway = leer('services/api-gateway/src/index.ts');

const prefijos = [...fuenteGateway.matchAll(/prefijo:\s*'(\/api\/[a-z]+)'/g)].map((m) => m[1]);

// La lista blanca de rutas publicas, tal como la escribe el gateway.
const bloquePublicas = fuenteGateway.match(/const RUTAS_PUBLICAS[\s\S]*?\n\];/)?.[0] ?? '';
const rutasPublicas = [...bloquePublicas.matchAll(/metodo:\s*'([A-Z]+)',\s*patron:\s*\/(.+?)\/\s*\}/g)].map(
  (m) => ({ metodo: m[1], patron: new RegExp(m[2]) })
);
const esPublica = (metodo: string, ruta: string) => {
  // Sustituye cada parametro por un valor de ejemplo para probar los patrones.
  const concreta = ruta.replace(/\{\}/g, 'X1');
  return rutasPublicas.some((r) => r.metodo === metodo.toUpperCase() && r.patron.test(concreta));
};

const enCodigo: Operacion[] = [
  // Rutas propias del gateway (la documentacion /api/docs no se autodocumenta).
  { metodo: 'get', ruta: '/api/health', rutaOriginal: '/api/health', roles: ['publica'], publica: true }
];

for (const prefijo of prefijos) {
  const servicio = `${prefijo.replace('/api/', '')}-service`;
  const fuente = leer(`services/${servicio}/src/index.ts`);
  const expresion = /router\.(get|post|put|patch|delete)\(\s*'([^']+)'\s*,\s*(requiereRol\(([^)]*)\))?/g;
  for (const m of fuente.matchAll(expresion)) {
    const [, metodo, rutaLocal, conRol, argumentos] = m;
    const rutaOriginal = `${prefijo}${rutaLocal === '/' ? '' : rutaLocal}`;
    const ruta = normalizar(rutaOriginal);
    const publica = esPublica(metodo, ruta);
    let roles: string[];
    if (conRol) {
      const lista = [...(argumentos ?? '').matchAll(/'([a-z]+)'/g)].map((r) => r[1]);
      roles = lista.length ? lista : ['sesion'];
    } else {
      // Sin requiereRol() en el servicio: decide el gateway.
      roles = [publica ? 'publica' : 'sesion'];
    }
    enCodigo.push({ metodo, ruta, rutaOriginal, roles, publica });
  }
}

// ---------------------------------------------------- las especificaciones
const leerEspecificacion = (relativa: string, interna: boolean): Operacion[] => {
  const especificacion = JSON.parse(leer(relativa)) as {
    security?: unknown[];
    paths: Record<string, Record<string, { security?: unknown[]; 'x-roles'?: string[]; 'x-interna'?: boolean }>>;
  };
  const operaciones: Operacion[] = [];
  for (const [ruta, item] of Object.entries(especificacion.paths)) {
    for (const metodo of METODOS) {
      const op = item[metodo];
      if (!op) continue;
      const seguridad = op.security ?? especificacion.security ?? [];
      operaciones.push({
        metodo,
        ruta: normalizar(ruta),
        rutaOriginal: ruta,
        roles: op['x-roles'] ?? [],
        publica: Array.isArray(seguridad) && seguridad.length === 0,
        interna: op['x-interna'] === true
      });
      if (interna) comprobar(op['x-interna'] === true, `${metodo.toUpperCase()} ${ruta}: la especificacion interna exige x-interna: true`);
      else comprobar(op['x-interna'] !== true, `${metodo.toUpperCase()} ${ruta}: una ruta interna no debe estar en la especificacion publica`);
    }
  }
  return operaciones;
};

const publicas = leerEspecificacion('services/api-gateway/especificacion/openapi.json', false);
const internas = leerEspecificacion('docs/openapi/generado/openapi-interna.json', true);
const documentadas = [...publicas, ...internas];

// 1. Cada ruta del codigo, documentada exactamente una vez y con sus roles.
for (const op of enCodigo) {
  const coincidencias = documentadas.filter((d) => clave(d) === clave(op));
  comprobar(coincidencias.length > 0, `${clave(op)} (${op.rutaOriginal}) existe en el codigo pero no esta documentada`);
  comprobar(coincidencias.length < 2, `${clave(op)} esta documentada en las dos especificaciones`);
  const doc = coincidencias[0];
  if (!doc) continue;
  const esperados = [...op.roles].sort().join(',');
  const declarados = [...doc.roles].sort().join(',');
  comprobar(esperados === declarados, `${clave(op)}: x-roles [${declarados}] no coincide con el codigo [${esperados}]`);
  comprobar(
    doc.publica === op.publica,
    `${clave(op)}: ${op.publica ? 'es publica en el gateway y la especificacion pide token' : 'exige token y la especificacion la marca sin seguridad'}`
  );
}

// 2. Nada documentado que no exista.
for (const doc of documentadas) {
  comprobar(
    enCodigo.some((op) => clave(op) === clave(doc)),
    `${clave(doc)} (${doc.rutaOriginal}) esta documentada pero no existe en el codigo`
  );
}

// 3. El empaquetado servido por el gateway corresponde a las fuentes actuales.
const temporal = mkdtempSync(path.join(tmpdir(), 'openapi-'));
const fresco = path.join(temporal, 'openapi.json');
execFileSync(
  process.execPath,
  [require.resolve('@redocly/cli/bin/cli.js'), 'bundle', path.join(RAIZ, 'docs/openapi/openapi.yaml'), '-o', fresco],
  { stdio: 'ignore' }
);
comprobar(
  readFileSync(fresco, 'utf8').trim() === leer('services/api-gateway/especificacion/openapi.json').trim(),
  'services/api-gateway/especificacion/openapi.json esta desactualizado: ejecute npm run docs:openapi'
);

// ------------------------------------------------------------------ informe
console.log(
  gris(
    `Codigo: ${enCodigo.length} rutas (${prefijos.length} servicios + gateway). ` +
      `Especificacion: ${publicas.length} publicas + ${internas.length} internas. ` +
      `Rutas publicas del gateway: ${enCodigo.filter((o) => o.publica).length}.`
  )
);
if (fallos.length) {
  for (const f of fallos) console.log(`  ${rojo('FALLA')}  ${f}`);
  console.log(rojo(`\n${fallos.length} de ${comprobaciones} comprobaciones fallaron.`));
  process.exit(1);
}
console.log(verde(`Las ${comprobaciones} comprobaciones pasaron: la especificacion cubre exactamente el codigo.`));
