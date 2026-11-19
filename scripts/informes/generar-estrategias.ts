/**
 * Genera el informe de la practica "Estrategias de validacion y pruebas de
 * software" en .docx con la libreria docx de npm.
 *
 * Uso: npm run informe:estrategias
 *   (despues, scripts/informes/actualizar-indice.ps1 abre el documento en
 *   Word, actualiza la tabla de contenido y exporta un PDF de control)
 *
 * Estilo acordado con el equipo: tonos verdes en titulos y tablas, fuente sans
 * serif (Arial), sin encabezados ni pies de pagina.
 *
 * El contenido resume docs/calidad/*.md; las cifras salen de la evidencia de
 * docs/evidencia/no-funcionales/. Nada de lo que depende de personas (SUS,
 * observacion con evaluadores) se rellena: queda como pendiente declarado.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageBreak,
  Paragraph,
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

const RAIZ = path.resolve(__dirname, '..', '..');
const SALIDA = path.join(RAIZ, 'docs', 'informes', 'Informe_Estrategias_Validacion_Pruebas.docx');
const GRAFICAS = path.join(RAIZ, 'docs', 'evidencia', 'no-funcionales', 'graficas');
const REPO = 'https://github.com/SerBy48/Proyecto-EIS-II';
const FIGURAS = path.join(RAIZ, 'docs', 'informes', 'figuras');

// ---------------------------------------------------------------------------
// Estilo
// ---------------------------------------------------------------------------
const FUENTE = 'Arial';
const MONO = 'Consolas';
const VERDE_OSCURO = '1B5E20';
const VERDE = '2E7D32';
const VERDE_MEDIO = '43A047';
const VERDE_CLARO = 'E8F5E9';
const BORDE = 'A5D6A7';
const TINTA = '212121';
const GRIS = '5F6368';
const ANCHO = 9360; // carta con margenes de 1": 12240 - 2 x 1440 (DXA)

/** Sombreado de las celdas de estado. Verde para lo que cumple; tonos suaves para el resto. */
const ESTADOS: Record<string, string> = {
  Cumple: 'C8E6C9',
  Corregido: 'C8E6C9',
  Parcial: 'FFF4CC',
  Aceptado: 'FFF4CC',
  'No cumple': 'FBE0E0',
  Pendiente: 'ECEFF1',
  'Siguiente iteración': 'ECEFF1'
};

// ---------------------------------------------------------------------------
// Bloques
// ---------------------------------------------------------------------------
/** Texto con marcas en linea: **negrita**, *cursiva* y `codigo`. */
const enLinea = (texto: string, base: { size?: number; color?: string; bold?: boolean } = {}): TextRun[] =>
  texto
    .split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/)
    .filter(Boolean)
    .map((parte) => {
      if (parte.startsWith('**')) return new TextRun({ text: parte.slice(2, -2), bold: true, font: FUENTE, ...base, ...{ bold: true } });
      if (parte.startsWith('`')) return new TextRun({ text: parte.slice(1, -1), font: MONO, size: (base.size ?? 21) - 2, color: base.color ?? VERDE_OSCURO });
      if (parte.startsWith('*') && parte.length > 2) return new TextRun({ text: parte.slice(1, -1), italics: true, font: FUENTE, ...base });
      return new TextRun({ text: parte, font: FUENTE, ...base });
    });

const p = (texto: string, opciones: { despues?: number; alineacion?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) =>
  new Paragraph({
    children: enLinea(texto),
    spacing: { after: opciones.despues ?? 120, line: 276 },
    alignment: opciones.alineacion ?? AlignmentType.JUSTIFIED
  });

// outlineLevel explicito: sin el, el campo de la tabla de contenido de Word no
// reconoce los titulos que genera la libreria ("No se encontraron elementos").
const h1 = (texto: string) => new Paragraph({ text: texto, heading: HeadingLevel.HEADING_1, outlineLevel: 0, pageBreakBefore: true });
const h2 = (texto: string) => new Paragraph({ text: texto, heading: HeadingLevel.HEADING_2, outlineLevel: 1 });

const vinetas = (items: string[]) =>
  items.map(
    (item) =>
      new Paragraph({
        children: enLinea(item),
        numbering: { reference: 'vinetas', level: 0 },
        spacing: { after: 60, line: 264 },
        alignment: AlignmentType.LEFT
      })
  );

const leyenda = (texto: string) =>
  new Paragraph({
    children: enLinea(texto, { size: 17, color: GRIS }),
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 200 }
  });

const codigo = (lineas: string[]) =>
  lineas.map(
    (linea, i) =>
      new Paragraph({
        children: [new TextRun({ text: linea || ' ', font: MONO, size: 16, color: TINTA })],
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F1F8F1' },
        spacing: { before: i === 0 ? 80 : 0, after: i === lineas.length - 1 ? 160 : 0, line: 240 },
        indent: { left: 200, right: 200 }
      })
  );

/** Dimensiones de un PNG leidas de su cabecera. */
const dimensionesPng = (datos: Buffer) => ({ ancho: datos.readUInt32BE(16), alto: datos.readUInt32BE(20) });

const imagen = (ruta: string, anchoPx = 600, altoMaxPx = 520) => {
  const datos = readFileSync(ruta);
  const { ancho, alto } = dimensionesPng(datos);
  let w = anchoPx;
  let h = Math.round((alto / ancho) * w);
  if (h > altoMaxPx) {
    h = altoMaxPx;
    w = Math.round((ancho / alto) * h);
  }
  return new ImageRun({ type: 'png', data: datos, transformation: { width: w, height: h } });
};

const figura = (ruta: string, texto: string, anchoPx = 600, altoMaxPx = 520) => [
  new Paragraph({ children: [imagen(ruta, anchoPx, altoMaxPx)], alignment: AlignmentType.CENTER, spacing: { before: 120 }, keepNext: true }),
  leyenda(texto)
];

const BORDES = {
  top: { style: BorderStyle.SINGLE, size: 4, color: BORDE },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDE },
  left: { style: BorderStyle.SINGLE, size: 4, color: BORDE },
  right: { style: BorderStyle.SINGLE, size: 4, color: BORDE },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: BORDE },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: BORDE }
};

/**
 * Tabla con encabezado verde, filas alternas y celdas de estado sombreadas.
 * anchos: proporciones de cada columna (se reparten sobre el ancho util).
 */
const tabla = (encabezados: string[], filas: string[][], anchos: number[], { tamano = 17 } = {}) => {
  const suma = anchos.reduce((a, b) => a + b, 0);
  const columnas = anchos.map((a) => Math.floor((a / suma) * ANCHO));
  columnas[columnas.length - 1] += ANCHO - columnas.reduce((a, b) => a + b, 0);
  const celda = (texto: string, i: number, fondo?: string, encabezado = false) =>
    new TableCell({
      width: { size: columnas[i], type: WidthType.DXA },
      shading: fondo ? { type: ShadingType.CLEAR, color: 'auto', fill: fondo } : undefined,
      margins: { top: 50, bottom: 50, left: 90, right: 90 },
      verticalAlign: VerticalAlign.CENTER,
      children: texto.split('\n').map(
        (linea) =>
          new Paragraph({
            children: enLinea(linea, encabezado ? { size: tamano, color: 'FFFFFF', bold: true } : { size: tamano, color: TINTA }),
            spacing: { after: 0, line: 240 },
            alignment: AlignmentType.LEFT
          })
      )
    });
  return new Table({
    width: { size: ANCHO, type: WidthType.DXA },
    columnWidths: columnas,
    layout: TableLayoutType.FIXED,
    borders: BORDES,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: encabezados.map((t, i) => celda(t, i, VERDE, true)) }),
      ...filas.map(
        (fila, r) =>
          new TableRow({
            cantSplit: true,
            children: fila.map((t, i) => celda(t, i, ESTADOS[t.replace(/\*/g, '')] ?? (r % 2 === 1 ? VERDE_CLARO : undefined)))
          })
      )
    ]
  });
};

