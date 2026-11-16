/**
 * Motor de intenciones del asistente (docs/adr/0007).
 *
 * Es determinista y puro: recibe el texto, las intenciones (datos editables en
 * asistente_db) y el contexto de la conversacion, y devuelve la intencion con
 * su puntaje y las entidades. No consulta la red ni la base: por eso se prueba
 * con una tabla de frases (test/motor.test.ts) y se mide su tasa de acierto.
 *
 * Algoritmo:
 *   1. Normaliza el texto: minusculas, sin tildes, sin signos.
 *   2. Extrae entidades con expresiones regulares: SKU y numero de pedido.
 *   3. Puntua cada intencion: suma el peso de sus terminos presentes (una
 *      frase de varias palabras cuenta como un termino) mas los refuerzos por
 *      entidad. Empates: gana la de mayor prioridad.
 *   4. Por debajo del umbral, "no_entendido", salvo que la conversacion este
 *      esperando un dato (contexto de varios turnos) y el mensaje lo traiga.
 */

export interface Termino {
  texto: string;
  peso: number;
}

export interface Intencion {
  clave: string;
  descripcion?: string;
  prioridad?: number;
  requiere_sesion?: boolean;
  terminos: Termino[];
  /** Puntos extra si el mensaje trae la entidad, p. ej. { sku: 4 }. */
  refuerzos?: Partial<Record<keyof Entidades, number>>;
}

export interface Entidades {
  sku?: string;
  /** Numero de pedido (PED-AAAAMM-NNNNNN) o id numerico. */
  pedido?: string;
}

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
}

export const NO_ENTENDIDO = 'no_entendido';
export const UMBRAL_PUNTAJE = 2;

/** Minusculas, sin tildes ni signos, espacios simples. Conserva guiones (SKU-TEC-001). */
export const normalizar = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const PATRON_SKU = /\bsku-[a-z]{2,5}-\d{3}\b/;
const PATRON_NUMERO_PEDIDO = /\bped-\d{6}-\d{6}\b/;
const PATRON_PEDIDO_POR_ID = /\bpedido\s*(?:numero|no|nro|n)?\s*(\d{1,9})\b/;

export const extraerEntidades = (normalizado: string, pendiente?: Pendiente): Entidades => {
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
  return entidades;
};

/** ¿El termino aparece como palabra (o frase) completa? Con * al final, por prefijo. */
const contiene = (normalizado: string, termino: string): boolean => {
  const buscado = normalizar(termino.replace(/\*$/, ''));
  if (!buscado) return false;
  if (termino.endsWith('*')) return new RegExp(`(^|\\s)${escapar(buscado)}`).test(normalizado);
  return ` ${normalizado} `.includes(` ${buscado} `);
};

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const clasificar = (texto: string, intenciones: Intencion[], pendiente?: Pendiente): Resultado => {
  const normalizado = normalizar(texto);
  const entidades = extraerEntidades(normalizado, pendiente);

  const puntajes = intenciones
    .map((intencion) => {
      const coincidencias = intencion.terminos.filter((t) => contiene(normalizado, t.texto));
      const porTerminos = coincidencias.reduce((suma, t) => suma + t.peso, 0);
      let puntaje = porTerminos;
      for (const [entidad, extra] of Object.entries(intencion.refuerzos ?? {})) {
        if (entidades[entidad as keyof Entidades]) puntaje += extra ?? 0;
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

  // Un SKU o un numero de pedido sueltos bastan para entender que se pregunta.
  if (mejor < UMBRAL_PUNTAJE && entidades.sku) {
    return { intencion: 'precio_disponibilidad', puntaje: 0, confianza: 1, entidades, coincidencias: [] };
  }
  if (mejor < UMBRAL_PUNTAJE && entidades.pedido) {
    return { intencion: 'estado_pedido', puntaje: 0, confianza: 1, entidades, coincidencias: [] };
  }

  if (!primera || mejor < UMBRAL_PUNTAJE) {
    return { intencion: NO_ENTENDIDO, puntaje: mejor, confianza: 0, entidades, coincidencias: [] };
  }

  return {
    intencion: primera.intencion.clave,
    puntaje: mejor,
    confianza: Number((mejor / (mejor + (segunda?.puntaje ?? 0))).toFixed(2)),
    entidades,
    coincidencias: primera.coincidencias
  };
};

/** Palabras que no describen un producto: se quitan para armar la busqueda. */
const PALABRAS_VACIAS = new Set(
  (
    'el la los las lo un una unos unas de del al a y o u e en por para con sin que cual cuales es son esta estan ' +
    'me mi mis te tu tus su sus se le les nos yo usted ustedes hay tienen tiene tienes tengo quiero quisiera busco ' +
    'buscar buscando estoy necesito venden vende vendes comprar muestrame recomiendame algun alguna algunos algo ' +
    'favor porfa porfavor hola gracias precio precios cuanto cuesta cuestan vale valen valor disponible disponibles ' +
    'disponibilidad stock quedan queda unidades existencias agotado producto productos catalogo articulo articulos ' +
    'informacion info sobre como ver mostrar dame saber'
  ).split(' ')
);

/** Lo que queda del mensaje al quitar palabras vacias y SKU: el nombre del producto buscado. */
export const extraerConsultaProducto = (texto: string): string =>
  normalizar(texto)
    .replace(PATRON_SKU, ' ')
    .split(' ')
    .filter((p) => p.length > 1 && !PALABRAS_VACIAS.has(p) && !/^\d+$/.test(p))
    .join(' ')
    .trim();
