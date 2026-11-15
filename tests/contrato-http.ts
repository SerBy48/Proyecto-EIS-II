/**
 * Suite de pruebas del contrato HTTP a traves del API Gateway.
 *
 * 70 casos sobre nueve areas: autenticacion, control de acceso, inventario,
 * pagos, pedidos, limitacion de peticiones, cumplimiento PCI-DSS, aislamiento de
 * las bases de datos y degradacion del sistema.
 *
 * Requiere la infraestructura y los servicios en marcha:
 *   npm run infra:up && npm run dev
 *
 * Uso: npm run test:http
 *
 * Re-ejecutable por diseño:
 *   - El limitador de peticiones del gateway es EN MEMORIA y por IP, con una
 *     ventana de 15 minutos, y la Suite F agota a proposito la cuota de /login.
 *     Por eso la suite arranca su PROPIO gateway temporal (puerto 18080) con el
 *     contador limpio, y lo apaga al terminar: el gateway de `npm run dev` no se
 *     toca y el resto de pruebas pueden seguir haciendo login.
 *   - Restablece el estado de las bases antes de empezar (claves de
 *     idempotencia, pedidos, reservas) y desbloquea las cuentas al terminar.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { Pool } from 'pg';

const RAIZ = path.resolve(__dirname, '..');
const PUERTO_GATEWAY = Number(process.env.PUERTO_GATEWAY_PRUEBAS || 18080);
const G = `http://127.0.0.1:${PUERTO_GATEWAY}`;
const PG_PUERTO = process.env.POSTGRES_PUERTO_HOST || '5432';
const PG_CLAVE = process.env.POSTGRES_PASSWORD || 'postgres';

const VERDE = '\u001b[32m';
const ROJO = '\u001b[31m';
const GRIS = '\u001b[90m';
const FIN = '\u001b[0m';

let pasa = 0;
let falla = 0;

const urlPg = (usuario: string, clave: string, base: string): string =>
  `postgresql://${usuario}:${clave}@localhost:${PG_PUERTO}/${base}`;

const pools = new Map<string, Pool>();
/** Conexion como superusuario a una base, para preparar y verificar estado. */
const sql = async (base: string, consulta: string, params: unknown[] = []): Promise<any[]> => {
  if (!pools.has(base)) pools.set(base, new Pool({ connectionString: urlPg('postgres', PG_CLAVE, base), max: 2 }));
  const { rows } = await pools.get(base)!.query(consulta, params);
  return rows;
};

const registrar = (id: string, ok: boolean, desc: string, detalle: string): void => {
  const marca = ok ? `${VERDE}PASA ${FIN}` : `${ROJO}FALLA${FIN}`;
  console.log(`  ${id.padEnd(7)} ${marca}  ${desc.padEnd(52)} ${detalle}`);
  if (ok) pasa += 1;
  else falla += 1;
};

const info = (id: string, texto: string): void => console.log(`  ${id.padEnd(7)} ${GRIS}INFO${FIN}   ${texto}`);

const seccion = (texto: string): void => {
  console.log('\n' + '='.repeat(76));
  console.log(` ${texto}`);
  console.log('='.repeat(76));
};

interface Opciones {
  metodo?: string;
  token?: string;
  cuerpo?: unknown;
  cabeceras?: Record<string, string>;
}

