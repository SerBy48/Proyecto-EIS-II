/**
 * Pruebas de aceptacion E2E de INTERFAZ (Trabajo Final, Fase 5).
 *
 *   npm run test:e2e:ui            web en http://localhost:8081 (contenedor ecom_web)
 *   URL_WEB=http://... npm run test:e2e:ui
 *
 * Un caso por criterio de docs/aceptacion/CRITERIOS.md (CA-01 a CA-23), con
 * Playwright sobre Chromium y selectores accesibles (getByRole, getByLabel):
 * los mismos nombres que anuncia un lector de pantalla.
 *
 * Los datos se preparan por la API A TRAVES DEL MISMO ORIGEN de la web (el
 * proxy /api de nginx), asi la prueba funciona tambien con el perfil de
 * produccion, donde el gateway no publica puerto. La interfaz se usa solo
 * para la accion que se acepta.
 *
 * Requiere la web en modo pruebas (MODO_VITE=pruebas, el valor del perfil de
 * laboratorio) para elegir la respuesta de la pasarela en CA-06.
 *
 * Evidencia en docs/evidencia/trabajo-final/e2e-ui/: una captura por criterio,
 * la traza de Playwright de cada fallo y resultados.json.
 *
 * GRABAR_VIDEO=1 graba ademas un video .webm por criterio en e2e-ui/video/
 * (plan B de la defensa; no se versiona).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Browser, BrowserContext, chromium, Page } from 'playwright';

const WEB = (process.env.URL_WEB || 'http://localhost:8081').replace(/\/$/, '');
const API = `${WEB}/api`;
const MAILPIT = process.env.MAILPIT_URL || 'http://localhost:8025';
const CLAVE = 'Password123';
const SALIDA = path.resolve(__dirname, '../../docs/evidencia/trabajo-final/e2e-ui');

const VERDE = '\u001b[32m';
const ROJO = '\u001b[31m';
const GRIS = '\u001b[90m';
const FIN = '\u001b[0m';

interface ResultadoCaso {
  id: string;
  titulo: string;
  resultado: 'PASA' | 'FALLA';
  segundos: number;
  detalle?: string;
  captura?: string;
  traza?: string;
}
const resultados: ResultadoCaso[] = [];

// ------------------------------------------------------------------- API
const api = async (ruta: string, opciones: { metodo?: string; token?: string; cuerpo?: unknown; clave?: string } = {}) => {
  const r = await fetch(`${API}${ruta}`, {
    method: opciones.metodo ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(opciones.token ? { authorization: `Bearer ${opciones.token}` } : {}),
      ...(opciones.clave ? { 'Idempotency-Key': opciones.clave } : {})
    },
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo)
  });
  const texto = await r.text();
  return { estado: r.status, datos: texto ? JSON.parse(texto) : null };
};

const login = async (email: string) => {
  const r = await api('/auth/login', { metodo: 'POST', cuerpo: { email, password: CLAVE } });
  if (r.estado !== 200) throw new Error(`No se pudo iniciar sesion como ${email} (${r.estado}). ¿Esta la web en ${WEB}?`);
  return { token: r.datos.token as string, clienteId: r.datos.usuario.cliente_id as number };
};

const stockDe = async (sku: string, token: string): Promise<number> => {
  const r = await api(`/inventario/stock/${sku}`, { token });
  return (r.datos as Array<{ cantidad_disponible: number }>).reduce((s, f) => s + f.cantidad_disponible, 0);
};

const clave = (prefijo: string) => `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Un pedido pagado por la API (para los criterios que parten de uno). */
const pedidoPagado = async (sesion: { token: string; clienteId: number }, sku: string) => {
  await api(`/carrito/${sesion.clienteId}`, { metodo: 'DELETE', token: sesion.token });
  await api(`/carrito/${sesion.clienteId}/items`, { metodo: 'POST', token: sesion.token, cuerpo: { sku, cantidad: 1 } });
  const r = await api('/pedidos/checkout', {
    metodo: 'POST',
    token: sesion.token,
    clave: clave('e2e-ui'),
    cuerpo: { medio_pago: 'tarjeta_credito', token_medio_pago: 'tok_ok_4242' }
  });
  if (r.estado !== 201) throw new Error(`No se pudo preparar un pedido pagado: ${r.estado} ${JSON.stringify(r.datos)}`);
  return r.datos.pedido as { id: number; numero: string };
};

// --------------------------------------------------------------- interfaz
const afirmar = (condicion: unknown, mensaje: string): void => {
  if (!condicion) throw new Error(mensaje);
};

const nav = (p: Page, nombre: RegExp) => p.getByRole('navigation', { name: 'Principal' }).getByRole('button', { name: nombre });

const iniciarSesionUI = async (p: Page, correo: string, contrasena = CLAVE) => {
  await p.goto(WEB, { waitUntil: 'domcontentloaded' });
  await p.getByRole('button', { name: 'Iniciar sesión' }).click();
  await p.getByLabel('Correo').fill(correo);
  await p.getByLabel('Contraseña', { exact: true }).fill(contrasena);
  await p.getByRole('button', { name: 'Ingresar' }).click();
  // Esperar a la sesion: si no, lo que se escriba enseguida se pierde al cambiar de vista.
  if (contrasena === CLAVE) await p.getByRole('button', { name: 'Salir' }).waitFor();
};

let navegador: Browser;

/** Ejecuta un criterio en un contexto nuevo; captura al final o traza si falla. */
const caso = async (id: string, titulo: string, cuerpo: (p: Page, contexto: BrowserContext) => Promise<string | void>) => {
  // GRABAR_VIDEO=1 guarda un video por criterio (plan B de la defensa).
  const contexto = await navegador.newContext({
    viewport: { width: 1280, height: 860 },
    locale: 'es-CO',
    ...(process.env.GRABAR_VIDEO ? { recordVideo: { dir: path.join(SALIDA, 'video', id), size: { width: 1280, height: 860 } } } : {})
  });
  await contexto.tracing.start({ screenshots: true, snapshots: true });
  const pagina = await contexto.newPage();
  pagina.setDefaultTimeout(15_000);
  pagina.setDefaultNavigationTimeout(30_000);
  const inicio = Date.now();
  const resultado: ResultadoCaso = { id, titulo, resultado: 'PASA', segundos: 0 };
  try {
    const detalle = await cuerpo(pagina, contexto);
    if (detalle) resultado.detalle = detalle;
    resultado.captura = `${id}.png`;
    await pagina.screenshot({ path: path.join(SALIDA, resultado.captura), fullPage: true });
    await contexto.tracing.stop();
    console.log(`  ${VERDE}PASA${FIN}  ${id} ${titulo}${detalle ? `${GRIS} — ${detalle}${FIN}` : ''}`);
  } catch (error) {
    resultado.resultado = 'FALLA';
    resultado.detalle = (error as Error).message.split('\n')[0];
    resultado.traza = `${id}-traza.zip`;
    // Una captura por pagina abierta: algunos criterios usan dos (visitante y cliente).
    for (const [i, abierta] of contexto.pages().entries()) {
      const nombre = i === 0 ? `${id}-fallo.png` : `${id}-fallo-${i + 1}.png`;
      await abierta.screenshot({ path: path.join(SALIDA, nombre), fullPage: true }).catch(() => undefined);
    }
    await contexto.tracing.stop({ path: path.join(SALIDA, resultado.traza) });
    console.log(`  ${ROJO}FALLA${FIN} ${id} ${titulo}\n        ${GRIS}${resultado.detalle}${FIN}`);
  }
  resultado.segundos = Number(((Date.now() - inicio) / 1000).toFixed(1));
  resultados.push(resultado);
  await contexto.close();
};

