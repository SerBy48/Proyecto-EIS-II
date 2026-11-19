/**
 * Conversor de Markdown a .docx con el estilo de los informes del equipo
 * (verde, sans serif, sin encabezados ni pies de pagina; ver
 * generar-estrategias.ts). Lo usa generar-trabajo-final.ts para el informe y
 * los dos manuales: el contenido vive en Markdown dentro del repositorio y el
 * .docx se regenera, nunca se edita a mano.
 *
 * Lo que entiende (lo que usan los documentos del proyecto):
 *   - titulos # a ####; parrafos; **negrita**, *cursiva*, `codigo`, [enlaces](url)
 *   - listas con vinetas o numeradas, anidadas por sangria
 *   - tablas con | (una linea "Tabla: texto" justo antes le pone leyenda numerada)
 *   - bloques de codigo ``` (los diagramas mermaid se remiten al repositorio)
 *   - citas > ; imagenes en su propia linea ![texto](ruta.png) -> "Figura N. texto"
 *   - <!-- incluir: ruta/archivo.md :: Titulo de la seccion --> inserta el cuerpo
 *     de esa seccion de otro documento, con sus subtitulos un nivel por debajo
 *     del titulo bajo el que se incluye. Asi el informe reutiliza la
 *     especificacion y los documentos de calidad sin copiarlos.
 *
 * Los enlaces relativos a archivos del repositorio se convierten en enlaces a
 * GitHub; las figuras y tablas usan campos SEQ para los indices de Word.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  PageBreak,
  Paragraph,
  SimpleField,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableOfContents,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType
} from 'docx';

export const RAIZ = path.resolve(__dirname, '..', '..');
export const REPO = 'https://github.com/SerBy48/Proyecto-EIS-II';

// ---------------------------------------------------------------------------
// Estilo (el mismo del informe de Estrategias de validacion)
// ---------------------------------------------------------------------------
export const FUENTE = 'Arial';
const MONO = 'Consolas';
export const VERDE_OSCURO = '1B5E20';
export const VERDE = '2E7D32';
export const VERDE_MEDIO = '43A047';
const VERDE_CLARO = 'E8F5E9';
const BORDE = 'A5D6A7';
export const TINTA = '212121';
export const GRIS = '5F6368';
const ANCHO = 9360; // carta con margenes de 1" (DXA)
const ANCHO_IMAGEN = 620; // px a 96 ppp: 6,45"
const ALTO_IMAGEN = 810; // casi una pagina (con su leyenda): los diagramas C4 altos se leen con zoom

type Bloque = Paragraph | Table;
type Alineacion = (typeof AlignmentType)[keyof typeof AlignmentType];

interface Base {
  bold?: boolean;
  italics?: boolean;
  size?: number;
  color?: string;
}

// ---------------------------------------------------------------------------
// Texto en linea
// ---------------------------------------------------------------------------
/** URL de un enlace relativo dentro del repositorio, resuelto desde el archivo que lo contiene. */
const urlDelRepositorio = (destino: string, archivo: string): string | null => {
  if (/^(https?:|mailto:)/.test(destino)) return destino;
  if (destino.startsWith('#')) return null;
  const [ruta] = destino.split('#');
  const absoluta = path.resolve(path.dirname(archivo), decodeURI(ruta));
  const relativa = path.relative(RAIZ, absoluta).split(path.sep).join('/');
  if (relativa.startsWith('..')) return null;
  return `${REPO}/blob/main/${relativa}`;
};

