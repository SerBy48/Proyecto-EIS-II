/**
 * Recorrido cognitivo automatizado con estimacion KLM y analisis de accesibilidad.
 *
 * Ejecuta en un Chromium real las 8 tareas de tests/usabilidad/tareas.md, tal
 * como las haria un usuario (clics, teclado, selecciones), y para cada accion:
 *
 *   - registra los operadores del Keystroke-Level Model (Card, Moran y Newell,
 *     1983): K tecla, P apuntar, B boton del raton, H mover la mano entre
 *     teclado y raton, M preparacion mental;
 *   - mide R, el tiempo real que tarda el sistema en mostrar la respuesta;
 *   - guarda capturas de los estados de exito, error, vacio y carga;
 *   - y analiza cada pantalla con axe-core (WCAG 2.2 A y AA).
 *
 * Uso:   npm run usabilidad:recorrido
 * Variables:
 *   URL_WEB      web a recorrer (por defecto http://localhost:4173, el build)
 *   URL_API      API para preparar datos (por defecto http://localhost:8080/api)
 *   ZAP_PROXY    p. ej. http://localhost:8090: el navegador sale por el proxy
 *                de ZAP, que asi registra las paginas autenticadas (ver
 *                tests/seguridad/zap-recorrido.sh). En ese modo solo se hacen
 *                las tareas, sin capturas, axe ni estados especiales.
 *   DEGRADADO=1  detiene inventario un momento para capturar la degradacion.
 *   ETIQUETA     sufijo de la evidencia (p. ej. "despues"), para conservar el antes.
 *
 * El KLM es una ESTIMACION del tiempo de un usuario experto sin errores; no
 * sustituye la observacion de personas reales (tareas.md, seccion 4).
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import jwt from 'jsonwebtoken';
import { Browser, chromium, Locator, Page } from 'playwright';

const RAIZ = path.resolve(__dirname, '..', '..');

/**
 * La CSP estricta del build (script-src 'self', sin unsafe-eval) bloquea las
 * funciones que Playwright y axe evaluan dentro de la pagina. Para la
 * automatizacion se omite la CSP; que la web funcione CON ella se verifica
 * aparte (docs/calidad/SEGURIDAD.md, seccion 9.1).
 */
const OPCIONES_CONTEXTO = { locale: 'es-CO', bypassCSP: true, ignoreHTTPSErrors: true } as const;
const URL_WEB = process.env.URL_WEB || 'http://localhost:4173';
const URL_API = process.env.URL_API || 'http://localhost:8080/api';
const PROXY = process.env.ZAP_PROXY;
const COMPLETO = !PROXY;
const SALIDA = path.join(RAIZ, 'docs', 'evidencia', 'no-funcionales', 'usabilidad');
/** Sufijo de la evidencia (p. ej. ETIQUETA=despues), para no sobrescribir el antes. */
const SUFIJO = process.env.ETIQUETA ? `-${process.env.ETIQUETA}` : '';
const CAPTURAS = path.join(SALIDA, `capturas${SUFIJO}`);
const CLAVE = 'Password123';

// ---------------------------------------------------------------------------
// Keystroke-Level Model
// ---------------------------------------------------------------------------
/** Tiempos estandar de los operadores en segundos (Card, Moran y Newell, 1983; Kieras, 2001). */
const KLM = { K: 0.28, P: 1.1, B: 0.1, H: 0.4, M: 1.35 } as const;
type Operador = keyof typeof KLM;

interface Paso {
  accion: string;
  operadores: string;
  segundos_usuario: number;
  r_sistema_s: number;
}

interface ResultadoTarea {
  id: string;
  titulo: string;
  tiempo_esperado_s: number;
  exito: boolean;
  error?: string;
  pasos: Paso[];
  conteo: Record<Operador, number>;
  klm_usuario_s: number;
  r_sistema_s: number;
  klm_total_s: number;
  observaciones: string[];
}

class Tarea {
  pasos: Paso[] = [];
  observaciones: string[] = [];
  private mano: 'raton' | 'teclado' = 'raton';

  constructor(
    public pagina: Page,
    public id: string,
    public titulo: string,
    public tiempoEsperado: number
  ) {}

  private registrar(accion: string, ops: Operador[], rMs = 0): void {
    this.pasos.push({
      accion,
      operadores: ops.join(' '),
      segundos_usuario: Number(ops.reduce((s, o) => s + KLM[o], 0).toFixed(2)),
      r_sistema_s: Number((rMs / 1000).toFixed(2))
    });
  }

  private alRaton(): Operador[] {
    const ops: Operador[] = this.mano === 'teclado' ? ['H'] : [];
    this.mano = 'raton';
    return ops;
  }

  /** Decidir, apuntar y hacer clic. Regla de Kieras: una M antes de cada accion que inicia una unidad de trabajo. */
  async clic(objetivo: Locator, accion: string, { pensar = true } = {}): Promise<void> {
    await objetivo.click();
    this.registrar(accion, [...(pensar ? (['M'] as Operador[]) : []), ...this.alRaton(), 'P', 'B', 'B']);
  }

  /** Apuntar al campo, hacer clic y escribir el texto. */
  async escribir(campo: Locator, texto: string, accion: string): Promise<void> {
    await campo.click();
    await campo.fill(texto);
    const ops: Operador[] = ['M', ...this.alRaton(), 'P', 'B', 'B', 'H', ...(Array(texto.length).fill('K') as Operador[])];
    this.mano = 'teclado';
    this.registrar(accion, ops);
  }

