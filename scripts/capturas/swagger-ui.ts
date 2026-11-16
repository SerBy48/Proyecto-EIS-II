/**
 * Captura de Swagger UI y comprobacion de que funciona con su CSP: carga la
 * pagina en Chromium, cuenta etiquetas y operaciones e informa los errores de
 * consola (una violacion de CSP aparece ahi).
 *
 *   npx tsx scripts/capturas/swagger-ui.ts docs/evidencia/trabajo-final/swagger-ui.png
 */
import { chromium } from 'playwright';

const principal = async (): Promise<void> => {
  const salida = process.argv[2] ?? 'swagger-ui.png';
  const url = process.env.URL_DOCS || 'http://localhost:8080/api/docs/';

  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
  const errores: string[] = [];
  pagina.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  pagina.on('pageerror', (e) => errores.push(String(e)));

  await pagina.goto(url, { waitUntil: 'networkidle' });
  await pagina.waitForSelector('.opblock-tag', { timeout: 15_000 });
  const resultado = {
    titulo: await pagina.locator('.title').first().innerText(),
    etiquetas: await pagina.locator('.opblock-tag').count(),
    operaciones: await pagina.locator('.opblock').count(),
    errores
  };
  await pagina.screenshot({ path: salida });
  await navegador.close();

  console.log(JSON.stringify(resultado, null, 2));
  if (errores.length) process.exit(1);
};

void principal();
