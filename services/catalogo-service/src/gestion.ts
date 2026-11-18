import { errorSolicitud } from '@ecommerce/shared';

/**
 * Reglas de la gestion del catalogo desde el panel (RF-48 y RF-49).
 *
 * El precio lo pone el catalogo (invariante 2): por eso lo que llega del panel
 * se valida aqui, no en la web. Un descuento del 100 % o un precio negativo
 * le regalarian el producto a cualquiera.
 */

export const PRECIO_MINIMO = 1_000;
export const PRECIO_MAXIMO = 100_000_000;
export const DESCUENTO_MAXIMO = 90;
export const MAXIMO_IMAGENES = 6;

/** Ruta publica de una imagen (servida por GET /imagenes/:nombre). */
export const PREFIJO_IMAGENES = '/api/catalogo/imagenes/';
const PATRON_IMAGEN = /^\/api\/catalogo\/imagenes\/[A-Za-z0-9_-]{1,80}(\.webp)?$/;
const PATRON_SKU = /^[A-Z0-9][A-Z0-9-]{2,39}$/;

/**
 * El descuento solo vale mientras la oferta este vigente. Una oferta sin fecha
 * de fin dura hasta que alguien la quite; una vencida deja el precio de lista
 * sin que nadie tenga que entrar a quitarla.
 */
export const descuentoVigente = (producto: Record<string, unknown>, ahora = new Date()): number => {
  const descuento = Number(producto.descuento_porcentaje ?? 0);
  if (!descuento) return 0;
  const hasta = producto.oferta_hasta ? new Date(String(producto.oferta_hasta)) : null;
  return hasta && hasta.getTime() <= ahora.getTime() ? 0 : descuento;
};

/** Filtro de MongoDB equivalente a descuentoVigente() > 0. */
export const filtroEnOferta = (ahora = new Date()): Record<string, unknown> => ({
  descuento_porcentaje: { $gt: 0 },
  $or: [{ oferta_hasta: null }, { oferta_hasta: { $exists: false } }, { oferta_hasta: { $gt: ahora } }]
});

export const precioFinal = (precio: number, descuento = 0): number => Math.round(precio * (1 - descuento / 100));

const texto = (valor: unknown, campo: string, minimo: number, maximo: number): string => {
  if (typeof valor !== 'string') throw errorSolicitud(`El campo ${campo} debe ser texto.`);
  const limpio = valor.trim();
  if (limpio.length < minimo || limpio.length > maximo) {
    throw errorSolicitud(`El campo ${campo} debe tener entre ${minimo} y ${maximo} caracteres.`);
  }
  return limpio;
};

const entero = (valor: unknown, campo: string, minimo: number, maximo: number, unidad = ''): number => {
  const numero = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
  if (typeof numero !== 'number' || !Number.isInteger(numero) || numero < minimo || numero > maximo) {
    throw errorSolicitud(`El campo ${campo} debe ser un entero entre ${minimo.toLocaleString('es-CO')} y ${maximo.toLocaleString('es-CO')}${unidad}.`);
  }
  return numero;
};

/** Fecha de fin de la oferta: null la quita; si viene, debe ser futura. */
const fechaFin = (valor: unknown, ahora: Date): Date | null => {
  if (valor === null || valor === '') return null;
  if (typeof valor !== 'string') throw errorSolicitud('La fecha de fin de la oferta debe ser una fecha (AAAA-MM-DD o ISO 8601).');
  // Una fecha sin hora vale hasta el final de ese dia (hora de Colombia).
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(`${valor}T23:59:59-05:00`) : new Date(valor);
  if (Number.isNaN(fecha.getTime())) throw errorSolicitud('La fecha de fin de la oferta no es valida.');
  if (fecha.getTime() <= ahora.getTime()) throw errorSolicitud('La fecha de fin de la oferta debe ser posterior a hoy.');
  return fecha;
};

const atributosValidos = (valor: unknown): Record<string, string | number | boolean> => {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    throw errorSolicitud('Los atributos deben ser un objeto { nombre: valor }.');
  }
  const entradas = Object.entries(valor as Record<string, unknown>);
  if (entradas.length > 20) throw errorSolicitud('Maximo 20 atributos por producto.');
  const limpio: Record<string, string | number | boolean> = {};
  for (const [clave, dato] of entradas) {
    if (!/^[a-z0-9_]{1,40}$/.test(clave)) throw errorSolicitud(`Atributo invalido: ${clave.slice(0, 40)} (minusculas, numeros y guion bajo).`);
    if (!['string', 'number', 'boolean'].includes(typeof dato) || String(dato).length > 120) {
      throw errorSolicitud(`El atributo ${clave} debe ser un texto corto, un numero o si/no.`);
    }
    limpio[clave] = dato as string | number | boolean;
  }
  return limpio;
};