// ------------------------------------------------------------------ casos
const principal = async (): Promise<void> => {
  mkdirSync(SALIDA, { recursive: true });
  console.log(`\nAceptacion E2E de interfaz contra ${WEB}\n`);
  const [admin, vendedor, ana, bruno] = await Promise.all([
    login('admin@tienda.co'),
    login('vendedor@tienda.co'),
    login('ana@correo.co'),
    login('bruno@correo.co')
  ]);
  navegador = await chromium.launch();
  let numeroCompra = '';

  await caso('CA-01', 'Registro de un cliente nuevo', async (p) => {
    const correo = `e2e-ui-${Date.now()}@correo.co`;
    await p.goto(WEB, { waitUntil: 'domcontentloaded' });
    await p.getByRole('button', { name: 'Iniciar sesión' }).click();
    await p.getByRole('button', { name: 'Crear cuenta' }).click();
    await p.getByLabel('Nombre', { exact: true }).fill('Valentina');
    await p.getByLabel('Apellido').fill('Prueba');
    await p.getByLabel('Correo').fill(correo);
    await p.locator('#registro-password').fill(CLAVE);
    await p.getByLabel('Dirección', { exact: true }).fill('Calle 10 # 5-20');
    await p.getByLabel('Departamento').selectOption('Huila');
    await p.getByLabel('Ciudad o municipio').fill('Neiva');
    await p.getByRole('button', { name: 'Crear cuenta' }).click();
    await p.getByText(correo).waitFor();
    const sesion = await login(correo);
    const validacion = await api(`/clientes/${sesion.clienteId}/validar`, { token: admin.token });
    afirmar(validacion.estado === 200, `El cliente nuevo no puede comprar: ${JSON.stringify(validacion.datos)}`);
    afirmar(validacion.datos.direccion_envio.departamento === 'Huila', 'La dirección no guardó el departamento');
    return `${correo} con sesión iniciada y dirección (Neiva, Huila) lista para comprar`;
  });

  await caso('CA-02', 'Inicio de sesión (error y éxito)', async (p) => {
    await iniciarSesionUI(p, 'ana@correo.co', 'incorrecta');
    const alerta = await p.getByRole('alert').textContent();
    afirmar(/Credenciales/i.test(alerta ?? ''), `Mensaje inesperado: ${alerta}`);
    await p.getByLabel('Contraseña', { exact: true }).fill(CLAVE);
    await p.getByRole('button', { name: 'Ingresar' }).click();
    await p.getByRole('button', { name: 'Salir' }).waitFor();
    return `error: "${alerta?.trim()}"; luego entra`;
  });

  await caso('CA-03', 'Búsqueda y filtro', async (p) => {
    await p.goto(WEB, { waitUntil: 'domcontentloaded' });
    await p.locator('#filtro-q').fill('portatil');
    await p.locator('article h2', { hasText: /port[aá]til/i }).first().waitFor();
    const filtrada = p.waitForResponse((r) => r.url().includes('/catalogo/productos') && r.url().includes('subcategoria=computadores'));
    await p.getByRole('navigation', { name: 'Secciones del catálogo' }).getByRole('button', { name: /Computadores/ }).click();
    const respuesta = await (await filtrada).json();
    await p.locator('[aria-busy="true"]').waitFor({ state: 'detached' });
    const productos = respuesta.productos as Array<{ subcategoria: string; nombre: string }>;
    afirmar(productos.length > 0, 'La búsqueda no devolvió productos');
    afirmar(productos.every((x) => x.subcategoria === 'computadores'), 'Hay productos de otra sección');
    afirmar((await p.locator('article').count()) === productos.length, 'La pantalla no muestra los productos devueltos');
    return `${productos.length} portátiles, todos de la sección Computadores`;
  });

  await caso('CA-04', 'Carrito y cupón', async (p) => {
    await api(`/carrito/${ana.clienteId}`, { metodo: 'DELETE', token: ana.token });
    await iniciarSesionUI(p, 'ana@correo.co');
    await p.locator('#filtro-q').fill('portatil');
    await p.locator('article h2', { hasText: /port[aá]til/i }).first().waitFor();
    await p.locator('article', { hasText: /port[aá]til/i }).first().getByRole('button', { name: /^Agregar al carrito/ }).click();
    await p.getByRole('status').filter({ hasText: 'agregado al carrito' }).waitFor();
    await nav(p, /^Carrito/).click();
    await p.getByRole('heading', { name: 'Tu carrito' }).waitFor();
    await p.locator('#cupon').fill('BIENVENIDA10');
    await p.getByRole('button', { name: 'Aplicar' }).click();
    await p.getByText(/^Descuento/).waitFor();
    const carrito = await api(`/carrito/${ana.clienteId}`, { token: ana.token });
    afirmar(carrito.datos.totales.descuento > 0, 'El carrito no tiene descuento');
    return `descuento de ${carrito.datos.totales.descuento} sobre ${carrito.datos.totales.subtotal}`;
  });

  await caso('CA-05', 'Compra aprobada', async (p) => {
    await iniciarSesionUI(p, 'ana@correo.co');
    await nav(p, /^Carrito/).click();
    await p.getByRole('button', { name: /^Pagar/ }).click();
    await p.getByRole('heading', { name: 'Compra confirmada' }).waitFor({ timeout: 25_000 });
    numeroCompra = ((await p.locator('strong').first().textContent()) ?? '').trim();
    afirmar(/^PED-\d{6}-\d{6}$/.test(numeroCompra), `Número de pedido inesperado: ${numeroCompra}`);
    const carrito = await api(`/carrito/${ana.clienteId}`, { token: ana.token });
    afirmar(carrito.datos.items.length === 0, 'El carrito no quedó vacío');
    await nav(p, /^Mis pedidos/).click();
    await p.getByRole('row').filter({ hasText: numeroCompra }).getByText('pagado').waitFor();
    return `${numeroCompra} pagado; carrito vacío`;
  });

  await caso('CA-09', 'Correo de confirmación', async () => {
    afirmar(numeroCompra, 'No hay compra de CA-05');
    let correo: { To?: Array<{ Address: string }> } | null = null;
    for (let i = 0; i < 40 && !correo; i++) {
      const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`subject:"${numeroCompra}"`)}`)
        .then((x) => x.json())
        .catch(() => null);
      correo = r?.messages?.[0] ?? null;
      if (!correo) await new Promise((x) => setTimeout(x, 500));
    }
    afirmar(correo, `No llegó el correo de ${numeroCompra} a Mailpit (${MAILPIT})`);
    afirmar(correo!.To?.some((d) => d.Address === 'ana@correo.co'), 'El correo no va dirigido a Ana');
    return `correo de ${numeroCompra} para ana@correo.co`;
  });

  await caso('CA-08', 'Cancelación', async (p) => {
    afirmar(numeroCompra, 'No hay compra de CA-05');
    await iniciarSesionUI(p, 'ana@correo.co');
    await nav(p, /^Mis pedidos/).click();
    await p.getByRole('button', { name: new RegExp(`Ver detalle del pedido ${numeroCompra}`) }).click();
    await p.getByRole('button', { name: 'Cancelar pedido' }).click();
    await p.getByRole('button', { name: 'Si, cancelar pedido' }).click();
    await p.getByRole('row').filter({ hasText: numeroCompra }).getByText('cancelado').waitFor();
    const aviso = await p.getByRole('status').filter({ hasText: 'fue cancelado' }).textContent();
    // El correo de cancelacion le llega a Ana e informa el reembolso (H-F5-01).
    let correo: { To?: Array<{ Address: string }>; Snippet?: string } | null = null;
    for (let i = 0; i < 40 && !correo; i++) {
      const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`subject:"${numeroCompra} fue cancelado"`)}`)
        .then((x) => x.json())
        .catch(() => null);
      correo = r?.messages?.[0] ?? null;
      if (!correo) await new Promise((x) => setTimeout(x, 500));
    }
    afirmar(correo?.To?.some((d) => d.Address === 'ana@correo.co'), 'El correo de cancelación no le llegó a Ana');
    afirmar(/reembolso/i.test(correo?.Snippet ?? ''), `El correo no menciona el reembolso: ${correo?.Snippet}`);
    return `${numeroCompra} cancelado; aviso: "${aviso?.trim().slice(0, 60)}…"`;
  });

  await caso('CA-06', 'Compra rechazada con compensación', async (p) => {
    const sku = 'SKU-TEC-006';
    await api(`/carrito/${ana.clienteId}`, { metodo: 'DELETE', token: ana.token });
    await api(`/carrito/${ana.clienteId}/items`, { metodo: 'POST', token: ana.token, cuerpo: { sku, cantidad: 1 } });
    const antes = await stockDe(sku, admin.token);
    await iniciarSesionUI(p, 'ana@correo.co');
    await nav(p, /^Carrito/).click();
    await p.locator('#token-pasarela').selectOption('tok_rechazo_1111');
    await p.getByRole('button', { name: /^Pagar/ }).click();
    const alerta = p.getByRole('alert').filter({ hasText: /cobro/ });
    await alerta.waitFor({ timeout: 25_000 });
    const texto = (await alerta.textContent()) ?? '';
    afirmar(/ningún cobro/i.test(texto) && /cancelado/i.test(texto), `El mensaje no explica el rechazo: ${texto}`);
    const despues = await stockDe(sku, admin.token);
    afirmar(despues === antes, `El stock no volvió: ${antes} -> ${despues}`);
    return `stock de ${sku}: ${antes} antes y ${despues} después (devuelto)`;
  });

  await caso('CA-07', 'Última unidad', async (p) => {
    // Producto propio con UNA unidad: el criterio no depende del estado que
    // dejaron otras pruebas. Se desactiva al final para no ensuciar el catálogo.
    const sku = `SKU-ACE-${String(Math.floor(Math.random() * 900) + 100)}`;
    const creado = await api('/catalogo/productos', {
      metodo: 'POST',
      token: vendedor.token,
      cuerpo: { sku, nombre: `Cargador de aceptación ${sku}`, categoria: 'tecnologia', subcategoria: 'accesorios', precio: 50000 }
    });
    afirmar(creado.estado === 201, `No se pudo crear el producto: ${creado.estado}`);
    try {
      await api(`/inventario/stock/${sku}/entrada`, { metodo: 'POST', token: vendedor.token, cuerpo: { cantidad: 1 } });
      for (const s of [ana, bruno]) {
        await api(`/carrito/${s.clienteId}`, { metodo: 'DELETE', token: s.token });
        await api(`/carrito/${s.clienteId}/items`, { metodo: 'POST', token: s.token, cuerpo: { sku, cantidad: 1 } });
      }
      // Ana paga primero y gana la unidad.
      const compraAna = await api('/pedidos/checkout', {
        metodo: 'POST',
        token: ana.token,
        clave: clave('e2e-ui-ca07'),
        cuerpo: { medio_pago: 'tarjeta_credito', token_medio_pago: 'tok_ok_4242' }
      });
      afirmar(compraAna.estado === 201, `Ana no pudo comprar la última unidad: ${compraAna.estado}`);
      // Bruno intenta pagar desde la interfaz.
      await iniciarSesionUI(p, 'bruno@correo.co');
      await nav(p, /^Carrito/).click();
      await p.getByRole('button', { name: /^Pagar/ }).click();
      const alerta = p.getByRole('alert').filter({ hasText: /agot/i });
      await alerta.waitFor({ timeout: 20_000 });
      afirmar((await stockDe(sku, admin.token)) === 0, 'El stock no quedó en 0');
      const transacciones = await api('/pagos/transacciones', { token: bruno.token });
      afirmar(!JSON.stringify(transacciones.datos).includes(sku), 'Se le cobró a Bruno');
      return `Ana compra ${sku}; Bruno ve "${(await alerta.textContent())?.trim().slice(0, 50)}…" y no se le cobra`;
    } finally {
      await api(`/catalogo/productos/${sku}`, { metodo: 'PATCH', token: vendedor.token, cuerpo: { activo: false } });
      await api(`/carrito/${bruno.clienteId}`, { metodo: 'DELETE', token: bruno.token });
    }
  });

  await caso('CA-10', 'Asistente virtual', async (p, contexto) => {
    // Un pedido de Ana para consultarlo y otro de Bruno para el aislamiento.
    const deAna = await pedidoPagado(ana, 'SKU-TEC-009');
    const deBruno = await pedidoPagado(bruno, 'SKU-TEC-009');
    await p.goto(WEB, { waitUntil: 'domcontentloaded' });
    await p.getByRole('button', { name: '¿Necesitas ayuda?' }).click();
    const panel = p.getByRole('dialog', { name: 'Asistente virtual' });
    await panel.getByRole('button', { name: 'Costo de envío' }).click();
    await panel.getByText(/El envío cuesta .*15\.000/).waitFor();
    // La frase compuesta que antes respondia "no te entendí" (F5b).
    await panel.getByLabel('Escribe tu pregunta').fill('Hay audífonos disponibles?');
    await panel.getByRole('button', { name: 'Enviar' }).click();
    await panel.getByText(/Sí, tenemos \d+ productos en Audio/).waitFor();
    await panel.getByRole('list', { name: 'Productos' }).waitFor();

    const deAnaUI = await contexto.newPage();
    deAnaUI.setDefaultTimeout(15_000);
    await iniciarSesionUI(deAnaUI, 'ana@correo.co');
    await deAnaUI.getByRole('button', { name: '¿Necesitas ayuda?' }).click();
    const panelAna = deAnaUI.getByRole('dialog', { name: 'Asistente virtual' });
    await panelAna.getByLabel('Escribe tu pregunta').fill(`estado del pedido ${deAna.numero}`);
    await panelAna.getByRole('button', { name: 'Enviar' }).click();
    await panelAna.getByText(new RegExp(`Tu pedido ${deAna.numero} está`)).waitFor();
    await panelAna.getByLabel('Escribe tu pregunta').fill(`estado del pedido ${deBruno.numero}`);
    await panelAna.getByRole('button', { name: 'Enviar' }).click();
    await panelAna.getByText(new RegExp(`No encontré el pedido ${deBruno.numero}`)).waitFor();
    afirmar((await panelAna.getByRole('list', { name: 'Pedidos' }).filter({ hasText: deBruno.numero }).count()) === 0, 'Ana vio el pedido de Bruno');
    await deAnaUI.screenshot({ path: path.join(SALIDA, 'CA-10-cliente.png') });
    return `FAQ y "¿hay audífonos disponibles?" como visitante; Ana ve ${deAna.numero} y no ve ${deBruno.numero} (de Bruno)`;
  });

  await caso('CA-11', 'Vendedor: entrada de stock', async (p) => {
    const sku = 'SKU-TEC-007';
    const antes = await stockDe(sku, admin.token);
    await iniciarSesionUI(p, 'vendedor@tienda.co');
    await p.getByRole('navigation', { name: 'Secciones de administración' }).waitFor();
    await p.getByRole('button', { name: 'Inventario', exact: true }).click();
    await p.locator('#entrada-sku').fill(sku);
    await p.locator('#entrada-cantidad').fill('10');
    await p.getByRole('button', { name: 'Registrar' }).click();
    await p.getByText(/ahora hay \d+ unidades/).waitFor();
    const despues = await stockDe(sku, admin.token);
    afirmar(despues === antes + 10, `Stock ${antes} -> ${despues}`);
    return `${sku}: ${antes} -> ${despues}`;
  });

  await caso('CA-12', 'Administrador: estado del pedido con fecha y hora de cada cambio', async (p) => {
    const pedido = await pedidoPagado(bruno, 'SKU-TEC-001');
    await iniciarSesionUI(p, 'admin@tienda.co');
    await p.getByRole('navigation', { name: 'Secciones de administración' }).waitFor();
    await p.getByRole('button', { name: 'Pedidos', exact: true }).click();
    await p.getByRole('heading', { name: 'Pedidos del sistema' }).waitFor();
    await p.getByRole('button', { name: new RegExp(`^Marcar en preparación el pedido ${pedido.numero}`) }).click();
    await p.getByRole('row').filter({ hasText: pedido.numero }).getByText('En preparación').waitFor();
    // F5d: en lugar de la bitacora tecnica de la saga, el detalle con la linea
    // de tiempo de los estados (fecha y hora de cada cambio).
    await p.getByRole('button', { name: new RegExp(`Detalle del pedido ${pedido.numero}`) }).click();
    const detalle = p.getByRole('region', { name: `Pedido ${pedido.numero}` });
    const cambio = detalle.getByRole('listitem').filter({ hasText: 'Pagado → En preparación' });
    await cambio.waitFor();
    const hora = await cambio.locator('time').getAttribute('datetime');
    afirmar(hora && !Number.isNaN(Date.parse(hora)), 'El cambio de estado no muestra su fecha y hora');
    const cambios = await detalle.getByRole('listitem').filter({ has: p.locator('time') }).count();
    return `${pedido.numero} en preparación; el detalle muestra ${cambios} cambios de estado con fecha y hora (${new Date(hora!).toLocaleString('es-CO')})`;
  });

  /** Cuenta de cliente nueva por la API, con una direccion de envio. */
  const clienteNuevo = async (prefijo: string) => {
    const correo = `${prefijo}-${Date.now()}@correo.co`;
    const { datos } = await api('/clientes', { metodo: 'POST', cuerpo: { nombre: 'Prueba', apellido: prefijo, email: correo } });
    await api('/auth/registro', { metodo: 'POST', cuerpo: { email: correo, password: CLAVE, cliente_id: datos.cliente.id } });
    const sesion = await login(correo);
    const direccion = await api(`/clientes/${sesion.clienteId}/direcciones`, {
      metodo: 'POST',
      token: sesion.token,
      cuerpo: { etiqueta: 'Casa', linea1: 'Calle 1 # 2-3', ciudad: 'Neiva', departamento: 'Huila' }
    });
    return { ...sesion, correo, direccionId: direccion.datos.direccion.id as number };
  };

  await caso('CA-13', 'Perfil: datos y direcciones', async (p) => {
    const cliente = await clienteNuevo('ca13');
    await iniciarSesionUI(p, cliente.correo);
    await nav(p, /^Mi perfil/).click();
    await p.getByRole('heading', { name: 'Mi perfil' }).waitFor();
    await p.getByLabel('Teléfono').fill('310 555 1234');
    await p.getByRole('button', { name: 'Guardar datos' }).click();
    await p.getByText('Tus datos quedaron guardados.').waitFor();
    await p.getByRole('button', { name: '+ Agregar dirección' }).click();
    await p.getByLabel('Dirección', { exact: true }).fill('Carrera 7 # 71-52');
    await p.getByLabel('Departamento').selectOption('Bogotá D.C.');
    await p.getByLabel('Ciudad o municipio').fill('Bogotá');
    await p.getByLabel(/Nombre de la dirección/).fill('Oficina');
    await p.getByRole('button', { name: 'Guardar dirección' }).click();
    await p.getByText('Dirección agregada.').waitFor();
    await p.getByRole('button', { name: 'Usar como predeterminada' }).click();
    await p.getByText(/es ahora tu dirección predeterminada/).waitFor();
    const direcciones = (await api(`/clientes/${cliente.clienteId}/direcciones`, { token: cliente.token })).datos as Array<{ etiqueta: string; predeterminada: boolean; departamento: string }>;
    const oficina = direcciones.find((d) => d.etiqueta === 'Oficina');
    afirmar(oficina?.predeterminada && oficina.departamento === 'Bogotá D.C.', `Direcciones inesperadas: ${JSON.stringify(direcciones)}`);
    const perfil = await api(`/clientes/${cliente.clienteId}`, { token: cliente.token });
    afirmar(perfil.datos.telefono === '310 555 1234', 'El teléfono no se guardó');
    return `${direcciones.length} direcciones; "Oficina" (Bogotá D.C.) predeterminada; teléfono guardado`;
  });

  await caso('CA-14', 'Dirección al pagar y dos cambios después', async (p) => {
    const cliente = await clienteNuevo('ca14');
    await api(`/carrito/${cliente.clienteId}/items`, { metodo: 'POST', token: cliente.token, cuerpo: { sku: 'SKU-TEC-024', cantidad: 1 } });
    await iniciarSesionUI(p, cliente.correo);
    await nav(p, /^Carrito/).click();
    await p.getByRole('button', { name: '+ Agregar otra dirección' }).click();
    await p.getByLabel('Dirección', { exact: true }).fill('Avenida 6N # 28-10');
    await p.getByLabel('Departamento').selectOption('Valle del Cauca');
    await p.getByLabel('Ciudad o municipio').fill('Cali');
    await p.getByRole('button', { name: 'Usar esta dirección' }).click();
    // La direccion nueva queda elegida para esta compra.
    await p.getByRole('radio', { name: /Avenida 6N # 28-10, Cali, Valle del Cauca/ }).and(p.locator(':checked')).waitFor();
    await p.getByRole('button', { name: /^Pagar/ }).click();
    await p.getByRole('heading', { name: 'Compra confirmada' }).waitFor({ timeout: 25_000 });
    const numero = ((await p.locator('strong').first().textContent()) ?? '').trim();
    const pedido = (await api(`/pedidos/${numero}`, { token: cliente.token })).datos;
    afirmar(pedido.direccion_envio.ciudad === 'Cali', `El pedido no va a la dirección elegida: ${pedido.direccion_envio.ciudad}`);

    await nav(p, /^Mis pedidos/).click();
    await p.getByRole('button', { name: new RegExp(`Ver detalle del pedido ${numero}`) }).click();
    for (const restantes of [2, 1]) {
      await p.getByRole('button', { name: new RegExp(`Cambiar dirección \\(te quedan ${restantes}\\)`) }).click();
      await p.getByRole('radio').first().check();
      await p.getByRole('button', { name: 'Enviar a esta dirección' }).click();
      await p.getByText(/Actualizamos la dirección del pedido/).waitFor();
    }
    await p.getByText(/Ya usaste los 2 cambios de dirección/).waitFor();
    const final = (await api(`/pedidos/${numero}`, { token: cliente.token })).datos;
    afirmar(final.cambios_direccion === 2, `cambios_direccion = ${final.cambios_direccion}`);
    const tercero = await api(`/pedidos/${final.id}/direccion`, { metodo: 'PATCH', token: cliente.token, cuerpo: { direccion_id: cliente.direccionId } });
    afirmar(tercero.estado === 409, `Un tercer cambio respondió ${tercero.estado}`);
    return `${numero} pagado con envío a Cali; 2 cambios hechos y el tercero rechazado (409)`;
  });

  await caso('CA-15', 'Eliminar cuenta (bloqueada con pedidos en curso)', async (p) => {
    const cliente = await clienteNuevo('ca15');
    const pedido = await pedidoPagado(cliente, 'SKU-TEC-024');
    await iniciarSesionUI(p, cliente.correo);
    await nav(p, /^Mi perfil/).click();
    await p.getByText('No puedes eliminar tu cuenta todavía.').waitFor();
    await p.getByText(pedido.numero).waitFor();
    afirmar(await p.getByRole('button', { name: 'Eliminar mi cuenta' }).isDisabled(), 'El botón no está bloqueado');
    // Al cancelar el pedido, la cuenta ya se puede eliminar.
    await api(`/pedidos/${pedido.id}/cancelar`, { metodo: 'POST', token: cliente.token, cuerpo: { motivo: 'CA-15' } });
    await p.reload({ waitUntil: 'domcontentloaded' });
    await nav(p, /^Mi perfil/).click();
    await p.getByRole('button', { name: 'Eliminar mi cuenta' }).click();
    await p.getByLabel('Confirma con tu contraseña').fill(CLAVE);
    await p.getByRole('button', { name: 'Sí, eliminar mi cuenta' }).click();
    await p.getByText('Tu cuenta fue eliminada.').first().waitFor();
    await p.getByRole('button', { name: 'Iniciar sesión' }).waitFor();
    const reingreso = await api('/auth/login', { metodo: 'POST', cuerpo: { email: cliente.correo, password: CLAVE } });
    afirmar(reingreso.estado === 401, `La cuenta eliminada aún inicia sesión (${reingreso.estado})`);
    const perfil = await api(`/clientes/${cliente.clienteId}`, { token: admin.token });
    afirmar(perfil.datos.activo === false && !String(perfil.datos.email).startsWith('ca15'), 'El perfil no quedó anonimizado');
    return `bloqueada con ${pedido.numero} pagado; tras cancelarlo se elimina y el perfil queda anonimizado`;
  });

  await caso('CA-16', 'Modo oscuro y contraseña visible', async (p) => {
    await p.goto(WEB, { waitUntil: 'domcontentloaded' });
    const tema = p.getByRole('button', { name: 'Modo oscuro' });
    await tema.click();
    afirmar(await p.evaluate(() => document.documentElement.classList.contains('dark')), 'No se activó el modo oscuro');
    await p.reload({ waitUntil: 'domcontentloaded' });
    afirmar((await tema.getAttribute('aria-pressed')) === 'true', 'El modo oscuro no se recordó al recargar');
    await p.getByRole('button', { name: 'Iniciar sesión' }).click();
    const campo = p.getByLabel('Contraseña', { exact: true });
    await campo.fill('secreta123');
    afirmar((await campo.getAttribute('type')) === 'password', 'La contraseña se ve desde el inicio');
    await p.getByRole('button', { name: 'Mostrar contraseña' }).click();
    afirmar((await campo.getAttribute('type')) === 'text', 'El botón no muestra la contraseña');
    await p.getByRole('button', { name: 'Ocultar contraseña' }).waitFor();
    return 'tema oscuro recordado tras recargar; el ojo muestra y oculta la contraseña';
  });

  await caso('CA-17', 'Administrador: crear y desactivar un vendedor', async (p) => {
    const correo = `vendedor-${Date.now()}@serbytek.co`;
    await iniciarSesionUI(p, 'admin@tienda.co');
    await p.getByRole('navigation', { name: 'Secciones de administración' }).getByRole('button', { name: 'Usuarios' }).click();
    await p.locator('#usuario-correo').fill(correo);
    await p.locator('#usuario-password').fill(CLAVE);
    await p.getByRole('button', { name: 'Crear cuenta' }).click();
    await p.getByText(`Se creó la cuenta ${correo}`).waitFor();
    const entra = await api('/auth/login', { metodo: 'POST', cuerpo: { email: correo, password: CLAVE } });
    afirmar(entra.estado === 200 && entra.datos.usuario.rol === 'vendedor', 'El vendedor nuevo no puede entrar');
    await p.getByRole('button', { name: `Desactivar la cuenta ${correo}` }).click();
    await p.getByText(`La cuenta ${correo} quedó desactivada.`).waitFor();
    const despues = await api('/auth/login', { metodo: 'POST', cuerpo: { email: correo, password: CLAVE } });
    afirmar(despues.estado === 401, `El vendedor desactivado aún entra (${despues.estado})`);
    return `${correo} creado como vendedor, entra; desactivado, ya no entra`;
  });

  await caso('CA-18', 'Sesión vencida: la web vuelve a modo visitante', async (p) => {
    await p.goto(WEB, { waitUntil: 'domcontentloaded' });
    // Una sesion que el servidor ya no acepta (H-F5-02).
    await p.evaluate(() => {
      localStorage.setItem('token', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjF9.firma-invalida');
      localStorage.setItem('refresh_token', 'invalido');
      localStorage.setItem('usuario', JSON.stringify({ id: 3, email: 'ana@correo.co', rol: 'cliente', cliente_id: 1 }));
    });
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.getByText('Tu sesión expiró. Inicia sesión de nuevo.').waitFor();
    await p.getByRole('button', { name: 'Iniciar sesión' }).waitFor();
    await p.getByRole('button', { name: '¿Necesitas ayuda?' }).click();
    const panel = p.getByRole('dialog', { name: 'Asistente virtual' });
    await panel.getByLabel('Escribe tu pregunta').fill('cuánto cuesta el envío');
    await panel.getByRole('button', { name: 'Enviar' }).click();
    await panel.getByText(/El envío cuesta/).waitFor();
    afirmar((await panel.getByText(/no está disponible/).count()) === 0, 'El chat mostró "no disponible"');
    return 'aviso de sesión vencida, botón "Iniciar sesión" y el chat responde como visitante';
  });

  // ---------------------------------------------------------------- F5c
  /** Producto nuevo por la API, con stock, para no tocar los de la semilla. */
  // Se desactivan al final de la suite, aunque un criterio falle: si no,
  // cada corrida dejaria sus productos en la primera pagina de la tienda
  // (mismo criterio que U-17 en test:http y CA-07 aqui).
  const productosDePrueba: string[] = [];
  const productoNuevo = async (prefijo: string, stock: number, precio = 120000) => {
    const sku = `SKU-${prefijo}-${Date.now().toString(36).toUpperCase()}`;
    productosDePrueba.push(sku);
    const creado = await api('/catalogo/productos', {
      metodo: 'POST',
      token: vendedor.token,
      cuerpo: { sku, nombre: `Producto ${prefijo} ${sku.slice(-5)}`, marca: 'Prueba', subcategoria: 'accesorios', precio }
    });
    if (creado.estado !== 201) throw new Error(`No se pudo crear ${sku}: ${creado.estado} ${JSON.stringify(creado.datos)}`);
    if (stock) await api(`/inventario/stock/${sku}/entrada`, { metodo: 'POST', token: vendedor.token, cuerpo: { cantidad: stock } });
    return sku;
  };

  await caso('CA-19', 'Productos: precio y oferta con fecha de fin desde el panel', async (p) => {
    const sku = await productoNuevo('CA19', 10, 200000);
    await iniciarSesionUI(p, 'vendedor@tienda.co');
    await p.getByRole('navigation', { name: 'Secciones de administración' }).getByRole('button', { name: 'Productos' }).click();
    await p.getByLabel('Buscar').fill(sku);
    await p.getByRole('button', { name: new RegExp(`^Editar Producto CA19`) }).click();
    await p.locator('#editar-precio').fill('180000');
    await p.locator('#editar-descuento').fill('25');
    const fin = new Date(Date.now() + 10 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    await p.locator('#editar-hasta').fill(fin);
    await p.getByRole('button', { name: 'Guardar cambios' }).click();
    await p.getByText(/cambios guardados/).waitFor();
    const leido = await api(`/catalogo/productos/${sku}`);
    afirmar(leido.datos.precio_final === 135000, `Precio final ${leido.datos.precio_final}, se esperaba 135000`);
    afirmar(String(leido.datos.oferta_hasta ?? '').length > 0, 'La oferta no quedó con fecha de fin');
    const historial = await api(`/catalogo/productos/${sku}/historial-precios`, { token: vendedor.token });
    afirmar(historial.datos.length >= 2 && historial.datos[0].usuario === 'vendedor@tienda.co', 'El cambio no quedó en el historial');
    await p.screenshot({ path: path.join(SALIDA, 'CA-19-productos.png') });
    return `${sku}: $200.000 -> $180.000 con 25 % hasta el ${fin} (precio final $135.000), en el historial`;
  });

  await caso('CA-20', 'Productos: subir una foto desde el PC', async (p) => {
    const sku = await productoNuevo('CA20', 5);
    await iniciarSesionUI(p, 'vendedor@tienda.co');
    await p.getByRole('navigation', { name: 'Secciones de administración' }).getByRole('button', { name: 'Productos' }).click();
    await p.getByLabel('Buscar').fill(sku);
    await p.getByRole('button', { name: /^Editar Producto CA20/ }).click();
    // PNG valido de 1 x 1 pixel.
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    await p.locator('#editar-foto').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: png });
    await p.getByRole('button', { name: 'Subir foto' }).click();
    // El aviso exacto: la ayuda del formulario tambien dice "foto subida".
    await p.getByText(/: foto subida.$/).waitFor();
    const leido = await api(`/catalogo/productos/${sku}`);
    const ruta = leido.datos.imagenes?.[0] as string;
    afirmar(/^\/api\/catalogo\/imagenes\/[a-f0-9]{24}$/.test(ruta), `La foto no reemplazó la de la sección: ${ruta}`);
    const foto = await fetch(`${WEB}${ruta}`);
    afirmar(foto.status === 200 && foto.headers.get('content-type') === 'image/png', `La foto no se sirve (${foto.status})`);
    return `${sku}: foto subida y servida en ${ruta}`;
  });

  await caso('CA-21', 'Inventario: entrada con proveedor, costo y factura', async (p) => {
    const sku = 'SKU-TEC-026';
    const antes = await stockDe(sku, admin.token);
    await iniciarSesionUI(p, 'vendedor@tienda.co');
    await p.getByRole('navigation', { name: 'Secciones de administración' }).getByRole('button', { name: 'Inventario', exact: true }).click();
    await p.locator('#entrada-sku').fill(sku);
    await p.locator('#entrada-cantidad').fill('4');
    await p.locator('#entrada-costo').fill('550000');
    await p.locator('#entrada-proveedor').selectOption({ index: 1 });
    const factura = `FV-CA21-${Date.now().toString().slice(-5)}`;
    await p.locator('#entrada-documento').fill(factura);
    await p.getByRole('button', { name: 'Registrar entrada' }).click();
    await p.getByText(/ahora hay \d+ unidades/).waitFor();
    await p.getByRole('cell', { name: new RegExp(factura) }).waitFor();
    const despues = await stockDe(sku, admin.token);
    afirmar(despues === antes + 4, `Stock ${antes} -> ${despues}`);
    const entradas = await api(`/inventario/entradas?sku=${sku}`, { token: vendedor.token });
    const e = entradas.datos.find((x: { documento: string }) => x.documento === factura);
    afirmar(e && e.proveedor && e.costo_unitario === 550000 && e.registrado_por === 'vendedor@tienda.co', 'La entrada no guardó su soporte');
    return `${sku}: ${antes} -> ${despues}; ${factura} de ${e.proveedor} a $550.000 c/u`;
  });

  await caso('CA-22', 'Límite por cliente: el carrito dice cuántas puede llevar', async (p) => {
    // 7 unidades: el cliente debe dejar 5, puede llevar 2.
    const sku = await productoNuevo('CA22', 7);
    const cliente = await clienteNuevo('ca22');
    await api(`/carrito/${cliente.clienteId}/items`, { metodo: 'POST', token: cliente.token, cuerpo: { sku, cantidad: 2 } });
    await iniciarSesionUI(p, cliente.correo);
    await nav(p, /^Carrito/).click();
    await p.getByText('Puedes llevar hasta 2.').waitFor();
    afirmar(await p.getByRole('button', { name: /^Aumentar cantidad de Producto CA22/ }).isDisabled(), 'El botón + sigue activo en el máximo');
    await api(`/carrito/${cliente.clienteId}/items/${sku}`, { metodo: 'PATCH', token: cliente.token, cuerpo: { cantidad: 3 } });
    const r = await api('/pedidos/checkout', {
      metodo: 'POST',
      token: cliente.token,
      clave: clave('ca22'),
      cuerpo: { medio_pago: 'tarjeta_credito', token_medio_pago: 'tok_ok_4242', direccion_id: cliente.direccionId }
    });
    afirmar(r.estado === 409 && r.datos.codigo === 'LIMITE_POR_CLIENTE', `El checkout con 3 respondió ${r.estado} ${r.datos?.codigo}`);
    afirmar((await stockDe(sku, admin.token)) === 7, 'El checkout rechazado tocó el stock');
    await p.screenshot({ path: path.join(SALIDA, 'CA-22-limite.png') });
    return `7 unidades: la web muestra "hasta 2" y desactiva +; con 3, 409 LIMITE_POR_CLIENTE ("${r.datos.mensaje}")`;
  });

  await caso('CA-23', 'Consulta al vendedor desde el asistente y respuesta en la campana', async (p, contexto) => {
    const cliente = await clienteNuevo('ca23');
    await iniciarSesionUI(p, cliente.correo);
    await p.getByRole('button', { name: '¿Necesitas ayuda?' }).click();
    const panel = p.getByRole('dialog', { name: 'Asistente virtual' });
    await panel.getByLabel('Escribe tu pregunta').fill('quiero contactar al vendedor');
    await panel.getByRole('button', { name: 'Enviar' }).click();
    const formulario = panel.getByRole('form', { name: 'Consulta al vendedor' });
    await formulario.getByLabel('Tu pregunta').fill('¿El hub UGREEN sirve para un portátil con USB-C de 2019?');
    await formulario.getByRole('button', { name: 'Enviar al vendedor' }).click();
    const confirmacion = await panel.getByText(/Envié tu consulta al vendedor con el número TCK-/).textContent();
    const numero = confirmacion?.match(/TCK-[A-Z0-9]+/)?.[0] ?? '';
    afirmar(numero, 'No se mostró el número de la consulta');

    // El vendedor responde desde el panel.
    // La sesion del vendedor se prepara por la API (como en CA-18): el criterio
    // acepta la consulta y la campana; el inicio de sesion ya lo cubre CA-02.
    // Con un segundo inicio de sesion por la interfaz en otra pagina, la
    // peticion de login a veces no salia (fallo intermitente de la prueba).
    const contextoVendedor = await contexto.browser()!.newContext({ viewport: { width: 1280, height: 860 }, locale: 'es-CO' });
    const vend = await contextoVendedor.newPage();
    vend.setDefaultTimeout(15_000);
    const sesionVendedor = (await api('/auth/login', { metodo: 'POST', cuerpo: { email: 'vendedor@tienda.co', password: CLAVE } })).datos;
    await vend.goto(WEB, { waitUntil: 'domcontentloaded' });
    await vend.evaluate((s) => {
      localStorage.setItem('token', s.token);
      localStorage.setItem('refresh_token', s.refresh_token);
      localStorage.setItem('usuario', JSON.stringify(s.usuario));
    }, sesionVendedor);
    await vend.reload({ waitUntil: 'domcontentloaded' });
    await vend.getByRole('button', { name: 'Salir' }).waitFor();
    await vend.getByRole('button', { name: 'Administración' }).click();
    await vend.getByRole('navigation', { name: 'Secciones de administración' }).getByRole('button', { name: 'Consultas' }).click();
    await vend.getByRole('button', { name: new RegExp(numero) }).click();
    await vend.getByLabel('Respuesta al cliente').fill('Sí, funciona con cualquier USB-C con modo alterno de video.');
    // Se espera la respuesta del servidor: getByText('Respondida') encontraba
    // primero la opcion oculta "Respondidas" del filtro.
    const [respuesta] = await Promise.all([
      vend.waitForResponse((r) => r.url().includes(`/consultas/${numero}/mensajes`) && r.request().method() === 'POST'),
      vend.getByRole('button', { name: 'Responder' }).click()
    ]);
    afirmar(respuesta.status() === 200 && (await respuesta.json()).estado === 'respondida', `La respuesta del vendedor dio ${respuesta.status()}`);
    await contextoVendedor.close();

    // La campana del cliente lo muestra (se actualiza al volver a la pestaña o cada 30 s).
    let campana = p.getByRole('button', { name: /^Notificaciones, \d+ sin leer/ });
    for (let i = 0; i < 20 && !(await campana.count()); i++) {
      await p.reload({ waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(1000);
      campana = p.getByRole('button', { name: /^Notificaciones, \d+ sin leer/ });
    }
    await campana.click();
    await p.getByRole('button', { name: new RegExp(`Respondimos tu consulta ${numero}`) }).click();
    await p.getByRole('heading', { name: 'Mis consultas' }).waitFor();
    await p.getByRole('list', { name: 'Mensajes de la consulta' }).getByText('Sí, funciona con cualquier USB-C').waitFor();
    await p.screenshot({ path: path.join(SALIDA, 'CA-23-consulta.png') });
    return `${numero}: enviada desde el chat, respondida en el panel; el cliente la abre desde la campana`;
  });

  // ---------------------------------------------------------------- F5d
  /** Sesion del personal preparada por la API (como en CA-18 y CA-23). */
  const sesionEnNavegador = async (p: Page, correo: string) => {
    const s = (await api('/auth/login', { metodo: 'POST', cuerpo: { email: correo, password: CLAVE } })).datos;
    await p.goto(WEB, { waitUntil: 'domcontentloaded' });
    await p.evaluate((d) => {
      localStorage.setItem('token', d.token);
      localStorage.setItem('refresh_token', d.refresh_token);
      localStorage.setItem('usuario', JSON.stringify(d.usuario));
    }, s);
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.getByRole('button', { name: 'Salir' }).waitFor();
  };

  await caso('CA-24', 'Recuperar la contraseña con el enlace del correo', async (p) => {
    const cliente = await clienteNuevo('ca24');
    await p.goto(WEB, { waitUntil: 'domcontentloaded' });
    await p.getByRole('button', { name: 'Iniciar sesión' }).click();
    await p.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click();
    await p.getByLabel('Correo').fill(cliente.correo);
    await p.getByRole('button', { name: 'Enviar enlace' }).click();
    await p.getByText('Revisa tu correo').waitFor();

    // El enlace llega a Mailpit.
    let token = '';
    for (let i = 0; i < 30 && !token; i++) {
      const busqueda = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${cliente.correo}"`)}`).then((r) => r.json()).catch(() => null);
      const id = busqueda?.messages?.[0]?.ID;
      if (id) {
        const mensaje = await fetch(`${MAILPIT}/api/v1/message/${id}`).then((r) => r.json());
        token = /#restablecer=([a-f0-9]{64})/.exec(String(mensaje.Text ?? ''))?.[1] ?? '';
      }
      if (!token) await p.waitForTimeout(500);
    }
    afirmar(token, 'No llegó el correo con el enlace a Mailpit');

    await p.goto(`${WEB}/#restablecer=${token}`, { waitUntil: 'domcontentloaded' });
    await p.getByRole('heading', { name: 'Crea una contraseña nueva' }).waitFor();
    await p.locator('#restablecer-password').fill('ClaveNueva2026');
    await p.locator('#restablecer-confirmacion').fill('ClaveNueva2026');
    await p.getByRole('button', { name: 'Guardar contraseña' }).click();
    await p.getByText('Tu contraseña se actualizó. Inicia sesión con la nueva.').waitFor();
    afirmar(!p.url().includes(token), 'El token quedó en la barra de direcciones');
    await p.getByLabel('Correo').fill(cliente.correo);
    await p.getByLabel('Contraseña', { exact: true }).fill('ClaveNueva2026');
    await p.getByRole('button', { name: 'Ingresar' }).click();
    await p.getByRole('button', { name: 'Salir' }).waitFor();
    const reuso = await api('/auth/restablecer', { metodo: 'POST', cuerpo: { token, password: 'OtraClave2026' } });
    afirmar(reuso.estado === 400, `El enlace sirvió dos veces (${reuso.estado})`);
    return `${cliente.correo}: enlace recibido en Mailpit, contraseña cambiada e inicio de sesión con la nueva; el enlace no sirve dos veces`;
  });

  await caso('CA-25', 'Notificaciones: ver todas y responder una consulta desde la notificación', async (p) => {
    const cliente = await clienteNuevo('ca25');
    const creada = await api('/asistente/consultas', {
      metodo: 'POST',
      token: cliente.token,
      cuerpo: { motivo: 'producto', mensaje: '¿El monitor de 27 pulgadas trae cable DisplayPort?' }
    });
    const numero = creada.datos?.consulta?.numero as string;
    afirmar(numero, `No se creó la consulta (${creada.estado})`);
    // La notificacion llega al buzon de operaciones por el bus: se espera a que exista.
    let llego = false;
    for (let i = 0; i < 30 && !llego; i++) {
      const bandeja = await api('/notificaciones/bandeja?limite=20', { token: vendedor.token });
      llego = (bandeja.datos?.notificaciones ?? []).some((n: { ticket: string }) => n.ticket === numero);
      if (!llego) await p.waitForTimeout(500);
    }
    afirmar(llego, 'La notificación de la consulta no llegó al buzón de operaciones');

    await sesionEnNavegador(p, 'vendedor@tienda.co');
    await p.getByRole('banner').getByRole('button', { name: /^Notificaciones/ }).click();
    await p.getByRole('button', { name: 'Ver todas las notificaciones' }).click();
    await p.getByRole('heading', { name: /^Notificaciones/ }).waitFor();
    const fila = p.getByRole('listitem').filter({ hasText: numero }).first();
    await fila.getByRole('button', { name: /^Responder la consulta/ }).click();
    const respuesta = p.getByLabel('Respuesta al cliente');
    await respuesta.waitFor();
    await p.waitForFunction(() => document.activeElement?.id === 'hilo-respuesta');
    await p.getByRole('heading', { name: 'Consultas de clientes' }).waitFor();
    await respuesta.fill('Sí, el monitor incluye un cable DisplayPort de 1,8 m.');
    const [r] = await Promise.all([
      p.waitForResponse((x) => x.url().includes(`/consultas/${numero}/mensajes`) && x.request().method() === 'POST'),
      p.getByRole('button', { name: 'Responder', exact: true }).click()
    ]);
    afirmar(r.status() === 200, `La respuesta dio ${r.status()}`);
    return `${numero}: desde "Ver todas" se abre la consulta con el cursor en la respuesta y se responde`;
  });

  await caso('CA-26', 'Cerrar sesión: pantalla de salida y seguir como visitante', async (p) => {
    await iniciarSesionUI(p, 'ana@correo.co');
    await Promise.all([p.getByText('Cerrando sesión…').waitFor(), p.getByRole('button', { name: 'Salir' }).click()]);
    await p.getByText('Cerraste sesión.').waitFor();
    await p.getByRole('heading', { name: 'Iniciar sesión' }).waitFor();
    afirmar(await p.evaluate(() => localStorage.getItem('token') === null), 'El token quedó guardado tras salir');
    await p.getByRole('button', { name: 'Seguir en la tienda como visitante' }).click();
    await p.getByRole('heading', { name: 'Tecnología para trabajar, estudiar y jugar' }).waitFor();
    await p.getByRole('button', { name: /^Inicie sesión para comprar/ }).first().waitFor();
    return 'pantalla "Cerrando sesión…", inicio de sesión con el aviso y catálogo como visitante';
  });

  await caso('CA-27', 'Vendedor: sin salud del sistema, catálogo en vista previa y nombres en inventario', async (p) => {
    await iniciarSesionUI(p, 'vendedor@tienda.co');
    const secciones = p.getByRole('navigation', { name: 'Secciones de administración' });
    await secciones.getByRole('button', { name: 'Productos' }).waitFor();
    afirmar((await secciones.getByRole('button', { name: 'Salud del sistema' }).count()) === 0, 'El vendedor ve la salud del sistema');

    await secciones.getByRole('button', { name: 'Inventario', exact: true }).click();
    const nombre = (await api('/catalogo/productos/SKU-TEC-007')).datos.nombre as string;
    await p.getByRole('cell').filter({ hasText: 'SKU-TEC-007' }).filter({ hasText: nombre }).first().waitFor();

    await nav(p, /^Catálogo/).click();
    await p.getByRole('heading', { name: 'Vista previa: así ven la tienda los clientes' }).waitFor();
    const comprar = p.getByRole('button', { name: /^Vista de cliente \(sin compra\)/ }).first();
    afirmar(await comprar.isDisabled(), 'El botón de compra del personal está activo');
    afirmar((await p.getByRole('button', { name: /^Agregar al carrito/ }).count()) === 0, 'El personal ve "Agregar al carrito"');
    await p.screenshot({ path: path.join(SALIDA, 'CA-27-vista-previa.png') });

    // El administrador si tiene la salud, con que hacer si algo falla.
    const admin2 = await p.context().browser()!.newContext({ viewport: { width: 1280, height: 860 }, locale: 'es-CO' });
    const pa = await admin2.newPage();
    pa.setDefaultTimeout(15_000);
    await sesionEnNavegador(pa, 'admin@tienda.co');
    await pa.getByRole('button', { name: 'Administración' }).click();
    await pa.getByRole('heading', { name: 'Cómo leer esta vista' }).waitFor();
    await pa.getByRole('button', { name: /^Qué hacer si falla/ }).first().click();
    await pa.getByText('docker compose restart', { exact: false }).first().waitFor();
    await pa.screenshot({ path: path.join(SALIDA, 'CA-27-salud.png'), fullPage: true });
    await admin2.close();
    return `sin pestaña de salud; ${nombre} junto a SKU-TEC-007 en inventario; catálogo en vista previa sin compra; el administrador ve la salud con sus pasos`;
  });

  await caso('CA-28', 'Visitante que pide un asesor: inicia sesión y el chat retoma la consulta', async (p) => {
    const cliente = await clienteNuevo('ca28');
    await p.goto(WEB, { waitUntil: 'domcontentloaded' });
    await p.getByRole('button', { name: '¿Necesitas ayuda?' }).click();
    const panel = p.getByRole('dialog', { name: 'Asistente virtual' });
    await panel.getByRole('button', { name: 'Hablar con un asesor' }).click();
    await panel.getByText(/necesitas iniciar sesión/).waitFor();
    afirmar((await panel.getByText(/TCK-/).count()) === 0, 'Al visitante se le dio un número de ticket');
    await panel.getByRole('button', { name: 'Iniciar sesión' }).click();
    await p.getByLabel('Correo').fill(cliente.correo);
    await p.getByLabel('Contraseña', { exact: true }).fill(CLAVE);
    await p.getByRole('button', { name: 'Ingresar' }).click();
    // Con la sesion iniciada el chat se abre solo con el formulario listo.
    const formulario = p.getByRole('dialog', { name: 'Asistente virtual' }).getByRole('form', { name: 'Consulta al vendedor' });
    await formulario.getByLabel('Tu pregunta').waitFor();
    await p.screenshot({ path: path.join(SALIDA, 'CA-28-formulario.png') });
    return 'sin ticket para el visitante; tras iniciar sesión el chat muestra el formulario de la consulta';
  });

  await caso('CA-29', 'Los filtros del catálogo no pasan de una cuenta a otra', async (p) => {
    const cliente = await clienteNuevo('ca29');
    await iniciarSesionUI(p, cliente.correo);
    await p.getByRole('button', { name: '¿Necesitas ayuda?' }).click();
    const panel = p.getByRole('dialog', { name: 'Asistente virtual' });
    await panel.getByRole('button', { name: 'Ofertas' }).click();
    await panel.getByRole('button', { name: /^Ver los \d+ en el catálogo/ }).click();
    await p.getByText(/productos\s+en oferta/).waitFor();
    await p.getByRole('button', { name: 'Salir' }).click();
    await p.getByText('Cerraste sesión.').waitFor();
    await p.getByLabel('Correo').fill('vendedor@tienda.co');
    await p.getByLabel('Contraseña', { exact: true }).fill(CLAVE);
    await p.getByRole('button', { name: 'Ingresar' }).click();
    await p.getByRole('button', { name: 'Salir' }).waitFor();
    await nav(p, /^Catálogo/).click();
    await p.getByText(/^Mostrando/).waitFor();
    const resumen = (await p.getByText(/^Mostrando/).textContent()) ?? '';
    afirmar(!/en oferta/.test(resumen), `El vendedor heredó el filtro del cliente: "${resumen}"`);
    return `cliente: catálogo en oferta desde el asistente; vendedor después: "${resumen.trim()}"`;
  });

  for (const sku of productosDePrueba) {
    await api(`/catalogo/productos/${sku}`, { metodo: 'PATCH', token: vendedor.token, cuerpo: { activo: false } });
  }

  await navegador.close();

  const fallidos = resultados.filter((r) => r.resultado === 'FALLA').length;
  writeFileSync(
    path.join(SALIDA, 'resultados.json'),
    JSON.stringify({ fecha: new Date().toISOString(), web: WEB, total: resultados.length, fallidos, resultados }, null, 2)
  );
  console.log(
    `\n${fallidos ? ROJO : VERDE}${resultados.length - fallidos} de ${resultados.length} criterios de aceptación pasan.${FIN}` +
      `\n${GRIS}Evidencia: ${path.relative(process.cwd(), SALIDA)}${FIN}\n`
  );
  process.exit(fallidos ? 1 : 0);
};

principal().catch(async (error) => {
  console.error(`${ROJO}Error inesperado:${FIN}`, error);
  await navegador?.close().catch(() => undefined);
  process.exit(2);
});
