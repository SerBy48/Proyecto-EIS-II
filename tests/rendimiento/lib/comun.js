/**
 * Utilidades comunes de los escenarios de k6.
 *
 * - URL del gateway parametrizada (K6_URL_BASE): los mismos scripts sirven
 *   para el Trabajo Final, sobre la version con el chatbot.
 * - Una cuenta carga001..cargaNNN distinta por usuario virtual (__VU). El rate
 *   limiting y el carrito son por usuario: con una sola cuenta se mediria el
 *   limitador y los VU se vaciarian el carrito entre si.
 * - Clave de idempotencia nueva por intento de checkout (invariante 4).
 */
import http from 'k6/http';
import { check } from 'k6';

export const URL_BASE = (__ENV.K6_URL_BASE || 'http://localhost:8080').replace(/\/$/, '');
export const API = `${URL_BASE}/api`;
export const CONTRASENA = 'Password123';
/** Cuentas sembradas con CLIENTES_CARGA=300 npm run sembrar:carga */
export const TOTAL_CUENTAS = Number(__ENV.CUENTAS || 300);

/** SKU con 10 000 unidades: los unicos que compra la carga. */
export const SKUS_CARGA = ['SKU-TEC-001', 'SKU-HOG-001', 'SKU-DEP-001', 'SKU-TEC-002', 'SKU-DEP-002'];

export const TERMINOS = [
  'portatil', 'monitor', 'audifonos', 'teclado', 'cafetera', 'licuadora', 'aspiradora',
  'freidora', 'bicicleta', 'mancuernas', 'balon', 'raqueta', 'pro', 'basico', 'andina', 'cumbre'
];
export const CATEGORIAS = ['tecnologia', 'hogar', 'deportes'];

export const JSON_CABECERAS = { 'Content-Type': 'application/json' };

export const correoCuenta = (indice) =>
  `carga${String((indice % TOTAL_CUENTAS) + 1).padStart(3, '0')}@correo.co`;

export const azar = (lista) => lista[Math.floor(Math.random() * lista.length)];

export const conToken = (token, extra = {}) => ({
  headers: { ...JSON_CABECERAS, Authorization: `Bearer ${token}`, ...extra }
});

/** Inicia sesion; devuelve { token, clienteId } o null. */
export const iniciarSesion = (correo, etiquetas = {}) => {
  const r = http.post(`${API}/auth/login`, JSON.stringify({ email: correo, password: CONTRASENA }), {
    headers: JSON_CABECERAS,
    tags: { endpoint: 'login', ...etiquetas }
  });
  const ok = check(r, { 'login 200': (x) => x.status === 200 });
  if (!ok) return null;
  const cuerpo = r.json();
  return { token: cuerpo.token, clienteId: cuerpo.usuario.cliente_id, obtenido: Date.now() };
};

/**
 * Sesion por VU reutilizada entre iteraciones. El JWT vive 15 min: se renueva
 * a los 12 para que una corrida larga no falle por expiracion.
 */
let sesionVu = null;
export const sesionDelVu = () => {
  if (!sesionVu || Date.now() - sesionVu.obtenido > 12 * 60_000) {
    sesionVu = iniciarSesion(correoCuenta(__VU - 1), { fase: 'preparacion' });
  }
  return sesionVu;
};

export const claveIdempotencia = () => `k6-${crypto.randomUUID()}`;

/**
 * Checkout con su clasificacion de negocio. Un 409 (stock insuficiente) o
 * 402 (pago rechazado) es una respuesta valida del negocio, no un fallo del
 * sistema (invariante 7): se etiqueta aparte y no cuenta en http_req_failed.
 */
export const comprar = (sesion, etiquetas = {}) => {
  const r = http.post(
    `${API}/pedidos/checkout`,
    JSON.stringify({ medio_pago: 'tarjeta_credito', token_medio_pago: `tok_ok_${__VU}` }),
    {
      ...conToken(sesion.token, { 'Idempotency-Key': claveIdempotencia() }),
      tags: { endpoint: 'checkout', ...etiquetas },
      responseCallback: http.expectedStatuses(200, 201, 402, 409)
    }
  );
  const negocio = r.status === 409 || r.status === 402;
  check(r, {
    'checkout 201/200': (x) => x.status === 201 || x.status === 200 || negocio,
    'pedido queda pagado': (x) => negocio || ((x.status === 201 || x.status === 200) && x.json('pedido.estado') === 'pagado')
  });
  return { respuesta: r, negocio };
};

export const agregarAlCarrito = (sesion, sku, etiquetas = {}) =>
  http.post(`${API}/carrito/${sesion.clienteId}/items`, JSON.stringify({ sku, cantidad: 1 }), {
    ...conToken(sesion.token),
    tags: { endpoint: 'carrito_agregar', ...etiquetas }
  });