const imagenesValidas = (valor: unknown): string[] => {
  if (!Array.isArray(valor) || valor.length > MAXIMO_IMAGENES) {
    throw errorSolicitud(`Las imagenes deben ser una lista de maximo ${MAXIMO_IMAGENES} rutas.`);
  }
  for (const ruta of valor) {
    if (typeof ruta !== 'string' || !PATRON_IMAGEN.test(ruta)) {
      throw errorSolicitud('Cada imagen debe ser una ruta de /api/catalogo/imagenes/ (se suben con POST /productos/:sku/imagenes).');
    }
  }
  return [...new Set(valor as string[])];
};

export interface Seccion {
  categoria: string;
  subcategorias: string[];
}

/**
 * Valida un alta (completo) o una edicion (parcial) y devuelve solo los campos
 * permitidos ya normalizados. Lo que no se reconoce se ignora: nunca llega a
 * la base un campo que el panel no deberia poder escribir (creado_en, _id).
 */
export const validarProducto = (
  cuerpo: Record<string, unknown>,
  { parcial, secciones, ahora = new Date() }: { parcial: boolean; secciones: Seccion[]; ahora?: Date }
): Record<string, unknown> => {
  if (typeof cuerpo !== 'object' || cuerpo === null) throw errorSolicitud('El cuerpo debe ser un objeto JSON.');
  const salida: Record<string, unknown> = {};
  const viene = (campo: string) => cuerpo[campo] !== undefined;

  if (!parcial) {
    const faltan = ['sku', 'nombre', 'subcategoria', 'precio'].filter((c) => !viene(c) || cuerpo[c] === '');
    if (faltan.length) throw errorSolicitud(`Campos obligatorios: ${faltan.join(', ')}`);
    const sku = String(cuerpo.sku).trim().toUpperCase();
    if (!PATRON_SKU.test(sku)) throw errorSolicitud('El SKU debe tener de 3 a 40 letras, numeros o guiones (ej. SKU-TEC-061).');
    salida.sku = sku;
    salida.marca = 'Sin marca';
  }

  if (viene('nombre')) salida.nombre = texto(cuerpo.nombre, 'nombre', 3, 120);
  if (viene('descripcion')) salida.descripcion = cuerpo.descripcion === '' ? '' : texto(cuerpo.descripcion, 'descripcion', 0, 2000);
  if (viene('marca')) salida.marca = texto(cuerpo.marca, 'marca', 1, 60);
  if (viene('precio')) salida.precio = entero(cuerpo.precio, 'precio', PRECIO_MINIMO, PRECIO_MAXIMO, ' pesos');
  if (viene('descuento_porcentaje')) salida.descuento_porcentaje = entero(cuerpo.descuento_porcentaje, 'descuento_porcentaje', 0, DESCUENTO_MAXIMO, ' %');
  if (viene('oferta_hasta')) salida.oferta_hasta = fechaFin(cuerpo.oferta_hasta, ahora);
  if (viene('activo')) {
    if (typeof cuerpo.activo !== 'boolean') throw errorSolicitud('El campo activo debe ser true o false.');
    salida.activo = cuerpo.activo;
  }
  if (viene('atributos')) salida.atributos = atributosValidos(cuerpo.atributos);
  if (viene('imagenes')) salida.imagenes = imagenesValidas(cuerpo.imagenes);

  // La seccion debe existir: una subcategoria inventada dejaria el producto
  // fuera de los filtros del catalogo y del vocabulario del asistente.
  if (viene('categoria') || viene('subcategoria') || !parcial) {
    const categoria = viene('categoria') ? String(cuerpo.categoria) : (secciones[0]?.categoria ?? 'tecnologia');
    const seccion = secciones.find((s) => s.categoria === categoria);
    if (!seccion) throw errorSolicitud(`La categoria ${categoria.slice(0, 40)} no existe.`);
    if (viene('categoria')) salida.categoria = categoria;
    if (viene('subcategoria')) {
      const sub = String(cuerpo.subcategoria);
      if (!seccion.subcategorias.includes(sub)) {
        throw errorSolicitud(`La seccion ${sub.slice(0, 40)} no existe. Opciones: ${seccion.subcategorias.join(', ')}.`);
      }
      salida.subcategoria = sub;
    }
    if (!parcial) salida.categoria = categoria;
  }

  // Sin descuento no hay oferta que vencer.
  if (salida.descuento_porcentaje === 0) salida.oferta_hasta = null;
  return salida;
};
