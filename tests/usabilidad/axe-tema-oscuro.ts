/**
 * Accesibilidad del tema oscuro (F5b, RF-44): axe-core (WCAG 2.2 A y AA) sobre
 * las pantallas principales con el modo oscuro activo. El recorrido completo
 * (usabilidad:recorrido) mide el tema claro.
 *
 *   npx tsx --env-file-if-exists=.env tests/usabilidad/axe-tema-oscuro.ts
 *   URL_WEB=http://localhost:8081 (por defecto)
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { chromium, Page } from 'playwright';

const WEB = (process.env.URL_WEB || 'http://localhost:8081').replace(/\/$/, '');
const SALIDA = path.resolve(__dirname, '../../docs/evidencia/trabajo-final/regresion-f5b/axe-tema-oscuro.json');

interface Resultado {
  pantalla: string;
  violaciones: Array<{ regla: string; impacto: string | null; nodos: number; ejemplo: string }>;
}

const analizar = async (p: Page, pantalla: string, resultados: Resultado[]) => {
  await p.waitForTimeout(500);
  const r = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  resultados.push({
    pantalla,
    violaciones: r.violations.map((v) => ({ regla: v.id, impacto: v.impact ?? null, nodos: v.nodes.length, ejemplo: v.nodes[0]?.target.join(' ') ?? '' }))
  });
  console.log(`  ${r.violations.length ? 'X' : 'ok'}  ${pantalla}${r.violations.length ? ': ' + r.violations.map((v) => `${v.id} (${v.nodes.length})`).join(', ') : ''}`);
};

(async () => {
  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: 'dark', locale: 'es-CO' });
  const p = await contexto.newPage();
  p.setDefaultTimeout(20_000);
  const resultados: Resultado[] = [];
  const nav = (nombre: RegExp) => p.getByRole('navigation', { name: 'Principal' }).getByRole('button', { name: nombre });

  console.log(`axe en tema oscuro contra ${WEB}`);
  await p.goto(WEB, { waitUntil: 'domcontentloaded' });
  await p.locator('article').first().waitFor();
  if (!(await p.evaluate(() => document.documentElement.classList.contains('dark')))) await p.getByRole('button', { name: 'Modo oscuro' }).click();
  await analizar(p, 'Catálogo (visitante)', resultados);

  await p.getByRole('button', { name: 'Iniciar sesión' }).click();
  await analizar(p, 'Iniciar sesión', resultados);
  await p.getByRole('button', { name: 'Crear cuenta' }).click();
  await analizar(p, 'Crear cuenta', resultados);
  await p.getByRole('button', { name: 'Iniciar sesión', exact: true }).last().click();

  await p.getByLabel('Correo').fill('ana@correo.co');
  await p.getByLabel('Contraseña', { exact: true }).fill('Password123');
  await p.getByRole('button', { name: 'Ingresar' }).click();
  await p.getByRole('button', { name: 'Salir' }).waitFor();
  await p.locator('article').first().getByRole('button', { name: /Agregar al carrito/ }).click();
  await nav(/^Carrito/).click();
  await p.getByRole('heading', { name: 'Tu carrito' }).waitFor();
  await p.getByText('Dirección de envío').waitFor();
  await analizar(p, 'Carrito', resultados);
  await nav(/^Mis pedidos/).click();
  await p.getByRole('heading', { name: 'Mis pedidos' }).waitFor();
  await analizar(p, 'Mis pedidos', resultados);
  await nav(/^Mi perfil/).click();
  await p.getByText('Eliminar cuenta').first().waitFor();
  await analizar(p, 'Mi perfil', resultados);
  await p.getByRole('button', { name: '¿Necesitas ayuda?' }).click();
  const panel = p.getByRole('dialog', { name: 'Asistente virtual' });
  await panel.getByLabel('Escribe tu pregunta').fill('Hay audífonos disponibles?');
  await panel.getByRole('button', { name: 'Enviar' }).click();
  await panel.getByText(/Sí, tenemos/).waitFor();
  await analizar(p, 'Asistente', resultados);

  const total = resultados.reduce((s, r) => s + r.violaciones.length, 0);
  writeFileSync(SALIDA, JSON.stringify({ fecha: new Date().toISOString(), web: WEB, tema: 'oscuro', estandar: 'WCAG 2.2 A y AA', total, resultados }, null, 2));
  console.log(`\naxe (tema oscuro): ${resultados.length} pantallas, ${total} reglas incumplidas.`);
  await navegador.close();
  process.exit(total ? 1 : 0);
})();
