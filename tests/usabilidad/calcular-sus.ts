/**
 * Calcula el puntaje SUS (System Usability Scale) a partir de las respuestas
 * de los evaluadores.
 *
 * Uso: npm run usabilidad:sus [-- ruta/al/archivo.csv]
 *
 * Entrada: tests/usabilidad/sus-respuestas.csv, con el encabezado
 *   evaluador,p1,p2,p3,p4,p5,p6,p7,p8,p9,p10
 * y una fila por evaluador con diez respuestas enteras de 1 a 5. Las lineas
 * vacias y las que empiezan por # se ignoran.
 *
 * Salida: el puntaje de cada evaluador, la media, la desviacion estandar y su
 * interpretacion, en consola y en
 * docs/evidencia/no-funcionales/usabilidad/sus-resultado.json.
 *
 * Si el archivo no existe, no tiene respuestas o alguna fila es invalida,
 * termina con codigo 1 y no escribe resultados. NO se simulan respuestas: el
 * SUS solo tiene sentido con datos de personas reales.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(__dirname, '..', '..');
const ENTRADA = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, 'sus-respuestas.csv');
const SALIDA = path.join(RAIZ, 'docs', 'evidencia', 'no-funcionales', 'usabilidad', 'sus-resultado.json');
const PROMEDIO_REFERENCIA = 68; // Sauro (2011), media de mas de 500 estudios

const terminar = (mensaje: string): never => {
  console.error(`\n${mensaje}\n`);
  process.exit(1);
};

/** Puntaje SUS de un evaluador: impares (r - 1), pares (5 - r), suma x 2,5. */
export const puntajeSus = (respuestas: number[]): number =>
  respuestas.reduce((suma, r, i) => suma + (i % 2 === 0 ? r - 1 : 5 - r), 0) * 2.5;

/** Adjetivo de Bangor, Kortum y Miller (2009), por los cortes entre sus medias. */
export const adjetivo = (sus: number): string =>
  sus < 25 ? 'Peor imaginable'
  : sus < 39 ? 'Pobre'
  : sus < 52 ? 'Aceptable (OK)'
  : sus < 73 ? 'Bueno'
  : sus < 85 ? 'Excelente'
  : 'El mejor imaginable';

/** Escala curva de Sauro y Lewis (2016). */
export const nota = (sus: number): string =>
  sus >= 84.1 ? 'A+'
  : sus >= 80.8 ? 'A'
  : sus >= 78.9 ? 'A-'
  : sus >= 77.2 ? 'B+'
  : sus >= 74.1 ? 'B'
  : sus >= 72.6 ? 'B-'
  : sus >= 71.1 ? 'C+'
  : sus >= 65.0 ? 'C'
  : sus >= 62.7 ? 'C-'
  : sus >= 51.7 ? 'D'
  : 'F';

/** Rangos de aceptabilidad de Bangor, Kortum y Miller (2008). */
export const aceptabilidad = (sus: number): string =>
  sus < 50 ? 'No aceptable' : sus <= 70 ? 'Marginal' : 'Aceptable';

const ejecutar = (): void => {
  if (!existsSync(ENTRADA)) {
    terminar(`No existe ${path.relative(RAIZ, ENTRADA)}. ⚠️ PENDIENTE: dato humano (respuestas SUS de los evaluadores).`);
  }

  const lineas = readFileSync(ENTRADA, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  const encabezado = lineas.shift()?.split(',').map((c) => c.trim().toLowerCase());
  const esperado = ['evaluador', ...Array.from({ length: 10 }, (_, i) => `p${i + 1}`)];
  if (!encabezado || encabezado.join(',') !== esperado.join(',')) {
    terminar(`Encabezado invalido. Se esperaba: ${esperado.join(',')}`);
  }

  if (lineas.length === 0) {
    terminar(
      `${path.relative(RAIZ, ENTRADA)} no tiene respuestas. ⚠️ PENDIENTE: dato humano.\n` +
        'Aplique el cuestionario (tests/usabilidad/sus-cuestionario.md) y agregue una fila por evaluador.'
    );
  }

  const errores: string[] = [];
  const evaluadores = lineas.map((linea, i) => {
    const [evaluador, ...valores] = linea.split(',').map((c) => c.trim());
    const respuestas = valores.map(Number);
    if (!evaluador) errores.push(`fila ${i + 2}: falta el codigo del evaluador`);
    if (respuestas.length !== 10 || respuestas.some((r) => !Number.isInteger(r) || r < 1 || r > 5)) {
      errores.push(`fila ${i + 2} (${evaluador || '?'}): se esperan 10 respuestas enteras de 1 a 5`);
    }
    return { evaluador, respuestas, sus: puntajeSus(respuestas) };
  });

  const repetidos = evaluadores.map((e) => e.evaluador).filter((c, i, todos) => todos.indexOf(c) !== i);
  if (repetidos.length) errores.push(`evaluadores repetidos: ${[...new Set(repetidos)].join(', ')}`);
  if (errores.length) terminar(`El archivo tiene errores:\n  - ${errores.join('\n  - ')}`);

  const puntajes = evaluadores.map((e) => e.sus);
  const n = puntajes.length;
  const media = puntajes.reduce((a, b) => a + b, 0) / n;
  const desviacion = n > 1 ? Math.sqrt(puntajes.reduce((a, p) => a + (p - media) ** 2, 0) / (n - 1)) : 0;

  const resultado = {
    fecha: new Date().toISOString(),
    fuente: path.relative(RAIZ, ENTRADA),
    evaluadores: evaluadores.map(({ evaluador, respuestas, sus }) => ({ evaluador, respuestas, sus })),
    n,
    media: Number(media.toFixed(1)),
    desviacion_estandar: Number(desviacion.toFixed(1)),
    minimo: Math.min(...puntajes),
    maximo: Math.max(...puntajes),
    interpretacion: {
      adjetivo_bangor_2009: adjetivo(media),
      nota_sauro_lewis_2016: nota(media),
      aceptabilidad_bangor_2008: aceptabilidad(media),
      frente_al_promedio: `${media >= PROMEDIO_REFERENCIA ? 'por encima' : 'por debajo'} del promedio de referencia (${PROMEDIO_REFERENCIA})`
    },
    advertencia: n < 5 ? 'Menos de 5 evaluadores: el resultado es orientativo, no concluyente.' : null
  };

  console.log('\nPuntaje SUS por evaluador');
  for (const e of evaluadores) console.log(`  ${e.evaluador.padEnd(10)} ${e.sus.toFixed(1)}`);
  console.log(`\nMedia: ${resultado.media} (desviacion estandar ${resultado.desviacion_estandar}, n = ${n})`);
  console.log(`  ${resultado.interpretacion.adjetivo_bangor_2009} · nota ${resultado.interpretacion.nota_sauro_lewis_2016} · ${resultado.interpretacion.aceptabilidad_bangor_2008}`);
  console.log(`  ${resultado.interpretacion.frente_al_promedio}`);
  if (resultado.advertencia) console.log(`  ⚠️ ${resultado.advertencia}`);

  mkdirSync(path.dirname(SALIDA), { recursive: true });
  writeFileSync(SALIDA, JSON.stringify(resultado, null, 2));
  console.log(`\nResultado: ${path.relative(RAIZ, SALIDA)}\n`);
};

ejecutar();
