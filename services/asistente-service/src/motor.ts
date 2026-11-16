/**
 * Motor de intenciones del asistente (docs/adr/0007).
 *
 * Es determinista y puro: recibe el texto, las intenciones (datos editables en
 * asistente_db), el vocabulario del catalogo y el contexto de la conversacion,
 * y devuelve la intencion con su puntaje y las entidades. No consulta la red
 * ni la base: por eso se prueba con tablas de frases (test/motor.test.ts) y se
 * mide su tasa de acierto.
 *
 * Algoritmo:
 *   1. Normaliza el texto: minusculas, sin tildes ni signos, cifras unidas
 *      (3.000.000 -> 3000000).
 *   2. Extrae entidades: SKU, numero de pedido, subcategoria del catalogo
 *      (por su nombre o sus sinonimos, que vienen de catalogo_db: un producto o
 *      una subcategoria nueva no exige tocar este archivo), rango de precio,
 *      "barato" y "en oferta".
 *   3. Puntua cada intencion: suma el peso de sus terminos presentes mas los
 *      refuerzos por entidad. Un termino coincide palabra por palabra, en
 *      singular o plural, y con un error de tipeo si la palabra del mensaje no
 *      es una palabra conocida ("audifnos" -> "audifonos", pero "cuesta" no se
 *      confunde con "cuenta"). Empates: gana la de mayor prioridad.
 *   4. Por debajo del umbral: si el mensaje nombra productos (subcategoria o
 *      precio), es una busqueda; si la conversacion esperaba un dato y el
 *      mensaje lo trae, sigue el contexto; si no, "no_entendido" con las
 *      intenciones mas cercanas como sugerencia.
 */

export interface Termino {
  texto: string;
  peso: number;
}

export interface Intencion {
  clave: string;
  descripcion?: string;
  /** Frase que se envia al elegir la intencion como sugerencia. */
  ejemplo?: string;
  prioridad?: number;
  requiere_sesion?: boolean;
  terminos: Termino[];
  /** Puntos extra si el mensaje trae la entidad, p. ej. { sku: 4 }. */
  refuerzos?: Partial<Record<ClaveEntidad, number>>;
}

export interface Entidades {
  sku?: string;
  /** Numero de pedido (PED-AAAAMM-NNNNNN) o id numerico. */
  pedido?: string;
  /** Slug de la subcategoria del catalogo que nombra el mensaje. */
  subcategoria?: string;
  /** El mensaje nombra la categoria completa ("tecnologia"). */
  categoria?: string;
  precio_min?: number;
  precio_max?: number;
  /** "barato", "economico": ordenar de menor a mayor precio. */
  economico?: boolean;
  /** "oferta", "descuento", "promocion". */
  oferta?: boolean;
}

export type ClaveEntidad = 'sku' | 'pedido' | 'subcategoria' | 'categoria' | 'precio' | 'economico' | 'oferta';

/** Subcategoria tal como la publica GET /api/catalogo/categorias. */
export interface Subcategoria {
  slug: string;
  nombre: string;
  sinonimos?: string[];
  productos?: number;
}

export interface Vocabulario {
  categorias: string[];
  subcategorias: Subcategoria[];
}

export const VOCABULARIO_VACIO: Vocabulario = { categorias: [], subcategorias: [] };

/** Lo que la conversacion espera del siguiente mensaje. */
export interface Pendiente {
  intencion: string;
  espera: 'pedido' | 'producto';
}

export interface Resultado {
  intencion: string;
  puntaje: number;
  /** 0..1: que tanto se impone la ganadora a la segunda. */
  confianza: number;
  entidades: Entidades;
  /** Terminos que coincidieron, para depurar y para la analitica. */
  coincidencias: string[];
  /** true si la intencion salio del contexto y no del texto. */
  por_contexto?: boolean;
  /** Con no_entendido: las intenciones que mas se acercaron, para sugerirlas. */
  sugerencias?: string[];
}

export const NO_ENTENDIDO = 'no_entendido';
export const UMBRAL_PUNTAJE = 2;

// ------------------------------------------------------------- normalizar

