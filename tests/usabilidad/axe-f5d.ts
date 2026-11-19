/**
 * Accesibilidad de las vistas de F5d: axe-core (WCAG 2.2 A y AA) en los temas
 * claro y oscuro sobre la salud del sistema (administrador), el detalle de un
 * pedido con su historial de estados, la vista completa de notificaciones
 * (personal y cliente), el catalogo en vista previa del vendedor, el inicio de
 * sesion tras salir y las dos pantallas de recuperacion de contrasena.
 *
 *   npx tsx --env-file-if-exists=.env tests/usabilidad/axe-f5d.ts
 *   URL_WEB=http://localhost:8081 (por defecto)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { Browser, chromium, Page } from 'playwright';

const WEB = (process.env.URL_WEB || 'http://localhost:8081').replace(/\/$/, '');
const SALIDA = path.resolve(__dirname, '../../docs/evidencia/trabajo-final/regresion-f5d/axe-f5d.json');

interface Resultado {
  tema: string;
  pantalla: string;
  violaciones: Array<{ regla: string; impacto: string | null; nodos: number; ejemplo: string }>;
}
const resultados: Resultado[] = [];

const analizar = async (p: Page, tema: string, pantalla: string) => {
  await p.waitForTimeout(500);
  const r = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  resultados.push({
    tema,
    pantalla,
    violaciones: r.violations.map((v) => ({ regla: v.id, impacto: v.impact ?? null, nodos: v.nodes.length, ejemplo: v.nodes[0]?.target.join(' ') ?? '' }))
  });
  console.log(`  ${r.violations.length ? 'X' : 'ok'}  [${tema}] ${pantalla}${r.violations.length ? ': ' + r.violations.map((v) => `${v.id} (${v.nodes.length}) ${v.nodes[0]?.target.join(' ')}`).join(', ') : ''}`);
};

const abrir = async (navegador: Browser, tema: 'light' | 'dark') => {
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: tema, locale: 'es-CO' });
  const p = await contexto.newPage();
  p.setDefaultTimeout(20_000);
  await p.goto(WEB, { waitUntil: 'domcontentloaded' });
  const oscuro = await p.evaluate(() => document.documentElement.classList.contains('dark'));
  if ((tema === 'dark') !== oscuro) await p.getByRole('button', { name: 'Modo oscuro' }).click();
  return { p, contexto };
};

const entrar = async (p: Page, correo: string) => {
  await p.getByRole('button', { name: 'Iniciar sesión' }).click();
  await p.getByLabel('Correo').fill(correo);
  await p.getByLabel('Contraseña', { exact: true }).fill('Password123');
  await p.getByRole('button', { name: 'Ingresar' }).click();
  await p.getByRole('button', { name: 'Salir' }).waitFor();
};

(async () => {
  mkdirSync(path.dirname(SALIDA), { recursive: true });
  const navegador = await chromium.launch();
  console.log(`axe de las vistas F5d contra ${WEB}`);
  for (const tema of ['light', 'dark'] as const) {
    const nombreTema = tema === 'light' ? 'claro' : 'oscuro';

    // Administrador: salud, pedidos y notificaciones.
    const admin = await abrir(navegador, tema);
    const a = admin.p;
    await entrar(a, 'admin@tienda.co');
    await a.getByRole('heading', { name: 'Cómo leer esta vista' }).waitFor();
    await a.getByRole('button', { name: /^Qué hacer si falla/ }).first().click();
    await analizar(a, nombreTema, 'Salud del sistema (con "qué hacer" abierto)');
    const pestana = (n: string) => a.getByRole('navigation', { name: 'Secciones de administración' }).getByRole('button', { name: n, exact: true });
    await pestana('Pedidos').click();
    await a.getByRole('heading', { name: 'Pedidos del sistema' }).waitFor();
    const detalle = a.getByRole('button', { name: /^Detalle del pedido/ }).first();
    if (await detalle.count()) {
      await detalle.click();
      await a.getByText('Historial de estados').waitFor();
    }
    await analizar(a, nombreTema, 'Pedidos con el detalle y el historial de estados');
    await pestana('Notificaciones').click();
    await a.getByRole('heading', { name: /^Notificaciones/ }).waitFor();
    await analizar(a, nombreTema, 'Notificaciones del personal (bandeja)');
    await a.getByRole('button', { name: 'Registro de envíos' }).click();
    await a.getByRole('heading', { name: 'Registro de envíos' }).waitFor();
    await analizar(a, nombreTema, 'Registro de envíos (administrador)');
    await admin.contexto.close();

    // Vendedor: catalogo en vista previa.
    const vend = await abrir(navegador, tema);
    await entrar(vend.p, 'vendedor@tienda.co');
    await vend.p.getByRole('navigation', { name: 'Principal' }).getByRole('button', { name: /^Catálogo/ }).click();
    await vend.p.getByRole('heading', { name: 'Vista previa: así ven la tienda los clientes' }).waitFor();
    await vend.p.locator('article').first().waitFor();
    await analizar(vend.p, nombreTema, 'Catálogo en vista previa (vendedor)');
    await vend.contexto.close();

    // Cliente: notificaciones en Mi perfil y salida.
    const cli = await abrir(navegador, tema);
    const c = cli.p;
    await entrar(c, 'ana@correo.co');
    await c.getByRole('navigation', { name: 'Principal' }).getByRole('button', { name: /^Mi perfil/ }).click();
    await c.getByRole('button', { name: 'Notificaciones', exact: true }).click();
    await c.getByRole('heading', { name: /^Notificaciones/ }).waitFor();
    await analizar(c, nombreTema, 'Mi perfil > Notificaciones');
    await c.getByRole('button', { name: 'Salir' }).click();
    await c.getByText('Cerraste sesión.').waitFor();
    await analizar(c, nombreTema, 'Inicio de sesión después de salir');
    await c.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click();
    await c.getByRole('heading', { name: 'Recuperar la contraseña' }).waitFor();
    await analizar(c, nombreTema, 'Recuperar la contraseña');
    // Un token con el formato correcto: la pantalla se muestra igual (el servidor lo valida al guardar).
    await c.goto(`${WEB}/#restablecer=${'0'.repeat(64)}`, { waitUntil: 'domcontentloaded' });
    await c.reload({ waitUntil: 'domcontentloaded' });
    await c.getByRole('heading', { name: 'Crea una contraseña nueva' }).waitFor();
    await analizar(c, nombreTema, 'Crear la contraseña nueva');
    await cli.contexto.close();
  }

  const total = resultados.reduce((s, r) => s + r.violaciones.length, 0);
  writeFileSync(SALIDA, JSON.stringify({ fecha: new Date().toISOString(), web: WEB, estandar: 'WCAG 2.2 A y AA', total, resultados }, null, 2));
  console.log(`\naxe F5d: ${resultados.length} pantallas (claro y oscuro), ${total} reglas incumplidas.`);
  await navegador.close();
  process.exit(total ? 1 : 0);
})();