/** Espacio despues de una tabla (Word pega el parrafo siguiente sin margen). */
const respiro = () => new Paragraph({ children: [], spacing: { after: 120 } });

/** Dos imagenes lado a lado con su leyenda, en una tabla sin bordes. */
const parDeImagenes = (izq: string, der: string, leyendaIzq: string, leyendaDer: string) => {
  const sinBorde = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const col = Math.floor(ANCHO / 2);
  const celda = (ruta: string, texto: string) =>
    new TableCell({
      width: { size: col, type: WidthType.DXA },
      borders: { top: sinBorde, bottom: sinBorde, left: sinBorde, right: sinBorde },
      margins: { left: 60, right: 60 },
      children: [new Paragraph({ children: [imagen(ruta, 300, 400)], alignment: AlignmentType.CENTER }), leyenda(texto)]
    });
  return new Table({
    width: { size: col * 2, type: WidthType.DXA },
    columnWidths: [col, col],
    layout: TableLayoutType.FIXED,
    borders: { top: sinBorde, bottom: sinBorde, left: sinBorde, right: sinBorde, insideHorizontal: sinBorde, insideVertical: sinBorde },
    rows: [new TableRow({ cantSplit: true, children: [celda(izq, leyendaIzq), celda(der, leyendaDer)] })]
  });
};

// ---------------------------------------------------------------------------
// Portada
// ---------------------------------------------------------------------------
const lineaPortada = (texto: string, opciones: { size?: number; bold?: boolean; color?: string; antes?: number; despues?: number } = {}) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: opciones.antes ?? 0, after: opciones.despues ?? 80 },
    children: [new TextRun({ text: texto, font: FUENTE, size: opciones.size ?? 24, bold: opciones.bold, color: opciones.color ?? TINTA })]
  });

const portada = [
  lineaPortada('UNIVERSIDAD SURCOLOMBIANA', { size: 30, bold: true, color: VERDE_OSCURO, antes: 600 }),
  lineaPortada('Facultad de Ingeniería · Programa de Ingeniería de Software', { size: 22, color: GRIS }),
  lineaPortada('Electiva Ingeniería de Software II (EIS II)', { size: 22, color: GRIS, despues: 1400 }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { top: { style: BorderStyle.SINGLE, size: 12, color: VERDE, space: 12 }, bottom: { style: BorderStyle.SINGLE, size: 12, color: VERDE, space: 12 } },
    spacing: { after: 240 },
    children: [new TextRun({ text: 'Estrategias de validación y pruebas de software', font: FUENTE, size: 44, bold: true, color: VERDE_OSCURO })]
  }),
  lineaPortada('Pruebas de rendimiento, usabilidad y seguridad de una plataforma de comercio electrónico con arquitectura de microservicios', { size: 24, color: TINTA, despues: 1800 }),
  lineaPortada('Presentado por', { size: 20, color: GRIS }),
  lineaPortada('Sergio Augusto Garcia Murcia', { size: 24, bold: true }),
  lineaPortada('Juan Pablo Parra Gutierrez', { size: 24, bold: true, despues: 600 }),
  lineaPortada('Presentado a', { size: 20, color: GRIS }),
  lineaPortada('Alvaro Javier Gomez Lamilla', { size: 24, bold: true, despues: 1400 }),
  lineaPortada('Neiva, 19 de noviembre de 2026', { size: 22, color: GRIS })
];

