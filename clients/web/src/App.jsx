import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api, cerrarSesion, iniciarSesion, sesion } from './servicios/api';
import Catalogo from './paginas/Catalogo.jsx';
import CarritoPagina from './paginas/Carrito.jsx';
import MisPedidos from './paginas/MisPedidos.jsx';
import Admin from './paginas/Admin.jsx';
import Asistente from './componentes/Asistente.jsx';

const CUENTAS = [
  ['ana@correo.co', 'Ana (cliente)'],
  ['bruno@correo.co', 'Bruno (cliente)'],
  ['carla@correo.co', 'Carla (cliente)'],
  ['vendedor@tienda.co', 'Vendedor'],
  ['admin@tienda.co', 'Administrador']
];

export default function App() {
  const [usuario, setUsuario] = useState(sesion.usuario);
  const [vista, setVista] = useState('catalogo');
  const [carrito, setCarrito] = useState(null);
  const [aviso, setAviso] = useState(null);
  const temporizadorAviso = useRef(null);

  const esCliente = usuario?.rol === 'cliente';
  const esInterno = usuario && ['administrador', 'vendedor'].includes(usuario.rol);

  const recargarCarrito = useCallback(async () => {
    if (!esCliente || !usuario?.cliente_id) return setCarrito(null);
    try {
      setCarrito(await api(`/carrito/${usuario.cliente_id}`));
    } catch {
      setCarrito(null);
    }
  }, [esCliente, usuario]);

  useEffect(() => {
    recargarCarrito();
  }, [recargarCarrito]);

  const agregarAlCarrito = async (sku) => {
    if (!usuario?.cliente_id) return;
    try {
      // La respuesta ya es el carrito actualizado: trae el nombre del producto
      // y evita una segunda peticion.
      const actualizado = await api(`/carrito/${usuario.cliente_id}/items`, {
        metodo: 'POST',
        cuerpo: { sku, cantidad: 1 }
      });
      setCarrito(actualizado);
      // U-07: el cliente reconoce el nombre, no el SKU interno.
      const nombre = actualizado?.items?.find((i) => i.sku === sku)?.nombre ?? 'Producto';
      setAviso({ tipo: 'ok', texto: `${nombre} agregado al carrito.` });
    } catch (e) {
      setAviso({ tipo: 'error', texto: e.message });
    }
    // Un aviso nuevo reinicia el temporizador: si no, el del aviso anterior
    // borraria este antes de tiempo.
    clearTimeout(temporizadorAviso.current);
    temporizadorAviso.current = setTimeout(() => setAviso(null), 3500);
  };

  const salir = async () => {
    await cerrarSesion();
    setUsuario(null);
    setCarrito(null);
    setVista('catalogo');
  };

  const cantidadCarrito = carrito?.cantidad_items ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:text-indigo-700 focus:px-4 focus:py-2 focus:rounded-lg focus:shadow"
      >
        Saltar al contenido
      </a>
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <button
            onClick={() => setVista('catalogo')}
            className="font-bold text-lg text-indigo-700 whitespace-nowrap"
          >
            Tienda en línea
          </button>

          <nav aria-label="Principal" className="order-last sm:order-none w-full sm:w-auto flex flex-wrap items-center gap-1 text-sm">
            <BotonNav activo={vista === 'catalogo'} onClick={() => setVista('catalogo')}>
              Catálogo
            </BotonNav>
            {esCliente && (
              <>
                <BotonNav activo={vista === 'carrito'} onClick={() => setVista('carrito')}>
                  Carrito{cantidadCarrito > 0 && ` (${cantidadCarrito})`}
                </BotonNav>
                <BotonNav activo={vista === 'pedidos'} onClick={() => setVista('pedidos')}>
                  Mis pedidos
                </BotonNav>
              </>
            )}
            {esInterno && (
              <BotonNav activo={vista === 'admin'} onClick={() => setVista('admin')}>
                Administración
              </BotonNav>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-sm">
            {usuario ? (
              <>
                <span className="text-gray-600 hidden sm:inline">
                  {usuario.email} · <span className="font-semibold">{usuario.rol}</span>
                </span>
                <button
                  onClick={salir}
                  className="border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg"
                >
                  Salir
                </button>
              </>
            ) : (
              <button
                onClick={() => setVista('login')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg font-semibold"
              >
                Iniciar sesión
              </button>
            )}
          </div>
        </div>
      </header>

      <main id="contenido" tabIndex={-1} className="pb-16 focus:outline-none">
        {/* La region viva existe siempre: si se montara junto con el texto, los
            lectores de pantalla no anunciarian el primer aviso. */}
        {/* U-07: el aviso flota bajo la cabecera, visible aunque el usuario haya
            bajado en la lista de productos. */}
        <div
          role="status"
          aria-live="polite"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md pointer-events-none"
        >
          {aviso && (
            <div
              className={`text-sm rounded-lg p-3 shadow-lg ${
                aviso.tipo === 'ok'
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}
            >
              {aviso.texto}
            </div>
          )}
        </div>

        {vista === 'login' && (
          <Login
            onIngreso={(u) => {
              setUsuario(u);
              setVista(['administrador', 'vendedor'].includes(u.rol) ? 'admin' : 'catalogo');
            }}
          />
        )}
        {vista === 'catalogo' && <Catalogo usuario={usuario} alAgregar={agregarAlCarrito} />}
        {vista === 'carrito' && esCliente && (
          <CarritoPagina usuario={usuario} carrito={carrito} recargarCarrito={recargarCarrito} />
        )}
        {vista === 'pedidos' && usuario && <MisPedidos usuario={usuario} />}
        {vista === 'admin' && esInterno && <Admin />}
      </main>

      <Asistente
        usuario={usuario}
        alAgregar={agregarAlCarrito}
        onNavegar={setVista}
        onIniciarSesion={() => setVista('login')}
      />
    </div>
  );
}

function BotonNav({ activo, onClick, children }) {
  return (
    <button
      onClick={onClick}
      aria-current={activo ? 'page' : undefined}
      className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
        activo ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Inicio de sesion con correo y contrasena.
 *
 * Antes el correo era un desplegable con las cuatro cuentas de prueba y la
 * contrasena venia escrita: nadie mas podia entrar (hallazgo U-01 de
 * docs/calidad/USABILIDAD.md, severidad 4). Las cuentas de prueba siguen a la
 * vista, pero como ayuda, no como unica opcion.
 */
function Login({ onIngreso }) {
  const [registrando, setRegistrando] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const enviar = async (e) => {
    e?.preventDefault();
    setCargando(true);
    setError(null);
    try {
      onIngreso(await iniciarSesion(email, password));
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  if (registrando) return <Registro onIngreso={onIngreso} onVolver={() => setRegistrando(false)} />;

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 mt-6 sm:mt-10">
      <form onSubmit={enviar} className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8">
        <h1 className="text-xl font-bold mb-6">Iniciar sesión</h1>

        {error && (
          <div role="alert" className="mb-4 bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        <label htmlFor="login-correo" className="block text-sm font-semibold text-gray-700 mb-1">
          Correo
        </label>
        <input
          id="login-correo"
          type="email"
          autoComplete="username"
          required
          placeholder="nombre@correo.co"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4"
        />

        <label htmlFor="login-password" className="block text-sm font-semibold text-gray-700 mb-1">
          Contraseña
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-6"
        />

        <button
          type="submit"
          disabled={cargando}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold py-2.5 rounded-lg"
        >
          {cargando ? 'Verificando...' : 'Ingresar'}
        </button>

        <p className="mt-4 text-sm text-center text-gray-600">
          ¿No tienes cuenta?{' '}
          <button type="button" onClick={() => setRegistrando(true)} className="text-indigo-700 font-semibold hover:underline">
            Crear cuenta
          </button>
        </p>

        {/* Ayuda del entorno de laboratorio: las cuentas de prueba a la vista,
            sin escribirlas por el usuario. */}
        <details className="mt-6 text-sm text-gray-600">
          <summary className="cursor-pointer font-semibold text-gray-700">Cuentas de prueba</summary>
          <p className="mt-2">
            Todas usan la contraseña <code>Password123</code>.
          </p>
          <ul className="mt-2 space-y-1">
            {CUENTAS.map(([correo, etiqueta]) => (
              <li key={correo}>
                <code>{correo}</code> · {etiqueta}
              </li>
            ))}
          </ul>
        </details>
      </form>
    </div>
  );
}

/**
 * Registro de un cliente nuevo (Trabajo Final, Fase 5; RF-01, RF-07, RF-09).
 *
 * Tres llamadas en orden: el perfil en clientes-service, la cuenta en
 * auth-service (que verifica que el correo y el cliente_id coincidan, S-01) y,
 * ya con sesion, la direccion de envio predeterminada. Sin direccion, la saga
 * rechazaria la primera compra.
 */
function Registro({ onIngreso, onVolver }) {
  const [datos, setDatos] = useState({ nombre: '', apellido: '', email: '', password: '', linea1: '', ciudad: '' });
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const campo = (nombre) => ({
    id: `registro-${nombre}`,
    value: datos[nombre],
    onChange: (e) => setDatos((d) => ({ ...d, [nombre]: e.target.value })),
    className: 'w-full border border-gray-300 rounded-lg px-3 py-2 mb-4'
  });

  const enviar = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError(null);
    try {
      const { cliente } = await api('/clientes', {
        metodo: 'POST',
        cuerpo: { nombre: datos.nombre, apellido: datos.apellido, email: datos.email }
      });
      await api('/auth/registro', {
        metodo: 'POST',
        cuerpo: { email: datos.email, password: datos.password, cliente_id: cliente.id }
      });
      const usuario = await iniciarSesion(datos.email, datos.password);
      await api(`/clientes/${cliente.id}/direcciones`, {
        metodo: 'POST',
        cuerpo: { tipo: 'envio', etiqueta: 'Principal', linea1: datos.linea1, ciudad: datos.ciudad, predeterminada: true }
      });
      onIngreso(usuario);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  const etiqueta = (nombre, texto) => (
    <label htmlFor={`registro-${nombre}`} className="block text-sm font-semibold text-gray-700 mb-1">
      {texto}
    </label>
  );

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 mt-6 sm:mt-10">
      <form onSubmit={enviar} className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8">
        <h1 className="text-xl font-bold mb-6">Crear cuenta</h1>
        {error && (
          <div role="alert" className="mb-4 bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}
        <div className="grid grid-cols-2 gap-x-3">
          <div>
            {etiqueta('nombre', 'Nombre')}
            <input {...campo('nombre')} required autoComplete="given-name" maxLength={100} />
          </div>
          <div>
            {etiqueta('apellido', 'Apellido')}
            <input {...campo('apellido')} required autoComplete="family-name" maxLength={100} />
          </div>
        </div>
        {etiqueta('email', 'Correo')}
        <input {...campo('email')} type="email" required autoComplete="email" maxLength={150} />
        {etiqueta('password', 'Contraseña (mínimo 8 caracteres)')}
        <input {...campo('password')} type="password" required minLength={8} autoComplete="new-password" />
        {etiqueta('linea1', 'Dirección de envío')}
        <input {...campo('linea1')} required autoComplete="street-address" maxLength={200} placeholder="Calle 10 # 5-20" />
        {etiqueta('ciudad', 'Ciudad')}
        <input {...campo('ciudad')} required autoComplete="address-level2" maxLength={100} />
        <button
          type="submit"
          disabled={cargando}
          className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold py-2.5 rounded-lg"
        >
          {cargando ? 'Creando la cuenta...' : 'Crear cuenta'}
        </button>
        <p className="mt-4 text-sm text-center text-gray-600">
          ¿Ya tienes cuenta?{' '}
          <button type="button" onClick={onVolver} className="text-indigo-700 font-semibold hover:underline">
            Iniciar sesión
          </button>
        </p>
      </form>
    </div>
  );
}