const pedir = async (ruta: string, op: Opciones = {}): Promise<{ estado: number; datos: any }> => {
  const cabeceras: Record<string, string> = { ...op.cabeceras };
  if (op.token) cabeceras.Authorization = `Bearer ${op.token}`;
  if (op.cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';
  try {
    const r = await fetch(ruta.startsWith('http') ? ruta : `${G}${ruta}`, {
      method: op.metodo || 'GET',
      headers: cabeceras,
      body: op.cuerpo === undefined ? undefined : JSON.stringify(op.cuerpo),
      signal: AbortSignal.timeout(10_000)
    });
    const texto = await r.text();
    let datos: any = texto;
    try {
      datos = JSON.parse(texto);
    } catch {
      /* respuesta no JSON */
    }
    return { estado: r.status, datos };
  } catch {
    return { estado: 0, datos: null };
  }
};

const caso = async (id: string, esperado: number, desc: string, ruta: string, op: Opciones = {}): Promise<void> => {
  const { estado } = await pedir(ruta, op);
  registrar(id, estado === esperado, desc, `esperado ${esperado}, obtenido ${estado}`);
};

const login = async (email: string): Promise<string> => {
  const { datos } = await pedir('/api/auth/login', {
    metodo: 'POST',
    cuerpo: { email, password: 'Password123' }
  });
  return datos?.token || '';
};

// ---------------------------------------------------------------------------
// Gateway temporal
// ---------------------------------------------------------------------------
const arrancarGateway = async (): Promise<ChildProcess> => {
  console.log(`Arrancando un gateway temporal en el puerto ${PUERTO_GATEWAY} (limitador limpio)...`);
  const hijo = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: path.join(RAIZ, 'services', 'api-gateway'),
    env: { ...process.env, PORT: String(PUERTO_GATEWAY), LOG_LEVEL: 'error' },
    stdio: 'ignore'
  });
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (hijo.exitCode !== null) throw new Error('El gateway temporal termino al arrancar.');
    const { estado } = await pedir('/');
    if (estado > 0) {
      console.log(`Gateway listo: ${estado}`);
      return hijo;
    }
  }
  hijo.kill();
  throw new Error('El gateway temporal no respondio en 30 s.');
};