// ---------------------------------------------------------------------------
// Contenido
// ---------------------------------------------------------------------------
const contenido = [
  ...portada,
  new Paragraph({ children: [new PageBreak()] }),
  // Titulo visible del indice: el de TableOfContents solo es el nombre interno
  // del campo. No es un Heading, para que no se incluya a si mismo.
  new Paragraph({
    children: [new TextRun({ text: 'Tabla de contenido', font: FUENTE, size: 32, bold: true, color: VERDE_OSCURO })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: VERDE_MEDIO, space: 4 } },
    spacing: { after: 240 }
  }),
  new TableOfContents('Tabla de contenido', { hyperlink: true, headingStyleRange: '1-2', useAppliedParagraphOutlineLevel: true }),

  // 1 -----------------------------------------------------------------------
  h1('1. Resumen ejecutivo'),
  p('Se evaluó la calidad no funcional de una plataforma de comercio electrónico con nueve servicios (un API Gateway y ocho microservicios) en tres dimensiones: **rendimiento** con k6, **seguridad** con OWASP ZAP y verificaciones manuales, y **usabilidad** con inspección experta (recorrido cognitivo, KLM, heurísticas de Nielsen y accesibilidad con axe). Cada problema encontrado se clasificó, se priorizó con una fórmula explícita (severidad × alcance) y los más graves se corrigieron en el código, verificando la mejora **con la misma prueba que los detectó**.'),
  tabla(
    ['Dimensión', 'Estado inicial', 'Estado final'],
    [
      ['Rendimiento', 'Catálogo y checkout dentro de su meta con 50 usuarios. El login solo atendía ~10 por segundo (p95 4,3 s) y, saturado, cortaba conexiones a los 15 s', 'Login ×2,5 (23,4/s, p95 1,3 s), rechazo rápido con 503 y 0 % de errores en el catálogo con 300 usuarios. El checkout se satura desde 100 usuarios, pero sin errores'],
      ['Seguridad', '11 hallazgos, 3 graves: secreto JWT público (CVSS 9,8), servicios internos sin el gateway (8,3) y registro vinculado a otro cliente (8,2)', '10 corregidos y 1 aceptado con argumentos. Escaneo activo: de 781 errores 500 y 1 030 respuestas 503 a cero'],
      ['Usabilidad', '17 hallazgos: login con 4 cuentas de demostración (severidad 4), 72 % del catálogo inalcanzable, cancelación sin confirmación y con el error oculto', 'Ningún hallazgo de severidad 3 o 4 abierto; 8 tareas completas; 0 incumplimientos de WCAG 2.2 AA. El SUS queda pendiente de dato humano']
    ],
    [1.3, 3.3, 3.3]
  ),
  respiro(),
  p('**Las tres correcciones con mayor impacto medido:**'),
  ...vinetas([
    '**Rendimiento**: bcrypt pasó del hilo principal de auth a un pool de hilos con cola acotada. El throughput del login se multiplicó por 2,5, los inicios de sesión exitosos en estrés por 4,7, y las compras completadas en el flujo de estrés por 3,3.',
    '**Seguridad**: los secretos pasaron a ser obligatorios, sin valores por defecto. Un token de administrador forjado con el secreto publicado pasó de ser aceptado (200) a rechazado (401), y los servicios ya no arrancan con secretos débiles.',
    '**Usabilidad**: inicio de sesión real y paginación del catálogo. Las cuentas que pueden entrar pasaron de 4 a todas, y los productos alcanzables navegando, de 20 a 71 de 71.'
  ]),
  p('De 34 hallazgos, **los 6 de prioridad crítica (P1) están corregidos**: 19 corregidos en total, 1 aceptado y 14 menores para la siguiente iteración. La regresión completa (155 casos funcionales) pasa después de cada corrección.'),

  // 2 -----------------------------------------------------------------------
  h1('2. Introducción y sistema bajo prueba'),
  h2('2.1 Objetivo y alcance'),
  p('El objetivo de la práctica es aplicar estrategias de validación no funcional sobre un sistema real, interpretar los resultados y convertirlos en mejoras verificables del código. El alcance cubre las tres dimensiones pedidas (rendimiento, usabilidad y seguridad), un plan de corrección de todos los hallazgos y al menos una corrección real por dimensión, con su medición de antes y después.'),
  p('Todas las pruebas se ejecutaron sobre el propio proyecto, en un equipo local. Los escaneos de seguridad apuntan solo a `localhost`.'),
  h2('2.2 Arquitectura evaluada'),
  p('La plataforma (Práctica de Laboratorio 2) es un monorepo con npm workspaces. Un **API Gateway** es el único punto de entrada: valida el JWT, aplica limitación de peticiones y enruta hacia ocho microservicios, **cada uno con su propia base de datos**. La compra es una **saga orquestada** con compensaciones, protegida con idempotencia, circuit breakers y reintentos. Los eventos de dominio viajan por RabbitMQ.'),
  tabla(
    ['Servicio', 'Puerto', 'Datos', 'Responsabilidad'],
    [
      ['api-gateway', '8080', '—', 'Entrada única: JWT, RBAC, rate limiting, CORS y proxy'],
      ['auth-service', '3001', 'PostgreSQL', 'Usuarios, contraseñas (bcrypt) y tokens'],
      ['clientes-service', '3002', 'PostgreSQL', 'Clientes y direcciones'],
      ['catalogo-service', '3003', 'MongoDB', 'Productos, precios y promociones'],
      ['inventario-service', '3004', 'PostgreSQL', 'Stock, reservas con bloqueo por SKU'],
      ['carrito-service', '3005', 'Redis', 'Carritos con TTL'],
      ['pedidos-service', '3006', 'PostgreSQL', 'Orquestador de la saga de compra'],
      ['pagos-service', '3007', 'PostgreSQL', 'Pasarela simulada (sin datos de tarjeta, PCI-DSS)'],
      ['notificaciones-service', '3008', 'MongoDB', 'Consumidor de eventos y envío de mensajes'],
      ['web', '5173 / 4173', '—', 'React + Vite + Tailwind: tienda y panel de administración']
    ],
    [2.2, 1.1, 1.3, 4.4]
  ),

  // 3 -----------------------------------------------------------------------
  h1('3. Fase 1 — Preparación'),
  h2('3.1 Entorno de pruebas'),
  tabla(
    ['Aspecto', 'Valor'],
    [
      ['Equipo', 'Intel Core i5-9300H (4 núcleos y 8 hilos), 15,8 GB de RAM, Windows 11'],
      ['Contenedores', 'Docker Desktop (WSL2) con 8 CPU y 7,7 GB asignados; los 9 servicios y los 4 motores en `docker compose`'],
      ['Herramientas', 'k6 v1.5.0, OWASP ZAP 2.17.0 (Docker), Playwright 1.48.2 con Chromium, axe-core 4.10, Node.js 25, Python 3.12'],
      ['Perfil de carga', '`.env.carga` sube los límites del gateway a 100 000 para medir la capacidad del sistema y no la del limitador. Los límites normales se probaron aparte'],
      ['Limitación', 'El generador de carga comparte la máquina con los contenedores: las cifras absolutas son cotas conservadoras, válidas para comparar escenarios y para el antes y el después']
    ],
    [1.6, 6.4]
  ),
  respiro(),
  h2('3.2 Poblado de datos'),
  p('Los datos se crearon **a través de la API** (`npm run sembrar:carga`), no con SQL directo, para respetar la propiedad de los datos de cada servicio y ejercitar las mismas validaciones que un usuario. El script es idempotente: 70 productos, 300 cuentas de carga con su dirección (una por usuario virtual), 10 000 unidades en los 5 SKU de carga y 60 pedidos pagados de base.'),
  p('Durante el poblado aparecieron y se corrigieron cuatro defectos funcionales: los contenedores no arrancaban, el listado de direcciones respondía 500, un producto nuevo no se podía abastecer y una entrada sin bodega se sumaba en todas. Están documentados en `docs/PRUEBAS.md` (4.6 a 4.9).'),
  h2('3.3 Inventario de rutas y flujo principal'),
  p('El gateway expone **52 endpoints** (8 públicos), documentados en una especificación OpenAPI 3.0 mínima (`docs/openapi/openapi.yaml`) que luego alimentó el escaneo de ZAP. Una medición exploratoria sin concurrencia confirmó los endpoints críticos: **checkout** (una saga de 8+ llamadas, p95 de 476 ms en reposo), **login** (bcrypt, p95 de 392 ms) y **búsqueda en el catálogo** (la ruta pública de mayor volumen).'),
  ...figura(path.join(FIGURAS, 'flujo-principal-informe.png'), 'Figura 1. Flujo principal del negocio a través del gateway y pasos síncronos de la saga de compra.', 600, 470),

  // 4 -----------------------------------------------------------------------
  h1('4. Módulo 1 — Pruebas de rendimiento'),
  h2('4.1 Herramienta y diseño'),
  p('Se eligió **k6** frente a JMeter: los scripts son JavaScript versionado junto al código, los umbrales son declarativos (la corrida falla con código 99 si no se cumplen) y el generador es liviano, algo que importa porque comparte la máquina con el sistema. Cada usuario virtual (VU) usa su propia cuenta, una clave de idempotencia por compra y 1 s de pausa entre acciones (modelo cerrado). Los 409 de stock y los 402 de pago rechazado cuentan como respuestas de negocio, no como errores.'),
  tabla(
    ['Perfil', 'Configuración', 'Propósito'],
    [
      ['Humo', '2 VU, 30 s', 'Que el script funcione; línea base'],
      ['Carga', '0 → 50 VU en 1 min, 3 min sostenidos', 'Hora pico esperada'],
      ['Estrés', 'Escalones de 50 → 100 → 200 → 300 VU, 2 min cada uno', 'Encontrar el punto de quiebre'],
      ['Pico', '10 → 300 VU en 10 s, 1 min sostenido', 'Evento masivo tipo "día sin IVA"']
    ],
    [1.2, 3.6, 3.2]
  ),
  respiro(),
  p('**Umbrales:** errores < 1 %; checks > 99 %; p95 de la búsqueda < 500 ms; p95 del login < 1000 ms; p95 del checkout < 1500 ms. Escenarios: búsqueda en el catálogo, login, checkout y flujo completo (login → búsqueda → detalle → carrito → checkout → mis pedidos).'),
  h2('4.2 Resultados'),
  tabla(
    ['Escenario', 'Carga (50 VU): p95', 'Estrés: p95 por escalón (100 / 200 / 300 VU)', 'Errores en estrés', 'Umbral con 50 VU'],
    [
      ['Catálogo (búsqueda)', '146 ms', '193 / 645 / 829 ms', '14 % con 300 VU (agotamiento de puertos)', 'Cumple'],
      ['Login', '**4 294 ms** (9,5 logins/s)', '11 469 / 15 009 / 15 022 ms', '96-100 % desde 200 VU (EOF a los 15 s)', 'No cumple'],
      ['Checkout', '546 ms', '2 116 / 4 990 / 7 155 ms', '0 % (1 de 42 122)', 'Cumple'],
      ['Flujo completo', '495 ms (checkout); login p95 3,3 s', 'Fallos del login desde 200 VU', '79-100 % desde 200 VU (login)', 'No cumple']
    ],
    [1.5, 1.7, 2.3, 2.0, 1.1]
  ),
  respiro(),
  ...figura(path.join(GRAFICAS, 'p95-por-escenario.png'), 'Figura 2. Latencia p95 del endpoint principal por escenario y perfil (antes de las correcciones).', 560, 300),
  h2('4.3 Análisis del cuello de botella'),
  p('El muestreo de `docker stats` cada 2 s mostró que **auth ocupa el 99,5 % de un solo núcleo** durante todo el estrés del login, mientras los otros siete núcleos asignados a Docker quedan casi libres. La causa: `bcryptjs` es JavaScript puro y calcula cada hash (~100 ms) en el **hilo principal** de Node, de modo que el servicio no puede pasar de ~10 inicios de sesión por segundo. La ley de Little explica las latencias medidas: con 50 VU, R ≈ 50 / 9,5 − 1 ≈ 4,3 s (se midieron 3,9-4,8 s), y con 100 VU, R ≈ 10,8 s (se midieron 10,9 s).'),
  ...figura(path.join(GRAFICAS, 'cpu-tiempo-login-estres.png'), 'Figura 3. CPU por contenedor durante el estrés del login: auth fijo en 100 % (un núcleo) mientras crecen los VU.', 520, 470),
  tabla(
    ['ID', 'Hallazgo', 'Evidencia'],
    [
      ['R1', 'Login limitado a ~10/s por bcryptjs en el hilo principal', 'CPU de auth al 99,5 %; throughput estable entre 8,4 y 10/s con cualquier carga'],
      ['R2', 'Sin descarte de carga: auth sigue calculando hashes de clientes que ya se fueron y tarda 30-40 s en recuperarse', '`/api/health` marca auth como inalcanzable al empezar la corrida siguiente'],
      ['R3', 'El gateway responde `Connection: close`: dos conexiones TCP nuevas por petición', 'Agotamiento de puertos del cliente con 300 VU (`connectex`)'],
      ['R4', 'Al vencer los 15 s, el gateway corta con EOF en lugar de responder 504', 'Los 4 561 fallos del estrés del login son EOF (estado 0)'],
      ['R5', 'El checkout se satura en ~39 compras/s desde 100 VU, con PostgreSQL al 97 % de CPU', '0 errores en 20 910 compras: se degrada sin fallar'],
      ['R6', 'Notificaciones consume ~10 eventos/s (`prefetch(1)` y 100 ms por envío)', 'Cola de hasta 10 533 eventos pendientes']
    ],
    [0.6, 4.1, 3.3]
  ),
  respiro(),
  p('Con los **límites normales** del gateway, el limitador rechazó el exceso con 429 en ~3 ms, sin ninguna respuesta 5xx, y el circuit breaker hacia inventario se mantuvo cerrado en las 18 corridas.'),

  // 5 -----------------------------------------------------------------------
  h1('5. Módulo 2 — Pruebas de usabilidad'),
  h2('5.1 Metodología'),
  p('La práctica pide una prueba cruzada con evaluadores de otro equipo, pensando en voz alta, y el cuestionario SUS. **Estas actividades humanas no se realizaron en esta entrega** porque no se contó con un equipo evaluador. Quedan declaradas como pendientes, con todo su material listo: 8 tareas con criterio de éxito y tiempo esperado, hoja de observación, protocolo de pensar en voz alta, cuestionario SUS en versión impresa y para Google Forms, y el cálculo automatizado (`npm run usabilidad:sus`), que se niega a producir un resultado sin respuestas reales. **No se simuló ningún dato humano.**'),
  p('Para evaluar la dimensión sin depender de usuarios se aplicaron métodos de **inspección experta**, automatizados con Playwright sobre la web construida: un recorrido cognitivo de las 8 tareas (Wharton et al.), el **Keystroke-Level Model** (Card, Moran y Newell) para estimar el tiempo de un usuario experto, la **evaluación heurística de Nielsen** con severidad 0-4, y un análisis de accesibilidad con **axe-core** contra WCAG 2.2 A y AA.'),
  h2('5.2 Tareas y estimación KLM'),
  tabla(
    ['Tarea', 'Operadores KLM', 'Usuario', 'Sistema', 'Total', 'Esperado'],
    [
      ['T1 Iniciar sesión', '3M 2P 4B', '6,6 s', '0,3 s', '6,9 s', '30 s'],
      ['T2 Buscar y filtrar', '3M 3P 6B 8K 2H', '11,0 s', '0,5 s', '11,5 s', '30 s'],
      ['T3 Armar el carrito', '4M 4P 8B', '10,6 s', '0,9 s', '11,5 s', '60 s'],
      ['T4 Aplicar cupón', '3M 2P 4B 12K 2H', '10,8 s', '0,8 s', '11,7 s', '30 s'],
      ['T5 Pagar', '2M 1P 2B', '4,0 s', '0,4 s', '4,4 s', '45 s'],
      ['T6 Revisar y cancelar', '5M 3P 6B', '10,7 s', '1,4 s', '12,1 s', '60 s'],
      ['T7 Pago rechazado', '8M 7P 14B', '19,9 s', '2,4 s', '22,3 s', '90 s'],
      ['T8 Administrador', '11M 11P 22B 13K 4H', '34,4 s', '1,8 s', '36,2 s', '90 s']
    ],
    [2.2, 2.4, 1.0, 1.0, 1.0, 1.0]
  ),
  respiro(),
  p('Las 8 tareas se completaron. El sistema responde en menos del 12 % del tiempo de cada tarea: incluso la compra completa (la saga de 8 pasos) tarda 0,4 s, así que la experiencia la dominan las decisiones del usuario (M) y los apuntados (P). T1 era rápida por la razón equivocada: el correo se elegía de una lista y la contraseña venía escrita.'),
  h2('5.3 Evaluación heurística y accesibilidad'),
  p('La inspección encontró **17 hallazgos**: 1 catástrofe (severidad 4), 3 mayores (3), 8 menores (2) y 5 cosméticos (1). Se concentran en H1 (visibilidad del estado), H9 (recuperación de errores) y H2 (lenguaje del usuario). Los más graves:'),
  tabla(
    ['ID', 'Heurística', 'Problema', 'Sev.'],
    [
      ['U-01', 'H2, H4', 'El "correo" es un desplegable con 4 cuentas de prueba y la contraseña viene escrita: nadie más puede entrar ni registrarse', '4'],
      ['U-02', 'H6, H7', 'Se muestran 20 de 71 productos sin paginación: 51 solo se encuentran buscándolos por nombre', '3'],
      ['U-03', 'H5', 'Cancelar un pedido (irreversible) se hace con un clic, sin confirmación', '3'],
      ['U-04', 'H9, H1', 'Si la cancelación falla, el mensaje de error queda detrás del velo del modal', '3'],
      ['U-05 a U-12', 'Varias', 'Cupón (error lejos del campo), sesión vencida, avisos con el SKU, controles de prueba visibles, entre otros', '2']
    ],
    [1.1, 1.1, 5.2, 0.6]
  ),
  respiro(),
  p('La tienda también hace muchas cosas bien: el **pago rechazado** explica qué pasó, que no hubo cobro y qué puede hacer el usuario; la disponibilidad tiene tres estados, incluido "Disponibilidad no verificada" cuando inventario está caído; y la web se adapta a móvil. **axe-core no encontró ningún incumplimiento de WCAG 2.2 AA en 13 pantallas**, aunque una herramienta automática no reemplaza una prueba con lector de pantalla.'),
  h2('5.4 Cuestionario SUS'),
  p('⚠️ **PENDIENTE: dato humano.** El cuestionario no se aplicó a evaluadores. Cuando haya respuestas, `npm run usabilidad:sus` calcula el puntaje (impares r − 1, pares 5 − r, suma × 2,5) y lo interpreta frente al promedio de referencia de 68, con el adjetivo de Bangor et al. (2009) y la nota de Sauro y Lewis.'),

  // 6 -----------------------------------------------------------------------
  h1('6. Módulo 3 — Pruebas de seguridad'),
  h2('6.1 Herramienta y configuración'),
  p('**OWASP ZAP 2.17.0** corrió en Docker contra el propio proyecto. Se hicieron cuatro escaneos:'),
  ...vinetas([
    'un escaneo **pasivo** de la web con spider clásico y AJAX spider;',
    'dos escaneos **activos y autenticados** de la API (como cliente y como administrador), a partir de la OpenAPI, con el token inyectado por `ZAP_AUTH_HEADER`;',
    'un **spidering autenticado** de la interfaz, con ZAP como proxy de un navegador Playwright que recorre las tareas de usabilidad.'
  ]),
  p('El escaneo activo corrió con los límites altos para que el limitador no ocultara las respuestas. Se complementó con **16 verificaciones manuales automatizadas** (`npm run test:seguridad`) de lo que ZAP no cubre: inyección, contraseñas, errores, IDOR, sesión, secretos, CORS y almacenamiento en el cliente.'),
  h2('6.2 Resultados'),
  p('ZAP no encontró inyección SQL, XSS reflejado, *path traversal* ni ejecución remota en las 117-118 reglas activas. Sus alertas señalaron la falta de cabeceras de seguridad en la web y **781 errores 500 y 1 030 respuestas 503** en la API. Al agruparlos aparecieron dos causas: entradas sin validar que llegaban hasta la base, y circuit breakers abiertos por los propios errores del escaneo. Las verificaciones manuales arrojaron **11 hallazgos** en 16 pruebas; resistieron las consultas parametrizadas, el hash de contraseñas, el aislamiento entre clientes, las cabeceras de confianza y la verificación y rotación de tokens.'),
  h2('6.3 Clasificación (OWASP Top 10 2025, CWE y CVSS v3.1)'),
  tabla(
    ['ID', 'Hallazgo', 'OWASP', 'CWE', 'CVSS'],
    [
      ['S-02', 'Secreto JWT por defecto y público: se forjan tokens de administrador', 'A02', '1394, 798', '9,8'],
      ['S-03', 'Token interno por defecto y puertos internos publicados: se salta el gateway', 'A02', '1394, 668', '8,3'],
      ['S-01', 'Registro público vinculado al `cliente_id` de otra persona', 'A01', '639', '8,2'],
      ['S-09', 'JWT y refresh token en `localStorage`', 'A07', '922', '6,9'],
      ['S-04', 'Los 4xx de un cliente abren el circuit breaker de todos', 'A10', '755', '6,5'],
      ['S-05', 'Inyección de operadores NoSQL en los filtros del catálogo', 'A05', '943', '5,3'],
      ['S-06', 'Entradas inválidas que responden 500', 'A10', '20', '4,3'],
      ['S-08', 'La web sin CSP ni cabeceras de seguridad', 'A02', '693, 1021', '4,3'],
      ['S-07', 'El rechazo de CORS responde 500', 'A10', '755', 'Bajo'],
      ['S-10', 'Correo sin validar', 'A06', '20', 'Bajo'],
      ['S-11', 'XSS almacenado latente (mitigado en la web por React)', 'A05', '79', 'Info.']
    ],
    [0.7, 5.0, 0.8, 1.0, 0.7]
  ),
  respiro(),
  p('**Falsos positivos justificados:** *Format String Error* (Node no usa `printf`: el 500 era un texto demasiado largo para la columna, es decir, S-06) y *Timestamp Disclosure* (son el `iat` y el `exp` del token del propio usuario, que devuelve `/auth/verificar`).'),

  // 7 -----------------------------------------------------------------------
  h1('7. Fase 3 — Matriz de calidad y diagnóstico'),
  h2('7.1 Priorización'),
  p('Para no priorizar a ojo, cada hallazgo recibe **Prioridad = Severidad (0-4) × Alcance (1-3)**. La severidad se normaliza desde la fuente propia de cada dimensión: el CVSS en seguridad, la escala de Nielsen en usabilidad, y en rendimiento cuánto se excede el umbral y con qué carga (4 si se incumple por más del doble con 50 VU; 1 si solo se incumple con 300 VU). El alcance es 3 si afecta a todos los usuarios o a la compra, y 1 si afecta solo a personal interno o a un caso borde. Las bandas son P1 (9-12), P2 (6-8), P3 (3-5) y P4 (0-2).'),
  tabla(
    ['Dimensión', 'Hallazgos', 'P1', 'P2', 'P3', 'P4', 'Corregidos', 'Aceptados', 'Siguiente iteración'],
    [
      ['Rendimiento', '6', '1', '2', '3', '0', '4', '0', '2'],
      ['Seguridad', '11', '3', '2', '2', '4', '10', '1', '0'],
      ['Usabilidad', '17', '2', '5', '7', '3', '5', '0', '12'],
      ['**Total**', '**34**', '**6**', '**9**', '**12**', '**7**', '**19**', '**1**', '**14**']
    ],
    [1.6, 1.0, 0.6, 0.6, 0.6, 0.6, 1.1, 1.0, 1.4]
  ),
  respiro(),
  h2('7.2 Matriz (extracto)'),
  tabla(
    ['Dim.', 'Criterio', 'Meta', 'Antes', 'Después', 'Estado', 'Prior.'],
    [
      ['Rend.', 'p95 del login con 50 VU', '< 1000 ms', '4 294 ms', '1 280 ms', 'Parcial', 'P1'],
      ['Rend.', 'Errores del catálogo con 300 VU', '< 1 %', '14 %', '0 %', 'Cumple', 'P3'],
      ['Rend.', 'p95 del checkout con 100 VU', '< 1500 ms', '2 116 ms', '—', 'No cumple', 'P2'],
      ['Rend.', 'Rechazo bajo saturación', 'Rápido y explícito', 'EOF a los 15 s', '503 en ~100 ms', 'Cumple', 'P2'],
      ['Seg.', 'Token de admin. forjado', 'Rechazado', 'Aceptado (200)', 'Rechazado (401)', 'Cumple', 'P1'],
      ['Seg.', 'Acceso directo a servicios', 'Sin acceso', 'Reserva sin JWT', '401', 'Cumple', 'P1'],
      ['Seg.', 'Aislamiento entre clientes', 'Sin acceso ajeno', 'Lee datos de Ana', '403', 'Cumple', 'P1'],
      ['Seg.', 'Errores 500 en el escaneo activo', '0', '781', '0', 'Cumple', 'P3'],
      ['Seg.', 'Tokens en el cliente', 'Fuera del alcance de un XSS', '`localStorage`', 'Mitigado con CSP', 'Aceptado', 'P2'],
      ['Usab.', 'Cuentas que pueden entrar', 'Todas', '4 de demostración', 'Todas', 'Cumple', 'P1'],
      ['Usab.', 'Productos alcanzables', '100 %', '20 de 71', '71 de 71', 'Cumple', 'P1'],
      ['Usab.', 'Hallazgos de severidad 3-4', '0', '4', '0', 'Cumple', '—'],
      ['Usab.', 'Puntaje SUS', '≥ 68', 'Pendiente', '—', 'Pendiente', '—']
    ],
    [0.7, 2.3, 1.4, 1.3, 1.3, 1.0, 0.6]
  ),
  respiro(),
  p('La matriz completa, con todas las métricas, está en `docs/calidad/MATRIZ-CALIDAD.md`.'),
  h2('7.3 Diagnóstico'),
  p('**Rendimiento.** Con la carga esperada (50 usuarios), el catálogo responde con un p95 de 146 ms y el checkout de 546 ms, dentro de sus metas, y el catálogo resiste 300 usuarios sin errores desde que el gateway reutiliza conexiones. El cuello de botella era el login: bcrypt en el hilo principal lo limitaba a 10 por segundo y, saturado, cortaba conexiones. Con el pool de hilos llega a 26 por segundo y rechaza el exceso en 100 ms, aunque su p95 (1,3 s) sigue sobre la meta porque bcrypt es costoso a propósito. El checkout se degrada desde 100 usuarios (p95 de 2,1 s; 7,2 s con 300) por saturación de PostgreSQL, pero sin un solo error en 20 910 compras: se vuelve lento, no incorrecto.'),
  p('**Seguridad.** Los controles de diseño resisten: consultas parametrizadas, aislamiento entre clientes, cabeceras de confianza, tokens y bcrypt. Las vulnerabilidades graves estaban en la configuración (un secreto JWT público, servicios alcanzables sin el gateway) y en un endpoint (el registro). Las tres están corregidas, el escaneo activo pasó de 781 errores 500 a cero y las verificaciones, de 11 hallazgos a 1, aceptado como riesgo.'),
  p('**Usabilidad.** La tienda es accesible, se adapta a móvil y es honesta con el estado del sistema en sus flujos centrales. Sus fallas estaban en los bordes y eran graves: solo cuatro cuentas podían entrar, el 72 % del catálogo era inalcanzable y cancelar era irreversible con un clic. Las cuatro están corregidas. Falta la voz de los usuarios: el SUS sigue pendiente de dato humano.'),

  // 8 -----------------------------------------------------------------------
  h1('8. Plan de acciones correctivas'),
  h2('8.1 Plan completo'),
  p('`docs/calidad/PLAN-CORRECCION.md` lista los 34 hallazgos con su acción, responsable (por rol: backend, frontend, infraestructura o QA), esfuerzo estimado y estado. Se corrigieron primero todos los P1 y luego los P2; los P3 y P4 corregidos salieron casi gratis junto a una corrección mayor del mismo componente. **Siguiente iteración**, por prioridad:'),
  ...vinetas([
    'R5 (P2): diagnosticar la saturación del checkout (pool de conexiones, bloqueo por SKU y CPU de PostgreSQL) antes de escalar.',
    'U-07, U-08 (P2): avisos con el nombre del producto y ocultar los controles de prueba de la pasarela.',
    'U-11 (P2): página de detalle del producto.',
    'R6, U-05, U-06, U-09 y U-10 (P3): tanda corta de mejoras.',
    'S-09 (P2, aceptado): pasar el refresh token a una cookie `HttpOnly` si cambian las condiciones que justificaron aceptarlo.'
  ]),
  h2('8.2 Corrección de rendimiento: bcrypt en un pool de hilos (R1-R4)'),
  p('**Causa raíz.** `bcryptjs` bloqueaba el hilo principal de auth y no había límite de cola. **Cambio** (`auth-service/src/pool-hash.ts`): un pool de `worker_threads` (hasta 4 hilos), una cola acotada que responde 503 `SERVICIO_SATURADO` con `Retry-After`, y el descarte de las tareas de clientes que ya cerraron la conexión. En el gateway, un `http.Agent` con keep-alive (R3) y 504 `TIEMPO_AGOTADO` en lugar de EOF (R4).'),
  ...codigo([
    'const encolar = (operacion, senal) => {',
    '  if (cola.length >= COLA_MAXIMA) {          // descarte de carga (R2)',
    "    return Promise.reject(new ErrorApp(503, 'El servicio de autenticacion esta saturado...', 'SERVICIO_SATURADO'));",
    '  }',
    '  return new Promise((resolver, rechazar) => {',
    '    cola.push({ id: siguienteId++, operacion, senal, resolver, rechazar });',
    '    despachar();                              // un hilo libre toma la tarea',
    '  });',
    '};'
  ]),
  tabla(
    ['Medición (misma batería de k6)', 'Antes', 'Después'],
    [
      ['Throughput del login con 50 VU', '10,0 logins/s', '**26,4 logins/s** (×2,6)'],
      ['p95 del login con 50 VU', '4 328 ms', '**1 300 ms** (−70 %)'],
      ['Logins exitosos en estrés (10 min)', '2 535', '**11 793** (×4,7)'],
      ['Fallos bajo saturación', '4 561 EOF a los 15 s', '503 en ~100 ms'],
      ['CPU de auth en estrés', '99,5 % (1 núcleo)', '408 % (4 núcleos)'],
      ['Errores del catálogo con 300 VU (R3)', '14 %', '**0 %**'],
      ['p95 del checkout con 50 VU, prueba A/B (R3)', '1 576 ms sin keep-alive', '**734 ms** con keep-alive'],
      ['Compras completadas, flujo en estrés', '1 874', '**6 162** (×3,3)']
    ],
    [3.6, 2.2, 2.2]
  ),
  respiro(),
  ...figura(path.join(GRAFICAS, 'antes-despues-fase3.png'), 'Figura 4. Antes y después de las correcciones de rendimiento. El panel del checkout compara la prueba A/B en las mismas condiciones.', 580, 400),
  p('Una aparente regresión del checkout (p95 de 546 → 735 ms) se investigó antes de aceptarla. La causa no estaba en el código: carritos heredados entre corridas, una cola de notificaciones acumulada y el desgaste del equipo tras horas de carga. Una **prueba A/B intercalada** en las mismas condiciones atribuyó la diferencia al entorno: sin keep-alive el p95 era de 1 576 ms y con keep-alive, de 734 ms.'),
  h2('8.3 Corrección de seguridad: secretos obligatorios y registro verificado (S-01 a S-04)'),
  p('**Causa raíz.** Los secretos tenían un valor de respaldo publicado en el código, en `docker-compose.yml` y en `.env.example`, y ese valor era el que corría. **Cambio**: `verificarSecretos()` detiene cada servicio si un secreto falta, tiene menos de 32 caracteres o es un valor publicado; Compose exige las variables y los puertos internos solo escuchan en `127.0.0.1`. Además, el registro verifica con clientes-service que el `cliente_id` pertenezca al correo (S-01), y el circuit breaker solo cuenta errores de red, 5xx y timeouts (S-04).'),
  ...codigo([
    'const problemaDelSecreto = (nombre) => {',
    '  const valor = process.env[nombre];',
    '  if (!valor) return `${nombre} no esta definido`;',
    '  if (SECRETOS_PUBLICADOS.has(valor)) return `${nombre} usa un valor publicado en el repositorio`;',
    '  if (valor.length < 32) return `${nombre} tiene menos de 32 caracteres`;',
    '  return null;',
    '};'
  ]),
  tabla(
    ['Medición (mismas verificaciones y mismo escaneo de ZAP)', 'Antes', 'Después'],
    [
      ['Token de administrador forjado con el secreto publicado', 'Aceptado (200): ve todos los pedidos', '**401**'],
      ['Reserva de stock directa al servicio, sin JWT', 'Aceptada (201)', '**401**'],
      ['Registro con el `cliente_id` de Ana', 'La cuenta lee su perfil y direcciones', '**403**'],
      ['Respuestas 503 durante el escaneo activo (S-04)', '1 030', '**0**'],
      ['Respuestas 500 durante el escaneo activo (S-06)', '781', '**0**'],
      ['Advertencias del baseline de ZAP sobre la web (S-08)', '8', '2 (informativas)'],
      ['Hallazgos de las 16 verificaciones manuales', '11', '**1** (S-09, aceptado)']
    ],
    [3.6, 2.4, 2.0]
  ),
  respiro(),
  p('**S-09, riesgo aceptado.** Los tokens en `localStorage` solo son explotables si antes existe un XSS, que no se encontró. React escapa la salida y la nueva CSP estricta (`script-src \'self\'`) bloquea los scripts inyectados. Corregirlo exige cambiar el modelo de sesión en auth, el gateway, la web y la app móvil, e introduce un riesgo nuevo (CSRF), a días de la entrega. Se compensa con la CSP, tokens de 15 min y rotación del refresh token con detección de reutilización.'),
  h2('8.4 Corrección de usabilidad: login real, paginación y cancelación segura (U-01 a U-04)'),
  p('**Cambio** (`clients/web`): campo de correo y contraseña vacía, con las cuentas de prueba como ayuda plegable; paginación del catálogo con "Mostrando X-Y de Z productos"; y la cancelación en dos pasos ("¿Cancelar el pedido? Esta acción no se puede deshacer"), con el error dentro del diálogo, con foco y desplazamiento, y un aviso de éxito al terminar.'),
  parDeImagenes(
    path.join(FIGURAS, 'E8-antes.png'),
    path.join(FIGURAS, 'E8-despues.png'),
    'Antes: el error de la cancelación queda detrás del velo del modal.',
    'Después: el error se ve completo dentro del diálogo y el detalle muestra el estado real.'
  ),
  tabla(
    ['Medición (mismo recorrido automatizado)', 'Antes', 'Después'],
    [
      ['Cuentas que pueden iniciar sesión (E11: Carla)', '4 de demostración: Carla no puede entrar', '**Todas**: Carla entra'],
      ['Productos alcanzables navegando (E3)', '20 de 71', '**71 de 71** en 4 páginas'],
      ['Error al cancelar un pedido ya despachado (E8)', 'Tapado por el modal', '**Visible y completo**'],
      ['Cancelación (T6)', 'Un clic, sin aviso', 'Confirmación y aviso de éxito'],
      ['Incumplimientos de WCAG 2.2 AA (axe, 13 pantallas)', '0', '0'],
      ['KLM de T1 y T6', '6,9 s y 12,1 s', '17,8 s y 15,2 s']
    ],
    [3.6, 2.4, 2.0]
  ),
  respiro(),
  p('El KLM **sube** a propósito. El antes era rápido porque no era un inicio de sesión real ni había confirmación: ahora se escriben credenciales y se confirma antes de destruir. Todas las tareas siguen muy por debajo de su tiempo esperado.'),
  h2('8.5 Pruebas de regresión'),
  p('Después de cada tanda de correcciones se ejecutó la regresión completa: `typecheck`, salud de los 9 servicios, contrato HTTP, concurrencia sobre el inventario, extremo a extremo y build de la web. Se agregaron 8 casos HTTP que impiden que las correcciones de seguridad retrocedan (de 65 a 73).'),
  tabla(
    ['Suite', 'Casos', 'Resultado tras la última corrección'],
    [
      ['Concurrencia (20 compradores por 5 unidades)', '33', 'Pasan; la sobreventa es imposible'],
      ['Contrato HTTP (RBAC, aislamiento, idempotencia, PCI-DSS…)', '73', '73/73'],
      ['Extremo a extremo (compra, rechazo, última unidad, cancelación)', '49', '49/49'],
      ['Salud, typecheck y build de la web', '—', 'Pasan'],
      ['**Total de casos funcionales**', '**155**', '**155 pasan**']
    ],
    [4.4, 0.9, 2.7]
  ),

  // 9 -----------------------------------------------------------------------
  h1('9. Conclusiones y lecciones aprendidas'),
  ...vinetas([
    '**El sistema es correcto bajo carga y seguro por diseño.** Sus problemas eran de capacidad en un punto (el login), de configuración (los secretos) y de acabado en los bordes de la interfaz. Los seis problemas críticos están corregidos y verificados con la misma prueba que los detectó.',
    '**Medir lleva a la causa, suponer no.** La hipótesis inicial del login era el *threadpool* de libuv; los datos de CPU por contenedor mostraron un solo núcleo saturado y llevaron a la causa real (`bcryptjs` en el hilo principal), que la ley de Little confirmó.',
    '**Un antes y después solo vale en las mismas condiciones.** Carritos heredados, colas asíncronas acumuladas y el desgaste del equipo produjeron una regresión aparente del checkout; solo una prueba A/B intercalada permitió atribuirla. Dos correcciones de usabilidad también se ajustaron gracias a que la verificación midió de nuevo, y no se dio por buena la primera versión.',
    '**Las herramientas se complementan.** ZAP no habría encontrado el registro con un `cliente_id` ajeno ni el secreto forjable; las verificaciones manuales sí. A su vez, el escaneo activo de ZAP destapó el circuit breaker que se abría con errores 404, algo que ninguna verificación manual buscaba.',
    '**Lo que no se midió se declara.** El SUS y la prueba con evaluadores quedan pendientes, con todo su material listo, en lugar de rellenarse con datos plausibles.'
  ]),

  // 10 ----------------------------------------------------------------------
  h1('10. Referencias'),
  ...vinetas([
    'Bangor, A., Kortum, P. y Miller, J. (2009). Determining what individual SUS scores mean: Adding an adjective rating scale. *Journal of Usability Studies*, 4(3), 114-123.',
    'Brooke, J. (1996). SUS: A "quick and dirty" usability scale. En *Usability Evaluation in Industry*. Taylor & Francis.',
    'Card, S. K., Moran, T. P. y Newell, A. (1983). *The Psychology of Human-Computer Interaction*. Lawrence Erlbaum.',
    'FIRST (2019). *Common Vulnerability Scoring System v3.1: Specification Document*.',
    'Grafana Labs. *k6 documentation*. https://grafana.com/docs/k6/',
    'Kieras, D. (2001). *Using the Keystroke-Level Model to Estimate Execution Times*. University of Michigan.',
    'Nielsen, J. (1994). *Usability Engineering*. Morgan Kaufmann; y 10 Usability Heuristics for User Interface Design.',
    'OWASP Foundation. *OWASP Top 10:2025* y *ZAP documentation*. https://www.zaproxy.org/docs/',
    'Sauro, J. y Lewis, J. R. (2016). *Quantifying the User Experience* (2.ª ed.). Morgan Kaufmann.',
    'W3C (2023). *Web Content Accessibility Guidelines (WCAG) 2.2*.',
    'Wharton, C., Rieman, J., Lewis, C. y Polson, P. (1994). The cognitive walkthrough method: A practitioner\'s guide. En *Usability Inspection Methods*. Wiley.'
  ]),

  // Anexos ------------------------------------------------------------------
  h1('Anexos'),
  h2('A. Repositorio y entregas'),
  new Paragraph({
    spacing: { after: 120 },
    children: [
      new TextRun({ text: 'Repositorio: ', font: FUENTE, size: 21, bold: true }),
      new ExternalHyperlink({ link: REPO, children: [new TextRun({ text: REPO, font: FUENTE, size: 21, color: VERDE, underline: {} })] })
    ]
  }),
  p('Cada fase se integró en `develop` con su propio pull request; las correcciones llevan commits `fix(rendimiento)`, `fix(seguridad)`, `fix(usabilidad)`, entre otros.'),
  tabla(
    ['PR', 'Rama', 'Contenido'],
    [
      ['#1', 'feature/fase1-preparacion', 'Entorno, poblado, inventario de rutas, OpenAPI y 4 defectos funcionales'],
      ['#2', 'feature/fase2-rendimiento', 'Escenarios k6, batería completa, gráficas y análisis'],
      ['#3', 'feature/fase3-correcciones-rendimiento', 'R1 a R4: pool de bcrypt, descarte de carga, keep-alive, 504'],
      ['#4', 'feature/fase2-seguridad', 'ZAP (pasivo y activo) y 16 verificaciones manuales'],
      ['#5', 'feature/fase3-correcciones-seguridad', 'S-01 a S-04 y S-10: secretos, registro y circuit breaker'],
      ['#6', 'feature/fase3-correcciones-seguridad-2', 'S-05 a S-08 y S-11; S-09 aceptado'],
      ['#7', 'feature/fase2-usabilidad', 'Tareas, recorrido KLM, heurísticas, axe, SUS y spidering autenticado'],
      ['#8', 'feature/fase3-correcciones-usabilidad', 'U-01 a U-04: login, paginación y cancelación'],
      ['#9', 'feature/fase3-matriz-calidad', 'Matriz de calidad y plan de corrección']
    ],
    [0.6, 3.4, 4.0]
  ),
  respiro(),
  h2('B. Documentos y evidencia en el repositorio'),
  tabla(
    ['Material', 'Ubicación'],
    [
      ['Resultados por dimensión', '`docs/calidad/RENDIMIENTO.md`, `SEGURIDAD.md`, `USABILIDAD.md`'],
      ['Matriz y plan de corrección', '`docs/calidad/MATRIZ-CALIDAD.md`, `PLAN-CORRECCION.md`'],
      ['Scripts de k6', '`tests/rendimiento/` (`npm run test:carga:*`)'],
      ['Reportes de ZAP (HTML, JSON y Markdown)', '`docs/evidencia/no-funcionales/seguridad/`'],
      ['Tareas, hoja de observación y protocolo', '`tests/usabilidad/tareas.md`'],
      ['Cuestionario SUS y cálculo', '`tests/usabilidad/sus-cuestionario.md`, `npm run usabilidad:sus`'],
      ['Capturas y datos del recorrido', '`docs/evidencia/no-funcionales/usabilidad/`'],
      ['Evidencia de rendimiento y gráficas', '`docs/evidencia/no-funcionales/rendimiento/`, `graficas/`'],
      ['Defectos funcionales corregidos (25)', '`docs/PRUEBAS.md`, sección 4']
    ],
    [3.2, 4.8]
  ),
  respiro(),
  h2('C. Cómo reproducir'),
  ...codigo([
    'npm install && npm run infra:carga              # sistema con limites de carga',
    'CLIENTES_CARGA=300 npm run sembrar:carga         # datos de prueba',
    'npm run test:carga:bateria                        # rendimiento (k6)',
    'npm run infra:normal && npm run test:seguridad    # verificaciones de seguridad',
    'npm run test:zap:baseline && npm run test:zap:api  # OWASP ZAP',
    'npm run usabilidad:recorrido                      # tareas, KLM, capturas y axe',
    'npm run informe:estrategias                       # este informe'
  ])
];

