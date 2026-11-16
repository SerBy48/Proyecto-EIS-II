import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Agent, IncomingMessage } from 'node:http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { crearLogger, ErrorApp, leerSecreto, PeticionAutenticada, verificarAcceso, verificarSecretos } from '@ecommerce/shared';
import { docsExpuestas, montarDocumentacion, PATRON_DOCS } from './documentacion';

/**
 * API GATEWAY - punto unico de entrada del sistema (seccion 5.2 del documento).
 *
 * Ningun cliente se comunica directamente con los servicios internos. El
 * gateway concentra las funciones transversales de acceso, que de otro modo
 * habria que duplicar en los ocho microservicios:
 *
 *   - Enrutamiento hacia el servicio correspondiente.
 *   - Validacion del token JWT y autorizacion por rol.
 *   - Politicas de seguridad: cabeceras, limitacion de peticiones, CORS.
 *   - Registro de peticiones y correlacion mediante request_id.
 *   - Version de la API y balanceo de carga.
 *
 * Los servicios internos no se exponen al exterior: en docker-compose no
 * publican puertos hacia el host mas que para el desarrollo local.
 */

const log = crearLogger('api-gateway');

// Sin secretos propios el gateway no arranca (hallazgos S-02 y S-03 de
// docs/calidad/SEGURIDAD.md): no hay valores por defecto.
try {
  verificarSecretos();
} catch (error) {
  log.error((error as Error).message);
  process.exit(1);
}
const app = express();
const PUERTO = Number(process.env.PORT || 8080);

// --------------------------------------------------------------------------
// Tabla de enrutamiento
// --------------------------------------------------------------------------
interface Destino {
  prefijo: string;
  url: string;
  /** true si alguna ruta del servicio es accesible sin token. */
  tienePublicas?: boolean;
}

const DESTINOS: Destino[] = [
  { prefijo: '/api/auth',           url: process.env.URL_AUTH           || 'http://localhost:3001', tienePublicas: true },
  { prefijo: '/api/clientes',       url: process.env.URL_CLIENTES       || 'http://localhost:3002', tienePublicas: true },
  { prefijo: '/api/catalogo',       url: process.env.URL_CATALOGO       || 'http://localhost:3003', tienePublicas: true },
  { prefijo: '/api/inventario',     url: process.env.URL_INVENTARIO     || 'http://localhost:3004' },
  { prefijo: '/api/carrito',        url: process.env.URL_CARRITO        || 'http://localhost:3005' },
  { prefijo: '/api/pedidos',        url: process.env.URL_PEDIDOS        || 'http://localhost:3006' },
  { prefijo: '/api/pagos',          url: process.env.URL_PAGOS          || 'http://localhost:3007' },
  { prefijo: '/api/notificaciones', url: process.env.URL_NOTIFICACIONES || 'http://localhost:3008' }
];

/**
 * Rutas accesibles sin autenticacion.
 *
 * Todo lo que no aparezca aqui exige un token valido. Es una lista blanca a
 * proposito: si alguien agrega un endpoint nuevo y olvida protegerlo, el
 * gateway lo rechaza por defecto en lugar de dejarlo abierto.
 */
const RUTAS_PUBLICAS: Array<{ metodo: string; patron: RegExp }> = [
  { metodo: 'POST', patron: /^\/api\/auth\/(login|registro|renovar)$/ },
  { metodo: 'POST', patron: /^\/api\/clientes\/?$/ },
  { metodo: 'GET',  patron: /^\/api\/catalogo\/productos(\/[^/]+)?$/ },
  { metodo: 'GET',  patron: /^\/api\/catalogo\/categorias$/ },
  // Swagger UI y la especificacion, solo si estan expuestas (EXPONER_DOCS).
  ...(docsExpuestas() ? [{ metodo: 'GET', patron: PATRON_DOCS }] : [])
];

const esPublica = (metodo: string, ruta: string): boolean =>
  RUTAS_PUBLICAS.some((r) => r.metodo === metodo && r.patron.test(ruta));

// --------------------------------------------------------------------------
// Seguridad de transporte y cabeceras
// --------------------------------------------------------------------------
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: false, // la sirve el frontend, no la API
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

