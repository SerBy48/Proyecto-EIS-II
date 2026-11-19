/**
 * Capturas REALES del manual de usuario (Trabajo Final, Fase 5): recorre la
 * web como visitante, cliente, vendedor y administrador y guarda una imagen
 * por pantalla en docs/manuales/img/.
 *
 *   npx tsx --env-file-if-exists=.env scripts/capturas/manual-usuario.ts
 *   URL_WEB=http://localhost:8081 (por defecto)
 *
 * Requiere la web en modo pruebas (selector de la pasarela) y deja datos de
 * prueba: una cuenta nueva, un pedido pagado y otro cancelado.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium, Page } from 'playwright';

const WEB = (process.env.URL_WEB || 'http://localhost:8081').replace(/\/$/, '');
const MAILPIT = process.env.MAILPIT_URL || 'http://localhost:8025';
const CLAVE = 'Password123';
const SALIDA = path.resolve(__dirname, '../../docs/manuales/img');

const nav = (p: Page, nombre: RegExp) => p.getByRole('navigation', { name: 'Principal' }).getByRole('button', { name: nombre });

const foto = async (p: Page, nombre: string, completa = false) => {
  await p.waitForTimeout(300); // transiciones de Tailwind
  await p.screenshot({ path: path.join(SALIDA, `${nombre}.png`), fullPage: completa });
  console.log(`  ${nombre}.png`);
};

const entrar = async (p: Page, correo: string) => {
  await p.goto(WEB, { waitUntil: 'domcontentloaded' });
  await p.getByRole('button', { name: 'Iniciar sesión' }).click();
  await p.getByLabel('Correo').fill(correo);
  await p.getByLabel('Contraseña', { exact: true }).fill(CLAVE);
  await p.getByRole('button', { name: 'Ingresar' }).click();
  await p.getByRole('button', { name: 'Salir' }).waitFor();
};

const principal = async (): Promise<void> => {
  mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch();
  const nuevaPagina = async () => {
    const contexto = await navegador.newContext({ viewport: { width: 1280, height: 800 }, locale: 'es-CO' });
    const p = await contexto.newPage();
    p.setDefaultTimeout(20_000);
    return p;
  };
  console.log(`Capturas del manual desde ${WEB}`);

  // ------------------------------------------------------------ visitante
  let p = await nuevaPagina();
  await p.goto(WEB, { waitUntil: 'domcontentloaded' });
  await p.locator('article').first().waitFor();
  await foto(p, '01-catalogo');
  await p.getByRole('button', { name: 'Iniciar sesión' }).click();
  await foto(p, '02-iniciar-sesion');
  await p.getByRole('button', { name: 'Crear cuenta' }).click();
  await p.getByLabel('Nombre', { exact: true }).fill('Valentina');
  await p.getByLabel('Apellido').fill('Rojas');
  await p.getByLabel('Correo').fill(`manual-${Date.now()}@correo.co`);
  await p.locator('#registro-password').fill(CLAVE);
  await p.getByLabel('Dirección', { exact: true }).fill('Calle 10 # 5-20');
  await p.getByLabel('Departamento').selectOption('Huila');
  await p.getByLabel('Ciudad o municipio').fill('Neiva');
  await foto(p, '03-registro', true);
  await p.getByRole('button', { name: 'Crear cuenta' }).click();
  await p.getByRole('button', { name: 'Salir' }).waitFor();
  await p.context().close();

  // -------------------------------------------------------------- cliente
  p = await nuevaPagina();
  await entrar(p, 'ana@correo.co');
  // Carrito vacio para empezar.
  await nav(p, /^Carrito/).click();
  while (await p.getByRole('button', { name: /^Quitar/ }).count()) {
    await p.getByRole('button', { name: /^Quitar/ }).first().click();
    await p.waitForTimeout(400);
  }
  await nav(p, /^Catálogo/).click();
  await p.locator('#filtro-q').fill('mouse');
  await p.locator('article h2', { hasText: /mouse inal/i }).first().waitFor();
  await p.locator('article', { hasText: /mouse inal/i }).first().getByRole('button', { name: /^Agregar al carrito/ }).click();
  await p.getByRole('status').filter({ hasText: 'agregado al carrito' }).waitFor();
  await foto(p, '04-buscar-y-agregar');
  await nav(p, /^Carrito/).click();
  await p.getByRole('heading', { name: 'Tu carrito' }).waitFor();
  await p.locator('#cupon').fill('BIENVENIDA10');
  await p.getByRole('button', { name: 'Aplicar' }).click();
  await p.getByText(/^Descuento/).waitFor();
  await foto(p, '05-carrito-y-cupon', true);
  await p.getByRole('button', { name: /^Pagar/ }).click();
  await p.getByRole('heading', { name: 'Compra confirmada' }).waitFor({ timeout: 25_000 });
  const numero = ((await p.locator('strong').first().textContent()) ?? '').trim();
  await foto(p, '06-compra-confirmada');
  await nav(p, /^Mis pedidos/).click();
  await p.getByRole('button', { name: new RegExp(`Ver detalle del pedido ${numero}`) }).click();
  await p.getByRole('button', { name: 'Cancelar pedido' }).waitFor();
  await foto(p, '07-mis-pedidos', true);
  // Cambiar la direccion de un pedido pagado (hasta 2 veces).
  await p.getByRole('button', { name: /Cambiar dirección/ }).click();
  await p.getByText('Nueva dirección de envío').waitFor();
  await p.getByRole('dialog').screenshot({ path: path.join(SALIDA, '16-cambiar-direccion.png') });
  console.log('  16-cambiar-direccion.png');
  await p.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await p.getByRole('button', { name: 'Cancelar pedido' }).click();
  await p.getByRole('button', { name: 'Si, cancelar pedido' }).waitFor();
  await foto(p, '08-cancelar-pedido');
  await p.getByRole('button', { name: 'Si, cancelar pedido' }).click();
  await p.getByRole('row').filter({ hasText: numero }).getByText('cancelado').waitFor();

  await p.getByRole('button', { name: '¿Necesitas ayuda?' }).click();
  const panel = p.getByRole('dialog', { name: 'Asistente virtual' });
  await panel.getByRole('button', { name: 'Costo de envío' }).click();
  await panel.getByText(/El envío cuesta/).waitFor();
  await panel.getByLabel('Escribe tu pregunta').fill(`estado del pedido ${numero}`);
  await panel.getByRole('button', { name: 'Enviar' }).click();
  await panel.getByText(new RegExp(`Tu pedido ${numero} está`)).waitFor();
  await panel.getByLabel('Escribe tu pregunta').fill('Hay audífonos disponibles?');
  await panel.getByRole('button', { name: 'Enviar' }).click();
  await panel.getByText(/Sí, tenemos/).waitFor();
  await foto(p, '09-asistente');
  await p.getByRole('button', { name: 'Cerrar asistente' }).click();

  // Mi perfil: datos, direcciones y eliminar la cuenta.
  await nav(p, /^Mi perfil/).click();
  await p.getByRole('heading', { name: 'Mi perfil' }).waitFor();
  await p.getByText('Eliminar cuenta').first().waitFor();
  await p.waitForTimeout(600);
  await foto(p, '15-perfil', true);
  await p.context().close();

  // Modo oscuro (se recuerda en el navegador).
  p = await nuevaPagina();
  await p.goto(WEB, { waitUntil: 'domcontentloaded' });
  await p.locator('article').first().waitFor();
  await p.getByRole('button', { name: 'Modo oscuro' }).click();
  await foto(p, '17-modo-oscuro');
  await p.context().close();

  // Correo de la compra en Mailpit (la interfaz solo escucha en 127.0.0.1).
  p = await nuevaPagina();
  await p.goto(MAILPIT, { waitUntil: 'domcontentloaded' });
  await p.getByText(`Tu pedido ${numero} fue confirmado`).first().click();
  await p.waitForTimeout(800);
  await foto(p, '10-correo');
  await p.context().close();

  // ------------------------------------------------------------- vendedor
  p = await nuevaPagina();
  await entrar(p, 'vendedor@tienda.co');
  await p.getByRole('navigation', { name: 'Secciones de administración' }).waitFor();
  await p.getByRole('button', { name: 'Inventario', exact: true }).click();
  await p.locator('#entrada-sku').fill('SKU-TEC-007');
  await p.locator('#entrada-cantidad').fill('5');
  await p.getByRole('button', { name: 'Registrar' }).click();
  await p.getByText(/ahora hay \d+ unidades/).waitFor();
  await foto(p, '11-vendedor-inventario', true);
  // F5c: pestaña Productos con el editor abierto (precio, oferta y fotos).
  await p.getByRole('navigation', { name: 'Secciones de administración' }).getByRole('button', { name: 'Productos', exact: true }).click();
  await p.getByLabel('Buscar').fill('SKU-TEC-002');
  await p.getByRole('button', { name: /^Editar Audífonos Sony/ }).click();
  await p.getByRole('heading', { name: /^Historial de precios/ }).waitFor();
  await foto(p, '19-productos');
  await p.context().close();

  // -------------------------------------------------------- administrador
  p = await nuevaPagina();
  await entrar(p, 'admin@tienda.co');
  await p.getByRole('navigation', { name: 'Secciones de administración' }).waitFor();
  await p.getByRole('heading', { name: 'Cómo leer esta vista' }).waitFor();
  await foto(p, '12-admin-salud', true);
  await p.getByRole('button', { name: 'Pedidos', exact: true }).click();
  await p.getByRole('heading', { name: 'Pedidos del sistema' }).waitFor();
  // F5d: el detalle del pedido con la linea de tiempo de sus estados.
  await p.getByRole('button', { name: new RegExp(`Detalle del pedido ${numero}`) }).click();
  const detalle = p.getByRole('region', { name: `Pedido ${numero}` });
  await detalle.getByText('Historial de estados').waitFor();
  // La tabla tiene todos los pedidos de las pruebas: se recortan la cabecera y el detalle.
  await foto(p, '13a-admin-pedidos');
  await detalle.screenshot({ path: path.join(SALIDA, '13b-admin-detalle-pedido.png') });
  console.log('  13b-admin-detalle-pedido.png');
  await p.getByRole('navigation', { name: 'Secciones de administración' }).getByRole('button', { name: 'Notificaciones', exact: true }).click();
  await p.getByRole('heading', { name: /^Notificaciones/ }).waitFor();
  await foto(p, '14-admin-notificaciones');
  await p.getByRole('navigation', { name: 'Secciones de administración' }).getByRole('button', { name: 'Usuarios' }).click();
  await p.getByRole('heading', { name: 'Crear cuenta interna' }).waitFor();
  await p.locator('#usuario-correo').fill('nuevo.vendedor@serbytek.co');
  await foto(p, '18-admin-usuarios', true);

  await navegador.close();
  console.log(`Listo: ${path.relative(process.cwd(), SALIDA)}`);
};

principal().catch((error) => {
  console.error(error);
  process.exit(1);
});
