/**
 * Recorrido del asistente en la web (Chromium): visitante y cliente con sesion.
 * Toma capturas y pasa axe (WCAG 2.2 AA) sobre el panel abierto.
 *
 *   npx tsx scripts/capturas/asistente.ts [carpeta]   (web en http://localhost:4173)
 *
 * Usa selectores accesibles (roles y etiquetas), los mismos que veria un lector
 * de pantalla. bypassCSP solo para que axe pueda inyectarse; la CSP de la web
 * se verifica aparte (npm run test:seguridad).
 */
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { chromium, Page } from 'playwright';

const WEB = process.env.URL_WEB || 'http://localhost:4173';

const preguntar = async (pagina: Page, texto: string) => {
  const respuestasAntes = await pagina.locator('[role="log"] > div').count();
  await pagina.getByLabel('Escribe tu pregunta').fill(texto);
  await pagina.getByRole('button', { name: 'Enviar' }).click();
  await pagina.waitForFunction((n) => document.querySelectorAll('[role="log"] > div').length > n, respuestasAntes, {
    timeout: 10_000
  });
};

const principal = async (): Promise<void> => {
  const carpeta = process.argv[2] ?? '.';
  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 860 }, bypassCSP: true });
  const pagina = await contexto.newPage();
  const errores: string[] = [];
  pagina.on('pageerror', (e) => errores.push(String(e)));
  const resultado: Record<string, unknown> = {};

  await pagina.goto(WEB, { waitUntil: 'networkidle' });

  // Visitante: FAQ y busqueda.
  await pagina.getByRole('button', { name: '¿Necesitas ayuda?' }).click();
  const panel = pagina.getByRole('dialog', { name: 'Asistente virtual' });
  resultado.foco_en_el_campo = await pagina.getByLabel('Escribe tu pregunta').evaluate((e) => e === document.activeElement);
  await pagina.getByRole('button', { name: 'Costo de envío' }).click();
  await pagina.waitForSelector('text=/15\\.000/');
  await preguntar(pagina, 'tienen cafeteras?');
  await pagina.waitForSelector('[aria-label="Productos"]');
  await panel.screenshot({ path: path.join(carpeta, 'asistente-visitante.png') });

  const axe = await new AxeBuilder({ page: pagina })
    .include('[role="dialog"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  resultado.axe_violaciones = axe.violations.map((v) => ({ id: v.id, impacto: v.impact, nodos: v.nodes.length }));

  // Esc cierra y devuelve el foco al boton.
  await pagina.keyboard.press('Escape');
  resultado.esc_cierra = (await panel.count()) === 0;
  resultado.foco_vuelve_al_boton = await pagina
    .getByRole('button', { name: '¿Necesitas ayuda?' })
    .evaluate((e) => e === document.activeElement);

  // Cliente con sesion: estado de sus pedidos.
  await pagina.getByRole('button', { name: 'Iniciar sesión' }).first().click();
  await pagina.getByLabel('Correo').fill('ana@correo.co');
  await pagina.getByLabel('Contraseña').fill('Password123');
  await pagina.getByRole('button', { name: 'Ingresar' }).click();
  await pagina.waitForSelector('text=ana@correo.co');
  await pagina.getByRole('button', { name: '¿Necesitas ayuda?' }).click();
  await preguntar(pagina, 'cual es el estado de mis pedidos?');
  await pagina.waitForSelector('[aria-label="Pedidos"]');
  resultado.pedidos_mostrados = await pagina.locator('[aria-label="Pedidos"] li').count();
  await pagina.getByRole('dialog', { name: 'Asistente virtual' }).screenshot({ path: path.join(carpeta, 'asistente-cliente.png') });
  await pagina.screenshot({ path: path.join(carpeta, 'asistente-pagina.png') });

  resultado.errores_de_pagina = errores;
  await navegador.close();
  console.log(JSON.stringify(resultado, null, 2));
  if (errores.length || axe.violations.some((v) => v.impact === 'serious' || v.impact === 'critical')) process.exit(1);
};

void principal();