const PATRON_EN_LINEA = /(\*\*.+?\*\*|`[^`]+`|!?\[[^\]]*\]\([^)\s]+\)|<https?:\/\/[^>\s]+>|(?<![\w*])\*[^*\s][^*]*?\*(?![\w*]))/;

/** Texto con marcas en linea: **negrita**, *cursiva*, `codigo` y [enlaces](url). */
export const enLinea = (texto: string, archivo: string, base: Base = {}): (TextRun | ExternalHyperlink)[] => {
  const limpio = texto.replace(/\\([|*_`[\]<>#])/g, '$1').replace(/<br\s*\/?>/g, ' · ');
  const partes = limpio.split(new RegExp(PATRON_EN_LINEA.source, 'g')).filter((x) => x !== undefined && x !== '');
  const salida: (TextRun | ExternalHyperlink)[] = [];
  for (const parte of partes) {
    if (parte.startsWith('**') && parte.endsWith('**') && parte.length > 4) {
      salida.push(...enLinea(parte.slice(2, -2), archivo, { ...base, bold: true }));
    } else if (parte.startsWith('`') && parte.endsWith('`') && parte.length > 1) {
      salida.push(new TextRun({ text: parte.slice(1, -1), font: MONO, size: (base.size ?? 21) - 2, color: base.color === 'FFFFFF' ? 'FFFFFF' : VERDE_OSCURO, bold: base.bold }));
    } else if (/^!?\[[^\]]*\]\([^)\s]+\)$/.test(parte)) {
      const [, textoEnlace, destino] = parte.match(/^!?\[([^\]]*)\]\(([^)\s]+)\)$/)!;
      const url = urlDelRepositorio(destino, archivo);
      const visible = textoEnlace || destino;
      if (url) {
        salida.push(
          new ExternalHyperlink({
            link: url,
            children: enLinea(visible, archivo, { ...base, color: base.color === 'FFFFFF' ? 'FFFFFF' : VERDE }).map((r) =>
              r instanceof TextRun ? r : r
            )
          })
        );
      } else {
        salida.push(...enLinea(visible, archivo, base));
      }
    } else if (/^<https?:\/\/[^>\s]+>$/.test(parte)) {
      const url = parte.slice(1, -1);
      salida.push(new ExternalHyperlink({ link: url, children: [new TextRun({ text: url, font: FUENTE, color: VERDE, size: base.size, underline: {} })] }));
    } else if (parte.length > 2 && parte.startsWith('*') && parte.endsWith('*')) {
      salida.push(...enLinea(parte.slice(1, -1), archivo, { ...base, italics: true }));
    } else {
      // Sin emojis de color: los de estado pasan a simbolos monocromaticos (con
      // la fuente de simbolos de Windows; Arial no los tiene) y las marcas como
      // la de "nuevo" se quitan.
      const sobrio = parte
        .replace(/\s*\u{1F195}\s*/gu, ' ')
        .replace(/✅/g, '✓')
        .replace(/❌/g, '✗')
        .replace(/⚠️?/g, '⚠')
        .replace(/\u{1F536}/gu, '◆')
        .replace(/\u{1F51C}/gu, '(próximo)')
        .replace(/⏳/g, '(pendiente)')
        .replace(/ℹ️?/g, '(i)')
        .replace(/️/g, '')
        .replace(/ {2,}/g, ' ');
      for (const trozo of sobrio.split(/([✓✗⚠◆☰↔→←]|\p{Extended_Pictographic})/u).filter(Boolean)) {
        const simbolo = /^([✓✗⚠◆☰↔→←]|\p{Extended_Pictographic})$/u.test(trozo);
        salida.push(new TextRun({ text: trozo, font: simbolo ? 'Segoe UI Symbol' : FUENTE, bold: base.bold, italics: base.italics, size: base.size, color: base.color }));
      }
    }
  }
  return salida;
};

