import { describe, expect, it, vi } from 'vitest';
import { Caso, medir } from '../../../tests/asistente/metricas';
import frases from '../../../tests/asistente/frases.json';
import { completarPlantilla, enmascarar } from '../src/configuracion';
import datos from '../src/datos/intenciones.json';
import { ClienteIa, responderConIa } from '../src/ia';
import { Intencion, NO_ENTENDIDO, clasificar, extraerConsultaProducto, extraerEntidades, normalizar } from '../src/motor';

const intenciones = datos.intenciones as Intencion[];

describe('normalizar', () => {
  it('quita tildes, signos y mayusculas, y conserva los guiones de un SKU', () => {
    expect(normalizar('¿Cuánto CUESTA el envío?')).toBe('cuanto cuesta el envio');
    expect(normalizar('Precio del SKU-TEC-004!!')).toBe('precio del sku-tec-004');
  });
});

describe('entidades', () => {
  it('reconoce SKU y numero de pedido', () => {
    expect(extraerEntidades(normalizar('hay stock de SKU-TEC-004?'))).toEqual({ sku: 'SKU-TEC-004' });
    expect(extraerEntidades(normalizar('mi pedido PED-202611-001105'))).toEqual({ pedido: 'PED-202611-001105' });
    expect(extraerEntidades(normalizar('el pedido 106 no llega'))).toEqual({ pedido: '106' });
  });

  it('un numero suelto solo es un pedido si el asistente lo estaba esperando', () => {
    expect(extraerEntidades('106')).toEqual({});
    expect(extraerEntidades('106', { intencion: 'estado_pedido', espera: 'pedido' })).toEqual({ pedido: '106' });
  });
});

describe('clasificar', () => {
  it('los terminos de varias palabras desempatan: "cuanto cuesta el envio" es FAQ, no precio', () => {
    expect(clasificar('cuanto cuesta el envio?', intenciones).intencion).toBe('faq_envio');
    expect(clasificar('cuanto cuesta la cafetera', intenciones).intencion).toBe('precio_disponibilidad');
  });

  it('una palabra suelta de otra intencion no gana a una pregunta concreta', () => {
    expect(clasificar('hola, cual es el estado de mi pedido', intenciones).intencion).toBe('estado_pedido');
  });

  it('por debajo del umbral responde no_entendido', () => {
    const r = clasificar('el cielo es azul', intenciones);
    expect(r.intencion).toBe(NO_ENTENDIDO);
    expect(r.confianza).toBe(0);
  });

  it('contexto de varios turnos: el numero que responde a la pregunta va a la intencion pendiente', () => {
    expect(clasificar('PED-202611-000001', intenciones, { intencion: 'cancelar_pedido', espera: 'pedido' }).intencion).toBe('cancelar_pedido');
    const r = clasificar('el 45', intenciones, { intencion: 'estado_pedido', espera: 'pedido' });
    expect(r).toMatchObject({ intencion: 'estado_pedido', por_contexto: true, entidades: { pedido: '45' } });
  });

  it('si el usuario cambia de tema, el contexto no lo retiene', () => {
    expect(clasificar('cuales son los medios de pago', intenciones, { intencion: 'estado_pedido', espera: 'pedido' }).intencion).toBe('faq_pagos');
  });

  it('extrae el nombre del producto quitando palabras vacias y SKU', () => {
    expect(extraerConsultaProducto('¿Tienen portátiles Aurora?')).toBe('portatiles aurora');
    expect(extraerConsultaProducto('cuanto cuesta el SKU-TEC-001')).toBe('');
  });
});

describe('tasa de acierto (tests/asistente/frases.json)', () => {
  it('desarrollo: todas las frases (es el conjunto con el que se ajustan los terminos)', () => {
    const m = medir(frases.desarrollo as Caso[]);
    expect(m.errores).toEqual([]);
  });

  it('evaluacion: al menos 85 % (RNF-20); la cifra real esta en la evidencia', () => {
    const m = medir(frases.evaluacion as Caso[]);
    expect(m.total).toBeGreaterThanOrEqual(30);
    expect(m.tasa).toBeGreaterThanOrEqual(0.85);
  });
});

describe('configuracion', () => {
  it('las cifras de la FAQ salen de la configuracion, no del texto', () => {
    expect(completarPlantilla('Envio {{costo_envio}}; gratis desde {{umbral_envio_gratis}}')).toMatch(/15\.000.*500\.000/);
    expect(completarPlantilla('{{desconocida}}')).toBe('{{desconocida}}');
  });

  it('enmascara correos, tarjetas y telefonos antes de guardar la conversacion', () => {
    const texto = enmascarar('soy ana@correo.co, mi tarjeta 4111 1111 1111 1111 y mi celular 3001112233');
    expect(texto).not.toMatch(/ana@|4111|3001112233/);
    expect(enmascarar('mi pedido PED-202611-001105')).toBe('mi pedido PED-202611-001105');
  });
});

describe('IA opcional', () => {
  const clienteSimulado = (respuesta: unknown) => {
    const crear = vi.fn(async () => respuesta);
    return { cliente: { beta: { messages: { create: crear } } } as unknown as ClienteIa, crear };
  };

  it('apagada por defecto: no llama al proveedor', async () => {
    delete process.env.ASISTENTE_IA;
    const { cliente, crear } = clienteSimulado({});
    expect(await responderConIa('hola', '', cliente)).toBeNull();
    expect(crear).not.toHaveBeenCalled();
  });

  it('activa: envia solo la pregunta y la informacion publica, sin herramientas', async () => {
    process.env.ASISTENTE_IA = 'anthropic';
    try {
      const { cliente, crear } = clienteSimulado({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Respuesta breve.' }] });
      expect(await responderConIa('que es esta tienda?', 'Envio 15000', cliente)).toBe('Respuesta breve.');
      const peticion = (crear.mock.calls[0] as unknown as [Record<string, unknown>])[0];
      expect(peticion.tools).toBeUndefined();
      expect(peticion.messages).toEqual([{ role: 'user', content: 'que es esta tienda?' }]);
      expect(String(peticion.system)).toContain('Envio 15000');
    } finally {
      delete process.env.ASISTENTE_IA;
    }
  });

  it('si el modelo declina o falla, el asistente sigue sin IA (null)', async () => {
    process.env.ASISTENTE_IA = 'anthropic';
    try {
      const declina = clienteSimulado({ stop_reason: 'refusal', stop_details: { category: null }, content: [] });
      expect(await responderConIa('x', '', declina.cliente)).toBeNull();
      const falla = { beta: { messages: { create: vi.fn(async () => { throw new Error('red'); }) } } } as unknown as ClienteIa;
      expect(await responderConIa('x', '', falla)).toBeNull();
    } finally {
      delete process.env.ASISTENTE_IA;
    }
  });
});
