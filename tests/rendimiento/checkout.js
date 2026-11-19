/**
 * Escenario: checkout (la saga, el endpoint mas pesado).
 *
 * Cada VU usa su propia cuenta (sesion reutilizada; el login no se mide aqui).
 * Por iteracion: agrega 1 unidad de un SKU de carga al carrito y compra con
 * tok_ok_* (aprobado). La saga recorre clientes, carrito, catalogo,
 * inventario (pg_advisory_xact_lock por SKU), pagos (150 ms de pasarela
 * simulada) y publica en RabbitMQ.
 *
 * Un 409 (stock insuficiente) o 402 se etiquetan como respuesta de negocio:
 * no cuentan como fallo del sistema (invariante 7).
 *
 * Uso: k6 run -e PERFIL=carga tests/rendimiento/checkout.js
 *      (antes: npm run sembrar:carga, que repone el stock a 10 000)
 */
import { check, sleep } from 'k6';
import { SKUS_CARGA, agregarAlCarrito, azar, comprar, sesionDelVu } from './lib/comun.js';
import { opciones } from './lib/perfiles.js';

export const options = opciones({
  'http_req_duration{endpoint:checkout}': ['p(95)<1500'],
  'http_req_duration{endpoint:carrito_agregar}': ['p(95)<500']
});

export default function () {
  const sesion = sesionDelVu();
  if (!sesion) {
    sleep(1);
    return;
  }

  const r = agregarAlCarrito(sesion, azar(SKUS_CARGA), { name: 'POST /carrito/:id/items' });
  check(r, { 'carrito 200': (x) => x.status === 200 || x.status === 201 });

  comprar(sesion, { name: 'POST /pedidos/checkout' });

  sleep(1);
}
