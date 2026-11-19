/**
 * Pool de hilos para bcrypt, con cola acotada y cancelacion.
 *
 * Corrige dos hallazgos de las pruebas de carga (docs/calidad/RENDIMIENTO.md):
 *
 *  R1. bcryptjs calculaba los hashes en el hilo principal: un solo nucleo y
 *      ~10 inicios de sesion por segundo, aunque el contenedor tuviera ocho.
 *      Ahora cada hash corre en uno de N hilos de trabajo.
 *
 *  R2. Sin limite de cola, bajo saturacion el servicio seguia calculando
 *      hashes para clientes que ya habian abandonado (el gateway corta a los
 *      15 s) y tardaba 30-40 s en recuperarse. Ahora:
 *        - si la cola esta llena se responde 503 de inmediato (descarte de
 *          carga): es mejor un "intente de nuevo" rapido que un timeout;
 *        - si el cliente cerro la conexion mientras esperaba, su tarea se
 *          descarta sin calcular nada.
 *
 * Configuracion: AUTH_HILOS_HASH (por defecto, los nucleos disponibles con un
 * maximo de 4) y AUTH_COLA_HASH (tareas en espera admitidas; por defecto 25 por
 * hilo, unos 2,5 s de espera con hashes de ~100 ms).
 */
import { availableParallelism } from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { ErrorApp, crearLogger } from '@ecommerce/shared';
import type { MensajeHash, RespuestaHash } from './trabajador-hash';

const log = crearLogger('auth-service');

const HILOS = Math.max(1, Number(process.env.AUTH_HILOS_HASH) || Math.min(4, availableParallelism()));
const COLA_MAXIMA = Math.max(1, Number(process.env.AUTH_COLA_HASH) || HILOS * 25);

// Omit distribuido sobre la union: conserva los campos propios de cada operacion.
type Operacion = MensajeHash extends infer M ? (M extends MensajeHash ? Omit<M, 'id'> : never) : never;

interface Tarea {
  id: number;
  operacion: Operacion;
  senal?: AbortSignal;
  resolver: (valor: string | boolean) => void;
  rechazar: (error: Error) => void;
}

interface Hilo {
  worker: Worker;
  tarea: Tarea | null;
}

const hilos: Hilo[] = [];
const cola: Tarea[] = [];
let siguienteId = 1;
const contadores = { completadas: 0, rechazadas_por_cola_llena: 0, canceladas: 0, hilos_reiniciados: 0 };

const RUTA_TRABAJADOR = path.join(__dirname, 'trabajador-hash.ts');

const crearHilo = (): Hilo => {
  // Los hilos heredan los argumentos de Node del proceso principal, incluido
  // el cargador de tsx, asi que pueden ejecutar el archivo .ts directamente.
  const hilo: Hilo = { worker: new Worker(RUTA_TRABAJADOR), tarea: null };

  hilo.worker.on('message', (respuesta: RespuestaHash) => {
    const tarea = hilo.tarea;
    hilo.tarea = null;
    hilo.worker.unref();
    if (tarea && tarea.id === respuesta.id) {
      contadores.completadas++;
      if (respuesta.ok) tarea.resolver(respuesta.resultado);
      else tarea.rechazar(new Error(respuesta.error));
    }
    despachar();
  });

  // Si un hilo muere, su tarea en curso falla y se crea otro en su lugar.
  hilo.worker.on('error', (error) => {
    log.error('Fallo un hilo de hash', { error: error.message });
  });
  hilo.worker.on('exit', () => {
    hilo.tarea?.rechazar(new Error('El hilo de hash termino inesperadamente.'));
    const indice = hilos.indexOf(hilo);
    if (indice >= 0) {
      contadores.hilos_reiniciados++;
      hilos[indice] = crearHilo();
      despachar();
    }
  });

  // Un hilo ocioso no debe impedir que el proceso termine; uno ocupado si
  // (despachar() le devuelve la referencia mientras tiene una tarea).
  hilo.worker.unref();
  return hilo;
};

const despachar = (): void => {
  for (const hilo of hilos) {
    if (hilo.tarea) continue;
    let tarea = cola.shift();
    // El cliente ya se fue: no se gasta CPU en una respuesta que nadie leera.
    while (tarea?.senal?.aborted) {
      contadores.canceladas++;
      tarea.rechazar(new ErrorApp(503, 'La peticion fue cancelada por el cliente.', 'PETICION_CANCELADA'));
      tarea = cola.shift();
    }
    if (!tarea) return;
    hilo.tarea = tarea;
    hilo.worker.ref();
    hilo.worker.postMessage({ id: tarea.id, ...tarea.operacion } as MensajeHash);
  }
};

const encolar = (operacion: Operacion, senal?: AbortSignal): Promise<string | boolean> => {
  if (hilos.length === 0) {
    for (let i = 0; i < HILOS; i++) hilos.push(crearHilo());
    log.info('Pool de hash iniciado', { hilos: HILOS, cola_maxima: COLA_MAXIMA });
  }

  if (cola.length >= COLA_MAXIMA) {
    contadores.rechazadas_por_cola_llena++;
    return Promise.reject(
      new ErrorApp(
        503,
        'El servicio de autenticacion esta saturado. Intente de nuevo en unos segundos.',
        'SERVICIO_SATURADO'
      )
    );
  }

  return new Promise((resolver, rechazar) => {
    cola.push({ id: siguienteId++, operacion, senal, resolver, rechazar });
    despachar();
  });
};

export const compararHash = async (texto: string, hash: string, senal?: AbortSignal): Promise<boolean> =>
  (await encolar({ operacion: 'comparar', texto, hash }, senal)) as boolean;

export const generarHash = async (texto: string, rondas: number, senal?: AbortSignal): Promise<string> =>
  (await encolar({ operacion: 'hashear', texto, rondas }, senal)) as string;

/** Estado del pool para /health. */
export const metricasHash = () => ({
  pool_hash: {
    hilos: HILOS,
    ocupados: hilos.filter((h) => h.tarea).length,
    en_cola: cola.length,
    cola_maxima: COLA_MAXIMA,
    ...contadores
  }
});
