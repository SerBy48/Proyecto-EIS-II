import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api, cerrarSesion, iniciarSesion, sesion } from './servicios/api';
import Catalogo from './paginas/Catalogo.jsx';
import CarritoPagina from './paginas/Carrito.jsx';
import MisPedidos from './paginas/MisPedidos.jsx';
import Admin from './paginas/Admin.jsx';

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
      await api(`/carrito/${usuario.cliente_id}/items`, {
        metodo: 'POST',
        cuerpo: { sku, cantidad: 1 }
      });
      await recargarCarrito();
      setAviso({ tipo: 'ok', texto: `${sku} agregado al carrito.` });
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
            Tienda en linea
          </button>

          <nav aria-label="Principal" className="order-last sm:order-none w-full sm:w-auto flex flex-wrap items-center gap-1 text-sm">
            <BotonNav activo={vista === 'catalogo'} onClick={() => setVista('catalogo')}>
              Catalogo
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
                Administracion
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
                Iniciar sesion
              </button>
            )}
          </div>
        </div>
      </header>

      <main id="contenido" tabIndex={-1} className="pb-16 focus:outline-none">
        {/* La region viva existe siempre: si se montara junto con el texto, los
            lectores de pantalla no anunciarian el primer aviso. */}
        <div role="status" aria-live="polite" className="max-w-7xl mx-auto px-4 sm:px-6">
          {aviso && (
            <div
              className={`mt-4 text-sm rounded-lg p-3 ${
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

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 mt-6 sm:mt-10">
      <form onSubmit={enviar} className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8">
        <h1 className="text-xl font-bold mb-6">Iniciar sesion</h1>

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
          Contrasena
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

        {/* Ayuda del entorno de laboratorio: las cuentas de prueba a la vista,
            sin escribirlas por el usuario. */}
        <details className="mt-6 text-sm text-gray-600">
          <summary className="cursor-pointer font-semibold text-gray-700">Cuentas de prueba</summary>
          <p className="mt-2">
            Todas usan la contrasena <code>Password123</code>.
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
