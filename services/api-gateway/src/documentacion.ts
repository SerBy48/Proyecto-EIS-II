import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Application, NextFunction, Request, Response, Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { crearLogger } from '@ecommerce/shared';

/**
 * Documentacion interactiva de la API publica (docs/adr/0008).
 *
 *   GET /api/docs               Swagger UI
 *   GET /api/docs/openapi.json  la especificacion
 *
 * La especificacion se escribe en docs/openapi/ (dividida por servicio) y
 * `npm run docs:openapi` la valida y la empaqueta en especificacion/openapi.json,
 * dentro del gateway: la imagen Docker no copia docs/.
 *
 * Con EXPONER_DOCS=false (perfil de produccion) no se monta nada y la ruta sale
 * de la lista blanca: responde como cualquier ruta inexistente (401 sin token,
 * 404 con token), sin revelar que la documentacion existe.
 */

const log = crearLogger('api-gateway');

export const RUTA_ESPECIFICACION = path.join(__dirname, '..', 'especificacion', 'openapi.json');

/** Ruta publica (sin token) mientras la documentacion este expuesta. */
export const PATRON_DOCS = /^\/api\/docs(\/.*)?$/;

export const docsExpuestas = (): boolean => process.env.EXPONER_DOCS !== 'false';

/**
 * El gateway desactiva la CSP porque solo responde JSON. Swagger UI es HTML con
 * scripts, asi que lleva su propia politica, limitada a esta ruta: todo desde el
 * mismo origen; estilos en linea porque la plantilla de swagger-ui-express los usa.
 */
const politicaDeContenido = (_req: Request, res: Response, next: NextFunction): void => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  );
  next();
};

export const montarDocumentacion = (app: Application): void => {
  if (!docsExpuestas()) {
    log.info('Documentacion de la API desactivada (EXPONER_DOCS=false)');
    return;
  }

  let especificacion: Record<string, unknown>;
  try {
    especificacion = JSON.parse(readFileSync(RUTA_ESPECIFICACION, 'utf8'));
  } catch (error) {
    // Sin la especificacion el gateway sigue funcionando: la documentacion no
    // es parte del camino critico.
    log.warn('No se pudo cargar la especificacion OpenAPI; /api/docs no estara disponible', {
      ruta: RUTA_ESPECIFICACION,
      error: (error as Error).message
    });
    return;
  }

  const router = Router();
  router.use(politicaDeContenido);
  router.get('/openapi.json', (_req, res) => {
    res.status(200).json(especificacion);
  });
  router.use(
    '/',
    swaggerUi.serve,
    swaggerUi.setup(especificacion, {
      customSiteTitle: 'API - Plataforma de comercio electronico',
      swaggerOptions: { persistAuthorization: false, displayRequestDuration: true }
    })
  );

  app.use('/api/docs', router);
  log.info('Documentacion de la API en /api/docs');
};
