import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { Response } from 'express';
import { GridFSBucket, ObjectId } from 'mongodb';
import { PeticionAutenticada, errorConflicto, errorNoEncontrado, errorSolicitud } from '@ecommerce/shared';
import { baseDatosConectada as baseDatos, coleccionProductos } from './db';
import { MAXIMO_IMAGENES, PREFIJO_IMAGENES } from './gestion';

/**
 * Imagenes de los productos (RF-50).
 *
 * Dos origenes detras de una sola ruta publica, GET /imagenes/:nombre:
 *  - las fotos de la semilla, archivos WebP en services/catalogo-service/imagenes;
 *  - las que sube el personal desde el panel, en GridFS dentro de catalogo_db.
 *
 * Asi cada servicio sigue siendo dueño de sus datos (no hay un volumen
 * compartido) y la web y la app movil cargan las fotos por el gateway, la
 * misma direccion que ya usan para la API.
 */

export const TAMANO_MAXIMO = 2 * 1024 * 1024;
export const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'] as const;
type TipoImagen = (typeof TIPOS_PERMITIDOS)[number];

const DIRECTORIO_SEMILLA = path.resolve(__dirname, '../imagenes');
const PATRON_SEMILLA = /^[a-z0-9-]{1,60}\.webp$/;
const PATRON_SUBIDA = /^[a-f0-9]{24}$/;

/**
 * El tipo se decide por el contenido (los "numeros magicos"), no por la
 * extension ni por el Content-Type que manda el navegador: un HTML o un SVG
 * con script renombrado a .png se rechaza aqui (V-24).
 */
export const tipoPorContenido = (datos: Buffer): TipoImagen | null => {
  if (datos.length < 12) return null;
  if (datos[0] === 0xff && datos[1] === 0xd8 && datos[2] === 0xff) return 'image/jpeg';
  if (datos.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (datos.subarray(0, 4).toString('latin1') === 'RIFF' && datos.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
};

const cubeta = () => new GridFSBucket(baseDatos(), { bucketName: 'imagenes' });

/** POST /productos/:sku/imagenes (cuerpo: el archivo, image/jpeg|png|webp). */
export const subirImagen = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const datos = req.body;
  if (!Buffer.isBuffer(datos) || !datos.length) {
    throw errorSolicitud('Envie la imagen en el cuerpo con Content-Type image/jpeg, image/png o image/webp.');
  }
  const tipo = tipoPorContenido(datos);
  if (!tipo) throw errorSolicitud('El archivo no es una imagen JPEG, PNG o WebP valida.');

  const sku = req.params.sku;
  const producto = await coleccionProductos().findOne({ sku }, { projection: { imagenes: 1 } });
  if (!producto) throw errorNoEncontrado(`Producto ${sku} no encontrado.`);
  // Las fotos de la semilla se reemplazan por la primera foto subida.
  const actuales = ((producto.imagenes ?? []) as string[]).filter((r) => !r.endsWith('.webp'));
  if (actuales.length >= MAXIMO_IMAGENES) throw errorConflicto(`El producto ya tiene ${MAXIMO_IMAGENES} imagenes. Quite una antes de subir otra.`);

  const id = new ObjectId();
  await new Promise<void>((resolver, rechazar) => {
    const escritura = cubeta().openUploadStreamWithId(id, `${sku}-${id.toHexString()}`, {
      metadata: { sku, tipo, subido_por: req.usuario?.email ?? null, tamano: datos.length }
    });
    escritura.once('finish', () => resolver());
    escritura.once('error', rechazar);
    escritura.end(datos);
  });

  const ruta = `${PREFIJO_IMAGENES}${id.toHexString()}`;
  const actualizado = await coleccionProductos().findOneAndUpdate(
    { sku },
    { $set: { imagenes: [...actuales, ruta], actualizado_en: new Date() } },
    { returnDocument: 'after', projection: { _id: 0, sku: 1, imagenes: 1 } }
  );
  res.status(201).json({ mensaje: 'Imagen subida.', imagen: ruta, producto: actualizado });
};

/** DELETE /productos/:sku/imagenes/:id - quita una foto subida. */
export const eliminarImagen = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const { sku, id } = req.params;
  if (!PATRON_SUBIDA.test(id)) throw errorSolicitud('Identificador de imagen invalido.');
  const ruta = `${PREFIJO_IMAGENES}${id}`;
  const actualizado = await coleccionProductos().findOneAndUpdate(
    { sku, imagenes: ruta },
    { $pull: { imagenes: ruta } as never, $set: { actualizado_en: new Date() } },
    { returnDocument: 'after', projection: { _id: 0, sku: 1, imagenes: 1, subcategoria: 1 } }
  );
  if (!actualizado) throw errorNoEncontrado('La imagen no pertenece a ese producto.');
  await cubeta().delete(new ObjectId(id)).catch(() => undefined);

  // Sin fotos propias vuelve a la foto de su seccion.
  if (!((actualizado.imagenes ?? []) as string[]).length && actualizado.subcategoria) {
    const respaldo = `${PREFIJO_IMAGENES}${actualizado.subcategoria}.webp`;
    await coleccionProductos().updateOne({ sku }, { $set: { imagenes: [respaldo] } });
    actualizado.imagenes = [respaldo];
  }
  res.status(200).json({ mensaje: 'Imagen eliminada.', producto: actualizado });
};

const cabecerasDeImagen = (res: Response, tipo: string, inmutable: boolean): void => {
  res.setHeader('Content-Type', tipo);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Aunque alguien lograra subir otra cosa, el navegador no ejecuta nada.
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', inmutable ? 'public, max-age=31536000, immutable' : 'public, max-age=86400');
};

/** GET /imagenes/:nombre - publica. */
export const servirImagen = async (req: PeticionAutenticada, res: Response): Promise<void> => {
  const nombre = req.params.nombre;

  if (PATRON_SEMILLA.test(nombre)) {
    const archivo = path.join(DIRECTORIO_SEMILLA, nombre);
    if (!existsSync(archivo)) throw errorNoEncontrado('Imagen no encontrada.');
    cabecerasDeImagen(res, 'image/webp', false);
    createReadStream(archivo).pipe(res);
    return;
  }

  if (!PATRON_SUBIDA.test(nombre)) throw errorNoEncontrado('Imagen no encontrada.');
  const [archivo] = await cubeta().find({ _id: new ObjectId(nombre) }).limit(1).toArray();
  if (!archivo) throw errorNoEncontrado('Imagen no encontrada.');
  const tipo = String(archivo.metadata?.tipo ?? '');
  if (!(TIPOS_PERMITIDOS as readonly string[]).includes(tipo)) throw errorNoEncontrado('Imagen no encontrada.');

  // Cada subida tiene un id nuevo: la misma ruta nunca cambia de contenido.
  cabecerasDeImagen(res, tipo, true);
  res.setHeader('Content-Length', String(archivo.length));
  await new Promise<void>((resolver, rechazar) => {
    cubeta().openDownloadStream(archivo._id).once('error', rechazar).once('end', () => resolver()).pipe(res);
  });
};
