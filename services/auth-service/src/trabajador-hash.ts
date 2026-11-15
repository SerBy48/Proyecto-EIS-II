/**
 * Hilo de trabajo para bcrypt (ver pool-hash.ts).
 *
 * bcryptjs es JavaScript puro: cada comparacion ocupa la CPU durante ~100 ms.
 * Ejecutada en el hilo principal, bloquea el event loop y limita el servicio
 * a ~10 inicios de sesion por segundo (docs/calidad/RENDIMIENTO.md, 5.1).
 * Aqui corre en un hilo aparte, y el pool reparte el trabajo entre varios.
 */
import { parentPort } from 'node:worker_threads';
import bcrypt from 'bcryptjs';

export type MensajeHash =
  | { id: number; operacion: 'comparar'; texto: string; hash: string }
  | { id: number; operacion: 'hashear'; texto: string; rondas: number };

export type RespuestaHash =
  | { id: number; ok: true; resultado: string | boolean }
  | { id: number; ok: false; error: string };

parentPort?.on('message', (mensaje: MensajeHash) => {
  let respuesta: RespuestaHash;
  try {
    const resultado =
      mensaje.operacion === 'comparar'
        ? bcrypt.compareSync(mensaje.texto, mensaje.hash)
        : bcrypt.hashSync(mensaje.texto, mensaje.rondas);
    respuesta = { id: mensaje.id, ok: true, resultado };
  } catch (error) {
    respuesta = { id: mensaje.id, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  parentPort?.postMessage(respuesta);
});