  /** Abrir un desplegable y elegir una opcion: dos clics. */
  async elegir(lista: Locator, valor: string, accion: string): Promise<void> {
    await lista.selectOption(valor);
    this.registrar(accion, ['M', ...this.alRaton(), 'P', 'B', 'B', 'P', 'B', 'B']);
  }

  /** Leer y comprobar algo en pantalla antes de seguir: una M. */
  leer(accion: string): void {
    this.registrar(accion, ['M']);
  }

  /** Esperar la respuesta del sistema y medirla (operador R). */
  async esperar(condicion: () => Promise<unknown>, accion: string): Promise<void> {
    const inicio = Date.now();
    await condicion();
    this.registrar(accion, [], Date.now() - inicio);
  }

  async captura(nombre: string): Promise<void> {
    if (COMPLETO) await this.pagina.screenshot({ path: path.join(CAPTURAS, `${nombre}.png`), fullPage: true });
  }

  resultado(exito: boolean, error?: string): ResultadoTarea {
    const conteo = { K: 0, P: 0, B: 0, H: 0, M: 0 } as Record<Operador, number>;
    for (const p of this.pasos) for (const o of p.operadores.split(' ').filter(Boolean)) conteo[o as Operador]++;
    const usuario = this.pasos.reduce((s, p) => s + p.segundos_usuario, 0);
    const r = this.pasos.reduce((s, p) => s + p.r_sistema_s, 0);
    return {
      id: this.id,
      titulo: this.titulo,
      tiempo_esperado_s: this.tiempoEsperado,
      exito,
      error,
      pasos: this.pasos,
      conteo,
      klm_usuario_s: Number(usuario.toFixed(1)),
      r_sistema_s: Number(r.toFixed(1)),
      klm_total_s: Number((usuario + r).toFixed(1)),
      observaciones: this.observaciones
    };
  }
}

// ---------------------------------------------------------------------------
// API para preparar datos
// ---------------------------------------------------------------------------
const api = async (ruta: string, opciones: { metodo?: string; token?: string; cuerpo?: unknown; cabeceras?: Record<string, string> } = {}) => {
  const r = await fetch(`${URL_API}${ruta}`, {
    method: opciones.metodo || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opciones.token ? { Authorization: `Bearer ${opciones.token}` } : {}),
      ...opciones.cabeceras
    },
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo)
  });
  const texto = await r.text();
  return { estado: r.status, datos: texto ? JSON.parse(texto) : null };
};
const tokenDe = async (email: string) => (await api('/auth/login', { metodo: 'POST', cuerpo: { email, password: CLAVE } })).datos;

// ---------------------------------------------------------------------------
// Accesibilidad
// ---------------------------------------------------------------------------
interface Pantalla {
  pantalla: string;
  violaciones: { id: string; impacto: string | null | undefined; descripcion: string; ayuda: string; nodos: number; ejemplo: string }[];
}
const accesibilidad: Pantalla[] = [];

