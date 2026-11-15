/**
 * Escenario: flujo completo del negocio (la carga mixta mas realista).
 *
 *   login -> busqueda -> detalle -> carrito -> checkout -> mis pedidos
 *
 * Con 1 s de pausa entre acciones ("tiempo de pensar" del usuario). Cada
 * iteracion es una visita completa con su propio login, y la cuenta depende
 * del VU, asi que el historial de "mis pedidos" crece durante la corrida.
 *
 * Uso: k6 run -e PERFIL=carga tests/rendimiento/flujo-completo.js
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import {
  API, CATEGORIAS, SKUS_CARGA, TERMINOS, agregarAlCarrito, azar, comprar, conToken, correoCuenta, iniciarSesion
} from './lib/comun.js';
import { opciones } from './lib/perfiles.js';

export const options = opciones({
  'http_req_duration{endpoint:catalogo_busqueda}': ['p(95)<500'],
  'http_req_duration{endpoint:checkout}': ['p(95)<1500'],
  'http_req_duration{endpoint:login}': ['p(95)<1000'],
  'http_req_duration{endpoint:mis_pedidos}': ['p(95)<500']
});

export default function () {
  let sesion;
  group('1 login', () => {
    sesion = iniciarSesion(correoCuenta(__VU - 1), { name: 'POST /auth/login' });
  });
  if (!sesion) {
    sleep(1);
    return;
  }
  sleep(1);

  group('2 busqueda', () => {
    const r = http.get(`${API}/catalogo/productos?q=${azar(TERMINOS)}&categoria=${azar(CATEGORIAS)}`, {
      tags: { endpoint: 'catalogo_busqueda', name: 'GET /catalogo/productos?q=' }
    });
    check(r, { 'catalogo 200': (x) => x.status === 200 });
  });
  sleep(1);

  const sku = azar(SKUS_CARGA);
  group('3 detalle', () => {
    const r = http.get(`${API}/catalogo/productos/${sku}`, {
      tags: { endpoint: 'catalogo_detalle', name: 'GET /catalogo/productos/:sku' }
    });
    check(r, { 'detalle 200': (x) => x.status === 200 });
  });
  sleep(1);

  group('4 carrito', () => {
    const r = agregarAlCarrito(sesion, sku, { name: 'POST /carrito/:id/items' });
    check(r, { 'carrito 200': (x) => x.status === 200 || x.status === 201 });
  });
  sleep(1);

  group('5 checkout', () => {
    comprar(sesion, { name: 'POST /pedidos/checkout' });
  });
  sleep(1);

  group('6 mis pedidos', () => {
    const r = http.get(`${API}/pedidos`, {
      ...conToken(sesion.token),
      tags: { endpoint: 'mis_pedidos', name: 'GET /pedidos' }
    });
    check(r, { 'mis pedidos 200': (x) => x.status === 200 && Array.isArray(x.json()) });
  });
  sleep(1);
}