/** Texto plano (sin marcas), para medir columnas. */
const plano = (texto: string) =>
  texto
    .replace(/!?\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\*\*|`|\\/g, '')
    .replace(/\*([^*]+)\*/g, '$1');

// ---------------------------------------------------------------------------
// Bloques
// ---------------------------------------------------------------------------
const parrafo = (texto: string, archivo: string, alineacion: Alineacion = AlignmentType.JUSTIFIED) =>
  new Paragraph({ children: enLinea(texto, archivo), spacing: { after: 120, line: 276 }, alignment: alineacion });

const leyenda = (etiqueta: 'Figura' | 'Tabla', texto: string, archivo: string, antes = false) =>
  new Paragraph({
    children: [
      new TextRun({ text: `${etiqueta} `, font: FUENTE, size: 17, bold: true, color: VERDE }),
      // Word separa el numero del texto siguiente en los indices de figuras y
      // tablas: con una raya ("Figura 1 – Texto") se lee bien en los dos lugares.
      new SimpleField(`SEQ ${etiqueta} \\* ARABIC`, '1'),
      new TextRun({ text: ' – ', font: FUENTE, size: 17, bold: true, color: VERDE }),
      ...enLinea(texto, archivo, { size: 17, color: GRIS })
    ],
    alignment: AlignmentType.CENTER,
    keepNext: antes,
    spacing: antes ? { before: 160, after: 80 } : { before: 60, after: 220 }
  });

const codigo = (lineas: string[]) =>
  lineas.map(
    (linea, i) =>
      new Paragraph({
        children: [new TextRun({ text: linea.replace(/\t/g, '  ') || ' ', font: MONO, size: 16, color: TINTA })],
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F1F8F1' },
        spacing: { before: i === 0 ? 80 : 0, after: i === lineas.length - 1 ? 160 : 0, line: 240 },
        indent: { left: 200, right: 200 },
        keepLines: true,
        keepNext: i < lineas.length - 1 && lineas.length < 25
      })
  );

const cita = (lineas: string[], archivo: string) =>
  new Paragraph({
    children: enLinea(lineas.join(' '), archivo, { color: '33691E' }),
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: VERDE_CLARO },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: VERDE_MEDIO, space: 8 } },
    indent: { left: 240, right: 120 },
    spacing: { before: 80, after: 160, line: 264 }
  });

/** Dimensiones de un PNG leidas de su cabecera. */
const dimensionesPng = (datos: Buffer) => ({ ancho: datos.readUInt32BE(16), alto: datos.readUInt32BE(20) });

const figura = (ruta: string, texto: string, archivo: string, maxAncho = ANCHO_IMAGEN): Bloque[] => {
  if (!existsSync(ruta) || !ruta.toLowerCase().endsWith('.png')) {
    return [parrafo(`*[Imagen no disponible: ${path.relative(RAIZ, ruta)}]*`, archivo, AlignmentType.CENTER)];
  }
  const datos = readFileSync(ruta);
  const { ancho, alto } = dimensionesPng(datos);
  let w = Math.min(maxAncho, ancho);
  let h = Math.round((alto / ancho) * w);
  if (h > ALTO_IMAGEN) {
    h = ALTO_IMAGEN;
    w = Math.round((ancho / alto) * h);
  }
  return [
    new Paragraph({
      children: [new ImageRun({ type: 'png', data: datos, transformation: { width: w, height: h } })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 120 },
      keepNext: true
    }),
    leyenda('Figura', texto, archivo)
  ];
};

const BORDES = {
  top: { style: BorderStyle.SINGLE, size: 4, color: BORDE },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDE },
  left: { style: BorderStyle.SINGLE, size: 4, color: BORDE },
  right: { style: BorderStyle.SINGLE, size: 4, color: BORDE },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: BORDE },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: BORDE }
};

/** Celdas de una fila de tabla Markdown, respetando \| y el | dentro de `codigo`. */
const celdas = (linea: string): string[] => {
  const sinBordes = linea.trim().replace(/^\|/, '').replace(/\|$/, '');
  const resultado: string[] = [];
  let actual = '';
  let enCodigo = false;
  for (let i = 0; i < sinBordes.length; i++) {
    const c = sinBordes[i];
    if (c === '\\' && sinBordes[i + 1] === '|') {
      actual += '|';
      i++;
    } else if (c === '`') {
      enCodigo = !enCodigo;
      actual += c;
    } else if (c === '|' && !enCodigo) {
      resultado.push(actual.trim());
      actual = '';
    } else actual += c;
  }
  resultado.push(actual.trim());
  return resultado;
};

