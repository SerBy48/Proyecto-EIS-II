import { describe, expect, it } from 'vitest';
import { TEXTO_OCULTO, camposSecretos, htmlDelCorreo, ocultarSecretos } from '../src/controlador';
import { escaparHtml, renderizar } from '../src/plantillas';

const enlace = `http://localhost:8081/#restablecer=${'a'.repeat(64)}`;
const datos = { email: 'ana@correo.co', solicitud: 7, minutos: 30, enlace, secretos: ['enlace'] };

describe('recuperacion de contrasena: el enlace va solo en el correo (RF-54, V-27)', () => {
  it('lee la lista de campos secretos e ignora lo que no es texto', () => {
    expect(camposSecretos(datos)).toEqual(['enlace']);
    expect(camposSecretos({ secretos: ['enlace', 3, null] })).toEqual(['enlace']);
    expect(camposSecretos({})).toEqual([]);
  });

  it('lo que se guarda (texto de la campana y datos del evento) no lleva el enlace', () => {
    const guardado = ocultarSecretos(datos, camposSecretos(datos));
    expect(guardado.enlace).toBe(TEXTO_OCULTO);
    expect(JSON.stringify(guardado)).not.toContain('restablecer=');
    const texto = renderizar('Abre este enlace: {{enlace}}', guardado);
    expect(texto).toBe(`Abre este enlace: ${TEXTO_OCULTO}`);
    // El original no se modifica: el envio usa el enlace real.
    expect(datos.enlace).toBe(enlace);
  });

  it('sin campos secretos los datos se guardan tal cual', () => {
    const pedido = { numero: 'PED-1', total: 1000 };
    expect(ocultarSecretos(pedido, [])).toBe(pedido);
  });

  it('en el HTML del correo el enlace es un vinculo y el resto sigue escapado', () => {
    const cuerpo = renderizar('Hola <b>{{nombre}}</b>, abre: {{enlace}}', { nombre: '<img src=x>', enlace }, true);
    const html = htmlDelCorreo(cuerpo, enlace);
    expect(html).toContain(`<a href="${escaparHtml(enlace)}">`);
    expect(html).toContain('&lt;img src=x&gt;');
    expect(html).not.toContain('<img');
  });

  it('un "enlace" que no es http(s) no se vuelve vinculo', () => {
    const malicioso = 'javascript:alert(1)';
    const cuerpo = renderizar('Abre: {{enlace}}', { enlace: malicioso }, true);
    expect(htmlDelCorreo(cuerpo, malicioso)).not.toContain('<a ');
  });
});
