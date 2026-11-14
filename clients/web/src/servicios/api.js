/**
 * Cliente de la API.
 *
 * Todas las peticiones van al API Gateway. El frontend no sabe que detras hay
 * ocho microservicios: solo conoce las rutas /api/<area>.
 *
 * Incluye la renovacion automatica del token: como el token de acceso vive
 * quince minutos, sin esto el usuario seria expulsado a mitad de una compra.
 */

export const BASE = import.meta.env.VITE_API_URL || '/api';

export const sesion = {
  get token() {
    return localStorage.getItem('token');
  },
  get refresh() {
    return localStorage.getItem('refresh_token');
  },
  get usuario() {
    const guardado = localStorage.getItem('usuario');
    return guardado ? JSON.parse(guardado) : null;
  },
  guardar({ token, refresh_token, usuario }) {
    if (token) localStorage.setItem('token', token);
    if (refresh_token) localStorage.setItem('refresh_token', refresh_token);
    if (usuario) localStorage.setItem('usuario', JSON.stringify(usuario));
  },
  limpiar() {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('usuario');
  }
};

export class ErrorApi extends Error {
  constructor(estado, mensaje, codigo, detalle) {
    super(mensaje);
    this.estado = estado;
    this.codigo = codigo;
    this.detalle = detalle;
  }
}

let renovacionEnCurso = null;

/** Cambia el refresh token por un token de acceso nuevo. */
const renovarToken = async () => {
  // Si varias peticiones caducan a la vez, todas esperan la misma renovacion
  // en lugar de lanzar cinco renovaciones en paralelo.
  if (renovacionEnCurso) return renovacionEnCurso;

  renovacionEnCurso = (async () => {
    const refresh = sesion.refresh;
    if (!refresh) throw new ErrorApi(401, 'Sesion expirada.', 'SIN_REFRESH');

    const respuesta = await fetch(`${BASE}/auth/renovar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh })
    });

    if (!respuesta.ok) {
      sesion.limpiar();
      throw new ErrorApi(401, 'La sesion expiro. Inicie sesion de nuevo.', 'SESION_EXPIRADA');
    }

    const datos = await respuesta.json();
    sesion.guardar(datos);
    return datos.token;
  })();

  try {
    return await renovacionEnCurso;
  } finally {
    renovacionEnCurso = null;
  }
};

const ejecutar = async (ruta, opciones, token) => {
  const cabeceras = { 'Content-Type': 'application/json', ...(opciones.headers || {}) };
  if (token) cabeceras.Authorization = `Bearer ${token}`;

  const respuesta = await fetch(`${BASE}${ruta}`, {
    method: opciones.metodo || 'GET',
    headers: cabeceras,
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo)
  });

  const texto = await respuesta.text();
  const datos = texto ? JSON.parse(texto) : null;

  return { respuesta, datos };
};

export const api = async (ruta, opciones = {}) => {
  let { respuesta, datos } = await ejecutar(ruta, opciones, sesion.token);

  // Token expirado: se renueva y se repite la peticion una sola vez.
  if (respuesta.status === 401 && datos?.codigo === 'TOKEN_EXPIRADO' && sesion.refresh) {
    const nuevo = await renovarToken();
    ({ respuesta, datos } = await ejecutar(ruta, opciones, nuevo));
  }

  if (!respuesta.ok) {
    throw new ErrorApi(
      respuesta.status,
      datos?.mensaje || `El servidor respondio ${respuesta.status}`,
      datos?.codigo,
      datos?.detalle
    );
  }

  return datos;
};

export const iniciarSesion = async (email, password) => {
  const datos = await api('/auth/login', { metodo: 'POST', cuerpo: { email, password } });
  sesion.guardar(datos);
  return datos.usuario;
};

export const cerrarSesion = async () => {
  await api('/auth/logout', { metodo: 'POST' }).catch(() => undefined);
  sesion.limpiar();
};

export const moneda = (valor) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(Number(valor || 0));

/** Clave de idempotencia para el checkout: la genera el cliente. */
export const nuevaClaveIdempotencia = () =>
  `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