/** Tabla con encabezado verde y filas alternas; el ancho de cada columna sale de su contenido. */
const tabla = (filas: string[][], archivo: string): Table => {
  const columnas = Math.max(...filas.map((f) => f.length));
  const normalizadas = filas.map((f) => [...f, ...Array(columnas - f.length).fill('')]);
  const pesos = Array.from({ length: columnas }, (_, c) => {
    const largos = normalizadas.map((f) => plano(f[c]).length);
    const promedio = largos.reduce((a, b) => a + b, 0) / largos.length;
    const maximo = Math.max(...largos);
    return Math.min(Math.max(Math.sqrt(promedio * 0.6 + maximo * 0.4), 2.2), 9);
  });
  const suma = pesos.reduce((a, b) => a + b, 0);
  const anchos = pesos.map((p) => Math.floor((p / suma) * ANCHO));
  anchos[anchos.length - 1] += ANCHO - anchos.reduce((a, b) => a + b, 0);
  const tamano = columnas >= 5 ? 15 : 17;
  const celda = (texto: string, i: number, encabezado: boolean, fondo?: string) =>
    new TableCell({
      width: { size: anchos[i], type: WidthType.DXA },
      shading: fondo ? { type: ShadingType.CLEAR, color: 'auto', fill: fondo } : undefined,
      margins: { top: 50, bottom: 50, left: 80, right: 80 },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          children: enLinea(texto, archivo, encabezado ? { size: tamano, color: 'FFFFFF', bold: true } : { size: tamano, color: TINTA }),
          spacing: { after: 0, line: 240 },
          alignment: AlignmentType.LEFT
        })
      ]
    });
  return new Table({
    width: { size: ANCHO, type: WidthType.DXA },
    columnWidths: anchos,
    layout: TableLayoutType.FIXED,
    borders: BORDES,
    rows: normalizadas.map(
      (fila, r) =>
        new TableRow({
          tableHeader: r === 0,
          cantSplit: true,
          children: fila.map((t, i) => celda(t, i, r === 0, r === 0 ? VERDE : r % 2 === 0 ? VERDE_CLARO : undefined))
        })
    )
  });
};

const respiro = () => new Paragraph({ children: [], spacing: { after: 120 } });

