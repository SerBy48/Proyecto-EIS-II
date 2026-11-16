/**
 * Tasa de acierto del motor de intenciones y matriz de confusion
 * (npm run asistente:metricas). No necesita servicios: usa el motor puro y las
 * intenciones iniciales (services/asistente-service/src/datos/intenciones.json).
 *
 *   npm run asistente:metricas            imprime el resultado
 *   npm run asistente:metricas -- --guardar  ademas escribe la evidencia en
 *                                             docs/evidencia/trabajo-final/asistente-metricas.md
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { Intencion, Pendiente, Vocabulario, clasificar } from '../../services/asistente-service/src/motor';
import datos from '../../services/asistente-service/src/datos/intenciones.json';
import frases from './frases.json';
import serbytek from './frases-serbytek.json';
import { vocabularioDelCatalogo } from './vocabulario';

export interface Caso {
  frase: string;
  esperada: string;
  contexto?: Pendiente;
}

export interface Medicion {
  total: number;
  aciertos: number;
  tasa: number;
  errores: Array<Caso & { obtenida: string }>;
  confusion: Map<string, Map<string, number>>;
}

/** El motor se mide con el vocabulario del catalogo, como en produccion. */
export const medir = (casos: Caso[], intenciones = datos.intenciones as Intencion[], vocabulario: Vocabulario = vocabularioDelCatalogo()): Medicion => {
  const confusion = new Map<string, Map<string, number>>();
  const errores: Medicion['errores'] = [];
  for (const caso of casos) {
    const obtenida = clasificar(caso.frase, intenciones, caso.contexto, vocabulario).intencion;
    const fila = confusion.get(caso.esperada) ?? new Map<string, number>();
    fila.set(obtenida, (fila.get(obtenida) ?? 0) + 1);
    confusion.set(caso.esperada, fila);
    if (obtenida !== caso.esperada) errores.push({ ...caso, obtenida });
  }
  const aciertos = casos.length - errores.length;
  return { total: casos.length, aciertos, tasa: aciertos / casos.length, errores, confusion };
};

const porcentaje = (x: number) => `${(x * 100).toFixed(1).replace('.', ',')} %`;

/** Matriz de confusion en Markdown: filas = esperada, columnas = obtenida. */
const matriz = (m: Medicion): string => {
  const clases = [...new Set([...m.confusion.keys(), ...[...m.confusion.values()].flatMap((f) => [...f.keys()])])].sort();
  const abreviar = (c: string) => c.replace('faq_', 'f_').replace('precio_disponibilidad', 'precio').replace('buscar_producto', 'buscar').replace('estado_pedido', 'estado').replace('cancelar_pedido', 'cancelar').replace('no_entendido', 'no_ent');
  const encabezado = `| esperada \\ obtenida | ${clases.map(abreviar).join(' | ')} |`;
  const separador = `|---|${clases.map(() => '---:').join('|')}|`;
  const filas = clases
    .filter((c) => m.confusion.has(c))
    .map((esperada) => {
      const fila = m.confusion.get(esperada)!;
      return `| ${esperada} | ${clases.map((o) => { const n = fila.get(o) ?? 0; return n === 0 ? '·' : o === esperada ? `**${n}**` : `⚠ ${n}`; }).join(' | ')} |`;
    });
  return [encabezado, separador, ...filas].join('\n');
};

const principal = (): void => {
  const desarrollo = medir(frases.desarrollo as Caso[]);
  const evaluacion = medir(frases.evaluacion as Caso[]);
  const tienda = medir(serbytek.evaluacion as Caso[]);
  const total = medir([...frases.desarrollo, ...frases.evaluacion, ...serbytek.evaluacion] as Caso[]);

  const lineas = [
    '# Asistente virtual: tasa de acierto de intenciones',
    '',
    `Generado con \`npm run asistente:metricas -- --guardar\` el ${new Date().toISOString().slice(0, 10)}. Motor de reglas con las intenciones de \`intenciones.json\` y el vocabulario del catalogo; sin IA.`,
    '',
    '| Conjunto | Frases | Aciertos | Tasa de acierto |',
    '|---|---:|---:|---:|',
    `| Desarrollo (se usa para ajustar los terminos) | ${desarrollo.total} | ${desarrollo.aciertos} | ${porcentaje(desarrollo.tasa)} |`,
    `| Evaluacion de la Fase 3 (no se ajusta) | ${evaluacion.total} | ${evaluacion.aciertos} | ${porcentaje(evaluacion.tasa)} |`,
    `| **Evaluacion SerByTek (escrita antes del motor nuevo; es la cifra que se reporta)** | ${tienda.total} | ${tienda.aciertos} | **${porcentaje(tienda.tasa)}** |`,
    `| Total | ${total.total} | ${total.aciertos} | ${porcentaje(total.tasa)} |`,
    '',
    'Primera medicion del conjunto SerByTek (2026-11-16): 49 de 50 (98,0 %). La frase fallida, "Hay audífonos disponibles?", revelo un defecto en `singular()` ("disponibles" -> "disponibl"); se corrigio la regla del plural, no los terminos, y la cifra de arriba es la medicion posterior (docs/PRUEBAS.md, 4.33).',
    '',
    '## Matriz de confusion (evaluacion SerByTek)',
    '',
    'Filas: intencion esperada. Columnas: intencion que dio el motor. La diagonal en negrita son aciertos; ⚠ marca confusiones.',
    '',
    matriz(tienda),
    '',
    '## Errores',
    '',
    ...(total.errores.length
      ? ['| Conjunto | Frase | Esperada | Obtenida |', '|---|---|---|---|', ...total.errores.map((e) => `| ${frases.desarrollo.some((d) => d.frase === e.frase) ? 'desarrollo' : serbytek.evaluacion.some((d) => d.frase === e.frase) ? 'SerByTek' : 'evaluacion F3'} | ${e.frase} | ${e.esperada} | ${e.obtenida} |`)]
      : ['Ninguno.'])
  ];
  const informe = lineas.join('\n') + '\n';
  console.log(informe);

  if (process.argv.includes('--guardar')) {
    const destino = path.resolve(__dirname, '../../docs/evidencia/trabajo-final/asistente-metricas.md');
    writeFileSync(destino, informe);
    console.log(`Guardado en ${destino}`);
  }
};

if (typeof require !== 'undefined' && require.main === module) principal();
