/**
 * Accesibilidad de las vistas de F5e: axe-core (WCAG 2.2 A y AA) en los temas
 * claro y oscuro sobre los errores junto al campo (proveedor nuevo, datos
 * personales y registro), el asistente en modo demostracion del personal y la
 * invitacion a iniciar sesion del visitante que pide un asesor.
 *
 *   npx tsx --env-file-if-exists=.env tests/usabilidad/axe-f5e.ts
 *   URL_WEB=http://localhost:8081 (por defecto)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { Browser, chromium, Page } from 'playwright';

const WEB = (process.env.URL_WEB || 'http://localhost:8081').replace(/\/$/, '');
const SALIDA = path.resolve(__dirname, '../../docs/evidencia/trabajo-final/regresion-f5e/axe-f5e.json');

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

const chat = async (p: Page) => {
  await p.getByRole('button', { name: '¿Necesitas ayuda?' }).click();
  return p.getByRole('dialog', { name: 'Asistente virtual' });
};

(async () => {
  mkdirSync(path.dirname(SALIDA), { recursive: true });
  const navegador = await chromium.launch();
  console.log(`axe de las vistas F5e contra ${WEB}`);
  for (const tema of ['light', 'dark'] as const) {
    const nombreTema = tema === 'light' ? 'claro' : 'oscuro';

    // Visitante: pide un asesor y se le invita a iniciar sesion; registro con un correo invalido.
    const vis = await abrir(navegador, tema);
    const panelVisitante = await chat(vis.p);
    await panelVisitante.getByRole('button', { name: 'Hablar con un asesor' }).click();
    await panelVisitante.getByText(/necesitas iniciar sesión/).waitFor();
    await analizar(vis.p, nombreTema, 'Asistente: el visitante que pide un asesor');
    await vis.p.getByRole('button', { name: 'Cerrar el asistente' }).click();
    await vis.p.getByRole('button', { name: 'Iniciar sesión' }).click();
    await vis.p.getByRole('button', { name: 'Crear cuenta' }).click();
    await vis.p.getByLabel('Correo').fill('ana@correo');
    await vis.p.getByLabel('Apellido').click();
    await vis.p.getByText(/Revisa el correo/).waitFor();
    await analizar(vis.p, nombreTema, 'Registro con el correo incompleto');
    await vis.contexto.close();

    // Administrador: proveedor nuevo con errores y asistente en modo demostracion.
    const admin = await abrir(navegador, tema);
    const a = admin.p;
    await entrar(a, 'admin@tienda.co');
    await a.getByRole('navigation', { name: 'Secciones de administración' }).getByRole('button', { name: 'Inventario', exact: true }).click();
    await a.getByRole('button', { name: 'Nuevo proveedor' }).click();
    await a.getByRole('button', { name: 'Crear proveedor' }).click();
    await a.locator('#prov-nuevo-telefono').fill('601abc');
    await a.locator('#prov-nuevo-email').fill('compras-proveedor.com');
    await a.locator('#prov-nuevo-nombre').focus();
    await a.getByText(/debe tener una @/).waitFor();
    await analizar(a, nombreTema, 'Proveedor nuevo con errores junto a cada campo');
    const panelAdmin = await chat(a);
    await panelAdmin.getByRole('button', { name: 'Ofertas' }).click();
    await panelAdmin.getByText('Solo clientes: aquí no se agrega al carrito').first().waitFor();
    await analizar(a, nombreTema, 'Asistente en modo demostración (administrador)');
    await admin.contexto.close();

    // Cliente: datos personales con un telefono y un documento invalidos.
    const cli = await abrir(navegador, tema);
    const c = cli.p;
    await entrar(c, 'ana@correo.co');
    await c.getByRole('navigation', { name: 'Principal' }).getByRole('button', { name: /^Mi perfil/ }).click();
    await c.getByLabel('Teléfono').fill('30');
    await c.getByLabel('Número de documento').fill('12');
    await c.getByRole('button', { name: 'Guardar datos' }).click();
    await c.getByText(/de 7 a 20 caracteres/).waitFor();
    await analizar(c, nombreTema, 'Mi perfil con errores junto al campo');
    await cli.contexto.close();
  }

  const total = resultados.reduce((s, r) => s + r.violaciones.length, 0);
  writeFileSync(SALIDA, JSON.stringify({ fecha: new Date().toISOString(), web: WEB, estandar: 'WCAG 2.2 A y AA', total, resultados }, null, 2));
  console.log(`\naxe F5e: ${resultados.length} pantallas (claro y oscuro), ${total} reglas incumplidas.`);
  await navegador.close();
  process.exit(total ? 1 : 0);
})();