// ---------------------------------------------------------------------------
// Inclusiones
// ---------------------------------------------------------------------------
/** Cuerpo de una seccion de otro Markdown (sin su titulo), con el nivel de su titulo. */
const seccionDe = (ruta: string, titulo: string): { lineas: string[]; nivel: number } => {
  const lineas = readFileSync(ruta, 'utf8').replace(/\r\n/g, '\n').split('\n');
  // "*": el archivo completo sin su titulo principal.
  if (titulo === '*') {
    const primero = lineas.findIndex((l) => /^# /.test(l));
    return { lineas: lineas.slice(primero + 1), nivel: 1 };
  }
  const normal = (t: string) => t.replace(/[`*]/g, '').trim().toLowerCase();
  let enCodigo = false;
  let inicio = -1;
  let nivel = 0;
  for (let i = 0; i < lineas.length; i++) {
    if (/^\s*```/.test(lineas[i])) enCodigo = !enCodigo;
    if (enCodigo) continue;
    const m = lineas[i].match(/^(#{1,6})\s+(.*)$/);
    if (!m) continue;
    if (inicio === -1 && normal(m[2]).startsWith(normal(titulo))) {
      inicio = i + 1;
      nivel = m[1].length;
    } else if (inicio !== -1 && m[1].length <= nivel) {
      return { lineas: lineas.slice(inicio, i), nivel };
    }
  }
  if (inicio === -1) throw new Error(`No se encontro la seccion "${titulo}" en ${path.relative(RAIZ, ruta)}`);
  return { lineas: lineas.slice(inicio), nivel };
};

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------
export interface OpcionesConversion {
  /** Niveles que se restan a los titulos (# de Markdown -> nivel de Word). */
  desplazamiento?: number;
  /** Omite el primer titulo de nivel 1 del archivo (la portada ya lo lleva). */
  omitirTitulo?: boolean;
  /** Salto de pagina antes de cada titulo de nivel 1 de Word. */
  saltoEnCapitulo?: boolean;
  /** Titulo para el texto que va antes del primer capitulo (con omitirTitulo). */
  tituloIntroduccion?: string;
  /**
   * Incluye el archivo como el capitulo N de otro documento: su titulo pasa a
   * "N. Titulo", sus secciones "1. X" a "N.1 X" y las referencias "sección 5"
   * del texto a "sección N.5".
   */
  capitulo?: number;
  /** Quita la numeracion propia de los titulos ("9.1 Carga" -> "Carga"): la usan las secciones incluidas. */
  quitarNumeracion?: boolean;
}

// Cada lista numerada del documento es una instancia distinta (reinicia en 1),
// aunque venga de otro archivo o de una seccion incluida.
const instancias = { numerada: 0 };

const NIVELES = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4];

/** Convierte lineas de Markdown en bloques de docx. archivo: ruta del .md (para rutas relativas). */
export const convertirLineas = (entradaOriginal: string[], archivo: string, opciones: OpcionesConversion = {}): Bloque[] => {
  const capitulo = opciones.capitulo;
  const entrada = capitulo
    ? entradaOriginal.map((l) => {
        if (/^# /.test(l)) return l.replace(/^# /, `# ${capitulo}. `);
        if (/^## \d+\. /.test(l)) return l.replace(/^## (\d+)\. /, `## ${capitulo}.$1 `);
        if (/^### \d+\.\d+ /.test(l)) return l.replace(/^### (\d+\.\d+) /, `### ${capitulo}.$1 `);
        return l.replace(/secci[oó]n (\d+)(?![.\d])/g, `sección ${capitulo}.$1`);
      })
    : entradaOriginal;
  const desplazamiento = opciones.desplazamiento ?? 0;
  const salto = opciones.saltoEnCapitulo ?? true;
  const bloques: Bloque[] = [];
  let parrafoActual: string[] = [];
  let tituloOmitido = !opciones.omitirTitulo;
  let leyendaTabla: string | null = null;
  let nivelTituloActual = 0; // nivel Markdown del ultimo titulo (para las inclusiones)
  let introduccionPendiente = opciones.tituloIntroduccion ?? null;

  const cerrarParrafo = () => {
    if (parrafoActual.length) bloques.push(parrafo(parrafoActual.join(' '), archivo));
    parrafoActual = [];
  };

  for (let i = 0; i < entrada.length; i++) {
    const linea = entrada[i];
    const recortada = linea.trim();

    // Inclusion de una seccion de otro documento.
    // "<!-- incluir: ruta :: Titulo :: sin-figuras -->" omite las imagenes de la
    // seccion (el informe usa diagramas simplificados en su lugar).
    const inclusion = recortada.match(/^<!--\s*incluir:\s*(.+?)\s*::\s*(.+?)\s*(?:::\s*(sin-figuras)\s*)?-->$/);
    if (inclusion) {
      cerrarParrafo();
      const ruta = path.resolve(RAIZ, inclusion[1]);
      const seccion = seccionDe(ruta, inclusion[2]);
      let lineas = inclusion[3] ? seccion.lineas.filter((l) => !/^\s*!\[[^\]]*\]\([^)]+\)\s*$/.test(l)) : seccion.lineas;
      if (inclusion[3]) {
        // Un subtitulo que solo tenia figuras queda vacio: se quita.
        lineas = lineas.filter((l, k) => {
          if (!/^#{1,6}\s/.test(l)) return true;
          const siguiente = lineas.slice(k + 1).find((x) => x.trim());
          return siguiente !== undefined && !/^#{1,6}\s/.test(siguiente);
        });
      }
      // Los subtitulos de la seccion quedan un nivel por debajo del titulo actual.
      const nuevoDesplazamiento = desplazamiento + (seccion.nivel - nivelTituloActual);
      bloques.push(...convertirLineas(lineas, ruta, { desplazamiento: nuevoDesplazamiento, saltoEnCapitulo: salto, quitarNumeracion: true }));
      continue;
    }
    if (/^<!--.*-->$/.test(recortada)) continue;

    if (!recortada) {
      cerrarParrafo();
      continue;
    }

    // Texto antes del primer capitulo: lleva su propio titulo.
    if (introduccionPendiente && tituloOmitido && !/^#{1,6}\s/.test(linea)) {
      bloques.push(new Paragraph({ children: enLinea(introduccionPendiente, archivo), heading: HeadingLevel.HEADING_1, outlineLevel: 0, pageBreakBefore: salto }));
      introduccionPendiente = null;
    }

    // Bloque de codigo.
    const valla = linea.match(/^(\s*)```(\w*)/);
    if (valla) {
      cerrarParrafo();
      const sangria = valla[1].length;
      const lineasCodigo: string[] = [];
      i++;
      while (i < entrada.length && !/^\s*```/.test(entrada[i])) {
        lineasCodigo.push(entrada[i].slice(Math.min(sangria, entrada[i].length - entrada[i].trimStart().length)));
        i++;
      }
      if (valla[2] === 'mermaid') {
        bloques.push(parrafo(`*Diagrama disponible en el repositorio:* [${path.relative(RAIZ, archivo).split(path.sep).join('/')}](${path.basename(archivo)}).`, archivo, AlignmentType.LEFT));
      } else {
        bloques.push(...codigo(lineasCodigo));
      }
      continue;
    }

    // Titulos.
    const titulo = linea.match(/^(#{1,6})\s+(.*?)\s*#*$/);
    if (titulo) {
      cerrarParrafo();
      if (tituloOmitido || titulo[1].length > 1) introduccionPendiente = null;
      nivelTituloActual = titulo[1].length;
      if (!tituloOmitido && titulo[1].length === 1) {
        tituloOmitido = true;
        continue;
      }
      const nivel = Math.max(1, titulo[1].length - desplazamiento);
      const texto = opciones.quitarNumeracion ? titulo[2].replace(/^\d+(\.\d+)*\.?\s+/, '') : titulo[2];
      if (nivel <= 4) {
        bloques.push(
          new Paragraph({
            children: enLinea(texto, archivo),
            heading: NIVELES[nivel - 1],
            outlineLevel: nivel - 1,
            pageBreakBefore: nivel === 1 && salto
          })
        );
      } else {
        bloques.push(new Paragraph({ children: enLinea(texto, archivo, { bold: true, color: VERDE }), spacing: { before: 120, after: 60 }, keepNext: true }));
      }
      continue;
    }

    // Separadores.
    if (/^(-{3,}|\*{3,})$/.test(recortada)) {
      cerrarParrafo();
      continue;
    }

    // Leyenda de la tabla que sigue.
    const leyendaLinea = recortada.match(/^Tabla:\s+(.+)$/);
    const siguienteConTexto = entrada.slice(i + 1).find((l) => l.trim());
    if (leyendaLinea && siguienteConTexto?.trim().startsWith('|')) {
      cerrarParrafo();
      leyendaTabla = leyendaLinea[1];
      continue;
    }

    // Tablas.
    if (recortada.startsWith('|') && /^\s*\|?\s*:?-{2,}/.test(entrada[i + 1] ?? '')) {
      cerrarParrafo();
      const filas: string[][] = [celdas(recortada)];
      i += 2;
      while (i < entrada.length && entrada[i].trim().startsWith('|')) {
        filas.push(celdas(entrada[i]));
        i++;
      }
      i--;
      if (leyendaTabla) bloques.push(leyenda('Tabla', leyendaTabla, archivo, true));
      leyendaTabla = null;
      bloques.push(tabla(filas, archivo), respiro());
      continue;
    }

    // Figuras.
    const imagen = recortada.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (imagen) {
      cerrarParrafo();
      bloques.push(...figura(path.resolve(path.dirname(archivo), decodeURI(imagen[2])), imagen[1], archivo));
      continue;
    }

    // Citas.
    if (recortada.startsWith('>')) {
      cerrarParrafo();
      const lineasCita: string[] = [];
      while (i < entrada.length && entrada[i].trim().startsWith('>')) {
        lineasCita.push(entrada[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      i--;
      bloques.push(cita(lineasCita, archivo));
      continue;
    }

    // Listas.
    const item = linea.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (item) {
      cerrarParrafo();
      const numeradaInicio = /\d/.test(item[2]);
      if (numeradaInicio) instancias.numerada++;
      const instancia = instancias.numerada;
      while (i < entrada.length) {
        const actual = entrada[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
        if (!actual) break;
        const nivel = Math.min(Math.floor(actual[1].length / 2), 3);
        const numerada = /\d/.test(actual[2]);
        let texto = actual[3];
        // Lineas de continuacion del mismo elemento (sangradas, sin vineta).
        while (
          i + 1 < entrada.length &&
          entrada[i + 1].trim() &&
          !/^(\s*)([-*+]|\d+[.)])\s+/.test(entrada[i + 1]) &&
          /^\s{2,}/.test(entrada[i + 1]) &&
          !/^\s*```/.test(entrada[i + 1]) &&
          !entrada[i + 1].trim().startsWith('|')
        ) {
          texto += ' ' + entrada[i + 1].trim();
          i++;
        }
        bloques.push(
          new Paragraph({
            children: enLinea(texto, archivo),
            numbering: numerada ? { reference: 'numerada', level: nivel, instance: instancia } : { reference: 'vinetas', level: nivel },
            spacing: { after: 60, line: 264 },
            alignment: AlignmentType.LEFT
          })
        );
        // Una linea en blanco entre elementos no corta la lista.
        if (entrada[i + 1]?.trim() === '' && /^(\s*)([-*+]|\d+[.)])\s+/.test(entrada[i + 2] ?? '')) i++;
        i++;
      }
      i--;
      continue;
    }

    parrafoActual.push(recortada);
  }
  cerrarParrafo();
  return bloques;
};

/** Convierte un archivo Markdown completo. */
export const convertirArchivo = (ruta: string, opciones: OpcionesConversion = {}): Bloque[] => {
  const absoluta = path.resolve(RAIZ, ruta);
  return convertirLineas(readFileSync(absoluta, 'utf8').replace(/\r\n/g, '\n').split('\n'), absoluta, opciones);
};

// ---------------------------------------------------------------------------
// Portada, indices y documento
// ---------------------------------------------------------------------------
const lineaPortada = (texto: string, opciones: { size?: number; bold?: boolean; color?: string; antes?: number; despues?: number } = {}) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: opciones.antes ?? 0, after: opciones.despues ?? 80 },
    children: [new TextRun({ text: texto, font: FUENTE, size: opciones.size ?? 24, bold: opciones.bold, color: opciones.color ?? TINTA })]
  });

export interface DatosPortada {
  titulo: string;
  subtitulo: string;
  fecha: string;
}

export const portada = ({ titulo, subtitulo, fecha }: DatosPortada): Paragraph[] => [
  lineaPortada('UNIVERSIDAD SURCOLOMBIANA', { size: 30, bold: true, color: VERDE_OSCURO, antes: 600 }),
  lineaPortada('Facultad de Ingeniería · Programa de Ingeniería de Software', { size: 22, color: GRIS }),
  lineaPortada('Electiva Ingeniería de Software II (EIS II)', { size: 22, color: GRIS, despues: 1200 }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { top: { style: BorderStyle.SINGLE, size: 12, color: VERDE, space: 12 }, bottom: { style: BorderStyle.SINGLE, size: 12, color: VERDE, space: 12 } },
    spacing: { after: 240 },
    children: [new TextRun({ text: titulo, font: FUENTE, size: 44, bold: true, color: VERDE_OSCURO })]
  }),
  lineaPortada(subtitulo, { size: 24, color: TINTA, despues: 1500 }),
  lineaPortada('Presentado por', { size: 20, color: GRIS }),
  lineaPortada('Sergio Augusto Garcia Murcia', { size: 24, bold: true }),
  lineaPortada('Juan Pablo Parra Gutierrez', { size: 24, bold: true, despues: 600 }),
  lineaPortada('Presentado a', { size: 20, color: GRIS }),
  lineaPortada('Alvaro Javier Gomez Lamilla', { size: 24, bold: true, despues: 1200 }),
  lineaPortada(`Neiva, ${fecha}`, { size: 22, color: GRIS })
];

const tituloIndice = (texto: string, salto = false) =>
  new Paragraph({
    children: [new TextRun({ text: texto, font: FUENTE, size: 32, bold: true, color: VERDE_OSCURO })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: VERDE_MEDIO, space: 4 } },
    spacing: { after: 240 },
    pageBreakBefore: salto
  });

/** Tabla de contenido y, si se pide, indices de figuras y de tablas (los rellena Word). */
export const indices = ({ figuras = false, tablas = false, niveles = '1-3' } = {}): (Paragraph | TableOfContents)[] => [
  new Paragraph({ children: [new PageBreak()] }),
  tituloIndice('Tabla de contenido'),
  new TableOfContents('Tabla de contenido', { hyperlink: true, headingStyleRange: niveles, useAppliedParagraphOutlineLevel: true }),
  ...(figuras ? [tituloIndice('Índice de figuras', true), new TableOfContents('Índice de figuras', { hyperlink: true, captionLabelIncludingNumbers: 'Figura' })] : []),
  ...(tablas ? [tituloIndice('Índice de tablas', true), new TableOfContents('Índice de tablas', { hyperlink: true, captionLabelIncludingNumbers: 'Tabla' })] : [])
];

export const documento = (titulo: string, descripcion: string, hijos: (Paragraph | Table | TableOfContents)[]) =>
  new Document({
    creator: 'Sergio Augusto Garcia Murcia y Juan Pablo Parra Gutierrez',
    title: titulo,
    description: descripcion,
    features: { updateFields: true },
    styles: {
      default: {
        document: { run: { font: FUENTE, size: 21, color: TINTA } },
        heading1: {
          run: { font: FUENTE, size: 32, bold: true, color: VERDE_OSCURO },
          paragraph: { spacing: { before: 0, after: 200 }, keepNext: true, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: VERDE_MEDIO, space: 4 } } }
        },
        heading2: { run: { font: FUENTE, size: 26, bold: true, color: VERDE }, paragraph: { spacing: { before: 280, after: 120 }, keepNext: true } },
        heading3: { run: { font: FUENTE, size: 23, bold: true, color: VERDE_MEDIO }, paragraph: { spacing: { before: 200, after: 80 }, keepNext: true } },
        heading4: { run: { font: FUENTE, size: 21, bold: true, color: VERDE_MEDIO }, paragraph: { spacing: { before: 160, after: 60 }, keepNext: true } }
      }
    },
    numbering: {
      config: [
        {
          reference: 'vinetas',
          levels: [0, 1, 2, 3].map((nivel) => ({
            level: nivel,
            format: LevelFormat.BULLET,
            text: ['•', '◦', '▪', '–'][nivel],
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 500 + nivel * 400, hanging: 260 } }, run: { color: VERDE } }
          }))
        },
        {
          reference: 'numerada',
          levels: [0, 1, 2, 3].map((nivel) => ({
            level: nivel,
            format: [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN, LevelFormat.DECIMAL][nivel],
            text: `%${nivel + 1}.`,
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 540 + nivel * 400, hanging: 300 } }, run: { color: VERDE, bold: true } }
          }))
        }
      ]
    },
    sections: [
      {
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
        // Sin encabezados ni pies de pagina, por decision del equipo.
        children: hijos
      }
    ]
  });
