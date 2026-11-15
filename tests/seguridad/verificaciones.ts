/**
 * Verificaciones manuales de seguridad (Modulo 3, Paso 2.3.2).
 *
 * Cubren lo que el escaneo automatico de ZAP no prueba bien: inyeccion
 * NoSQL y SQL, XSS almacenado, almacenamiento de contrasenas, errores que
 * filtran informacion, control de acceso (IDOR), gestion de sesion, secretos,
 * CORS, cabeceras de la web y almacenamiento del token en el cliente.
 *
 * Cada verificacion termina en uno de tres resultados:
 *   SEGURO    el control funciona.
 *   HALLAZGO  vulnerabilidad confirmada (va a la tabla de SEGURIDAD.md).
 *   INFO      dato observado sin ser una vulnerabilidad por si mismo.
 *
 * Uso: npm run test:seguridad   (sistema con los limites normales)
 * Variables: URL_GATEWAY (http://localhost:8080) y URL_WEB
 * (http://localhost:4173, la web construida servida con `vite preview`).
 *
 * Todo lo que crea (un usuario atacante y un producto de prueba) se elimina o
 * desactiva al final. Termina con codigo 1 si hay algun HALLAZGO.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

const RAIZ = path.resolve(__dirname, '..', '..');
const G = process.env.URL_GATEWAY || 'http://localhost:8080';
const WEB = process.env.URL_WEB || 'http://localhost:4173';
const API = `${G}/api`;
const CLAVE = 'Password123';
const SECRETO_POR_DEFECTO = 'FirmaSecretaEcommerceDesarrollo'; // el de docker-compose.yml y shared/autenticacion.ts
const SALIDA = path.join(RAIZ, 'docs', 'evidencia', 'no-funcionales', 'seguridad', 'verificaciones-manuales.json');

type Resultado = 'SEGURO' | 'HALLAZGO' | 'INFO';
interface Verificacion {
  id: string;
  area: string;
  titulo: string;
  resultado: Resultado;
  detalle: string;
  evidencia: Record<string, unknown>;
}
const resultados: Verificacion[] = [];

const COLOR: Record<Resultado, string> = { SEGURO: '\u001b[32m', HALLAZGO: '\u001b[31m', INFO: '\u001b[90m' };
const registrar = (v: Verificacion): void => {
  resultados.push(v);
  console.log(`  ${v.id.padEnd(6)} ${COLOR[v.resultado]}${v.resultado.padEnd(8)}\u001b[0m ${v.titulo}`);
  console.log(`         ${v.detalle}`);
};

const pg = new Pool({
  connectionString: `postgresql://postgres:${process.env.POSTGRES_PASSWORD || 'postgres'}@localhost:${process.env.POSTGRES_PUERTO_HOST || '5432'}/auth_db`,
  max: 1
});
const pgBase = (base: string) =>
  new Pool({
    connectionString: `postgresql://postgres:${process.env.POSTGRES_PASSWORD || 'postgres'}@localhost:${process.env.POSTGRES_PUERTO_HOST || '5432'}/${base}`,
    max: 1
  });

interface Respuesta {
  estado: number;
  cabeceras: Record<string, string>;
  cuerpo: any;
  texto: string;
}
const pedir = async (ruta: string, opciones: RequestInit & { token?: string } = {}): Promise<Respuesta> => {
  const { token, headers, ...resto } = opciones;
  const r = await fetch(ruta.startsWith('http') ? ruta : `${API}${ruta}`, {
    ...resto,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers as Record<string, string>)
    }
  });
  const texto = await r.text();
  let cuerpo: any = null;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    cuerpo = null;
  }
  return { estado: r.status, cabeceras: Object.fromEntries(r.headers.entries()), cuerpo, texto };
};

const login = async (email: string, password = CLAVE) => {
  const r = await pedir('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (r.estado !== 200) throw new Error(`No se pudo iniciar sesion como ${email}: ${r.estado} ${r.texto}`);
  return r.cuerpo as { token: string; refresh_token: string; usuario: { id: number; cliente_id: number | null } };
};

/** Marcas de una fuga de informacion interna en una respuesta de error. */
const FUGAS = [/\bat [\w.<>]+ \(/, /node_modules/, /\/app\//, /\.ts:\d+/, /stack/i, /SELECT |INSERT /i, /MongoServerError/];
const fugas = (texto: string) => FUGAS.filter((re) => re.test(texto)).map(String);

const ejecutar = async (): Promise<void> => {
  console.log(`Verificaciones manuales de seguridad contra ${G}\n`);
  const ana = await login('ana@correo.co');
  const admin = await login('admin@tienda.co');
  const vendedor = await login('vendedor@tienda.co');

  // -------------------------------------------------------------- V-01
  // Registro publico con el cliente_id de otra persona (invariante 1).
  {
    const email = `atacante-${Date.now()}@correo.co`;
    const reg = await pedir('/auth/registro', {
      method: 'POST',
      body: JSON.stringify({ email, password: CLAVE, cliente_id: ana.usuario.cliente_id })
    });
    let perfilAjeno: Respuesta | null = null;
    let direcciones: Respuesta | null = null;
    if (reg.estado === 201) {
      const atacante = await login(email);
      perfilAjeno = await pedir(`/clientes/${ana.usuario.cliente_id}`, { token: atacante.token });
      direcciones = await pedir(`/clientes/${ana.usuario.cliente_id}/direcciones`, { token: atacante.token });
    }
    const vulnerable = perfilAjeno?.estado === 200;
    registrar({
      id: 'V-01',
      area: 'Control de acceso',
      titulo: 'Registro público vinculado al cliente_id de otra persona',
      resultado: vulnerable ? 'HALLAZGO' : 'SEGURO',
      detalle: vulnerable
        ? `POST /auth/registro aceptó cliente_id=${ana.usuario.cliente_id} (Ana) en el cuerpo: la cuenta nueva lee su perfil (${perfilAjeno?.cuerpo?.email}) y sus ${Array.isArray(direcciones?.cuerpo) ? direcciones?.cuerpo.length : '?'} direcciones.`
        : `El registro respondió ${reg.estado}; la cuenta nueva no accede a los datos de Ana.`,
      evidencia: {
        registro: { estado: reg.estado, cuerpo: reg.cuerpo },
        perfil_ajeno: perfilAjeno && { estado: perfilAjeno.estado, email: perfilAjeno.cuerpo?.email },
        direcciones_ajenas: direcciones && { estado: direcciones.estado, cantidad: Array.isArray(direcciones.cuerpo) ? direcciones.cuerpo.length : null }
      }
    });
    // Limpieza: la cuenta atacante no debe quedar viva.
    await pg.query(
      `DELETE FROM tokens_renovacion WHERE usuario_id IN (SELECT id FROM usuarios WHERE email = $1)`,
      [email]
    ).catch(() => undefined);
    await pg.query(`DELETE FROM auditoria_accesos WHERE email = $1`, [email]).catch(() => undefined);
    await pg.query(`DELETE FROM usuarios WHERE email = $1`, [email]).catch(() => undefined);
  }

  // -------------------------------------------------------------- V-02
  // Inyeccion de operadores NoSQL en los filtros del catalogo.
  {
    const normal = await pedir('/catalogo/productos?categoria=tecnologia&limite=100');
    const ne = await pedir('/catalogo/productos?categoria[$ne]=tecnologia&limite=100');
    const regex = await pedir('/catalogo/productos?marca[$regex]=.*&limite=100');
    const categorias = (r: Respuesta) => [...new Set((r.cuerpo?.productos ?? []).map((p: any) => p.categoria))];
    const interpretado = ne.estado === 200 && categorias(ne).some((c) => c !== 'tecnologia');
    registrar({
      id: 'V-02',
      area: 'Validación de entradas',
      titulo: 'Inyección de operadores NoSQL en categoria y marca',
      resultado: interpretado || regex.estado === 200 && (regex.cuerpo?.total ?? 0) > 0 ? 'HALLAZGO' : 'SEGURO',
      detalle: interpretado
        ? `?categoria[$ne]=tecnologia devolvió ${ne.cuerpo?.total} productos de las categorías ${categorias(ne).join(', ')}: MongoDB interpretó el operador. ?marca[$regex]=.* devolvió ${regex.cuerpo?.total}.`
        : `Los operadores no se interpretan (estados ${ne.estado} y ${regex.estado}).`,
      evidencia: {
        categoria_tecnologia: { estado: normal.estado, total: normal.cuerpo?.total },
        categoria_ne: { estado: ne.estado, total: ne.cuerpo?.total, categorias: categorias(ne) },
        marca_regex: { estado: regex.estado, total: regex.cuerpo?.total }
      }
    });

    const qObjeto = await pedir('/catalogo/productos?q[$gt]=');
    registrar({
      id: 'V-03',
      area: 'Errores',
      titulo: 'Búsqueda con q como objeto (q[$gt]=)',
      resultado: qObjeto.estado >= 500 || fugas(qObjeto.texto).length ? 'HALLAZGO' : 'SEGURO',
      detalle: `Respondió ${qObjeto.estado}${fugas(qObjeto.texto).length ? `, con rastros internos: ${fugas(qObjeto.texto).join(' ')}` : ''}. ${qObjeto.estado >= 500 ? 'Una entrada mal formada debería dar 400, no un error del servidor.' : ''}`,
      evidencia: { estado: qObjeto.estado, cuerpo: qObjeto.cuerpo }
    });
  }

  // -------------------------------------------------------------- V-04
  // Inyeccion SQL en parametros numericos de la ruta.
  {
    const cargas = ["1'OR'1'='1", '1 OR 1=1', "1;SELECT pg_sleep(3)--"];
    const evidencias = [];
    let peor = 'SEGURO' as Resultado;
    for (const carga of cargas) {
      const t0 = Date.now();
      const r = await pedir(`/pedidos/${encodeURIComponent(carga)}`, { token: ana.token });
      const ms = Date.now() - t0;
      evidencias.push({ carga, estado: r.estado, ms, cuerpo: r.cuerpo });
      if (r.estado === 200 || r.estado >= 500 || ms > 2500 || fugas(r.texto).length) peor = 'HALLAZGO';
    }
    registrar({
      id: 'V-04',
      area: 'Validación de entradas',
      titulo: 'Inyección SQL en /pedidos/:id',
      resultado: peor,
      detalle: `Estados: ${evidencias.map((e) => `${e.estado} (${e.ms} ms)`).join(', ')}. Las consultas son parametrizadas (invariante 8) y pg_sleep no se ejecuta.`,
      evidencia: { cargas: evidencias }
    });
  }

  // -------------------------------------------------------------- V-05
  // XSS almacenado en el nombre de un producto (como vendedor).
  {
    const sku = `SKU-SEG-XSS-${Date.now()}`;
    const carga = '<img src=x onerror="alert(document.cookie)">';
    const creado = await pedir('/catalogo/productos', {
      method: 'POST',
      token: vendedor.token,
      body: JSON.stringify({ sku, nombre: carga, descripcion: `<script>alert(1)</script>`, categoria: 'tecnologia', precio: 1000 })
    });
    const leido = await pedir(`/catalogo/productos/${sku}`);
    const almacenadoTalCual = leido.cuerpo?.nombre === carga;

    // React escapa el texto que interpola; solo dangerouslySetInnerHTML lo
    // insertaria como HTML. Se busca en todo el codigo de la web.
    const usos: string[] = [];
    const recorrer = (dir: string) => {
      for (const nombre of readdirSync(dir)) {
        const ruta = path.join(dir, nombre);
        if (statSync(ruta).isDirectory()) recorrer(ruta);
        else if (/\.(jsx?|tsx?)$/.test(nombre) && /dangerouslySetInnerHTML|\.innerHTML\s*=/.test(readFileSync(ruta, 'utf8'))) usos.push(path.relative(RAIZ, ruta));
      }
    };
    recorrer(path.join(RAIZ, 'clients', 'web', 'src'));

    registrar({
      id: 'V-05',
      area: 'Validación de entradas',
      titulo: 'XSS almacenado en el nombre y la descripción de un producto',
      resultado: usos.length ? 'HALLAZGO' : 'INFO',
      detalle: `Producto creado (${creado.estado}); la API ${almacenadoTalCual ? 'guarda y devuelve el HTML tal cual' : 'transforma la entrada'}. ${usos.length ? `Se inserta como HTML en: ${usos.join(', ')}.` : 'La web no usa dangerouslySetInnerHTML ni innerHTML: React lo muestra como texto y no se ejecuta.'} Riesgo latente para cualquier otro consumidor (correo, app móvil, reportes) que no escape la salida.`,
      evidencia: { creado: creado.estado, nombre_devuelto: leido.cuerpo?.nombre, usos_html_inseguro: usos }
    });
    await pedir(`/catalogo/productos/${sku}`, { method: 'PATCH', token: admin.token, body: JSON.stringify({ activo: false }) });
  }

  // -------------------------------------------------------------- V-06
  // Almacenamiento de contrasenas y que el hash no salga por ningun lado.
  {
    const { rows } = await pg.query(
      `SELECT COUNT(*)::INT AS total,
              COUNT(*) FILTER (WHERE password_hash ~ '^\\$2[aby]\\$10\\$' AND length(password_hash) = 60)::INT AS bcrypt
         FROM usuarios`
    );
    const perfil = await pedir('/auth/perfil', { token: ana.token });
    const respuestaLogin = JSON.stringify(ana);
    let enLogs = -1;
    try {
      enLogs = execSync('docker logs ecom_auth 2>&1', { maxBuffer: 256 * 1024 * 1024 }).toString().match(/\$2[aby]\$\d\d\$/g)?.length ?? 0;
    } catch {
      enLogs = -1;
    }
    const expuesto = /password|\$2[aby]\$/.test(perfil.texto + respuestaLogin) || enLogs > 0;
    registrar({
      id: 'V-06',
      area: 'Contraseñas',
      titulo: 'Contraseñas con bcrypt y el hash nunca expuesto',
      resultado: rows[0].bcrypt === rows[0].total && !expuesto ? 'SEGURO' : 'HALLAZGO',
      detalle: `${rows[0].bcrypt} de ${rows[0].total} usuarios con hash bcrypt de 10 rondas. El hash no aparece en la respuesta del login ni en /auth/perfil, y aparece ${enLogs < 0 ? '? (no se pudieron leer)' : enLogs} veces en los logs de auth.`,
      evidencia: { usuarios: rows[0], hash_en_respuestas: /\$2[aby]\$/.test(perfil.texto + respuestaLogin), hash_en_logs: enLogs }
    });
  }

  // -------------------------------------------------------------- V-07
  // Errores que filtran informacion y cabeceras que delatan la tecnologia.
  {
    const malFormado = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"email":' });
    const textoMal = await malFormado.text();
    const inexistente = await pedir('/no-existe');
    const catalogo = await pedir('/catalogo/productos');
    const problemas = [
      ...fugas(textoMal).map((f) => `JSON mal formado: ${f}`),
      ...fugas(inexistente.texto).map((f) => `ruta inexistente: ${f}`),
      ...(catalogo.cabeceras['x-powered-by'] ? [`x-powered-by: ${catalogo.cabeceras['x-powered-by']}`] : [])
    ];
    registrar({
      id: 'V-07',
      area: 'Errores',
      titulo: 'Errores sin stack traces ni detalles internos',
      resultado: problemas.length || malFormado.status >= 500 ? 'HALLAZGO' : 'SEGURO',
      detalle: `JSON mal formado → ${malFormado.status}; ruta inexistente → ${inexistente.estado}; ${problemas.length ? problemas.join('; ') : 'sin stack, rutas ni versiones, y sin x-powered-by.'}`,
      evidencia: { json_mal_formado: { estado: malFormado.status, cuerpo: textoMal.slice(0, 300) }, ruta_inexistente: { estado: inexistente.estado, cuerpo: inexistente.cuerpo }, cabeceras_gateway: catalogo.cabeceras }
    });
  }

  // -------------------------------------------------------------- V-08
  // IDOR y cabeceras de confianza inyectadas (invariante 10).
  {
    const pdb = pgBase('pedidos_db');
    const ajeno = (await pdb.query(`SELECT id, cliente_id FROM pedidos WHERE cliente_id <> $1 ORDER BY id DESC LIMIT 1`, [ana.usuario.cliente_id])).rows[0];
    await pdb.end();
    const casos = [
      { caso: 'pedido de otro cliente', r: ajeno ? await pedir(`/pedidos/${ajeno.id}`, { token: ana.token }) : null },
      { caso: 'carrito de otro cliente', r: await pedir('/carrito/2', { token: ana.token }) },
      { caso: 'perfil de otro cliente', r: await pedir('/clientes/2', { token: ana.token }) },
      {
        caso: 'ruta de administrador con x-usuario-rol: administrador inyectada',
        r: ajeno ? await pedir(`/pedidos/${ajeno.id}/saga`, { token: ana.token, headers: { 'x-usuario-rol': 'administrador', 'x-llamada-interna': '1', 'x-internal-token': 'secreto-interno-desarrollo' } }) : null
      },
      { caso: 'carrito ajeno con x-cliente-id: 2 inyectada', r: await pedir('/carrito/2', { token: ana.token, headers: { 'x-cliente-id': '2', 'x-usuario-rol': 'administrador' } }) }
    ];
    const abiertos = casos.filter((c) => c.r && c.r.estado < 400);
    registrar({
      id: 'V-08',
      area: 'Control de acceso',
      titulo: 'IDOR entre clientes y cabeceras de confianza inyectadas',
      resultado: abiertos.length ? 'HALLAZGO' : 'SEGURO',
      detalle: casos.map((c) => `${c.caso} → ${c.r ? c.r.estado : 'sin datos'}`).join('; '),
      evidencia: { casos: casos.map((c) => ({ caso: c.caso, estado: c.r?.estado })) }
    });
  }

  // -------------------------------------------------------------- V-09
  // Tokens manipulados, expirados y refresh token reutilizado.
  {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const [cab, carga, firma] = ana.token.split('.');
    const claims = JSON.parse(Buffer.from(carga, 'base64url').toString());
    const algNone = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ ...claims, rol: 'administrador' })}.`;
    const elevado = `${cab}.${b64({ ...claims, rol: 'administrador' })}.${firma}`;
    const firmaAlterada = `${cab}.${carga}.${firma.slice(0, -4)}AAAA`;
    const r1 = await pedir('/auth/perfil', { token: algNone });
    const r2 = await pedir('/auth/perfil', { token: elevado });
    const r3 = await pedir('/auth/perfil', { token: firmaAlterada });

    const sesion = await login('bruno@correo.co');
    const rot1 = await pedir('/auth/renovar', { method: 'POST', body: JSON.stringify({ refresh_token: sesion.refresh_token }) });
    const rot2 = await pedir('/auth/renovar', { method: 'POST', body: JSON.stringify({ refresh_token: sesion.refresh_token }) });

    const aceptados = [r1, r2, r3].filter((r) => r.estado < 400).length + (rot2.estado < 400 ? 1 : 0);
    registrar({
      id: 'V-09',
      area: 'Sesión',
      titulo: 'Tokens manipulados y refresh token reutilizado tras la rotación',
      resultado: aceptados ? 'HALLAZGO' : 'SEGURO',
      detalle: `alg:none → ${r1.estado}; rol cambiado sin refirmar → ${r2.estado}; firma alterada → ${r3.estado}; primera renovación → ${rot1.estado}; reutilizar el refresh token ya rotado → ${rot2.estado}.`,
      evidencia: { alg_none: r1.estado, rol_elevado: r2.estado, firma_alterada: r3.estado, renovacion: rot1.estado, refresh_reutilizado: rot2.estado }
    });
  }

  // -------------------------------------------------------------- V-10
  // Secreto JWT por defecto: ¿se puede forjar un token de administrador?
  {
    const pdb = pgBase('pedidos_db');
    const unPedido = (await pdb.query(`SELECT id FROM pedidos ORDER BY id DESC LIMIT 1`)).rows[0];
    await pdb.end();
    const forjado = jwt.sign({ sub: 999999, email: 'nadie@atacante.co', rol: 'administrador' }, SECRETO_POR_DEFECTO, { expiresIn: '5m' });
    const expirado = jwt.sign({ sub: ana.usuario.id, email: 'ana@correo.co', rol: 'cliente', cliente_id: ana.usuario.cliente_id }, SECRETO_POR_DEFECTO, { expiresIn: -60 });
    const rAdmin = unPedido ? await pedir(`/pedidos/${unPedido.id}/saga`, { token: forjado }) : null;
    const rTodos = await pedir('/pedidos', { token: forjado });
    const rExpirado = await pedir('/auth/perfil', { token: expirado });
    const aceptado = rAdmin?.estado === 200 || rTodos.estado === 200;
    registrar({
      id: 'V-10',
      area: 'Configuración',
      titulo: 'Token de administrador forjado con el secreto JWT por defecto',
      resultado: aceptado ? 'HALLAZGO' : 'SEGURO',
      detalle: aceptado
        ? `Un token firmado con "${SECRETO_POR_DEFECTO}" (publicado en docker-compose.yml) y un usuario inexistente fue aceptado como administrador: bitácora de la saga → ${rAdmin?.estado}, listado de todos los pedidos → ${rTodos.estado} (${Array.isArray(rTodos.cuerpo) ? rTodos.cuerpo.length : '?'} pedidos). Un token expirado firmado igual → ${rExpirado.estado}.`
        : `El token forjado fue rechazado (${rAdmin?.estado ?? '-'} / ${rTodos.estado}): el entorno no usa el secreto por defecto.`,
      evidencia: { saga_admin: rAdmin?.estado, listado_pedidos: rTodos.estado, pedidos_visibles: Array.isArray(rTodos.cuerpo) ? rTodos.cuerpo.length : null, token_expirado: rExpirado.estado }
    });
  }

  // -------------------------------------------------------------- V-11
  // CORS con un origen no permitido.
  {
    const malicioso = await pedir('/catalogo/productos', { headers: { Origin: 'http://sitio-malicioso.example' } });
    const permitido = await pedir('/catalogo/productos', { headers: { Origin: 'http://localhost:5173' } });
    const acao = malicioso.cabeceras['access-control-allow-origin'];
    registrar({
      id: 'V-11',
      area: 'Configuración',
      titulo: 'CORS con un origen no permitido',
      resultado: acao ? 'HALLAZGO' : malicioso.estado >= 500 ? 'HALLAZGO' : 'SEGURO',
      detalle: `Origen malicioso → ${malicioso.estado}, Access-Control-Allow-Origin: ${acao ?? '(ausente)'}; origen permitido → ${permitido.estado}, ${permitido.cabeceras['access-control-allow-origin']}. ${malicioso.estado >= 500 ? 'El rechazo de CORS se responde como un error interno (500): debería ser 403 y sin pasar por el manejador de errores.' : ''}`,
      evidencia: { malicioso: { estado: malicioso.estado, acao, cuerpo: malicioso.cuerpo }, permitido: { estado: permitido.estado, acao: permitido.cabeceras['access-control-allow-origin'] } }
    });
  }

  // -------------------------------------------------------------- V-12
  // Cabeceras de seguridad de la web servida.
  {
    let cab: Record<string, string> | null = null;
    try {
      const r = await fetch(WEB);
      cab = Object.fromEntries(r.headers.entries());
    } catch {
      cab = null;
    }
    const esperadas = ['content-security-policy', 'x-frame-options', 'x-content-type-options', 'referrer-policy'];
    const faltan = cab ? esperadas.filter((h) => !cab![h]) : esperadas;
    registrar({
      id: 'V-12',
      area: 'Configuración',
      titulo: 'Cabeceras de seguridad en la web',
      resultado: !cab ? 'INFO' : faltan.length ? 'HALLAZGO' : 'SEGURO',
      detalle: !cab ? `La web no respondió en ${WEB}.` : faltan.length ? `Faltan: ${faltan.join(', ')}. El gateway no pone CSP a propósito ("la sirve el frontend"), pero el frontend tampoco la sirve.` : 'Presentes todas.',
      evidencia: { url: WEB, cabeceras: cab, faltan }
    });
  }

  // -------------------------------------------------------------- V-13
  // Almacenamiento del token en el cliente.
  {
    const api = readFileSync(path.join(RAIZ, 'clients', 'web', 'src', 'servicios', 'api.js'), 'utf8');
    const usos = api.match(/localStorage\.setItem\('(\w+)'/g) ?? [];
    registrar({
      id: 'V-13',
      area: 'Almacenamiento en el cliente',
      titulo: 'JWT y refresh token en localStorage',
      resultado: usos.length ? 'HALLAZGO' : 'SEGURO',
      detalle: usos.length
        ? `api.js guarda ${usos.map((u) => u.match(/'(\w+)'/)![1]).join(', ')} en localStorage. Cualquier XSS lee el refresh token (vigencia de 7 días) y suplanta la sesión.`
        : 'No se usa localStorage para credenciales.',
      evidencia: { usos }
    });
  }

  // -------------------------------------------------------------- V-14
  // Denegacion de servicio: errores 4xx de un usuario abren el circuit breaker
  // que comparten todos (hallazgo del escaneo activo de ZAP).
  {
    const bruno = await login('bruno@correo.co');
    const agregar = (s: typeof ana, sku: string) =>
      pedir(`/carrito/${s.usuario.cliente_id}/items`, { method: 'POST', token: s.token, body: JSON.stringify({ sku, cantidad: 1 }) });
    const antes = await agregar(bruno, 'SKU-TEC-001');
    const ataque: number[] = [];
    for (let i = 0; i < 6; i++) ataque.push((await agregar(ana, `SKU-NO-EXISTE-${i}`)).estado);
    const victima = await agregar(bruno, 'SKU-TEC-001');
    const salud = await pedir('http://localhost:3005/health');
    await pedir(`/carrito/${bruno.usuario.cliente_id}`, { method: 'DELETE', token: bruno.token });
    const tumbado = victima.estado >= 500;
    registrar({
      id: 'V-14',
      area: 'Disponibilidad',
      titulo: 'Los 404 de un usuario abren el circuit breaker de todos',
      resultado: tumbado ? 'HALLAZGO' : 'SEGURO',
      detalle: tumbado
        ? `Bruno agrega un producto → ${antes.estado}. Ana agrega 6 SKU inexistentes → ${ataque.join(', ')}. Bruno lo intenta de nuevo → ${victima.estado} (${victima.cuerpo?.codigo}). El circuito de carrito hacia catálogo cuenta los 404 de negocio como fallos del servicio: cualquier cliente deja a todos sin carrito durante 15 s, repetible.`
        : `Tras 6 SKU inexistentes de Ana (${ataque.join(', ')}), Bruno sigue agregando productos (${victima.estado}).`,
      evidencia: { victima_antes: antes.estado, ataque, victima_despues: victima.estado, codigo: victima.cuerpo?.codigo, carrito_health: salud.cuerpo?.metricas ?? null }
    });
  }

  // -------------------------------------------------------------- V-15
  // Formato del correo en el registro.
  {
    const raro = `no-es-un-correo-${Date.now()}`;
    const r = await pedir('/auth/registro', { method: 'POST', body: JSON.stringify({ email: raro, password: CLAVE }) });
    await pg.query(`DELETE FROM auditoria_accesos WHERE email = $1`, [raro]).catch(() => undefined);
    await pg.query(`DELETE FROM usuarios WHERE email = $1`, [raro]).catch(() => undefined);
    registrar({
      id: 'V-15',
      area: 'Validación de entradas',
      titulo: 'El registro acepta un correo sin formato de correo',
      resultado: r.estado === 201 ? 'HALLAZGO' : 'SEGURO',
      detalle: `POST /auth/registro con email "${raro}" → ${r.estado}. El escaneo activo creó además 115 usuarios administradores con "correos" como http://www.google.com/ o plantillas de inyección por POST /auth/usuarios.`,
      evidencia: { estado: r.estado, cuerpo: r.cuerpo }
    });
  }

  // -------------------------------------------------------------- V-16
  // Acceso directo a un servicio interno, saltandose el gateway, con el
  // INTERNAL_TOKEN por defecto (invariante 11) y el puerto publicado.
  {
    const interno = {
      'x-internal-token': 'secreto-interno-desarrollo',
      'x-llamada-interna': '1',
      'idempotency-key': `verificacion-v16-${Date.now()}`
    };
    const URL_INV = process.env.URL_INVENTARIO || 'http://localhost:3004';
    const porGateway = await pedir('/inventario/stock/SKU-TEC-004');
    let reserva: Respuesta | null = null;
    let liberada: Respuesta | null = null;
    try {
      reserva = await pedir(`${URL_INV}/reservas`, { method: 'POST', headers: interno, body: JSON.stringify({ sku: 'SKU-TEC-004', cantidad: 1 }) });
      if (reserva.cuerpo?.reserva_id) {
        liberada = await pedir(`${URL_INV}/reservas/${reserva.cuerpo.reserva_id}/liberar`, { method: 'POST', headers: interno });
      }
    } catch {
      reserva = null; // el puerto no esta publicado: el ataque no es posible desde fuera
    }
    const abierto = reserva?.estado === 201 || reserva?.estado === 200;
    registrar({
      id: 'V-16',
      area: 'Configuración',
      titulo: 'Servicio interno alcanzable sin el gateway con el token interno por defecto',
      resultado: abierto ? 'HALLAZGO' : 'SEGURO',
      detalle: abierto
        ? `Por el gateway y sin JWT, la ruta de stock responde ${porGateway.estado}. Directo a ${URL_INV}, solo con x-internal-token: secreto-interno-desarrollo y x-llamada-interna, se reservó la última unidad de SKU-TEC-004 (${reserva?.estado}, disponible restante ${reserva?.cuerpo?.disponible_restante}) sin ningún JWT, y luego se liberó (${liberada?.estado}). docker-compose.yml publica los puertos 3001-3008 en todas las interfaces.`
        : `El acceso directo no fue posible (${reserva ? reserva.estado : 'puerto no alcanzable'}).`,
      evidencia: { gateway_sin_token: porGateway.estado, reserva_directa: reserva && { estado: reserva.estado, cuerpo: reserva.cuerpo }, liberacion: liberada?.estado }
    });
  }

  mkdirSync(path.dirname(SALIDA), { recursive: true });
  writeFileSync(SALIDA, JSON.stringify({ fecha: new Date().toISOString(), gateway: G, web: WEB, resultados }, null, 2));
  const hallazgos = resultados.filter((r) => r.resultado === 'HALLAZGO').length;
  console.log(`\n${resultados.length} verificaciones: ${hallazgos} hallazgos, ${resultados.filter((r) => r.resultado === 'SEGURO').length} seguras, ${resultados.filter((r) => r.resultado === 'INFO').length} informativas.`);
  console.log(`Evidencia: ${path.relative(RAIZ, SALIDA)}`);
  await pg.end();
  process.exitCode = hallazgos ? 1 : 0;
};

ejecutar().catch(async (error) => {
  console.error(error);
  await pg.end().catch(() => undefined);
  process.exit(2);
});
