/**
 * Genera los tres documentos del Trabajo Final (F6) en .docx:
 *
 *   docs/informes/Informe_Trabajo_Final_EIS_II.docx   informe principal
 *   docs/informes/Manual_Tecnico_SerByTek.docx        manual tecnico
 *   docs/informes/Manual_Usuario_SerByTek.docx        manual de usuario
 *
 * Uso: npm run informe:trabajo-final        (los tres)
 *      npm run informe:trabajo-final -- manual-usuario   (solo uno)
 *
 * El contenido es Markdown del repositorio (markdown-docx.ts):
 *   - el informe: docs/informes/trabajo-final/*.md, que incluyen secciones de
 *     la especificacion, la calidad y la aceptacion;
 *   - los manuales: docs/manuales/MANUAL-TECNICO.md (+ DESPLIEGUE.md como
 *     capitulo) y docs/manuales/MANUAL-USUARIO.md.
 * Despues, actualizar-indice.ps1 hace que Word calcule los indices.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Packer, Paragraph, Table, TableOfContents } from 'docx';
import { RAIZ, convertirArchivo, documento, indices, portada } from './markdown-docx';

const FECHA = '19 de noviembre de 2026';
const SALIDA = path.join(RAIZ, 'docs', 'informes');
type Hijo = Paragraph | Table | TableOfContents;

interface Documento {
  clave: string;
  archivo: string;
  titulo: string;
  subtitulo: string;
  descripcion: string;
  indices: { figuras?: boolean; tablas?: boolean; niveles?: string };
  contenido: () => Hijo[];
}

/**
 * Anexo C: la tabla de rutas sale de la especificacion OpenAPI que sirve el
 * gateway (la misma que test:openapi compara con el codigo), no se escribe a mano.
 */
const generarTablaDeRutas = () => {
  const especificacion = JSON.parse(readFileSync(path.join(RAIZ, 'services', 'api-gateway', 'especificacion', 'openapi.json'), 'utf8'));
  const filas: string[] = [];
  for (const [ruta, operaciones] of Object.entries<Record<string, { summary?: string; 'x-roles'?: string[] }>>(especificacion.paths)) {
    for (const [metodo, op] of Object.entries(operaciones)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(metodo)) continue;
      const roles = (op['x-roles'] ?? []).join(', ').replace('publica', 'pública');
      filas.push(`| ${metodo.toUpperCase()} | \`${ruta}\` | ${roles || '—'} | ${(op.summary ?? '').replace(/\|/g, '\\|')} |`);
    }
  }
  const destino = path.join(RAIZ, 'docs', 'informes', 'trabajo-final', 'generado', 'rutas-api.md');
  mkdirSync(path.dirname(destino), { recursive: true });
  writeFileSync(
    destino,
    ['# Rutas de la API', '', '<!-- Generado por scripts/informes/generar-trabajo-final.ts: no editar a mano. -->', '', `Tabla: Rutas públicas del gateway (${filas.length} operaciones)`, '', '| Método | Ruta | Roles | Descripción |', '|---|---|---|---|', ...filas, ''].join('\n')
  );
};

const capitulosDelInforme = () =>
  readdirSync(path.join(RAIZ, 'docs', 'informes', 'trabajo-final'))
    .filter((f) => /^\d\d-.*\.md$/.test(f))
    .sort()
    .map((f) => path.join('docs', 'informes', 'trabajo-final', f));

const DOCUMENTOS: Documento[] = [
  {
    clave: 'informe',
    archivo: 'Informe_Trabajo_Final_EIS_II.docx',
    titulo: 'SerByTek: tienda en línea de tecnología con arquitectura de microservicios',
    subtitulo: 'Informe del Trabajo Final: análisis y diseño, construcción, asistente virtual, aseguramiento de calidad, despliegue y validación',
    descripcion: 'Informe del Trabajo Final de EIS II',
    // Dos niveles: con tres, los subtitulos de los anexos (cada ADR) alargaban el indice a cuatro paginas.
    indices: { figuras: true, tablas: true, niveles: '1-2' },
    contenido: () => capitulosDelInforme().flatMap((ruta) => convertirArchivo(ruta))
  },
  {
    clave: 'manual-tecnico',
    archivo: 'Manual_Tecnico_SerByTek.docx',
    titulo: 'Manual técnico de SerByTek',
    subtitulo: 'Instalación, configuración, operación, pruebas y despliegue de la plataforma de microservicios',
    descripcion: 'Manual tecnico de SerByTek',
    indices: {},
    contenido: () => [
      ...convertirArchivo('docs/manuales/MANUAL-TECNICO.md', { desplazamiento: 1, omitirTitulo: true, tituloIntroduccion: 'Introducción' }),
      ...convertirArchivo('docs/manuales/DESPLIEGUE.md', { desplazamiento: 0, capitulo: 16 })
    ]
  },
  {
    clave: 'manual-usuario',
    archivo: 'Manual_Usuario_SerByTek.docx',
    titulo: 'Manual de usuario de SerByTek',
    subtitulo: 'Guía para clientes, vendedores y administradores de la tienda en línea',
    descripcion: 'Manual de usuario de SerByTek',
    indices: { figuras: true },
    contenido: () => convertirArchivo('docs/manuales/MANUAL-USUARIO.md', { desplazamiento: 1, omitirTitulo: true, tituloIntroduccion: 'Introducción' })
  }
];

const principal = async () => {
  const pedidos = process.argv.slice(2);
  mkdirSync(SALIDA, { recursive: true });
  generarTablaDeRutas();
  for (const d of DOCUMENTOS.filter((x) => !pedidos.length || pedidos.includes(x.clave))) {
    const hijos: Hijo[] = [...portada({ titulo: d.titulo, subtitulo: d.subtitulo, fecha: FECHA }), ...indices(d.indices), ...d.contenido()];
    const destino = path.join(SALIDA, d.archivo);
    writeFileSync(destino, await Packer.toBuffer(documento(d.titulo, d.descripcion, hijos)));
    console.log(`Generado: ${path.relative(RAIZ, destino)}`);
  }
};

principal().catch((error) => {
  console.error(error);
  process.exit(1);
});
