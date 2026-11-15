import express, { Application, NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { ErrorApp, traducirErrorDeEntrada } from './errores';
import { crearLogger, Logger } from './logger';
import { detectarLlamadaInterna, verificarSecretos } from './autenticacion';
import { PeticionAutenticada } from './tipos';

/**
 * Arranque comun a todos los microservicios.
 *
 * Centraliza lo que de otro modo habria que repetir nueve veces: el
 * identificador de correlacion, el registro de peticiones, el endpoint /health
 * que consulta el balanceador, el manejo uniforme de errores y el cierre
 * ordenado del proceso.
 */

export interface DependenciaSalud {
  nombre: string;
  /** Debe resolver true si la dependencia responde. */
  verificar: () => Promise<boolean>;
  /** Si es false, su indisponibilidad no marca el servicio como caido. */
  critica?: boolean;
}

export interface OpcionesServicio {
  nombre: string;
  puerto: number;
  /** Monta las rutas propias del servicio. */
  rutas: (app: Application) => void;
  /** Dependencias sondeadas por /health. */
  dependencias?: DependenciaSalud[];
  /** Se ejecuta antes de escuchar: conexiones, migraciones, suscripciones. */
  alIniciar?: () => Promise<void>;
  /** Se ejecuta al recibir SIGTERM/SIGINT. */
  alDetener?: () => Promise<void>;
  /** Metricas extra que se agregan a /health (circuitos, colas). */
  metricas?: () => Record<string, unknown>;
}

const propagarRequestId = (req: PeticionAutenticada, res: Response, next: NextFunction): void => {
  const recibido = req.headers['x-request-id'];
  req.requestId = typeof recibido === 'string' && recibido ? recibido : randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
};

const registrarPeticiones = (log: Logger) => {
  return (req: PeticionAutenticada, res: Response, next: NextFunction): void => {
    const inicio = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - inicio) / 1_000_000;
      const nivel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      log.con({ request_id: req.requestId })[nivel]('peticion', {
        metodo: req.method,
        ruta: req.originalUrl,
        estado: res.statusCode,
        ms: Number(ms.toFixed(1)),
        interna: req.esLlamadaInterna || undefined
      });
    });
    next();
  };
};

export const crearServicio = async (opciones: OpcionesServicio): Promise<void> => {
  const log = crearLogger(opciones.nombre);

  // Sin secretos propios el servicio no arranca: es preferible un error claro
  // al iniciar que un despliegue que acepta tokens forjados.
  try {
    verificarSecretos();
  } catch (error) {
    log.error((error as Error).message);
    process.exit(1);
  }

  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(propagarRequestId);
  app.use(detectarLlamadaInterna);
  app.use(registrarPeticiones(log));

  // Health check: lo consulta el balanceador de carga y docker compose.
  app.get('/health', async (_req: Request, res: Response) => {
    const dependencias = opciones.dependencias ?? [];
    const resultados = await Promise.all(
      dependencias.map(async (d) => {
        try {
          return { nombre: d.nombre, ok: await d.verificar(), critica: d.critica !== false };
        } catch {
          return { nombre: d.nombre, ok: false, critica: d.critica !== false };
        }
      })
    );

    const sano = resultados.every((r) => r.ok || !r.critica);
    res.status(sano ? 200 : 503).json({
      servicio: opciones.nombre,
      estado: sano ? 'ok' : 'degradado',
      hora: new Date().toISOString(),
      uptime_s: Math.round(process.uptime()),
      dependencias: resultados,
      ...(opciones.metricas ? { metricas: opciones.metricas() } : {})
    });
  });

  opciones.rutas(app);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ mensaje: 'Recurso no encontrado.', codigo: 'NO_ENCONTRADO' });
  });

  // Manejo uniforme de errores: los ErrorApp se traducen a su codigo HTTP;
  // cualquier otro error se reporta como 500 sin filtrar detalles internos.
  app.use((error: unknown, req: PeticionAutenticada, res: Response, _next: NextFunction) => {
    const contexto = log.con({ request_id: req.requestId });

    if (error instanceof ErrorApp) {
      if (error.estado >= 500) {
        contexto.error(error.message, { codigo: error.codigo, detalle: error.detalle });
      }
      res.status(error.estado).json({
        mensaje: error.message,
        codigo: error.codigo,
        ...(error.detalle ? { detalle: error.detalle } : {})
      });
      return;
    }

    // Entrada mal formada que rechazo body-parser o PostgreSQL: es un error del
    // cliente (400), no del servidor. Se registra como advertencia con el
    // codigo original, para poder distinguir un abuso de un defecto real.
    const deEntrada = traducirErrorDeEntrada(error);
    if (deEntrada) {
      contexto.warn('Entrada rechazada', {
        codigo_origen: (error as { code?: string; type?: string }).code ?? (error as { type?: string }).type,
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(deEntrada.estado).json({ mensaje: deEntrada.message, codigo: deEntrada.codigo });
      return;
    }

    contexto.error('Error no controlado', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({ mensaje: 'Error interno del servidor.', codigo: 'ERROR_INTERNO' });
  });

  if (opciones.alIniciar) {
    try {
      await opciones.alIniciar();
    } catch (error) {
      log.error('Fallo la inicializacion', {
        error: error instanceof Error ? error.message : error
      });
    }
  }

  const servidor = app.listen(opciones.puerto, '0.0.0.0', () => {
    log.info(`Servicio escuchando en http://localhost:${opciones.puerto}`);
  });

  // El gateway reutiliza conexiones (keep-alive). Con los 5 s por defecto de
  // Node, el servicio podia cerrar un socket ocioso justo cuando el gateway lo
  // reutilizaba, y esa peticion fallaba con ECONNRESET. El servicio mantiene la
  // conexion mas tiempo y anuncia el valor en "Keep-Alive: timeout=65", que el
  // agente HTTP de Node respeta para soltar el socket antes.
  servidor.keepAliveTimeout = 65_000;
  servidor.headersTimeout = 66_000;

  const detener = async (senal: string) => {
    log.info(`Recibida ${senal}, cerrando de forma ordenada`);
    servidor.close();
    try {
      await opciones.alDetener?.();
    } catch (error) {
      log.error('Error al cerrar', { error: error instanceof Error ? error.message : error });
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => void detener('SIGTERM'));
  process.on('SIGINT', () => void detener('SIGINT'));
};