// ---------------------------------------------------------------------------
const documento = new Document({
  creator: 'Sergio Augusto Garcia Murcia y Juan Pablo Parra Gutierrez',
  title: 'Estrategias de validación y pruebas de software',
  description: 'Informe de la práctica de EIS II: rendimiento, usabilidad y seguridad',
  features: { updateFields: true },
  styles: {
    default: {
      document: { run: { font: FUENTE, size: 21, color: TINTA } },
      heading1: {
        run: { font: FUENTE, size: 32, bold: true, color: VERDE_OSCURO },
        paragraph: { spacing: { before: 0, after: 200 }, keepNext: true, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: VERDE_MEDIO, space: 4 } } }
      },
      heading2: { run: { font: FUENTE, size: 25, bold: true, color: VERDE }, paragraph: { spacing: { before: 240, after: 100 }, keepNext: true } },
      heading3: { run: { font: FUENTE, size: 22, bold: true, color: VERDE_MEDIO }, paragraph: { spacing: { before: 160, after: 80 }, keepNext: true } }
    }
  },
  numbering: {
    config: [
      {
        reference: 'vinetas',
        levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 500, hanging: 260 } }, run: { color: VERDE } } }]
      }
    ]
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }
        }
      },
      // Sin encabezados ni pies de pagina, por decision del equipo.
      children: contenido
    }
  ]
});

const principal = async (): Promise<void> => {
  mkdirSync(path.dirname(SALIDA), { recursive: true });
  writeFileSync(SALIDA, await Packer.toBuffer(documento));
  console.log(`Informe generado: ${path.relative(RAIZ, SALIDA)}`);
};

principal().catch((error) => {
  console.error(error);
  process.exit(1);
});
