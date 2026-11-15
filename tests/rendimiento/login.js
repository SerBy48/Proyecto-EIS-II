/**
 * Escenario: inicio de sesion (bcrypt, costoso en CPU a proposito).
 *
 * Cada iteracion inicia sesion con una cuenta de carga distinta. Mide cuanto
 * aguanta auth-service: usa bcryptjs (JavaScript puro), que calcula el hash
 * en el hilo principal de Node, asi que bajo concurrencia las comparaciones
 * se encolan una detras de otra (ver docs/calidad/RENDIMIENTO.md, 5.1).
 *
 * Umbral p95 < 1000 ms: el login ocurre una vez por sesion (el JWT dura
 * 15 min), asi que tolera mas latencia que una busqueda, pero mas de un
 * segundo ya es perceptible como "lento" para el usuario.
 *
 * Uso: k6 run -e PERFIL=carga tests/rendimiento/login.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { API, CONTRASENA, JSON_CABECERAS, correoCuenta } from './lib/comun.js';
import { opciones } from './lib/perfiles.js';

export const options = opciones({
  'http_req_duration{endpoint:login}': ['p(95)<1000']
});

export default function () {
  const correo = correoCuenta((__VU - 1) * 1000 + __ITER);
  const r = http.post(`${API}/auth/login`, JSON.stringify({ email: correo, password: CONTRASENA }), {
    headers: JSON_CABECERAS,
    tags: { endpoint: 'login', name: 'POST /auth/login' }
  });

  check(r, {
    'login 200': (x) => x.status === 200,
    'emite token': (x) => x.status === 200 && Boolean(x.json('token'))
  });

  sleep(1);
}