const analizar = async (pagina: Page, pantalla: string): Promise<void> => {
  if (!COMPLETO) return;
  const r = await new AxeBuilder({ page: pagina }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  accesibilidad.push({
    pantalla,
    violaciones: r.violations.map((v) => ({
      id: v.id,
      impacto: v.impact,
      descripcion: v.help,
      ayuda: v.helpUrl,
      nodos: v.nodes.length,
      ejemplo: v.nodes[0]?.target.join(' ') ?? ''
    }))
  });
};

// ---------------------------------------------------------------------------
// Ayudantes de la interfaz
// ---------------------------------------------------------------------------
const sinCarga = (p: Page) => p.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
const nav = (p: Page, nombre: RegExp) => p.getByRole('navigation', { name: 'Principal' }).getByRole('button', { name: nombre });
/**
 * Escribe correo y contrasena. Si el formulario aun tiene el desplegable de
 * cuentas de prueba (version anterior a la correccion U-01), se elige de el.
 */
const esDesplegable = async (p: Page) => (await p.locator('#login-correo').evaluate((e) => e.tagName)) === 'SELECT';

const escribirCredenciales = async (t: Tarea, correo: string) => {
  if (await esDesplegable(t.pagina)) {
    await t.elegir(t.pagina.locator('#login-correo'), correo, `Elegir la cuenta ${correo} en el desplegable`);
    t.leer('Comprobar la contrasena (el campo ya viene lleno)');
    return;
  }
  await t.escribir(t.pagina.locator('#login-correo'), correo, 'Escribir el correo');
  await t.escribir(t.pagina.locator('#login-password'), CLAVE, 'Escribir la contrasena');
};

const iniciarSesionUI = async (t: Tarea, correo: string) => {
  await t.clic(t.pagina.getByRole('button', { name: 'Iniciar sesión' }), 'Abrir el formulario de inicio de sesion');
  await escribirCredenciales(t, correo);
  await t.clic(t.pagina.getByRole('button', { name: 'Ingresar' }), 'Pulsar Ingresar', { pensar: false });
  await t.esperar(() => t.pagina.getByRole('button', { name: 'Salir' }).waitFor(), 'Esperar la sesion iniciada');
};

// ---------------------------------------------------------------------------
// Tareas
// ---------------------------------------------------------------------------
const ejecutarTarea = async (
  pagina: Page,
  id: string,
  titulo: string,
  esperado: number,
  cuerpo: (t: Tarea) => Promise<void>
): Promise<ResultadoTarea> => {
  const t = new Tarea(pagina, id, titulo, esperado);
  try {
    await cuerpo(t);
    console.log(`  ${id} ✓ ${titulo}`);
    return t.resultado(true);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message.split('\n')[0] : String(error);
    console.log(`  ${id} ✗ ${titulo}: ${mensaje}`);
    await t.captura(`${id}-fallo`);
    return t.resultado(false, mensaje);
  }
};

const tareas = async (pagina: Page): Promise<ResultadoTarea[]> => {
  const r: ResultadoTarea[] = [];
  await pagina.goto(URL_WEB);
  await sinCarga(pagina);
  await analizar(pagina, 'Catalogo (visitante)');

  r.push(await ejecutarTarea(pagina, 'T1', 'Iniciar sesion como cliente', 30, async (t) => {
    await t.clic(pagina.getByRole('button', { name: 'Iniciar sesión' }), 'Abrir el formulario de inicio de sesion');
    await analizar(pagina, 'Inicio de sesion');
    await t.captura('T1-formulario');
    const desplegable = await esDesplegable(pagina);
    if (desplegable) {
      t.leer('Reconocer a Ana en el desplegable de cuentas (viene elegida por defecto)');
      t.leer('Comprobar la contrasena (el campo ya viene lleno)');
    } else {
      await escribirCredenciales(t, 'ana@correo.co');
    }
    await t.clic(pagina.getByRole('button', { name: 'Ingresar' }), 'Pulsar Ingresar', { pensar: false });
    await t.esperar(() => pagina.getByRole('button', { name: 'Salir' }).waitFor(), 'Esperar la sesion iniciada');
    await sinCarga(pagina);
    await t.captura('T1-sesion-iniciada');
    t.observaciones.push(
      desplegable
        ? 'El correo se elige en un desplegable con 4 cuentas de prueba y la contrasena viene escrita: no hay forma de entrar con otra cuenta.'
        : 'Correo y contrasena se escriben; las cuentas de prueba aparecen como ayuda plegable.'
    );
  }));

  r.push(await ejecutarTarea(pagina, 'T2', 'Buscar un producto y filtrar por seccion', 30, async (t) => {
    await analizar(pagina, 'Catalogo (cliente)');
    await t.escribir(pagina.locator('#filtro-q'), 'portatil', 'Escribir "portatil" en el buscador');
    await t.esperar(async () => {
      await pagina.waitForFunction(() => [...document.querySelectorAll('article h2')].some((h) => /port[aá]til/i.test(h.textContent ?? '')));
      await sinCarga(pagina);
    }, 'Esperar los resultados (la busqueda se lanza sola tras 350 ms)');
    // La consulta filtrada sale tras el debounce de 350 ms: se espera su
    // respuesta, no solo la ausencia de carga (que es cierta antes de empezar).
    const filtrada = pagina.waitForResponse((r) => r.url().includes('/catalogo/productos') && r.url().includes('subcategoria=computadores'));
    await t.clic(pagina.getByRole('navigation', { name: 'Secciones del catálogo' }).getByRole('button', { name: /Computadores/ }), 'Pulsar la seccion Computadores');
    await t.esperar(async () => {
      await filtrada;
      await sinCarga(pagina);
    }, 'Esperar la lista filtrada');
    t.leer('Revisar la lista resultante');
    await t.captura('T2-resultados');
    const n = await pagina.locator('article').count();
    const conteo = (await pagina.getByText(/^Mostrando/).count()) ? (await pagina.getByText(/^Mostrando/).textContent())?.trim() : null;
    t.observaciones.push(
      conteo
        ? `La busqueda muestra ${n} producto(s) e indica "${conteo}".`
        : `La busqueda muestra ${n} producto(s); no se indica cuantos resultados hay en total.`
    );
  }));

  r.push(await ejecutarTarea(pagina, 'T3', 'Agregar dos productos y cambiar una cantidad', 60, async (t) => {
    const botones = pagina.getByRole('button', { name: /^Agregar al carrito/ });
    for (let i = 0; i < 2; i++) {
      await t.clic(botones.nth(i), `Agregar el producto ${i + 1} al carrito`);
      await t.esperar(() => pagina.getByRole('status').filter({ hasText: 'agregado al carrito' }).first().waitFor(), 'Esperar el aviso de agregado');
    }
    await t.captura('T3-aviso-agregado');
    const aviso = (await pagina.getByRole('status').filter({ hasText: 'agregado al carrito' }).first().textContent()) ?? '';
    t.observaciones.push(
      /SKU-[A-Z]{3}-\d{3}/.test(aviso)
        ? `El aviso de confirmacion dice "${aviso.trim()}": muestra el SKU, no el nombre del producto.`
        : `El aviso de confirmacion dice "${aviso.trim()}": nombra el producto y flota bajo la cabecera (U-07 corregido).`
    );
    await t.clic(nav(pagina, /^Carrito/), 'Ir al carrito');
    await t.esperar(() => pagina.getByRole('heading', { name: 'Tu carrito' }).waitFor(), 'Esperar el carrito');
    await t.clic(pagina.getByRole('button', { name: /^Aumentar cantidad/ }).first(), 'Aumentar la cantidad del primer producto');
    await t.esperar(() => pagina.waitForFunction(() => /Cantidad:\s*2/.test(document.querySelector('main ul')?.textContent ?? '')), 'Esperar la cantidad 2');
    await analizar(pagina, 'Carrito con productos');
    await t.captura('T3-carrito');
  }));

  r.push(await ejecutarTarea(pagina, 'T4', 'Aplicar un cupon', 30, async (t) => {
    await t.escribir(pagina.locator('#cupon'), 'BIENVENIDA10', 'Escribir el cupon');
    await t.clic(pagina.getByRole('button', { name: 'Aplicar' }), 'Pulsar Aplicar');
    await t.esperar(() => pagina.getByText(/^Descuento/).waitFor(), 'Esperar la linea de descuento');
    t.leer('Comprobar el descuento en el resumen');
    await t.captura('T4-cupon-aplicado');
    t.observaciones.push('No hay mensaje de confirmacion: el unico indicio es la linea "Descuento" en el resumen. Tampoco hay forma de quitar el cupon.');
  }));

  let numeroPedido = '';
  r.push(await ejecutarTarea(pagina, 'T5', 'Finalizar la compra con pago aprobado', 45, async (t) => {
    t.leer('Revisar el medio de pago y el token de prueba (ya vienen en "aprueba")');
    await t.clic(pagina.getByRole('button', { name: /^Pagar/ }), 'Pulsar Pagar');
    await t.captura('T5-procesando');
    await t.esperar(() => pagina.getByRole('heading', { name: 'Compra confirmada' }).waitFor({ timeout: 20_000 }), 'Esperar la confirmacion (saga completa)');
    numeroPedido = (await pagina.locator('strong').first().textContent()) ?? '';
    await analizar(pagina, 'Compra confirmada');
    await t.captura('T5-compra-confirmada');
  }));

  r.push(await ejecutarTarea(pagina, 'T6', 'Consultar el pedido y cancelarlo', 60, async (t) => {
    await t.clic(nav(pagina, /^Mis pedidos/), 'Ir a Mis pedidos');
    await t.esperar(() => pagina.getByRole('table').waitFor(), 'Esperar la lista de pedidos');
    await analizar(pagina, 'Mis pedidos');
    await t.captura('T6-mis-pedidos');
    t.leer(`Encontrar el pedido ${numeroPedido} en la tabla`);
    await t.clic(pagina.getByRole('button', { name: new RegExp(`Ver detalle del pedido ${numeroPedido}`) }), 'Abrir el detalle');
    await t.esperar(() => pagina.getByRole('dialog').waitFor(), 'Esperar el detalle');
    await analizar(pagina, 'Detalle del pedido (modal)');
    await t.captura('T6-detalle');
    await t.clic(pagina.getByRole('button', { name: 'Cancelar pedido' }), 'Pulsar Cancelar pedido');
    const confirmacion = pagina.getByRole('button', { name: 'Si, cancelar pedido' });
    const pideConfirmacion = (await confirmacion.count()) > 0;
    if (pideConfirmacion) {
      t.leer('Leer la pregunta de confirmacion');
      await t.captura('T6-confirmacion');
      await t.clic(confirmacion, 'Confirmar la cancelacion', { pensar: false });
    }
    await t.esperar(async () => {
      await pagina.getByRole('dialog').waitFor({ state: 'detached' });
      await pagina.getByRole('row').filter({ hasText: numeroPedido }).getByText('cancelado').waitFor();
    }, 'Esperar el estado cancelado');
    t.leer('Comprobar el nuevo estado en la tabla');
    await t.captura('T6-cancelado');
    const avisoExito = await pagina.getByRole('status').filter({ hasText: 'fue cancelado' }).count();
    t.observaciones.push(
      pideConfirmacion
        ? `La cancelacion pide confirmacion${avisoExito ? ' y termina con un aviso de exito' : ''}.`
        : 'Cancelar es una accion irreversible y se ejecuta con un solo clic, sin confirmacion; tampoco hay un mensaje que confirme que se cancelo.'
    );
  }));

  r.push(await ejecutarTarea(pagina, 'T7', 'Comprar con pago rechazado e interpretar el mensaje', 90, async (t) => {
    await t.clic(nav(pagina, /^Catálogo/), 'Volver al catalogo');
    await t.esperar(() => sinCarga(pagina), 'Esperar el catalogo');
    await t.clic(pagina.getByRole('button', { name: /^Agregar al carrito/ }).first(), 'Agregar un producto');
    await t.esperar(() => pagina.getByRole('status').filter({ hasText: 'agregado al carrito' }).first().waitFor(), 'Esperar el aviso');
    await t.clic(nav(pagina, /^Carrito/), 'Ir al carrito');
    await t.esperar(() => pagina.getByRole('heading', { name: 'Tu carrito' }).waitFor(), 'Esperar el carrito');
    await t.elegir(pagina.locator('#token-pasarela'), 'tok_rechazo_1111', 'Elegir el token que rechaza el pago');
    await t.clic(pagina.getByRole('button', { name: /^Pagar/ }), 'Pulsar Pagar');
    await t.esperar(() => pagina.getByRole('heading', { name: 'No pudimos procesar el pago' }).waitFor({ timeout: 20_000 }), 'Esperar el resultado');
    t.leer('Leer el mensaje del rechazo');
    t.leer('Leer la lista "Que ocurrio con tu compra"');
    await analizar(pagina, 'Pago rechazado');
    await t.captura('T7-pago-rechazado');
    const texto = (await pagina.getByRole('alert').textContent()) ?? '';
    t.observaciones.push(
      /ningún cobro/i.test(texto) && /cancelado/i.test(texto)
        ? 'La pantalla explica que el pedido quedo cancelado, que no hubo cobro y que el carrito se conserva.'
        : 'La pantalla de rechazo no explica con claridad que paso con el cobro.'
    );
    await t.clic(pagina.getByRole('button', { name: 'Volver al carrito' }), 'Volver al carrito');
  }));

  r.push(await ejecutarTarea(pagina, 'T8', 'Registrar stock y avanzar un pedido como administrador', 90, async (t) => {
    await t.clic(pagina.getByRole('button', { name: 'Salir' }), 'Cerrar la sesion de cliente');
    await iniciarSesionUI(t, 'admin@tienda.co');
    await t.esperar(() => pagina.getByRole('navigation', { name: 'Secciones de administración' }).waitFor(), 'Esperar el panel');
    await analizar(pagina, 'Administracion: salud');
    await t.captura('T8-salud');
    await t.clic(pagina.getByRole('button', { name: 'Inventario', exact: true }), 'Abrir Inventario');
    await t.esperar(() => pagina.getByRole('heading', { name: 'Registrar entrada' }).waitFor(), 'Esperar el formulario');
    await t.escribir(pagina.locator('#entrada-sku'), 'SKU-TEC-007', 'Escribir el SKU');
    await t.escribir(pagina.locator('#entrada-cantidad'), '10', 'Escribir la cantidad');
    await t.clic(pagina.getByRole('button', { name: 'Registrar' }), 'Pulsar Registrar');
    await t.esperar(() => pagina.getByText(/ahora hay \d+ unidades/).waitFor(), 'Esperar la confirmacion');
    await analizar(pagina, 'Administracion: inventario');
    await t.captura('T8-entrada');
    await t.clic(pagina.getByRole('button', { name: 'Pedidos', exact: true }), 'Abrir Pedidos');
    await t.esperar(() => pagina.getByRole('heading', { name: 'Pedidos del sistema' }).waitFor(), 'Esperar la lista');
    t.leer('Encontrar un pedido pagado');
    const boton = pagina.getByRole('button', { name: /^Marcar en preparacion/ }).first();
    const fila = (await boton.locator('xpath=ancestor::tr').locator('td').first().textContent()) ?? '';
    await t.clic(boton, 'Pulsar "Marcar en preparacion"');
    await t.esperar(() => pagina.getByRole('row').filter({ hasText: fila }).getByText('en preparacion').waitFor(), 'Esperar el nuevo estado');
    await analizar(pagina, 'Administracion: pedidos');
    await t.captura('T8-pedido-en-preparacion');
    t.observaciones.push('La tabla de pedidos muestra el id numerico del cliente, no su nombre; los cambios de estado no piden confirmacion.');
  }));

  // T9 (Trabajo Final): el asistente. Una pregunta con opcion rapida y otra
  // escrita, para comparar el costo KLM de las dos formas de interaccion.
  r.push(await ejecutarTarea(pagina, 'T9', 'Preguntar al asistente el costo del envio y el estado del ultimo pedido', 60, async (t) => {
    await t.clic(pagina.getByRole('button', { name: 'Salir' }), 'Cerrar la sesion de administrador');
    await iniciarSesionUI(t, 'ana@correo.co');
    await t.clic(pagina.getByRole('button', { name: '¿Necesitas ayuda?' }), 'Abrir el asistente');
    const panel = pagina.getByRole('dialog', { name: 'Asistente virtual' });
    await t.esperar(() => panel.waitFor(), 'Esperar el panel');
    t.leer('Leer el saludo y las opciones rapidas');
    await t.clic(panel.getByRole('button', { name: 'Costo de envío' }), 'Elegir la opcion "Costo de envio"');
    await t.esperar(() => panel.getByText(/El envío cuesta/).waitFor(), 'Esperar la respuesta del envio');
    t.leer('Leer el costo y el umbral de envio gratis');
    await t.escribir(panel.getByLabel('Escribe tu pregunta'), 'estado de mi ultimo pedido', 'Escribir la pregunta del pedido');
    await t.clic(panel.getByRole('button', { name: 'Enviar' }), 'Pulsar Enviar', { pensar: false });
    await t.esperar(() => panel.getByText(/Tu último pedido/).waitFor(), 'Esperar la respuesta del pedido');
    t.leer('Leer el estado del ultimo pedido');
    await analizar(pagina, 'Asistente virtual');
    await t.captura('T9-asistente');
    const respuesta = (await panel.getByText(/Tu último pedido/).textContent()) ?? '';
    t.observaciones.push(
      /Tu último pedido, PED-\d{6}-\d{6}, está /.test(respuesta)
        ? `El asistente responde con el numero y el estado del ultimo pedido ("${respuesta.slice(0, 70)}...") y lista los mas recientes.`
        : 'La respuesta del pedido no trae el numero y el estado.'
    );
    t.observaciones.push(/[áéíóú]/.test(respuesta) ? 'Los textos del asistente llevan tildes (U-13 corregido).' : 'Los textos del asistente no llevan tildes (hallazgo U-13).');
    await pagina.keyboard.press('Escape');
  }));

  return r;
};

// ---------------------------------------------------------------------------
// Estados especiales (error, vacio, sesion, movil, degradacion)
// ---------------------------------------------------------------------------
interface Estado {
  id: string;
  estado: string;
  resultado: string;
  captura?: string;
}

const estados = async (navegador: Browser): Promise<Estado[]> => {
  const salida: Estado[] = [];
  const nueva = async (opciones = {}) => {
    const contexto = await navegador.newContext({ ...OPCIONES_CONTEXTO, ...opciones });
    return contexto.newPage();
  };
  const foto = async (p: Page, nombre: string) => {
    await p.screenshot({ path: path.join(CAPTURAS, `${nombre}.png`), fullPage: true });
    return `capturas${SUFIJO}/${nombre}.png`;
  };
  const registrar = (e: Estado) => {
    salida.push(e);
    console.log(`  ${e.id} ${e.estado}: ${e.resultado}`);
  };

  // E1. Contrasena incorrecta.
  {
    const p = await nueva();
    await p.goto(URL_WEB);
    await p.getByRole('button', { name: 'Iniciar sesión' }).click();
    if (await esDesplegable(p)) await p.locator('#login-correo').selectOption('bruno@correo.co');
    else await p.locator('#login-correo').fill('bruno@correo.co');
    await p.locator('#login-password').fill('incorrecta');
    await p.getByRole('button', { name: 'Ingresar' }).click();
    const alerta = p.getByRole('alert');
    await alerta.waitFor();
    registrar({ id: 'E1', estado: 'Error de inicio de sesion', resultado: `Mensaje: "${(await alerta.textContent())?.trim()}"`, captura: await foto(p, 'E1-login-error') });
    await analizar(p, 'Inicio de sesion con error');
    await p.context().close();
    await tokenDe('bruno@correo.co'); // un login correcto reinicia el contador de intentos
  }

  // E2. Busqueda sin resultados.
  {
    const p = await nueva();
    await p.goto(URL_WEB);
    await p.locator('#filtro-q').fill('zzzzzz');
    const vacio = p.getByText('No se encontraron productos');
    await vacio.waitFor();
    registrar({ id: 'E2', estado: 'Busqueda sin resultados', resultado: `Mensaje: "${(await vacio.textContent())?.trim()}" sin sugerencias ni opcion para limpiar los filtros`, captura: await foto(p, 'E2-sin-resultados') });
    await p.context().close();
  }

  // E3. Cuantos productos alcanza el visitante navegando.
  {
    const p = await nueva();
    await p.goto(URL_WEB);
    await sinCarga(p);
    const total = (await api('/catalogo/productos?limite=1')).datos.total;
    // SKU distintos que el visitante alcanza navegando, pasando por todas las
    // paginas si hay paginacion.
    const alcanzados = new Set<string>();
    let paginas = 0;
    for (;;) {
      paginas++;
      for (const sku of await p.locator('article p.text-xs.text-gray-500:not(.uppercase)').allTextContents()) alcanzados.add(sku.trim());
      const siguiente = p.getByRole('button', { name: 'Siguiente' });
      if (!(await siguiente.count()) || (await siguiente.isDisabled()) || paginas > 20) break;
      await siguiente.click();
      await sinCarga(p);
    }
    const resumen = (await p.getByText(/^Mostrando/).count()) ? await p.getByText(/^Mostrando/).textContent() : null;
    const faltan = total - alcanzados.size;
    registrar({
      id: 'E3',
      estado: 'Alcance del catalogo',
      resultado: `Navegando se alcanzan ${alcanzados.size} de ${total} productos activos en ${paginas} pagina(s)${resumen ? `; la ultima pagina indica "${resumen.trim()}"` : ''}${faltan > 0 ? `: ${faltan} productos solo se encuentran buscandolos por nombre` : ''}.`,
      captura: await foto(p, 'E3-catalogo-completo')
    });
    await p.context().close();
  }

  // Bruno: carrito vacio, cupon invalido, sesion expirada y error tapado por el modal.
  const bruno = await tokenDe('bruno@correo.co');
  await api(`/carrito/${bruno.usuario.cliente_id}`, { metodo: 'DELETE', token: bruno.token });
  const p = await nueva();
  await p.goto(URL_WEB);
  await p.evaluate((s) => {
    localStorage.setItem('token', s.token);
    localStorage.setItem('refresh_token', s.refresh_token);
    localStorage.setItem('usuario', JSON.stringify(s.usuario));
  }, bruno);
  await p.reload();

  // E4. Carrito vacio.
  await nav(p, /^Carrito/).click();
  await p.getByText('Tu carrito está vacío').waitFor();
  registrar({ id: 'E4', estado: 'Carrito vacio', resultado: 'Mensaje "Tu carrito está vacío." sin enlace para volver al catalogo; el boton Pagar queda deshabilitado mostrando $0.', captura: await foto(p, 'E4-carrito-vacio') });

  // E5. Cupon invalido: ¿donde aparece el error?
  await nav(p, /^Catálogo/).click();
  await sinCarga(p);
  await p.getByRole('button', { name: /^Agregar al carrito/ }).first().click();
  await p.getByRole('status').filter({ hasText: 'agregado' }).first().waitFor();
  await nav(p, /^Carrito/).click();
  await p.locator('#cupon').fill('NOEXISTE');
  await p.getByRole('button', { name: 'Aplicar' }).click();
  const errorCupon = p.getByRole('alert');
  await errorCupon.waitFor();
  const distancia = await p.evaluate(() => {
    const a = document.querySelector('[role="alert"]')!.getBoundingClientRect();
    const c = document.querySelector('#cupon')!.getBoundingClientRect();
    return Math.round(Math.hypot(a.x - c.x, a.y - c.y));
  });
  registrar({ id: 'E5', estado: 'Cupon invalido', resultado: `Mensaje "${(await errorCupon.textContent())?.trim()}", mostrado arriba de la lista de productos, a ${distancia} px del campo del cupon.`, captura: await foto(p, 'E5-cupon-invalido') });

  // E6. Token de acceso expirado con refresh token valido: la renovacion debe ser invisible.
  const secreto = process.env.JWT_SECRET;
  if (secreto) {
    const expirado = jwt.sign({ sub: bruno.usuario.id, email: bruno.usuario.email, rol: 'cliente', cliente_id: bruno.usuario.cliente_id }, secreto, { expiresIn: -60 });
    await p.evaluate((t) => localStorage.setItem('token', t), expirado);
    await nav(p, /^Mis pedidos/).click();
    await p.getByRole('heading', { name: 'Mis pedidos' }).waitFor();
    // Esperar a que la renovacion termine Y quede guardada: si E7 escribe sus
    // tokens antes, la renovacion en curso los sobrescribe con unos validos;
    // si se la interrumpe, el refresh ya rotado queda invalido. (No se usa
    // waitForFunction: la CSP de la web bloquea su evaluacion.)
    for (let i = 0; i < 50 && (await p.evaluate(() => localStorage.getItem('token'))) === expirado; i++) {
      await p.waitForTimeout(200);
    }
    await p.waitForLoadState('networkidle');
    const ok = await p.getByRole('alert').count();
    registrar({ id: 'E6', estado: 'Token expirado durante la navegacion', resultado: ok === 0 ? 'La sesion se renueva sola y la pagina carga sin errores.' : 'Aparece un error en lugar de renovar la sesion.' });

    // E7. Refresh token tambien invalido: ¿que ve el usuario?
    await nav(p, /^Catálogo/).click();
    await p.evaluate((t) => {
      localStorage.setItem('token', t);
      localStorage.setItem('refresh_token', 'invalido.invalido');
    }, expirado);
    await nav(p, /^Mis pedidos/).click();
    // Desde H-F5-02 el aviso es un estado ("Tu sesion expiro"), no un error del formulario.
    const aviso = p.getByText(/Tu sesión expiró|sesión expiró/).first();
    await aviso.waitFor();
    const sigueLogueado = await p.getByRole('button', { name: 'Salir' }).count();
    registrar({ id: 'E7', estado: 'Sesion vencida sin posibilidad de renovar', resultado: `Mensaje "${(await aviso.textContent())?.trim()}"; ${sigueLogueado ? 'la cabecera sigue mostrando la sesion abierta y no lleva al inicio de sesion' : 'se vuelve al inicio de sesion'}.`, captura: await foto(p, 'E7-sesion-vencida') });
  }
  await p.context().close();

  // E8. Error al cancelar mientras el detalle esta abierto: ¿se ve el mensaje?
  {
    const b = await tokenDe('bruno@correo.co');
    await api(`/carrito/${b.usuario.cliente_id}/items`, { metodo: 'POST', token: b.token, cuerpo: { sku: 'SKU-TEC-006', cantidad: 1 } });
    const compra = await api('/pedidos/checkout', { metodo: 'POST', token: b.token, cabeceras: { 'Idempotency-Key': `usabilidad-e8-${Date.now()}` }, cuerpo: { medio_pago: 'tarjeta_credito', token_medio_pago: 'tok_ok_e8' } });
    const pedido = compra.datos?.pedido ?? compra.datos;
    const q = await nueva();
    await q.goto(URL_WEB);
    await q.evaluate((s) => {
      localStorage.setItem('token', s.token);
      localStorage.setItem('refresh_token', s.refresh_token);
      localStorage.setItem('usuario', JSON.stringify(s.usuario));
    }, b);
    await q.reload();
    await nav(q, /^Mis pedidos/).click();
    await q.getByRole('button', { name: new RegExp(`Ver detalle del pedido ${pedido.numero}`) }).click();
    await q.getByRole('dialog').waitFor();
    // Mientras el cliente mira el detalle, el personal despacha el pedido: un
    // pedido enviado ya no se puede cancelar, y el servidor rechazara la accion.
    const admin = await tokenDe('admin@tienda.co');
    for (const estado of ['en_preparacion', 'enviado']) {
      await api(`/pedidos/${pedido.id}/estado`, { metodo: 'PATCH', token: admin.token, cuerpo: { estado } });
    }
    await q.getByRole('button', { name: 'Cancelar pedido' }).click();
    const confirmar = q.getByRole('button', { name: 'Si, cancelar pedido' });
    if (await confirmar.count()) await confirmar.click();
    await q.getByRole('alert').waitFor({ state: 'attached' });
    await q.waitForTimeout(500);
    const visibilidad = await q.evaluate(() => {
      const a = document.querySelector('[role="alert"]');
      if (!a) return 'sin mensaje';
      const r = a.getBoundingClientRect();
      const encima = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      if (!a.contains(encima)) return 'tapado por el velo del modal';
      // Visible, pero ¿completo? El dialogo tiene su propio desplazamiento.
      const marco = (a.closest('[role="dialog"]') ?? document.documentElement).getBoundingClientRect();
      const completo = r.top >= marco.top && r.bottom <= Math.min(marco.bottom, window.innerHeight);
      return completo ? 'visible y completo' : 'visible pero cortado por el borde del dialogo';
    });
    const botonSigue = await q.getByRole('button', { name: 'Cancelar pedido' }).count();
    const estadoActual = (await q.getByRole('dialog').textContent())?.includes('enviado');
    registrar({
      id: 'E8',
      estado: 'Error al cancelar un pedido que ya fue despachado',
      resultado: `Mensaje "${(await q.getByRole('alert').textContent())?.trim()}": ${visibilidad}; ${botonSigue ? 'el boton Cancelar pedido sigue disponible' : 'el boton Cancelar pedido desaparece'}${estadoActual ? ' y el detalle muestra el estado actual (enviado)' : ''}.`,
      captura: await foto(q, 'E8-error-cancelacion')
    });
    await q.context().close();
  }

  // E11. Una cuenta que no estaba en el desplegable original (Carla).
  {
    const c = await nueva();
    await c.goto(URL_WEB);
    await c.getByRole('button', { name: 'Iniciar sesión' }).click();
    let resultado: string;
    if (await esDesplegable(c)) {
      const opciones = await c.locator('#login-correo option').allTextContents();
      resultado = `Imposible: el desplegable solo ofrece ${opciones.length} cuentas y carla@correo.co no esta entre ellas.`;
    } else {
      await c.locator('#login-correo').fill('carla@correo.co');
      await c.locator('#login-password').fill(CLAVE);
      await c.getByRole('button', { name: 'Ingresar' }).click();
      await c.getByRole('button', { name: 'Salir' }).waitFor();
      resultado = `Carla entra escribiendo su correo y su contrasena${(await c.getByText('carla@correo.co').count()) ? '; su correo aparece en la cabecera' : ''}.`;
    }
    registrar({ id: 'E11', estado: 'Ingreso de una cuenta fuera de la lista de prueba (Carla)', resultado, captura: await foto(c, 'E11-ingreso-carla') });
    await c.context().close();
  }

  // E9. Movil (390 x 844).
  {
    const m = await nueva({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await m.goto(URL_WEB);
    await sinCarga(m);
    const desborde = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    registrar({ id: 'E9', estado: 'Catalogo en movil (390 px)', resultado: desborde ? 'Hay desplazamiento horizontal.' : 'Sin desplazamiento horizontal; la grilla pasa a una columna.', captura: await foto(m, 'E9-movil-catalogo') });
    await analizar(m, 'Catalogo en movil');
    await m.context().close();
  }

  // E10. Inventario caido: degradacion visible en el catalogo.
  if (process.env.DEGRADADO === '1') {
    execSync('docker stop ecom_inventario', { stdio: 'ignore' });
    try {
      const d = await nueva();
      await d.goto(URL_WEB);
      await sinCarga(d);
      const sinVerificar = await d.getByText('Disponibilidad no verificada').count();
      registrar({ id: 'E10', estado: 'Inventario caido', resultado: `El catalogo sigue funcionando; ${sinVerificar} productos muestran "Disponibilidad no verificada".`, captura: await foto(d, 'E10-inventario-caido') });
      await d.context().close();
    } finally {
      execSync('docker start ecom_inventario', { stdio: 'ignore' });
    }
  }

  return salida;
};

// ---------------------------------------------------------------------------
const principal = async (): Promise<void> => {
  mkdirSync(CAPTURAS, { recursive: true });

  // Datos de partida: el carrito de Ana vacio y SKU-TEC-007 bajo el minimo.
  const ana = await tokenDe('ana@correo.co');
  if (!ana?.token) throw new Error('No se pudo iniciar sesion como Ana: ¿esta el sistema levantado?');
  await api(`/carrito/${ana.usuario.cliente_id}`, { metodo: 'DELETE', token: ana.token });

  // T8 necesita al menos un pedido pagado (test:http borra los pedidos): Bruno
  // compra uno por la API.
  const bruno = await tokenDe('bruno@correo.co');
  await api(`/carrito/${bruno.usuario.cliente_id}`, { metodo: 'DELETE', token: bruno.token });
  await api(`/carrito/${bruno.usuario.cliente_id}/items`, { metodo: 'POST', token: bruno.token, cuerpo: { sku: 'SKU-TEC-009', cantidad: 1 } });
  const previa = await api('/pedidos/checkout', {
    metodo: 'POST',
    token: bruno.token,
    cabeceras: { 'Idempotency-Key': `usabilidad-t8-${Date.now()}` },
    cuerpo: { medio_pago: 'tarjeta_credito', token_medio_pago: 'tok_ok_t8' }
  });
  if (previa.estado !== 201) throw new Error(`No se pudo preparar el pedido pagado para T8: ${previa.estado}`);

  const navegador = await chromium.launch(PROXY ? { proxy: { server: PROXY } } : {});
  const contexto = await navegador.newContext({ ...OPCIONES_CONTEXTO, viewport: { width: 1280, height: 800 } });
  const pagina = await contexto.newPage();

  console.log(`Recorrido de las tareas en ${URL_WEB}${PROXY ? ` a traves de ${PROXY}` : ''}`);
  const resultados = await tareas(pagina);
  await contexto.close();

  let especiales: Estado[] = [];
  if (COMPLETO) {
    console.log('\nEstados especiales');
    especiales = await estados(navegador);
  }
  await navegador.close();

  process.exitCode = resultados.every((t) => t.exito) ? 0 : 1;
  if (!COMPLETO) return;

  const informe = {
    fecha: new Date().toISOString(),
    web: URL_WEB,
    navegador: 'Chromium (Playwright 1.48.2), 1280 x 800',
    klm: { operadores_s: KLM, fuente: 'Card, Moran y Newell (1983); Kieras (2001)' },
    tareas: resultados,
    estados: especiales
  };
  writeFileSync(path.join(SALIDA, `recorrido${SUFIJO}.json`), JSON.stringify(informe, null, 2));
  writeFileSync(path.join(SALIDA, `accesibilidad-axe${SUFIJO}.json`), JSON.stringify({ fecha: informe.fecha, estandar: 'WCAG 2.2 A y AA (axe-core 4.10)', pantallas: accesibilidad }, null, 2));

  console.log('\nKLM por tarea (usuario experto + respuesta del sistema)');
  for (const t of resultados) {
    console.log(`  ${t.id} ${t.exito ? '✓' : '✗'} ${String(t.klm_total_s).padStart(5)} s  (usuario ${t.klm_usuario_s} s + sistema ${t.r_sistema_s} s; esperado ${t.tiempo_esperado_s} s)  ${t.conteo.M}M ${t.conteo.P}P ${t.conteo.B}B ${t.conteo.K}K ${t.conteo.H}H`);
  }
  const totalViolaciones = accesibilidad.reduce((s, p) => s + p.violaciones.length, 0);
  console.log(`\naxe: ${accesibilidad.length} pantallas, ${totalViolaciones} reglas WCAG incumplidas en total`);
  for (const p of accesibilidad) for (const v of p.violaciones) console.log(`  ${p.pantalla}: ${v.id} (${v.impacto}, ${v.nodos} nodos)`);
  console.log(`\nEvidencia en ${path.relative(RAIZ, SALIDA)}`);
  process.exitCode = resultados.every((t) => t.exito) ? 0 : 1;
};

principal().catch((error) => {
  console.error(error);
  process.exit(2);
});