const origenesPermitidos = (process.env.CORS_ORIGENES || 'http://localhost:5173,http://localhost:4173')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origen, callback) => {
      // Sin origen: llamadas de curl, Postman o la app movil.
      if (!origen || origenesPermitidos.includes('*') || origenesPermitidos.includes(origen)) {
        return callback(null, true);
      }
      // 403 explicito: antes era un Error generico que el manejador final
      // respondia como 500 (hallazgo S-07 de docs/calidad/SEGURIDAD.md).
      callback(new ErrorApp(403, 'Origen no permitido por la politica de CORS.', 'ORIGEN_NO_PERMITIDO'));
    },
    credentials: true,
    exposedHeaders: ['x-request-id']
  })
);

// --------------------------------------------------------------------------
// Saneamiento de cabeceras de confianza
//
// Los servicios internos confian en x-usuario-id, x-usuario-rol y
// x-llamada-interna porque asumen que las escribio el gateway o otro servicio.
// Por eso lo PRIMERO que hace el gateway es borrarlas si vienen del cliente:
// de lo contrario cualquiera podria enviar "x-usuario-rol: administrador" y
// hacerse pasar por personal interno. Se eliminan siempre, y el gateway
// escribe despues las suyas a partir del token que el mismo valido.
// --------------------------------------------------------------------------
const CABECERAS_DE_CONFIANZA = [
  'x-internal-token',
  'x-llamada-interna',
  'x-usuario-id',
  'x-usuario-rol',
  'x-usuario-email',
  'x-cliente-id'
];

app.use((req: Request, _res: Response, next: NextFunction) => {
  for (const cabecera of CABECERAS_DE_CONFIANZA) delete req.headers[cabecera];
  next();
});

// --------------------------------------------------------------------------
// Identificador de correlacion
// --------------------------------------------------------------------------
app.use((req: PeticionAutenticada, res: Response, next: NextFunction) => {
  const recibido = req.headers['x-request-id'];
  req.requestId = typeof recibido === 'string' && recibido ? recibido : randomUUID();
  req.headers['x-request-id'] = req.requestId;
  res.setHeader('x-request-id', req.requestId);
  next();
});

// --------------------------------------------------------------------------
// Limitacion de peticiones (rate limiting)
//
// Tres niveles, porque no todas las rutas tienen el mismo riesgo:
//   - login: muy restrictivo, es el objetivo de los ataques de fuerza bruta
//   - checkout: restrictivo, protege el inventario de acaparamiento
//   - general: holgado, el catalogo recibe la mayor parte del trafico
// --------------------------------------------------------------------------
const identificar = (req: Request): string => {
  // Se limita por usuario cuando hay token, y por IP cuando no: de otro modo
  // todos los clientes detras de una misma NAT compartirian el cupo.
  const autorizacion = req.headers.authorization;
  if (autorizacion?.startsWith('Bearer ')) {
    try {
      return `u:${verificarAcceso(autorizacion.slice(7)).sub}`;
    } catch {
      /* token invalido: se limita por IP */
    }
  }
  return `ip:${req.ip}`;
};

const limiteGeneral = rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.LIMITE_GENERAL || 300),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: identificar,
  message: { mensaje: 'Demasiadas peticiones. Intente de nuevo en un momento.', codigo: 'LIMITE_EXCEDIDO' }
});

const limiteLogin = rateLimit({
  windowMs: 15 * 60_000,
  limit: Number(process.env.LIMITE_LOGIN || 10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `login:${req.ip}`,
  skipSuccessfulRequests: true, // solo cuentan los intentos fallidos
  message: { mensaje: 'Demasiados intentos de inicio de sesion. Espere 15 minutos.', codigo: 'LIMITE_LOGIN' }
});

const limiteCheckout = rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.LIMITE_CHECKOUT || 10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: identificar,
  message: { mensaje: 'Demasiados intentos de compra. Espere un momento.', codigo: 'LIMITE_CHECKOUT' }
});

app.use('/api/auth/login', limiteLogin);
app.use('/api/pedidos/checkout', limiteCheckout);
app.use('/api', limiteGeneral);

// --------------------------------------------------------------------------
// Registro de peticiones
// --------------------------------------------------------------------------
app.use((req: PeticionAutenticada, res: Response, next: NextFunction) => {
  const inicio = Date.now();
  res.on('finish', () => {
    const nivel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    log.con({ request_id: req.requestId })[nivel]('peticion', {
      metodo: req.method,
      ruta: req.originalUrl,
      estado: res.statusCode,
      ms: Date.now() - inicio,
      usuario: req.usuario?.sub,
      rol: req.usuario?.rol
    });
  });
  next();
});

// --------------------------------------------------------------------------
// Documentacion de la API (Swagger UI). Antes de la validacion del token: es
// publica, y despues del rate limit general y del registro de peticiones.
// --------------------------------------------------------------------------
montarDocumentacion(app);

