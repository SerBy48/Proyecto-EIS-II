/**
 * Escenario: asistente virtual (Trabajo Final, Fase 4).
 *
 * Mezcla de intenciones con y sin sesion, como en una hora pico:
 *   60 % visitantes: preguntas frecuentes (sin dependencias), busqueda y
 *        precio (consultan el catalogo, que a su vez consulta inventario).
 *   40 % clientes con sesion: "mis pedidos" (pedidos-service con el token del
 *        usuario) y, la mitad de las veces, un segundo turno con el numero
 *        (contexto de varios turnos guardado en Mongo).
 *
 * Ademas de la latencia, cada respuesta se valida: la intencion reconocida
 * debe ser la esperada (el motor no se degrada bajo carga) y un cliente con
 * sesion nunca recibe "inicia sesion".
 *
 * Requiere el perfil de carga (npm run infra:carga): con LIMITE_ASISTENTE=30
 * todos los visitantes comparten la IP del generador y se mediria el limitador.
 *
 * Uso: tests/rendimiento/ejecutar.sh asistente carga
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { API, CONTRASENA, JSON_CABECERAS, azar, correoCuenta } from './lib/comun.js';
import { opciones } from './lib/perfiles.js';

export const options = opciones({
  'http_req_duration{endpoint:asistente}': ['p(95)<500'],
  'http_req_duration{endpoint:asistente,tipo:faq}': ['p(95)<300']
});

const PREGUNTAS = [
  { texto: 'cuanto cuesta el envio?', intencion: 'faq_envio', tipo: 'faq' },
  { texto: 'cuales son los medios de pago', intencion: 'faq_pagos', tipo: 'faq' },
  { texto: 'el precio incluye iva?', intencion: 'faq_iva', tipo: 'faq' },
  { texto: 'cual es el horario de atencion', intencion: 'faq_horario', tipo: 'faq' },
  { texto: 'tienen portatiles?', intencion: 'buscar_producto', tipo: 'catalogo' },
  { texto: 'hay audifonos disponibles?', intencion: 'precio_disponibilidad', tipo: 'catalogo' },
  { texto: 'precio del SKU-TEC-001', intencion: 'precio_disponibilidad', tipo: 'catalogo' },
  { texto: 'hay stock de SKU-TEC-006?', intencion: 'precio_disponibilidad', tipo: 'catalogo' }
];

let sesion = null;
const token = () => {
  if (!sesion || Date.now() - sesion.obtenido > 12 * 60_000) {
    const r = http.post(`${API}/auth/login`, JSON.stringify({ email: correoCuenta(__VU - 1), password: CONTRASENA }), {
      headers: JSON_CABECERAS,
      tags: { endpoint: 'login', fase: 'preparacion' }
    });
    sesion = r.status === 200 ? { token: r.json('token'), obtenido: Date.now() } : null;
  }
  return sesion?.token;
};

const decir = (texto, tipo, opciones = {}) =>
  http.post(
    `${API}/asistente/mensajes`,
    JSON.stringify({ texto, ...(opciones.conversacion ? { conversacion_id: opciones.conversacion } : {}) }),
    {
      headers: { ...JSON_CABECERAS, ...(opciones.token ? { Authorization: `Bearer ${opciones.token}` } : {}) },
      tags: { endpoint: 'asistente', tipo, name: `POST /asistente/mensajes (${tipo})` }
    }
  );

const intencion = (r) => (r.status === 200 ? r.json('intencion') : null);

export default function () {
  if (Math.random() < 0.6) {
    const pregunta = azar(PREGUNTAS);
    const r = decir(pregunta.texto, pregunta.tipo);
    check(r, {
      'asistente 200': (x) => x.status === 200,
      'intencion esperada': (x) => intencion(x) === pregunta.intencion
    });
  } else {
    const t = token();
    const r = decir('cual es el estado de mis pedidos', 'pedidos', { token: t });
    const respuestas = r.status === 200 ? r.json('respuestas') : [];
    check(r, {
      'asistente 200': (x) => x.status === 200,
      'intencion esperada': (x) => intencion(x) === 'estado_pedido',
      'con sesion no pide iniciar sesion': () => !JSON.stringify(respuestas).includes('inicies sesión')
    });

    // Segundo turno: el numero del primer pedido listado, en la misma conversacion.
    const lista = (respuestas.find((x) => x.tipo === 'pedidos') || {}).pedidos || [];
    if (lista.length && Math.random() < 0.5) {
      sleep(1);
      const turno = decir(`el ${lista[0].id}`, 'pedidos', { token: t, conversacion: r.json('conversacion_id') });
      check(turno, {
        'asistente 200': (x) => x.status === 200,
        'segundo turno resuelve el pedido': (x) =>
          x.status === 200 && (x.json('respuestas') || []).some((y) => y.tipo === 'pedido' && y.pedido.id === lista[0].id)
      });
    }
  }
  sleep(1);
}
