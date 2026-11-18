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
    if (!refresh) throw new ErrorApi(401, 'Sesión expirada.', 'SIN_REFRESH');

    const respuesta = await fetch(`${BASE}/auth/renovar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh })
    });

    if (!respuesta.ok) {
      sesion.limpiar();
      throw new ErrorApi(401, 'La sesión expiró. Inicie sesión de nuevo.', 'SESION_EXPIRADA');
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
  // Un archivo (foto de producto) viaja crudo con su tipo; lo demas, como JSON.
  const cabeceras = { 'Content-Type': opciones.archivo ? opciones.archivo.type : 'application/json', ...(opciones.headers || {}) };
  if (token) cabeceras.Authorization = `Bearer ${token}`;

  const respuesta = await fetch(`${BASE}${ruta}`, {
    method: opciones.metodo || 'GET',
    headers: cabeceras,
    body: opciones.archivo ?? (opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo))
  });

  const texto = await respuesta.text();
  const datos = texto ? JSON.parse(texto) : null;

  return { respuesta, datos };
};

/**
 * Evento que avisa a la aplicacion que la sesion guardada ya no sirve (token
 * invalido o renovacion rechazada): App vuelve al modo visitante.
 */
export const EVENTO_SESION_EXPIRADA = 'sesion-expirada';

const sesionInvalida = () => {
  sesion.limpiar();
  window.dispatchEvent(new CustomEvent(EVENTO_SESION_EXPIRADA));
};

/**
 * Peticion a la API. Con `publica: true` (catalogo, chat) una sesion invalida
 * no impide la respuesta: se descarta la sesion y se repite como visitante.
 *
 * Hallazgo H-F5-02: antes, un token que el servidor ya no aceptaba (secretos
 * rotados, bases recreadas) se quedaba en el navegador; la web seguia
 * mostrando la sesion iniciada y el chat respondia "no disponible".
 */
export const api = async (ruta, opciones = {}) => {
  const tokenUsado = sesion.token;
  let { respuesta, datos } = await ejecutar(ruta, opciones, tokenUsado);

  if (respuesta.status === 401 && tokenUsado) {
    if (datos?.codigo === 'TOKEN_EXPIRADO' && sesion.refresh) {
      // Token expirado: se renueva y se repite la peticion una sola vez.
      try {
        const nuevo = await renovarToken();
        ({ respuesta, datos } = await ejecutar(ruta, opciones, nuevo));
      } catch (error) {
        sesionInvalida();
        if (!opciones.publica) throw error;
        ({ respuesta, datos } = await ejecutar(ruta, opciones, null));
      }
    } else if (datos?.codigo === 'TOKEN_INVALIDO' || datos?.codigo === 'TOKEN_EXPIRADO') {
      sesionInvalida();
      if (opciones.publica) ({ respuesta, datos } = await ejecutar(ruta, opciones, null));
      else throw new ErrorApi(401, 'Tu sesión expiró. Inicia sesión de nuevo.', 'SESION_EXPIRADA');
    }
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

/**
 * Ruta de una foto de producto. El catalogo las sirve en /api/catalogo/imagenes;
 * si la API esta en otro origen (VITE_API_URL), se carga de alla.
 */
export const urlImagen = (ruta) => {
  if (!ruta) return '';
  if (/^https?:/.test(BASE) && ruta.startsWith('/api/')) return new URL(BASE).origin + ruta;
  return ruta;
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
