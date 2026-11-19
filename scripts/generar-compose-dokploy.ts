/**
 * Genera docker-compose.dokploy.yml a partir de infra/dokploy/compose-fuente.yml.
 *
 *   npm run dokploy:compose
 *
 * Por que un archivo generado: la fuente usa `extends` y `!reset` (Compose
 * 2.24+) para reutilizar docker-compose.yml sin copiarlo, pero el VPS de
 * Dokploy tenia una version anterior de Compose: no entendia `!reset` y le puso
 * a todos los servicios el container_name literal "null" (y tampoco habria
 * quitado los puertos heredados). Este script le pide a Compose la
 * configuracion ya resuelta, sin sustituir las variables (--no-interpolate), y
 * la deja autonoma y compatible con versiones viejas:
 *   - sin `name:` (Dokploy pone su propio nombre de proyecto con -p);
 *   - sin los nombres fijos de redes y volumenes (quedan por proyecto);
 *   - rutas relativas a la raiz del repositorio, no las de este equipo;
 *   - sin `required:` en depends_on (Compose 2.20+) ni `create_host_path`.
 *
 * Se vuelve a ejecutar cada vez que cambie docker-compose.yml o la fuente.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(__dirname, '..');
const FUENTE = path.join('infra', 'dokploy', 'compose-fuente.yml');
const DESTINO = path.join(RAIZ, 'docker-compose.dokploy.yml');

// Valores de relleno solo para que Compose valide los ${VAR:?}; con
// --no-interpolate no aparecen en la salida.
const relleno = Object.fromEntries(
  ['DOMINIO', 'CORREO_ADMIN', 'CLAVE_ADMIN', 'CORREO_VENDEDOR', 'CLAVE_VENDEDOR', 'CORREO_CLIENTE', 'CLAVE_CLIENTE', 'NOMBRE_CLIENTE', 'APELLIDO_CLIENTE', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'INTERNAL_TOKEN'].map((v) => [v, 'x'])
);

const crudo = execFileSync('docker', ['compose', '-f', FUENTE, 'config', '--no-interpolate'], {
  cwd: RAIZ,
  env: { ...process.env, ...relleno },
  encoding: 'utf8'
});

// La raiz del repositorio tal como la escribe Compose (con \ en Windows).
const raices = [RAIZ, RAIZ.split(path.sep).join('/'), RAIZ.split('/').join('\\')];
const relativa = (linea: string) => {
  for (const raiz of raices) {
    const i = linea.indexOf(raiz);
    if (i === -1) continue;
    const resto = linea.slice(i + raiz.length).replace(/\\/g, '/');
    return linea.slice(0, i) + (resto ? '.' + resto : '.');
  }
  return linea;
};

const lineas: string[] = [];
let seccion = '';
let guionPendiente: string | null = null;
for (const linea of crudo.replace(/\r\n/g, '\n').split('\n')) {
  const superior = linea.match(/^([a-z_]+):/);
  if (superior) seccion = superior[1];
  if (/^name: /.test(linea)) continue;
  if (/^\s+required: true$/.test(linea)) continue;
  // `bind: { create_host_path: true }` es el valor por defecto: se quitan las
  // dos lineas (un `bind:` vacio no es valido).
  // Si `bind:` abria el elemento de la lista ("- bind:"), el guion pasa al
  // siguiente campo del mismo elemento.
  if (/^\s+create_host_path: true$/.test(linea)) {
    const anterior = (lineas[lineas.length - 1] ?? '').match(/^(\s*)(- )?bind:$/);
    if (anterior) {
      lineas.pop();
      if (anterior[2]) guionPendiente = anterior[1];
    }
    continue;
  }
  if (guionPendiente !== null) {
    const sangria = guionPendiente;
    guionPendiente = null;
    lineas.push(relativa(sangria + '- ' + linea.slice(sangria.length + 2)));
    continue;
  }
  // name: de redes y volumenes (no el de dokploy-network, que es externa).
  if ((seccion === 'volumes' || seccion === 'networks') && /^ {4}name: /.test(linea) && !/dokploy-network/.test(linea)) continue;
  lineas.push(relativa(linea));
}

const encabezado = `# ============================================================================
# GENERADO por scripts/generar-compose-dokploy.ts (npm run dokploy:compose)
# a partir de infra/dokploy/compose-fuente.yml. NO editar a mano: cambie la
# fuente o docker-compose.yml y vuelva a generarlo.
#
# Es el archivo que despliega Dokploy (docs/manuales/DESPLIEGUE-DOKPLOY.md):
# autonomo (sin extends ni !reset), sin puertos publicados ni container_name,
# la web en dokploy-network y PROXIES_CONFIANZA=2.
# ============================================================================
`;
writeFileSync(DESTINO, encabezado + lineas.join('\n'));
console.log(`Generado: ${path.relative(RAIZ, DESTINO)} (${lineas.length} lineas)`);