// --------------------------------------------------------------------------
// Validacion centralizada del token
//
// El gateway valida la firma una sola vez y reenvia la identidad ya resuelta a
// los servicios internos en cabeceras, junto con el secreto compartido. Los
// servicios siguen validando el token por su cuenta: defensa en profundidad,
// para que el sistema no quede abierto si alguien alcanzara la red interna.
// --------------------------------------------------------------------------
app.use('/api', (req: PeticionAutenticada, res: Response, next: NextFunction) => {
  const ruta = req.baseUrl + req.path;

  if (esPublica(req.method, ruta) || ruta === '/api/health') return next();

  const autorizacion = req.headers.authorization;
  if (!autorizacion?.startsWith('Bearer ')) {
    res.status(401).json({ mensaje: 'Acceso denegado. Token no provisto.', codigo: 'NO_AUTENTICADO' });
    return;
  }

  try {
    req.usuario = verificarAcceso(autorizacion.slice(7));
  } catch (error) {
    const expirado = error instanceof Error && error.name === 'TokenExpiredError';
    res.status(401).json({
      mensaje: expirado ? 'Token expirado. Renueve la sesion.' : 'Token invalido.',
      codigo: expirado ? 'TOKEN_EXPIRADO' : 'TOKEN_INVALIDO'
    });
    return;
  }

  next();
});

// --------------------------------------------------------------------------
// Proxy hacia los microservicios
// --------------------------------------------------------------------------
const PROXY_TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS || 15000);

/**
 * Conexiones persistentes hacia los servicios.
 *
 * Sin un agent, http-proxy envia "Connection: close" a cada servicio y
 * reenvia esa cabecera al cliente: cada peticion abria dos conexiones TCP
 * nuevas, y con 300 usuarios el equipo generador agotaba sus puertos
 * (docs/calidad/RENDIMIENTO.md, hallazgo R3). Con keep-alive se reutilizan.
 * 'lifo' reutiliza primero la conexion usada mas recientemente, que es la que
 * menos riesgo tiene de que el servicio la haya cerrado por inactividad.
 */
const agenteServicios = new Agent({ keepAlive: true, scheduling: 'lifo' });

/** Peticiones cuyo proxyTimeout vencio: se responden con 504 y no con 503. */
const tiempoAgotado = new WeakSet<IncomingMessage>();

const opcionesComunes = (destino: Destino): Options => ({
  target: destino.url,
  agent: agenteServicios,
  changeOrigin: true,
  // El prefijo /api/<servicio> se elimina: cada servicio publica sus rutas en
  // la raiz y no necesita saber bajo que prefijo lo expone el gateway.
  pathRewrite: { [`^${destino.prefijo}`]: '' },
  // Solo proxyTimeout (espera por el servicio). La opcion "timeout" de
  // http-proxy se aplica al socket del CLIENTE y, al vencer, lo destruye sin
  // responder: el cliente recibia un EOF en vez del 504 de abajo (hallazgo R4).
  proxyTimeout: PROXY_TIMEOUT_MS,
  on: {
    proxyReq: (proxyReq, req) => {
      const peticion = req as PeticionAutenticada;

      proxyReq.once('timeout', () => tiempoAgotado.add(req));

      proxyReq.setHeader('x-request-id', peticion.requestId ?? '');

      // El secreto compartido acredita que la peticion entro por el gateway y
      // no por un atajo a la red privada. Deliberadamente NO se envia
      // x-llamada-interna: esto es trafico de un usuario final, y el control de
      // rol de cada servicio debe seguir aplicandose.
      proxyReq.setHeader('x-internal-token', leerSecreto('INTERNAL_TOKEN'));

      if (peticion.usuario) {
        proxyReq.setHeader('x-usuario-id', String(peticion.usuario.sub));
        proxyReq.setHeader('x-usuario-rol', peticion.usuario.rol);
        proxyReq.setHeader('x-usuario-email', peticion.usuario.email);
        if (peticion.usuario.cliente_id !== undefined) {
          proxyReq.setHeader('x-cliente-id', String(peticion.usuario.cliente_id));
        }
      }
    },
    proxyRes: (proxyRes) => {
      // Keep-Alive es una cabecera de salto (hop-by-hop): describe la conexion
      // gateway-servicio (65 s), no la del cliente con el gateway. Si se
      // reenviara, el cliente reutilizaria sockets que el gateway ya cerro.
      delete proxyRes.headers['keep-alive'];
    },
    error: (error, req, res) => {
      const peticion = req as PeticionAutenticada;
      log.con({ request_id: peticion.requestId }).error('Error al enrutar la peticion', {
        destino: destino.prefijo,
        error: error.message
      });

      if ('writeHead' in res && !res.headersSent) {
        const servicio = destino.prefijo.replace('/api/', '');
        const vencido = tiempoAgotado.has(req);
        res.writeHead(vencido ? 504 : 503, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify(
            vencido
              ? { mensaje: `El servicio ${servicio} no respondio a tiempo. Intente de nuevo.`, codigo: 'TIEMPO_AGOTADO' }
              : { mensaje: `El servicio ${servicio} no esta disponible en este momento.`, codigo: 'SERVICIO_NO_DISPONIBLE' }
          )
        );
      }
    }
  }
});

