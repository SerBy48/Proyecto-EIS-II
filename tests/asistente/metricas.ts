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
import { Intencion, Pendiente, clasificar } from '../../services/asistente-service/src/motor';
import datos from '../../services/asistente-service/src/datos/intenciones.json';
import frases from './frases.json';

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

export const medir = (casos: Caso[], intenciones = datos.intenciones as Intencion[]): Medicion => {
  const confusion = new Map<string, Map<string, number>>();
  const errores: Medicion['errores'] = [];
  for (const caso of casos) {
    const obtenida = clasificar(caso.frase, intenciones, caso.contexto).intencion;
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
  const total = medir([...frases.desarrollo, ...frases.evaluacion] as Caso[]);

  const lineas = [
    '# Asistente virtual: tasa de acierto de intenciones',
    '',
    `Generado con \`npm run asistente:metricas -- --guardar\` el ${new Date().toISOString().slice(0, 10)}. Motor de reglas con las intenciones iniciales; sin IA.`,
    '',
    '| Conjunto | Frases | Aciertos | Tasa de acierto |',
    '|---|---:|---:|---:|',
    `| Desarrollo (se usa para ajustar los terminos) | ${desarrollo.total} | ${desarrollo.aciertos} | ${porcentaje(desarrollo.tasa)} |`,
    `| **Evaluacion (no se ajusta; es la cifra que se reporta)** | ${evaluacion.total} | ${evaluacion.aciertos} | **${porcentaje(evaluacion.tasa)}** |`,
    `| Total | ${total.total} | ${total.aciertos} | ${porcentaje(total.tasa)} |`,
    '',
    '## Matriz de confusion (conjunto de evaluacion)',
    '',
    'Filas: intencion esperada. Columnas: intencion que dio el motor. La diagonal en negrita son aciertos; ⚠ marca confusiones.',
    '',
    matriz(evaluacion),
    '',
    '## Errores',
    '',
    ...(total.errores.length
      ? ['| Conjunto | Frase | Esperada | Obtenida |', '|---|---|---|---|', ...total.errores.map((e) => `| ${frases.desarrollo.some((d) => d.frase === e.frase) ? 'desarrollo' : 'evaluacion'} | ${e.frase} | ${e.esperada} | ${e.obtenida} |`)]
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