/** Minusculas, sin tildes ni signos, espacios simples. Conserva guiones (SKU-TEC-001) y une cifras (3.000.000). */
export const normalizar = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/(\d)[.,](?=\d{3}(?!\d))/g, '$1')
    .replace(/[^a-z0-9ñ\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Singular del espanol: monitores -> monitor, audifonos -> audifono, celulares -> celular. */
export const singular = (palabra: string): string => {
  // Vocal + l, r, n, d, z o j + "es" (celular-es, monitor-es); si no, solo la "s" (disponible-s).
  if (palabra.length > 4 && /[aeiou][lrndzj]es$/.test(palabra)) return palabra.slice(0, -2);
  if (palabra.length > 3 && palabra.endsWith('s') && !palabra.endsWith('ss')) return palabra.slice(0, -1);
  return palabra;
};

/** Distancia de edicion (Levenshtein) con corte temprano. */
export const distancia = (a: string, b: string, maximo = 2): number => {
  if (Math.abs(a.length - b.length) > maximo) return maximo + 1;
  let previa = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const actual = [i];
    let minimoFila = i;
    for (let j = 1; j <= b.length; j++) {
      actual[j] = Math.min(previa[j] + 1, actual[j - 1] + 1, previa[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      minimoFila = Math.min(minimoFila, actual[j]);
    }
    if (minimoFila > maximo) return maximo + 1;
    previa = actual;
  }
  return previa[b.length];
};

/** Palabras que no describen un producto: se quitan para armar la busqueda. */
const PALABRAS_VACIAS = new Set(
  (
    'el la los las lo un una unos unas de del al a y o u e en por para con sin que cual cuales es son esta estan este estos ' +
    'me mi mis te tu tus su sus se le les nos yo usted ustedes hay tienen tiene tienes tengo quiero quisiera busco ' +
    'buscar buscando estoy necesito venden vende vendes manejan manejas comprar compro muestrame muestreme mostrar ' +
    'recomiendame recomiendas recomienda recomendar recomendacion alguno algun alguna algunos algo favor porfa porfavor ' +
    'hola buenas gracias precio precios cuanto cuesta cuestan vale valen valor disponible disponibles disponibilidad stock ' +
    'quedan queda unidades existencias agotado producto productos catalogo articulo articulos informacion info sobre como ' +
    'ver dame saber bueno buena buenos buenas mejor mejores barato barata baratos baratas economico economica economicos ' +
    'oferta ofertas descuento descuentos promocion promociones rebaja rebajas menos mas hasta desde entre maximo minimo ' +
    'millon millones mil pesos tecnologia tecnologicos tecnologico tienda serbytek aqui ahi interesa interesan ' +
    'puedo puede pueden podria sirve sirva tipo clase marca'
  ).split(' ')
);

/** Palabras que el motor ya conoce: no se corrigen como si fueran errores de tipeo. */
const palabrasConocidas = (intenciones: Intencion[], vocabulario: Vocabulario): Set<string> => {
  const conocidas = new Set(PALABRAS_VACIAS);
  const agregar = (texto: string) => normalizar(texto.replace(/\*$/, '')).split(' ').forEach((p) => conocidas.add(p));
  for (const intencion of intenciones) for (const t of intencion.terminos) agregar(t.texto);
  for (const s of vocabulario.subcategorias) [s.slug, s.nombre, ...(s.sinonimos ?? [])].forEach(agregar);
  return conocidas;
};

// ------------------------------------------------------------- coincidir

/** ¿La palabra del mensaje corresponde a la del termino? */
const mismaPalabra = (delMensaje: string, delTermino: string, prefijo: boolean, conocidas: Set<string>): boolean => {
  if (delMensaje === delTermino) return true;
  if (prefijo) return delMensaje.startsWith(delTermino);
  if (singular(delMensaje) === singular(delTermino)) return true;
  // Error de tipeo: solo si la palabra del mensaje no es otra palabra conocida
  // y empieza igual. Una letra en palabras de 5 a 7, dos desde 8.
  if (delTermino.length < 5 || conocidas.has(delMensaje) || delMensaje[0] !== delTermino[0]) return false;
  const tolerancia = delTermino.length >= 8 ? 2 : 1;
  return distancia(delMensaje, delTermino, tolerancia) <= tolerancia || distancia(singular(delMensaje), singular(delTermino), tolerancia) <= tolerancia;
};

/** Posicion (en palabras) donde aparece el termino completo, o -1. Con * al final, la ultima palabra va por prefijo. */
export const posicionDe = (palabras: string[], termino: string, conocidas: Set<string> = new Set()): number => {
  const prefijo = termino.endsWith('*');
  const buscadas = normalizar(termino.replace(/\*$/, '')).split(' ').filter(Boolean);
  if (!buscadas.length) return -1;
  for (let i = 0; i + buscadas.length <= palabras.length; i++) {
    const coincide = buscadas.every((b, j) => mismaPalabra(palabras[i + j], b, prefijo && j === buscadas.length - 1, conocidas));
    if (coincide) return i;
  }
  return -1;
};

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------------------------------------------------------------- entidades

const PATRON_SKU = /\bsku-[a-z]{2,5}-\d{3}\b/;
const PATRON_NUMERO_PEDIDO = /\bped-\d{6}-\d{6}\b/;
const PATRON_PEDIDO_POR_ID = /\bpedido\s*(?:numero|no|nro|n)?\s*(\d{1,9})\b/;

/** "3 millones", "500 mil", "1500000", "2,5 millones" -> pesos. */
const CANTIDAD = String.raw`(\d+(?:[.,]\d{1,2})?)\s*(millones|millon|palos|m|mil|k)?\b`;

const aPesos = (numero: string, unidad?: string): number => {
  const valor = Number(numero.replace(',', '.'));
  if (unidad && ['millones', 'millon', 'palos', 'm'].includes(unidad)) return Math.round(valor * 1_000_000);
  if (unidad && ['mil', 'k'].includes(unidad)) return Math.round(valor * 1_000);
  return Math.round(valor);
};

/** Rango de precio que pide el mensaje. Se lee del texto en minusculas sin tildes, con sus decimales. */
export const extraerPrecio = (texto: string): Pick<Entidades, 'precio_min' | 'precio_max'> => {
  const t = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/(\d)\.(?=\d{3}(?!\d))/g, '$1')
    .replace(/\$/g, ' ');
  const entre = t.match(new RegExp(String.raw`\bentre\s+${CANTIDAD}\s+y\s+${CANTIDAD}`));
  if (entre) {
    // "entre 1 y 2 millones": la unidad del segundo vale para el primero.
    const unidad = entre[2] ?? entre[4];
    const a = aPesos(entre[1], unidad);
    const b = aPesos(entre[3], entre[4]);
    return { precio_min: Math.min(a, b), precio_max: Math.max(a, b) };
  }
  const resultado: Pick<Entidades, 'precio_min' | 'precio_max'> = {};
  const maximo = t.match(new RegExp(String.raw`\b(?:menos de|hasta|maximo|max|no mas de|por debajo de|inferior a|que no pase de)\s+${CANTIDAD}`));
  if (maximo) resultado.precio_max = aPesos(maximo[1], maximo[2]);
  const minimo = t.match(new RegExp(String.raw`\b(?:mas de|minimo|por encima de|superior a|desde)\s+${CANTIDAD}`));
  if (minimo) resultado.precio_min = aPesos(minimo[1], minimo[2]);
  // Un precio de 0 o absurdo (p. ej. "mas de 2" sin unidad) no es un filtro.
  if ((resultado.precio_max ?? 1000) < 1000) delete resultado.precio_max;
  if ((resultado.precio_min ?? 1000) < 1000) delete resultado.precio_min;
  return resultado;
};

const PALABRAS_ECONOMICO = ['barato', 'barata', 'economico', 'economica', 'bajo costo', 'buen precio', 'precio bajo', 'asequible'];
const PALABRAS_OFERTA = ['oferta', 'descuento', 'promocion', 'rebaja', 'liquidacion', 'black friday'];

/** Subcategoria que nombra el mensaje: la que aparece primero; a igual posicion, la frase mas larga. */
export const extraerSubcategoria = (palabras: string[], vocabulario: Vocabulario, conocidas: Set<string>): string | undefined => {
  let mejor: { slug: string; posicion: number; largo: number } | undefined;
  for (const s of vocabulario.subcategorias) {
    for (const frase of [s.slug, s.nombre, ...(s.sinonimos ?? [])]) {
      const posicion = posicionDe(palabras, frase, conocidas);
      if (posicion < 0) continue;
      const largo = normalizar(frase).split(' ').length;
      if (!mejor || posicion < mejor.posicion || (posicion === mejor.posicion && largo > mejor.largo)) {
        mejor = { slug: s.slug, posicion, largo };
      }
    }
  }
  return mejor?.slug;
};

export const extraerEntidades = (
  normalizado: string,
  pendiente?: Pendiente,
  vocabulario: Vocabulario = VOCABULARIO_VACIO,
  conocidas: Set<string> = new Set(),
  original = normalizado
): Entidades => {
  const entidades: Entidades = {};
  const sku = normalizado.match(PATRON_SKU);
  if (sku) entidades.sku = sku[0].toUpperCase();

  const numero = normalizado.match(PATRON_NUMERO_PEDIDO);
  const porId = normalizado.match(PATRON_PEDIDO_POR_ID);
  if (numero) entidades.pedido = numero[0].toUpperCase();
  else if (porId) entidades.pedido = porId[1];
  else if (pendiente?.espera === 'pedido') {
    // Si el asistente acaba de pedir el numero, basta con "el 106" o "106".
    const solo = normalizado.match(/^(?:el\s+|es\s+el\s+|numero\s+)?(\d{1,9})$/);
    if (solo) entidades.pedido = solo[1];
  }

  const palabras = normalizado.split(' ').filter(Boolean);
  const subcategoria = extraerSubcategoria(palabras, vocabulario, conocidas);
  if (subcategoria) entidades.subcategoria = subcategoria;
  const categoria = vocabulario.categorias.find((c) => posicionDe(palabras, c) >= 0 || posicionDe(palabras, `${c}*`) >= 0);
  if (categoria) entidades.categoria = categoria;

  Object.assign(entidades, extraerPrecio(original));
  if (PALABRAS_ECONOMICO.some((p) => posicionDe(palabras, p) >= 0)) entidades.economico = true;
  if (PALABRAS_OFERTA.some((p) => posicionDe(palabras, p) >= 0)) entidades.oferta = true;
  return entidades;
};

/** ¿La entidad cuenta para el refuerzo? (precio agrupa minimo y maximo). */
const tieneEntidad = (entidades: Entidades, clave: ClaveEntidad): boolean =>
  clave === 'precio' ? entidades.precio_min !== undefined || entidades.precio_max !== undefined : Boolean(entidades[clave]);

/** ¿El mensaje habla de productos aunque no use un verbo de busqueda? */
const nombraProductos = (e: Entidades): boolean =>
  Boolean(e.subcategoria || e.categoria || e.precio_min !== undefined || e.precio_max !== undefined || e.economico);

// ---------------------------------------------------------------- clasificar

export const clasificar = (
  texto: string,
  intenciones: Intencion[],
  pendiente?: Pendiente,
  vocabulario: Vocabulario = VOCABULARIO_VACIO
): Resultado => {
  const normalizado = normalizar(texto);
  const palabras = normalizado.split(' ').filter(Boolean);
  const conocidas = palabrasConocidas(intenciones, vocabulario);
  const entidades = extraerEntidades(normalizado, pendiente, vocabulario, conocidas, texto);

  const puntajes = intenciones
    .map((intencion) => {
      // "pedido" y "pedidos" son el mismo termino una vez que se acepta el
      // plural: se cuenta una vez, con el mayor peso.
      const porForma = new Map<string, Termino>();
      for (const t of intencion.terminos) {
        if (posicionDe(palabras, t.texto, conocidas) < 0) continue;
        const forma = normalizar(t.texto).split(' ').map(singular).join(' ');
        if ((porForma.get(forma)?.peso ?? -1) < t.peso) porForma.set(forma, t);
      }
      const coincidencias = [...porForma.values()];
      const porTerminos = coincidencias.reduce((suma, t) => suma + t.peso, 0);
      let puntaje = porTerminos;
      for (const [entidad, extra] of Object.entries(intencion.refuerzos ?? {})) {
        if (tieneEntidad(entidades, entidad as ClaveEntidad)) puntaje += extra ?? 0;
      }
      return { intencion, puntaje, porTerminos, coincidencias: coincidencias.map((t) => t.texto) };
    })
    .sort((a, b) => b.puntaje - a.puntaje || (b.intencion.prioridad ?? 0) - (a.intencion.prioridad ?? 0));

  const [primera, segunda] = puntajes;
  const mejor = primera?.puntaje ?? 0;

  // Contexto de varios turnos: el asistente pidio un dato y el mensaje lo trae
  // SIN palabras de otra intencion. Se miran solo los terminos: los refuerzos
  // por entidad no cuentan, porque un numero de pedido suelto no dice si se
  // quiere ver o cancelar (lo dice la pregunta anterior).
  const masPalabras = Math.max(0, ...puntajes.map((p) => p.porTerminos));
  if (pendiente && masPalabras < UMBRAL_PUNTAJE) {
    const trae = (pendiente.espera === 'pedido' && entidades.pedido) || (pendiente.espera === 'producto' && normalizado.length > 0);
    if (trae) {
      return { intencion: pendiente.intencion, puntaje: mejor, confianza: 1, entidades, coincidencias: [], por_contexto: true };
    }
  }

  if (mejor < UMBRAL_PUNTAJE) {
    // Un SKU o un numero de pedido sueltos bastan para entender que se pregunta.
    if (entidades.sku) return { intencion: 'precio_disponibilidad', puntaje: mejor, confianza: 1, entidades, coincidencias: [] };
    if (entidades.pedido) return { intencion: 'estado_pedido', puntaje: mejor, confianza: 1, entidades, coincidencias: [] };
    // "audifonos", "router wifi", "algo de menos de 500 mil": es una busqueda.
    if (nombraProductos(entidades)) {
      return { intencion: entidades.oferta ? 'ofertas' : 'buscar_producto', puntaje: mejor, confianza: 1, entidades, coincidencias: [] };
    }
    const sugerencias = puntajes
      .filter((p) => p.puntaje > 0)
      .slice(0, 3)
      .map((p) => p.intencion.clave);
    return { intencion: NO_ENTENDIDO, puntaje: mejor, confianza: 0, entidades, coincidencias: [], sugerencias };
  }

  return {
    intencion: primera.intencion.clave,
    puntaje: mejor,
    confianza: Number((mejor / (mejor + (segunda?.puntaje ?? 0))).toFixed(2)),
    entidades,
    coincidencias: primera.coincidencias
  };
};

// ------------------------------------------------------------- busqueda

const PATRONES_PRECIO = [
  /\bentre\s+\d+(?:[.,]\d{1,2})?\s*(?:millones|millon|palos|m|mil|k)?\s+y\s+\d+(?:[.,]\d{1,2})?\s*(?:millones|millon|palos|m|mil|k)?\b/g,
  /\b(?:menos de|hasta|maximo|max|no mas de|por debajo de|inferior a|que no pase de|mas de|minimo|por encima de|superior a|desde)\s+\d+(?:[.,]\d{1,2})?\s*(?:millones|millon|palos|m|mil|k)?\b/g
];

/**
 * Lo que queda del mensaje al quitar palabras vacias, SKU y rangos de precio:
 * el nombre del producto buscado ("portatil aurora", "audifonos bluetooth").
 */
export const extraerConsultaProducto = (texto: string): string => {
  let t = normalizar(texto).replace(PATRON_SKU, ' ');
  for (const patron of PATRONES_PRECIO) t = t.replace(patron, ' ');
  return t
    .split(' ')
    .filter((p) => p.length > 1 && !PALABRAS_VACIAS.has(p) && !/^\d+$/.test(p))
    .join(' ')
    .trim();
};

export const _interno = { escapar, palabrasConocidas, mismaPalabra };
