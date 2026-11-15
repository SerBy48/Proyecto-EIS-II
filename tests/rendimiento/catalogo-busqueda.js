/**
 * Escenario: busqueda en el catalogo (ruta PUBLICA, la de mayor trafico).
 *
 * Cada iteracion es un visitante anonimo que busca por texto ($text de
 * MongoDB), a veces filtra por categoria y pagina. Cada pagina dispara ademas
 * una consulta sincrona a inventario (/disponibilidad) protegida por circuit
 * breaker: si el circuito se abre, la respuesta sigue siendo 200 pero sin
 * disponibilidad; eso se detecta con el check "disponibilidad presente".
 *
 * Uso: k6 run -e PERFIL=carga tests/rendimiento/catalogo-busqueda.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { API, CATEGORIAS, TERMINOS, azar } from './lib/comun.js';
import { opciones } from './lib/perfiles.js';

export const options = opciones({
  'http_req_duration{endpoint:catalogo_busqueda}': ['p(95)<500']
});

export default function () {
  const parametros = [`q=${encodeURIComponent(azar(TERMINOS))}`];
  if (Math.random() < 0.3) parametros.push(`categoria=${azar(CATEGORIAS)}`);
  if (Math.random() < 0.2) parametros.push('pagina=2');

  const r = http.get(`${API}/catalogo/productos?${parametros.join('&')}`, {
    tags: { endpoint: 'catalogo_busqueda', name: 'GET /catalogo/productos?q=' }
  });

  check(r, {
    'catalogo 200': (x) => x.status === 200,
    // null en "disponible" significa que inventario no respondio (degradacion).
    'disponibilidad presente': (x) => {
      if (x.status !== 200) return false;
      const productos = x.json('productos') || [];
      return productos.every((p) => p.disponible !== null && p.disponible !== undefined);
    }
  });

  sleep(1);
}