// ---------------------------------------------------------------------------
// Estado inicial conocido
// ---------------------------------------------------------------------------
const restablecerEstado = async (): Promise<void> => {
  console.log('Restableciendo el estado de las bases de datos...');
  await sql('inventario_db', 'DELETE FROM reservas');
  await sql(
    'inventario_db',
    `UPDATE stock s SET cantidad_disponible = v.cant, cantidad_reservada = 0, version = s.version + 1
       FROM (VALUES ('SKU-TEC-001',50),('SKU-TEC-002',25),('SKU-TEC-003',12),('SKU-TEC-004',1),
                    ('SKU-TEC-005',30),('SKU-HOG-001',40),('SKU-HOG-002',3),('SKU-HOG-003',18),
                    ('SKU-DEP-001',60),('SKU-DEP-002',8)) AS v(sku, cant)
      WHERE s.sku = v.sku`
  );
  await sql('pagos_db', 'DELETE FROM reembolsos; DELETE FROM auditoria_pasarela; DELETE FROM transacciones;');
  await sql('pedidos_db', 'DELETE FROM pedidos');
  await sql('auth_db', 'DELETE FROM auditoria_accesos; UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL;');
  console.log('Estado restablecido.');
};

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------
const ejecutar = async (): Promise<void> => {
  const ANA = await login('ana@correo.co');
  const ADMIN = await login('admin@tienda.co');
  const VEND = await login('vendedor@tienda.co');
  if (!ANA || !ADMIN || !VEND) throw new Error('No se pudieron obtener los tokens de prueba.');
  const ana = { token: ANA };
  const admin = { token: ADMIN };
  const vend = { token: VEND };

  seccion('SUITE A · AUTENTICACION Y EMISION DE TOKENS');
  await caso('A-01', 200, 'Login con credenciales validas (cliente)', '/api/auth/login', { metodo: 'POST', cuerpo: { email: 'ana@correo.co', password: 'Password123' } });
  await caso('A-02', 401, 'Login con contrasena incorrecta', '/api/auth/login', { metodo: 'POST', cuerpo: { email: 'ana@correo.co', password: 'incorrecta' } });
  await caso('A-03', 401, 'Login con usuario inexistente', '/api/auth/login', { metodo: 'POST', cuerpo: { email: 'nadie@correo.co', password: 'Password123' } });
  await caso('A-04', 400, 'Login sin campos obligatorios', '/api/auth/login', { metodo: 'POST', cuerpo: { email: 'ana@correo.co' } });
  await caso('A-05', 200, 'Consulta del perfil con token valido', '/api/auth/perfil', ana);
  info('A-06', `Token JWT emitido: ${ANA.length} caracteres`);
  // Hallazgo S-01 de docs/calidad/SEGURIDAD.md: el registro aceptaba el
  // cliente_id de otra persona. Ahora el correo del cliente debe coincidir.
  await caso('A-07', 403, 'Registro con el cliente_id de otra persona', '/api/auth/registro', {
    metodo: 'POST', cuerpo: { email: `intruso-${Date.now()}@correo.co`, password: 'Password123', cliente_id: 1 }
  });
  await caso('A-08', 409, 'Registro de un cliente que ya tiene cuenta', '/api/auth/registro', {
    metodo: 'POST', cuerpo: { email: 'ana@correo.co', password: 'Password123', cliente_id: 1 }
  });
  await caso('A-09', 400, 'Registro con un cliente_id inexistente', '/api/auth/registro', {
    metodo: 'POST', cuerpo: { email: `nadie-${Date.now()}@correo.co`, password: 'Password123', cliente_id: 999999 }
  });
  // Hallazgo S-10: el correo no se validaba.
  await caso('A-10', 400, 'Registro con un correo sin formato de correo', '/api/auth/registro', {
    metodo: 'POST', cuerpo: { email: 'http://www.google.com/', password: 'Password123' }
  });

  seccion('SUITE B · CONTROL DE ACCESO (RBAC Y PROPIEDAD DEL DATO)');
  await caso('B-01', 401, 'Ruta protegida sin token', '/api/pedidos');
  await caso('B-02', 401, 'Ruta protegida con token invalido', '/api/pedidos', { token: 'falso.token.aqui' });
  await caso('B-03', 200, 'Ruta protegida con token valido', '/api/pedidos', ana);
  await caso('B-04', 403, 'Cliente accediendo a ruta de personal interno', '/api/inventario/alertas', ana);
  await caso('B-05', 200, 'Administrador en la misma ruta interna', '/api/inventario/alertas', admin);
  await caso('B-06', 200, 'Vendedor en la misma ruta interna', '/api/inventario/alertas', vend);
  await caso('B-07', 403, 'Cliente intentando reservar stock por su cuenta', '/api/inventario/reservas', {
    ...ana, metodo: 'POST', cabeceras: { 'Idempotency-Key': 'intento-no-autorizado' }, cuerpo: { sku: 'SKU-TEC-001', cantidad: 500 }
  });
  await caso('B-08', 403, 'Cliente intentando registrar entrada de mercancia', '/api/inventario/stock/SKU-TEC-001/entrada', {
    ...ana, metodo: 'POST', cuerpo: { cantidad: 999 }
  });
  await caso('B-09', 200, 'Cliente consultando su propio perfil', '/api/clientes/1', ana);
  await caso('B-10', 403, 'Cliente consultando el perfil de otro cliente', '/api/clientes/2', ana);
  await caso('B-11', 403, 'Cliente consultando el carrito de otro cliente', '/api/carrito/2', ana);
  await caso('B-12', 403, 'Cliente consultando la bitacora de la saga', '/api/pedidos/1/saga', ana);
  await caso('B-13', 403, 'Inyeccion de cabeceras de confianza falsas', '/api/inventario/alertas', {
    ...ana,
    cabeceras: { 'x-usuario-rol': 'administrador', 'x-llamada-interna': '1', 'x-internal-token': 'secreto-interno-desarrollo' }
  });
  await caso('B-14', 404, 'Ruta inexistente en el gateway', '/api/inventado/ruta', ana);
  await caso('B-15', 200, 'Cliente listando sus propias direcciones', '/api/clientes/1/direcciones', ana);
  await caso('B-16', 403, 'Cliente listando las direcciones de otro cliente', '/api/clientes/2/direcciones', ana);
  // Hallazgo S-04: seis 404 de un cliente abrian el circuit breaker de carrito
  // hacia catalogo y dejaban a todos sin poder agregar productos.
  for (let i = 0; i < 6; i++) {
    await pedir('/api/carrito/1/items', { ...ana, metodo: 'POST', cuerpo: { sku: `SKU-NO-EXISTE-${i}`, cantidad: 1 } });
  }
  await caso('B-17', 200, 'Seis SKU inexistentes no abren el circuito del carrito', '/api/carrito/1/items', {
    ...ana, metodo: 'POST', cuerpo: { sku: 'SKU-TEC-001', cantidad: 1 }
  });
  await pedir('/api/carrito/1', { ...ana, metodo: 'DELETE' });

  seccion('SUITE C · INVENTARIO: RESERVAS, IDEMPOTENCIA Y COMPENSACION');
  // Se deja SKU-TEC-004 con una sola unidad.
  await sql('inventario_db', `UPDATE stock SET cantidad_disponible=1, cantidad_reservada=0 WHERE sku='SKU-TEC-004'`);
  await sql('inventario_db', `DELETE FROM reservas WHERE sku='SKU-TEC-004'`);
  const reservar = (clave: string, cuerpo: unknown): Opciones => ({ ...admin, metodo: 'POST', cabeceras: { 'Idempotency-Key': clave }, cuerpo });

  await caso('C-01', 200, 'Consulta de disponibilidad por SKU', '/api/inventario/stock/SKU-TEC-004', admin);
  await caso('C-02', 400, 'Reserva SIN cabecera Idempotency-Key', '/api/inventario/reservas', { ...admin, metodo: 'POST', cuerpo: { sku: 'SKU-TEC-004', cantidad: 1 } });
  await caso('C-03', 201, 'Reserva valida de la ultima unidad', '/api/inventario/reservas', reservar('ev-C-clave-A', { sku: 'SKU-TEC-004', cantidad: 1, pedido_id: 'evidencia' }));
  await caso('C-04', 200, 'Reintento con la MISMA clave (idempotente)', '/api/inventario/reservas', reservar('ev-C-clave-A', { sku: 'SKU-TEC-004', cantidad: 1 }));
  await caso('C-05', 409, 'Segundo comprador: stock insuficiente', '/api/inventario/reservas', reservar('ev-C-clave-B', { sku: 'SKU-TEC-004', cantidad: 1 }));

  const rid = (await pedir('/api/inventario/reservas', reservar('ev-C-clave-A', { sku: 'SKU-TEC-004', cantidad: 1 }))).datos?.reserva_id;
  const liberar: Opciones = { ...admin, metodo: 'POST', cuerpo: { motivo: 'evidencia' } };
  await caso('C-06', 200, 'Liberar la reserva (compensacion de la saga)', `/api/inventario/reservas/${rid}/liberar`, liberar);
  await caso('C-07', 200, 'Liberar de nuevo (idempotente)', `/api/inventario/reservas/${rid}/liberar`, liberar);
  const [stock] = await sql('inventario_db', `SELECT cantidad_disponible FROM stock WHERE sku='SKU-TEC-004'`);
  info('C-08', `Stock tras la compensacion: ${stock?.cantidad_disponible} unidad(es) — debe ser 1`);
  await caso('C-09', 200, 'Registrar entrada de mercancia', '/api/inventario/stock/SKU-TEC-002/entrada', { ...vend, metodo: 'POST', cuerpo: { cantidad: 5 } });
  // Un producto recien creado en el catalogo no tiene registro de inventario:
  // la primera entrada debe abrirlo (antes respondia 404 y el producto no se
  // podia vender nunca). El 409 del alta cubre las re-ejecuciones de la suite.
  await pedir('/api/catalogo/productos', {
    ...vend, metodo: 'POST', cuerpo: { sku: 'SKU-EV-INV-001', nombre: 'Producto de evidencia inventario', categoria: 'hogar', precio: 10000 }
  });
  await caso('C-10', 200, 'Primera entrada de un producto nuevo abre su inventario', '/api/inventario/stock/SKU-EV-INV-001/entrada', { ...vend, metodo: 'POST', cuerpo: { cantidad: 3 } });
  await caso('C-11', 404, 'Entrada de un SKU que no existe en el catalogo', '/api/inventario/stock/SKU-NO-EXISTE-999/entrada', { ...vend, metodo: 'POST', cuerpo: { cantidad: 3 } });
  await caso('C-12', 400, 'Entrada hacia una bodega inexistente', '/api/inventario/stock/SKU-TEC-002/entrada', { ...vend, metodo: 'POST', cuerpo: { cantidad: 1, bodega_id: 9999 } });
  await caso('C-10', 404, 'Entrada sobre un SKU inexistente', '/api/inventario/stock/SKU-NO-EXISTE/entrada', { ...vend, metodo: 'POST', cuerpo: { cantidad: 5 } });

  seccion('SUITE D · PAGOS: LOS CUATRO DESENLACES DE LA PASARELA');
  const cobrar = (clave: string, cuerpo: unknown): Opciones => ({ ...admin, metodo: 'POST', cabeceras: { 'Idempotency-Key': clave }, cuerpo });
  const cobroOk = { pedido_id: 9001, numero_pedido: 'PED-EV-9001', cliente_id: 1, monto: 500000, medio_pago: 'tarjeta_credito', token_medio_pago: 'tok_ok_4242' };
  await caso('D-01', 201, 'Pago aprobado (tok_ok)', '/api/pagos/cobros', cobrar('ev-D-01', cobroOk));
  await caso('D-02', 200, 'Reintento con la MISMA clave (no cobra dos veces)', '/api/pagos/cobros', cobrar('ev-D-01', cobroOk));
  await caso('D-03', 200, 'Pago rechazado por fondos (tok_rechazo)', '/api/pagos/cobros', cobrar('ev-D-03', { pedido_id: 9002, cliente_id: 1, monto: 100000, medio_pago: 'tarjeta_credito', token_medio_pago: 'tok_rechazo_1111' }));
  await caso('D-04', 502, 'Error tecnico de la pasarela (tok_error)', '/api/pagos/cobros', cobrar('ev-D-04', { pedido_id: 9003, cliente_id: 1, monto: 100000, medio_pago: 'tarjeta_credito', token_medio_pago: 'tok_error_9999' }));
  await caso('D-05', 400, 'Medio de pago no soportado', '/api/pagos/cobros', cobrar('ev-D-05', { pedido_id: 9004, cliente_id: 1, monto: 100000, medio_pago: 'bitcoin', token_medio_pago: 'tok_ok_1' }));
  await caso('D-06', 400, 'Monto invalido (cero)', '/api/pagos/cobros', cobrar('ev-D-06', { pedido_id: 9005, cliente_id: 1, monto: 0, medio_pago: 'pse', token_medio_pago: 'tok_ok_1' }));

  const ref = (await pedir('/api/pagos/cobros', cobrar('ev-D-01', cobroOk))).datos?.transaccion?.referencia;
  const reembolso: Opciones = { ...admin, metodo: 'POST', cuerpo: { motivo: 'evidencia' } };
  await caso('D-07', 200, 'Reembolso de una transaccion aprobada', `/api/pagos/transacciones/${ref}/reembolsar`, reembolso);
  await caso('D-08', 200, 'Reembolso repetido (idempotente)', `/api/pagos/transacciones/${ref}/reembolsar`, reembolso);
  await caso('D-09', 404, 'Reembolso de una referencia inexistente', '/api/pagos/transacciones/TRX-NO-EXISTE/reembolsar', { ...admin, metodo: 'POST', cuerpo: {} });

  seccion('SUITE E · PEDIDOS: IDENTIFICADORES Y CICLO DE VIDA');
  await caso('E-01', 404, 'Pedido por numero inexistente (PED-...)', '/api/pedidos/PED-000000-999999', ana);
  await caso('E-02', 404, 'Pedido por id numerico inexistente', '/api/pedidos/99999', ana);
  await caso('E-03', 404, 'Pedido con identificador no numerico ni PED-', '/api/pedidos/no-es-un-id', ana);
  await caso('E-04', 404, 'Bitacora de saga con identificador invalido', '/api/pedidos/no-es-un-id/saga', admin);
  await caso('E-05', 404, 'Cancelacion con identificador invalido', '/api/pedidos/no-es-un-id/cancelar', { ...ana, metodo: 'POST', cuerpo: {} });
  await caso('E-06', 404, 'Cambio de estado con identificador invalido', '/api/pedidos/no-es-un-id/estado', { ...admin, metodo: 'PATCH', cuerpo: { estado: 'enviado' } });

  // Pedido insertado directamente para probar la busqueda por numero y el ciclo de vida.
  await sql(
    'pedidos_db',
    `INSERT INTO pedidos (numero, cliente_id, direccion_envio, estado, subtotal, impuestos, envio, total, clave_idempotencia)
     VALUES (generar_numero_pedido(), 1, '{"linea1":"Calle 10","ciudad":"Medellin"}', 'pagado', 100000, 19000, 0, 119000, 'ev-E-pedido')
     ON CONFLICT (clave_idempotencia) DO NOTHING`
  );
  const [pedido] = await sql('pedidos_db', `SELECT id, numero FROM pedidos WHERE clave_idempotencia='ev-E-pedido'`);
  const estado = (valor: string): Opciones => ({ ...admin, metodo: 'PATCH', cuerpo: { estado: valor } });
  const cancelar: Opciones = { ...admin, metodo: 'POST', cuerpo: { motivo: 'evidencia' } };

  await caso('E-07', 200, `Pedido existente por NUMERO (${pedido.numero})`, `/api/pedidos/${pedido.numero}`, ana);
  await caso('E-08', 200, 'El mismo pedido por ID numerico', `/api/pedidos/${pedido.id}`, ana);
  await caso('E-09', 200, 'Bitacora de la saga (administrador)', `/api/pedidos/${pedido.id}/saga`, admin);
  await caso('E-10', 200, 'Transicion valida: pagado -> en_preparacion', `/api/pedidos/${pedido.id}/estado`, estado('en_preparacion'));
  await caso('E-11', 400, 'Transicion invalida: en_preparacion -> pagado', `/api/pedidos/${pedido.id}/estado`, estado('pagado'));
  await caso('E-12', 400, 'Estado inexistente', `/api/pedidos/${pedido.id}/estado`, estado('inventado'));
  await caso('E-13', 200, 'Cancelacion de un pedido en preparacion', `/api/pedidos/${pedido.id}/cancelar`, cancelar);
  await caso('E-14', 200, 'Cancelacion repetida (idempotente)', `/api/pedidos/${pedido.id}/cancelar`, cancelar);

  // El CLIENTE repite la cancelacion de su propio pedido: debe ser idempotente
  // (200), no un 403 por la regla de estados que solo aplica a pedidos vivos.
  await sql(
    'pedidos_db',
    `INSERT INTO pedidos (numero, cliente_id, direccion_envio, estado, subtotal, impuestos, envio, total, clave_idempotencia)
     VALUES (generar_numero_pedido(), 1, '{"linea1":"Calle 10","ciudad":"Medellin"}', 'creado', 100000, 19000, 0, 119000, 'ev-E-pedido-cliente')
     ON CONFLICT (clave_idempotencia) DO NOTHING`
  );
  const [propio] = await sql('pedidos_db', `SELECT id FROM pedidos WHERE clave_idempotencia='ev-E-pedido-cliente'`);
  const cancelarCliente: Opciones = { ...ana, metodo: 'POST', cuerpo: { motivo: 'evidencia' } };
  await caso('E-15', 200, 'El cliente cancela su propio pedido', `/api/pedidos/${propio.id}/cancelar`, cancelarCliente);
  await caso('E-16', 200, 'El cliente repite la cancelacion (idempotente)', `/api/pedidos/${propio.id}/cancelar`, cancelarCliente);

  seccion('SUITE F · LIMITACION DE PETICIONES Y BLOQUEO DE CUENTA');
  const codigos: number[] = [];
  for (let i = 0; i < 14; i++) {
    codigos.push((await pedir('/api/auth/login', { metodo: 'POST', cuerpo: { email: 'carla@correo.co', password: 'incorrecta' } })).estado);
  }
  info('F-01', `Codigos de 14 intentos de login fallidos: ${codigos.join(' ')}`);
  info('F-02', 'Estado de la cuenta tras los intentos:');
  for (const u of await sql('auth_db', `SELECT email, intentos_fallidos, bloqueado_hasta IS NOT NULL AS bloqueada FROM usuarios WHERE email='carla@correo.co'`)) {
    console.log(`           ${u.email} | intentos=${u.intentos_fallidos} | bloqueada=${u.bloqueada}`);
  }
  info('F-03', 'Auditoria de accesos registrada:');
  for (const a of await sql('auth_db', 'SELECT accion, exitoso, count(*) AS n FROM auditoria_accesos GROUP BY accion, exitoso ORDER BY accion')) {
    console.log(`           ${a.accion} | exitoso=${a.exitoso} | n=${a.n}`);
  }

  seccion('SUITE G · CUMPLIMIENTO PCI-DSS (ESQUEMA DE PAGOS)');
  const [cols] = await sql('pagos_db', `SELECT string_agg(column_name, ', ' ORDER BY ordinal_position) AS c FROM information_schema.columns WHERE table_name='transacciones'`);
  info('G-01', 'Columnas de la tabla transacciones:');
  console.log(`           ${cols.c}`);
  const [prohibidas] = await sql(
    'pagos_db',
    `SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name='transacciones' AND (column_name ~* 'numero_tarjeta|cvv|vencim|expiry|pan')`
  );
  registrar('G-02', prohibidas.n === 0, 'Columnas de tarjeta/CVV/vencimiento en el esquema', `esperado 0, obtenido ${prohibidas.n}`);

  seccion('SUITE H · AISLAMIENTO DE LAS BASES DE DATOS (BASE POR SERVICIO)');
  const puedeEntrar = async (usuario: string, clave: string, base: string): Promise<boolean> => {
    const p = new Pool({ connectionString: urlPg(usuario, clave, base), max: 1, connectionTimeoutMillis: 5000 });
    try {
      await p.query('SELECT 1');
      return true;
    } catch {
      return false;
    } finally {
      await p.end();
    }
  };
  const cruce = async (id: string, usuario: string, clave: string, base: string): Promise<void> => {
    const entra = await puedeEntrar(usuario, clave, base);
    registrar(id, !entra, `${usuario} no debe poder entrar a ${base}`, entra ? 'acceso CONCEDIDO (no debia)' : 'acceso denegado');
  };
  await cruce('H-01', 'auth_user', 'auth_pass', 'pedidos_db');
  await cruce('H-02', 'auth_user', 'auth_pass', 'pagos_db');
  await cruce('H-03', 'clientes_user', 'clientes_pass', 'inventario_db');
  await cruce('H-04', 'inventario_user', 'inventario_pass', 'pagos_db');
  await cruce('H-05', 'pedidos_user', 'pedidos_pass', 'auth_db');
  const propia = await puedeEntrar('inventario_user', 'inventario_pass', 'inventario_db');
  registrar('H-06', propia, 'inventario_user SI debe entrar a su propia base', propia ? 'acceso concedido' : 'acceso denegado (debia concederse)');

  seccion('SUITE I · DEGRADACION Y SALUD DEL SISTEMA');
  info('I-01', 'Estado de RabbitMQ en los servicios que publican eventos');
  console.log('           (dependencia no critica: el servicio sigue sano aunque falte):');
  for (const puerto of [3002, 3004, 3006, 3007]) {
    const { datos } = await pedir(`http://127.0.0.1:${puerto}/health`);
    if (!datos?.servicio) {
      console.log(`           puerto ${puerto}: sin respuesta`);
      continue;
    }
    const rabbit = (datos.dependencias || []).find((d: any) => d.nombre.includes('rabbit'));
    console.log(
      `           ${String(datos.servicio).padEnd(24)} estado=${String(datos.estado).padEnd(10)}` +
        `rabbitmq: conectado=${rabbit ? rabbit.ok : 'n/a'} critica=${rabbit ? rabbit.critica : 'n/a'}`
    );
  }
  info('I-02', 'Salud agregada del gateway:');
  const { datos: salud } = await pedir('/api/health');
  console.log(`           servicios caidos: ${(salud?.servicios_caidos || []).join(', ') || 'ninguno'}`);
  for (const s of salud?.servicios || []) {
    console.log(`           ${String(s.servicio).padEnd(16)} ok=${s.ok}  estado=${s.estado}`);
  }
};

const main = async (): Promise<void> => {
  let gateway: ChildProcess | undefined;
  try {
    gateway = await arrancarGateway();
    await restablecerEstado();
    console.log();
    await ejecutar();
  } catch (e) {
    falla += 1;
    console.error(`\n${ROJO}Error al ejecutar la suite:${FIN} ${(e as Error).message}`);
  } finally {
    // La Suite F deja bloqueada la cuenta de carla: se desbloquea para que
    // las demas pruebas (p. ej. test:e2e) puedan usarla.
    await sql('auth_db', 'UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL').catch(() => undefined);
    gateway?.kill();
    await Promise.all([...pools.values()].map((p) => p.end()));
  }

  console.log('\n' + '='.repeat(76));
  console.log(` RESULTADO: ${pasa} casos PASA, ${falla} casos FALLA`);
  console.log('='.repeat(76));
  process.exitCode = falla === 0 ? 0 : 1;
};

main();