for (const destino of DESTINOS) {
  app.use(destino.prefijo, createProxyMiddleware(opcionesComunes(destino)));
}

// --------------------------------------------------------------------------
// Salud agregada del sistema
//
// Consulta el /health de cada microservicio en paralelo. Es la vista que usa el
// operador para saber de un vistazo que esta caido, y la que responde la
// pregunta 4 del analisis: si catalogo falla, aqui se ve exactamente eso,
// mientras el resto sigue en verde.
// --------------------------------------------------------------------------
app.get('/api/health', async (_req: Request, res: Response) => {
  const resultados = await Promise.all(
    DESTINOS.map(async (destino) => {
      const controlador = new AbortController();
      const temporizador = setTimeout(() => controlador.abort(), 2000);
      const nombre = destino.prefijo.replace('/api/', '');
      try {
        const respuesta = await fetch(`${destino.url}/health`, { signal: controlador.signal });
        const cuerpo = (await respuesta.json()) as Record<string, unknown>;
        return { servicio: nombre, ok: respuesta.ok, estado: cuerpo.estado, dependencias: cuerpo.dependencias };
      } catch {
        return { servicio: nombre, ok: false, estado: 'inalcanzable' };
      } finally {
        clearTimeout(temporizador);
      }
    })
  );

  const caidos = resultados.filter((r) => !r.ok).map((r) => r.servicio);

  res.status(caidos.length ? 503 : 200).json({
    gateway: 'ok',
    hora: new Date().toISOString(),
    servicios_caidos: caidos,
    servicios: resultados
  });
});

// Liveness del propio gateway: lo consulta el HEALTHCHECK de la imagen
// (infra/Dockerfile.servicio pide /health en todos los servicios). No consulta
// a los demas servicios a proposito: si uno cae, el orquestador no debe
// reiniciar el gateway, que sigue sano y responde 503 solo para esa ruta.
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ servicio: 'api-gateway', estado: 'ok' });
});

app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    nombre: 'API Gateway - Plataforma de comercio electronico',
    version: process.env.VERSION_API || 'v1',
    rutas: DESTINOS.map((d) => d.prefijo),
    salud: '/api/health'
  });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ mensaje: 'Ruta no encontrada en el gateway.', codigo: 'NO_ENCONTRADO' });
});

app.use((error: unknown, req: PeticionAutenticada, res: Response, _next: NextFunction) => {
  // Errores esperados del propio gateway (p. ej. un origen rechazado por CORS):
  // se responden con su codigo, no como un fallo del servidor.
  if (error instanceof ErrorApp && error.estado < 500) {
    log.con({ request_id: req.requestId }).warn(error.message, { codigo: error.codigo, origen: req.headers.origin });
    if (!res.headersSent) res.status(error.estado).json({ mensaje: error.message, codigo: error.codigo });
    return;
  }
  log.con({ request_id: req.requestId }).error('Error en el gateway', {
    error: error instanceof Error ? error.message : String(error)
  });
  if (!res.headersSent) {
    res.status(500).json({ mensaje: 'Error interno del gateway.', codigo: 'ERROR_INTERNO' });
  }
});

const servidor = app.listen(PUERTO, '0.0.0.0', () => {
  log.info(`API Gateway escuchando en http://localhost:${PUERTO}`);
  for (const d of DESTINOS) log.info(`  ${d.prefijo.padEnd(22)} -> ${d.url}`);
});

const detener = (senal: string) => {
  log.info(`Recibida ${senal}, cerrando el gateway`);
  servidor.close(() => process.exit(0));
};

process.on('SIGTERM', () => detener('SIGTERM'));
process.on('SIGINT', () => detener('SIGINT'));
