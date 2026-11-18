/**
 * Accesibilidad de las vistas de F5c (RF-47 a RF-53): axe-core (WCAG 2.2 A y
 * AA) en los temas claro y oscuro sobre la pestaña Productos (con el editor
 * abierto), Inventario (entrada y proveedores), Consultas, la campana abierta,
 * Mi perfil > Mis consultas, el formulario de consulta del chat y el carrito
 * con el limite por cliente.
 *
 *   npx tsx --env-file-if-exists=.env tests/usabilidad/axe-f5c.ts
 *   URL_WEB=http://localhost:8081 (por defecto)
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { Browser, chromium, Page } from 'playwright';

const WEB = (process.env.URL_WEB || 'http://localhost:8081').replace(/\/$/, '');
const SALIDA = path.resolve(__dirname, '../../docs/evidencia/trabajo-final/regresion-f5c/axe-f5c.json');

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

const entrar = async (navegador: Browser, tema: 'light' | 'dark', correo: string) => {
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: tema, locale: 'es-CO' });
  const p = await contexto.newPage();
  p.setDefaultTimeout(20_000);
  await p.goto(WEB, { waitUntil: 'domcontentloaded' });
  const oscuro = await p.evaluate(() => document.documentElement.classList.contains('dark'));
  if ((tema === 'dark') !== oscuro) await p.getByRole('button', { name: 'Modo oscuro' }).click();
  await p.getByRole('button', { name: 'Iniciar sesión' }).click();
  await p.getByLabel('Correo').fill(correo);
  await p.getByLabel('Contraseña', { exact: true }).fill('Password123');
  await p.getByRole('button', { name: 'Ingresar' }).click();
  await p.getByRole('button', { name: 'Salir' }).waitFor();
  return { p, contexto };
};

(async () => {
  const navegador = await chromium.launch();
  console.log(`axe de las vistas F5c contra ${WEB}`);
  for (const tema of ['light', 'dark'] as const) {
    const nombreTema = tema === 'light' ? 'claro' : 'oscuro';

    // Personal interno.
    const { p, contexto } = await entrar(navegador, tema, 'vendedor@tienda.co');
    const pestana = (n: string) => p.getByRole('navigation', { name: 'Secciones de administración' }).getByRole('button', { name: n, exact: true });
    await pestana('Productos').click();
    await p.getByRole('table').getByRole('row').nth(1).waitFor();
    await analizar(p, nombreTema, 'Productos (lista)');
    await p.getByRole('button', { name: /^Editar / }).first().click();
    await p.getByRole('heading', { name: /^Historial de precios/ }).waitFor();
    await analizar(p, nombreTema, 'Productos (editar)');
    await p.getByRole('button', { name: 'Nuevo producto' }).click();
    await analizar(p, nombreTema, 'Productos (nuevo)');
    await pestana('Inventario').click();
    await p.getByRole('heading', { name: 'Proveedores' }).waitFor();
    await p.getByRole('button', { name: '+ Proveedor nuevo' }).click();
    await analizar(p, nombreTema, 'Inventario (entrada, historial y proveedores)');
    await pestana('Consultas').click();
    await p.getByRole('heading', { name: 'Consultas de clientes' }).waitFor();
    await p.getByRole('combobox').first().selectOption('');
    const primera = p.getByRole('list').getByRole('button').first();
    if (await primera.count()) await primera.click();
    await analizar(p, nombreTema, 'Consultas (personal)');
    await p.getByRole('banner').getByRole('button', { name: /^Notificaciones/ }).click();
    await p.getByRole('region', { name: 'Notificaciones' }).waitFor();
    await analizar(p, nombreTema, 'Campana abierta (personal)');
    await contexto.close();

    // Cliente.
    const cliente = await entrar(navegador, tema, 'ana@correo.co');
    const q = cliente.p;
    await q.locator('article').first().waitFor();
    await analizar(q, nombreTema, 'Catálogo con disponibles y máximo por cliente');
    await q.locator('article').first().getByRole('button', { name: /Agregar al carrito/ }).click();
    await q.getByRole('navigation', { name: 'Principal' }).getByRole('button', { name: /^Carrito/ }).click();
    await q.getByText(/Puedes llevar hasta|máximo/).first().waitFor();
    await analizar(q, nombreTema, 'Carrito con límite por cliente');
    await q.getByRole('navigation', { name: 'Principal' }).getByRole('button', { name: /^Mi perfil/ }).click();
    await q.getByRole('button', { name: 'Mis consultas' }).click();
    await q.getByRole('heading', { name: 'Mis consultas', level: 2 }).waitFor();
    await analizar(q, nombreTema, 'Mi perfil > Mis consultas');
    await q.getByRole('button', { name: '¿Necesitas ayuda?' }).click();
    const panel = q.getByRole('dialog', { name: 'Asistente virtual' });
    await panel.getByLabel('Escribe tu pregunta').fill('quiero contactar al vendedor');
    await panel.getByRole('button', { name: 'Enviar' }).click();
    await panel.getByRole('form', { name: 'Consulta al vendedor' }).waitFor();
    await analizar(q, nombreTema, 'Asistente: formulario de consulta');
    await cliente.contexto.close();
  }

  const total = resultados.reduce((s, r) => s + r.violaciones.length, 0);
  writeFileSync(SALIDA, JSON.stringify({ fecha: new Date().toISOString(), web: WEB, estandar: 'WCAG 2.2 A y AA', total, resultados }, null, 2));
  console.log(`\naxe F5c: ${resultados.length} pantallas (claro y oscuro), ${total} reglas incumplidas.`);
  await navegador.close();
  process.exit(total ? 1 : 0);
})();
