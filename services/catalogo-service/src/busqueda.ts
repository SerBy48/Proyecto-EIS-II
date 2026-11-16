/**
 * Busqueda tolerante del catalogo (respaldo del indice de texto).
 *
 * El indice de texto de MongoDB es rapido y ordena por relevancia, pero solo
 * encuentra palabras completas: "audi" o "portat" (lo que alguien lleva
 * escrito en el buscador) no devuelven nada. Cuando el indice no encuentra
 * resultados, el catalogo repite la busqueda con una expresion regular por
 * palabra, insensible a tildes y al plural.
 *
 * Seguridad: cada palabra se escapa antes de armar la expresion (nunca se
 * interpreta lo que escribe el usuario como regex) y se limita la cantidad y el
 * largo de las palabras, para que una consulta no pueda volverse costosa.
 */

const PALABRAS_VACIAS = new Set(
  'el la los las un una unos unas de del al a y o en por para con sin que es son mas muy'.split(' ')
);

const MAXIMO_PALABRAS = 5;
const MAXIMO_LARGO = 30;

/** Minusculas y sin tildes. */
export const sinTildes = (texto: string): string =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Quita el plural mas comun del espanol: monitores -> monitor, audifonos -> audifono. */
export const singular = (palabra: string): string => {
  // Vocal + l, r, n, d, z o j + "es" (celular-es, monitor-es); si no, solo la "s" (disponible-s).
  if (palabra.length > 4 && /[aeiou][lrndzj]es$/.test(palabra)) return palabra.slice(0, -2);
  if (palabra.length > 3 && palabra.endsWith('s') && !palabra.endsWith('ss')) return palabra.slice(0, -1);
  return palabra;
};

/** Palabras utiles de la consulta, normalizadas y en singular. */
export const palabrasDeBusqueda = (consulta: string): string[] =>
  sinTildes(consulta)
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length >= 2 && !PALABRAS_VACIAS.has(p))
    .slice(0, MAXIMO_PALABRAS)
    .map((p) => singular(p.slice(0, MAXIMO_LARGO)));

const CLASES: Record<string, string> = { a: '[aá]', e: '[eé]', i: '[ií]', o: '[oó]', u: '[uúü]', n: '[nñ]' };

/** Expresion regular (como texto) que encuentra la palabra con o sin tildes. */
export const patronSinTildes = (palabra: string): string =>
  palabra
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .split('')
    .map((letra) => CLASES[letra] ?? letra)
    .join('');

/**
 * Filtro de MongoDB: TODAS las palabras deben aparecer (en el nombre, la
 * marca, la subcategoria o la descripcion). Devuelve null si no hay palabras.
 */
export const filtroTolerante = (consulta: string): Record<string, unknown> | null => {
  const palabras = palabrasDeBusqueda(consulta);
  if (!palabras.length) return null;
  return {
    $and: palabras.map((palabra) => {
      const regex = { $regex: patronSinTildes(palabra), $options: 'i' };
      return { $or: [{ nombre: regex }, { marca: regex }, { subcategoria: regex }, { descripcion: regex }] };
    })
  };
};
