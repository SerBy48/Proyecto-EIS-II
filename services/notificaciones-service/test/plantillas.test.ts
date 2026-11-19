import { describe, expect, it } from 'vitest';
import { CanalRegistro, canalPara } from '../src/canales';
import { canalConHtml, escaparHtml, renderizar } from '../src/plantillas';

describe('renderizar (hallazgo S-11)', () => {
  const plantilla = 'Hola {{nombre}}, tu pedido {{numero}} va por {{total}}.';

  it('sustituye las variables y deja vacias las que faltan', () => {
    expect(renderizar(plantilla, { nombre: 'Ana', numero: 'PED-1' })).toBe('Hola Ana, tu pedido PED-1 va por .');
  });

  it('en el canal de correo escapa el HTML que viene del usuario', () => {
    const nombre = '<img src=x onerror=alert(1)>';
    const html = renderizar(plantilla, { nombre, numero: 'PED-1', total: '$1' }, canalConHtml('email'));
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('respeta el texto fijo de la plantilla (lo edita solo un administrador)', () => {
    expect(renderizar('<b>{{x}}</b>', { x: '<i>' }, true)).toBe('<b>&lt;i&gt;</b>');
  });

  it('en SMS y push no escapa: son texto plano', () => {
    expect(canalConHtml('sms')).toBe(false);
    expect(canalConHtml('push')).toBe(false);
    expect(renderizar('{{x}}', { x: 'A & B' }, canalConHtml('push'))).toBe('A & B');
  });

  it('escapa los cinco caracteres con significado en HTML', () => {
    expect(escaparHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });
});

describe('canales de envio', () => {
  it('sin CANAL_CORREO=smtp, el correo usa el canal de registro (no exige Mailpit)', () => {
    expect(canalPara('email')).toBeInstanceOf(CanalRegistro);
  });

  it('SMS y push siempre son simulados', async () => {
    process.env.LATENCIA_ENVIO_MS = '0';
    const resultado = await canalPara('sms').enviar({ destinatario: '300', asunto: 'a', texto: 'b' });
    expect(resultado.proveedor).toBe('sms-simulado');
  });
});
