import React, { useCallback, useEffect, useRef, useState } from 'react';
import { EVENTO_SESION_EXPIRADA, api, cerrarSesion, iniciarSesion, sesion } from './servicios/api';
import { guardarTema, temaInicial } from './servicios/tema';
import Catalogo from './paginas/Catalogo.jsx';
import CarritoPagina from './paginas/Carrito.jsx';
import MisPedidos from './paginas/MisPedidos.jsx';
import Perfil from './paginas/Perfil.jsx';
import Admin from './paginas/Admin.jsx';
import Asistente from './componentes/Asistente.jsx';
import CampoContrasena from './componentes/CampoContrasena.jsx';
import { CamposDireccion, DIRECCION_VACIA, limpiarDireccion } from './componentes/FormularioDireccion.jsx';

const CUENTAS = [
  ['ana@correo.co', 'Ana (cliente)'],
  ['bruno@correo.co', 'Bruno (cliente)'],
  ['carla@correo.co', 'Carla (cliente)'],
  ['vendedor@tienda.co', 'Vendedor'],
  ['admin@tienda.co', 'Administrador']
];

/** Logotipo de SerByTek: un chip estilizado y el nombre. */
function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <svg aria-hidden="true" viewBox="0 0 32 32" className="w-8 h-8 shrink-0">
        <rect x="4" y="4" width="24" height="24" rx="6" fill="#047857" />
        <rect x="10" y="10" width="12" height="12" rx="2" fill="none" stroke="#ecfdf5" strokeWidth="2" />
        <path d="M13 1v4M19 1v4M13 27v4M19 27v4M1 13h4M1 19h4M27 13h4M27 19h4" stroke="#047857" strokeWidth="2" strokeLinecap="round" />
        <path d="M14 18l2-4 2 4" stroke="#6ee7b7" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-extrabold text-xl tracking-tight text-gray-900">
        SerBy<span className="text-marca-700">Tek</span>
      </span>
    </span>
  );
}

/** Interruptor de tema claro/oscuro (se recuerda en este navegador). */
function BotonTema() {
  const [tema, setTema] = useState(temaInicial);
  const oscuro = tema === 'oscuro';
  const cambiar = () => {
    const nuevo = oscuro ? 'claro' : 'oscuro';
    guardarTema(nuevo);
    setTema(nuevo);
  };
  return (
    <button
      onClick={cambiar}
      aria-pressed={oscuro}
      aria-label="Modo oscuro"
      title={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
    >
      {oscuro ? (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}

export default function App() {
  const [usuario, setUsuario] = useState(sesion.usuario);
  const [vista, setVista] = useState('catalogo');
  // Filtros con los que el asistente abre el catalogo; la clave remonta la vista.
  const [filtrosCatalogo, setFiltrosCatalogo] = useState({ clave: 0, filtros: undefined });
  const [carrito, setCarrito] = useState(null);
  const [aviso, setAviso] = useState(null);
  const temporizadorAviso = useRef(null);

  const esCliente = usuario?.rol === 'cliente';
  const esInterno = usuario && ['administrador', 'vendedor'].includes(usuario.rol);

  const mostrarAviso = useCallback((nuevo, ms = 3500) => {
    setAviso(nuevo);
    // Un aviso nuevo reinicia el temporizador: si no, el del aviso anterior
    // borraria este antes de tiempo.
    clearTimeout(temporizadorAviso.current);
    temporizadorAviso.current = setTimeout(() => setAviso(null), ms);
  }, []);

  // H-F5-02: si el servidor ya no acepta la sesion guardada, la web vuelve al
  // modo visitante y lo dice, en lugar de seguir mostrando la sesion iniciada.
  useEffect(() => {
    const alExpirar = () => {
      setUsuario(null);
      setCarrito(null);
      setVista((v) => (['carrito', 'pedidos', 'perfil', 'admin'].includes(v) ? 'login' : v));
      mostrarAviso({ tipo: 'error', texto: 'Tu sesión expiró. Inicia sesión de nuevo.' }, 6000);
    };
    window.addEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
    return () => window.removeEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
  }, [mostrarAviso]);

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
      mostrarAviso({ tipo: 'ok', texto: `${nombre} agregado al carrito.` });
    } catch (e) {
      mostrarAviso({ tipo: 'error', texto: e.message });
    }
  };

  const navegar = (destino, filtros) => {
    if (destino === 'catalogo' && filtros) setFiltrosCatalogo((f) => ({ clave: f.clave + 1, filtros }));
    setVista(destino);
  };

  const salir = async () => {
    await cerrarSesion();
    setUsuario(null);
    setCarrito(null);
    setVista('catalogo');
  };

  const cuentaEliminada = () => {
    sesion.limpiar();
    setUsuario(null);
    setCarrito(null);
    setVista('catalogo');
    mostrarAviso({ tipo: 'ok', texto: 'Tu cuenta fue eliminada. Gracias por haber comprado en SerByTek.' }, 6000);
  };

  const cantidadCarrito = carrito?.cantidad_items ?? 0;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-superficie focus:text-marca-700 focus:px-4 focus:py-2 focus:rounded-lg focus:shadow"
      >
        Saltar al contenido
      </a>
      <header className="bg-superficie border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <button onClick={() => navegar('catalogo')} aria-label="SerByTek, ir al catálogo" className="whitespace-nowrap">
            <Logo />
          </button>

          <nav aria-label="Principal" className="order-last sm:order-none w-full sm:w-auto flex flex-wrap items-center gap-1 text-sm">
            <BotonNav activo={vista === 'catalogo'} onClick={() => navegar('catalogo')}>
              Catálogo
            </BotonNav>
            {esCliente && (
              <>
                <BotonNav activo={vista === 'carrito'} onClick={() => navegar('carrito')}>
                  Carrito{cantidadCarrito > 0 && ` (${cantidadCarrito})`}
                </BotonNav>
                <BotonNav activo={vista === 'pedidos'} onClick={() => navegar('pedidos')}>
                  Mis pedidos
                </BotonNav>
                <BotonNav activo={vista === 'perfil'} onClick={() => navegar('perfil')}>
                  Mi perfil
                </BotonNav>
              </>
            )}
            {esInterno && (
              <BotonNav activo={vista === 'admin'} onClick={() => navegar('admin')}>
                Administración
              </BotonNav>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-sm">
            <BotonTema />
            {usuario ? (
              <>
                <span className="text-gray-600 hidden md:inline">
                  {usuario.email} · <span className="font-semibold">{usuario.rol}</span>
                </span>
                <button onClick={salir} className="border border-gray-300 hover:bg-gray-100 px-3 py-1.5 rounded-lg">
                  Salir
                </button>
              </>
            ) : (
              <button onClick={() => navegar('login')} className="btn-primario px-4 py-1.5">
                Iniciar sesión
              </button>
            )}
          </div>
        </div>
      </header>

      <main id="contenido" tabIndex={-1} className="flex-1 pb-16 focus:outline-none">
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
        {vista === 'catalogo' && (
          <Catalogo
            key={filtrosCatalogo.clave}
            usuario={usuario}
            alAgregar={agregarAlCarrito}
            filtrosIniciales={filtrosCatalogo.filtros}
          />
        )}
        {vista === 'carrito' && esCliente && (
          <CarritoPagina usuario={usuario} carrito={carrito} recargarCarrito={recargarCarrito} />
        )}
        {vista === 'pedidos' && usuario && <MisPedidos usuario={usuario} />}
        {vista === 'perfil' && esCliente && <Perfil usuario={usuario} alEliminarCuenta={cuentaEliminada} />}
        {vista === 'admin' && esInterno && <Admin usuario={usuario} />}
      </main>

      <PiePagina />


      <Asistente
        usuario={usuario}
        alAgregar={agregarAlCarrito}
        onNavegar={navegar}
        onIniciarSesion={() => navegar('login')}
      />
    </div>
  );
}

/** Iconos de redes sociales: trazos simples, decorativos (el nombre va en texto). */
const ICONOS_REDES = {
  Instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" />
    </>
  ),
  Facebook: <path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V9H7v3.5h2V21h3.5v-8.5h2.6l.4-3.5h-3V7a1 1 0 0 1 1-1H15z" />,
  TikTok: <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.5 2.5 2.3 4.2 5 4.5" />,
  YouTube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="M10 9.5v5l4.5-2.5z" fill="currentColor" />
    </>
  )
};

/**
 * Pie de pagina: informacion de compra, contacto y redes. Las cifras son las
 * mismas del carrito y del asistente (envio, umbral de envio gratis, IVA y
 * retracto); las redes y el correo son de la tienda de demostracion.
 */
function PiePagina() {
  const columna = (titulo, filas) => (
    <div>
      <h2 className="text-sm font-bold text-gray-900 mb-3">{titulo}</h2>
      <ul className="space-y-2 text-sm text-gray-600">{filas}</ul>
    </div>
  );
  return (
    <footer className="border-t border-gray-200 bg-superficie">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-3 text-sm text-gray-600">
            Tecnología para trabajar, estudiar y jugar, con envío a toda Colombia.
          </p>
          <p className="mt-2 text-sm text-gray-600">Tienda 100 % en línea · Neiva, Huila.</p>
        </div>

        {columna('Compra segura', [
          <li key="envio">Envío de $15.000; <strong className="text-gray-800">gratis desde $500.000</strong></li>,
          <li key="entrega">Entrega en 2 a 5 días hábiles</li>,
          <li key="pagos">Tarjeta de crédito o débito, PSE y Efecty</li>,
          <li key="retracto">5 días hábiles de retracto y garantía del fabricante</li>,
          <li key="datos">No guardamos los datos de tu tarjeta</li>
        ])}

        {columna('Contáctenos', [
          <li key="correo">
            <span className="block text-gray-500 text-xs">Correo</span>
            soporte@serbytek.co
          </li>,
          <li key="horario">
            <span className="block text-gray-500 text-xs">Atención de asesores</span>
            Lunes a viernes, 8:00 a. m. a 6:00 p. m.
          </li>,
          <li key="asistente">
            <span className="block text-gray-500 text-xs">Asistente virtual</span>
            Todos los días, botón «¿Necesitas ayuda?»
          </li>
        ])}

        {columna(
          'Síguenos',
          Object.entries(ICONOS_REDES).map(([red, icono]) => (
            <li key={red} className="flex items-center gap-2">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5 text-marca-700" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {icono}
              </svg>
              <span>
                {red} <span className="text-gray-500">@serbytek</span>
              </span>
            </li>
          ))
        )}
      </div>
      <div className="border-t border-gray-200">
        <p className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-24 text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1 justify-between">
          <span>© {new Date().getFullYear()} SerByTek. Todos los derechos reservados.</span>
          <span>Precios en pesos colombianos; el IVA (19 %) se suma en el carrito.</span>
          <span className="w-full">
            Tienda de demostración: los precios son de referencia y las marcas y productos mencionados pertenecen a sus respectivos dueños.
          </span>
        </p>
      </div>
    </footer>
  );
}

function BotonNav({ activo, onClick, children }) {
  return (
    <button
      onClick={onClick}
      aria-current={activo ? 'page' : undefined}
      className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
        activo ? 'bg-marca-50 text-marca-800' : 'text-gray-600 hover:bg-gray-100'
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
      <form onSubmit={enviar} className="bg-superficie border border-gray-200 rounded-xl p-6 sm:p-8">
        <h1 className="text-xl font-bold mb-1">Iniciar sesión</h1>
        <p className="text-sm text-gray-600 mb-6">Bienvenido de nuevo a SerByTek.</p>

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
          className="w-full bg-superficie border border-gray-300 rounded-lg px-3 py-2 mb-4"
        />

        <label htmlFor="login-password" className="block text-sm font-semibold text-gray-700 mb-1">
          Contraseña
        </label>
        <div className="mb-6">
          <CampoContrasena
            id="login-password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button type="submit" disabled={cargando} className="w-full btn-primario py-2.5">
          {cargando ? 'Verificando...' : 'Ingresar'}
        </button>

        <p className="mt-4 text-sm text-center text-gray-600">
          ¿No tienes cuenta?{' '}
          <button type="button" onClick={() => setRegistrando(true)} className="text-marca-700 font-semibold hover:underline">
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
 * Registro de un cliente nuevo (RF-01, RF-07, RF-09).
 *
 * Tres llamadas en orden: el perfil en clientes-service, la cuenta en
 * auth-service (que verifica que el correo y el cliente_id coincidan, S-01) y,
 * ya con sesion, la direccion de envio predeterminada con su departamento. Sin
 * direccion, la saga rechazaria la primera compra.
 */
function Registro({ onIngreso, onVolver }) {
  const [datos, setDatos] = useState({ nombre: '', apellido: '', email: '', password: '' });
  const [direccion, setDireccion] = useState({ ...DIRECCION_VACIA, etiqueta: 'Principal' });
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const campo = (nombre) => ({
    id: `registro-${nombre}`,
    value: datos[nombre],
    onChange: (e) => setDatos((d) => ({ ...d, [nombre]: e.target.value })),
    className: 'w-full bg-superficie border border-gray-300 rounded-lg px-3 py-2 mb-4'
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
        cuerpo: { tipo: 'envio', ...limpiarDireccion(direccion), predeterminada: true }
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
    <div className="max-w-lg mx-auto p-4 sm:p-6 mt-6 sm:mt-10">
      <form onSubmit={enviar} className="bg-superficie border border-gray-200 rounded-xl p-6 sm:p-8">
        <h1 className="text-xl font-bold mb-1">Crear cuenta</h1>
        <p className="text-sm text-gray-600 mb-6">Compra tecnología en SerByTek con envío a toda Colombia.</p>
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
        <div className="mb-5">
          <CampoContrasena
            id="registro-password"
            value={datos.password}
            onChange={(e) => setDatos((d) => ({ ...d, password: e.target.value }))}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <fieldset className="border-t border-gray-200 pt-4">
          <legend className="text-sm font-bold text-gray-900 pr-2">Dirección de envío</legend>
          <div className="mt-2">
            <CamposDireccion valor={direccion} alCambiar={setDireccion} prefijo="registro" />
          </div>
        </fieldset>
        <button type="submit" disabled={cargando} className="w-full mt-6 btn-primario py-2.5">
          {cargando ? 'Creando la cuenta...' : 'Crear cuenta'}
        </button>
        <p className="mt-4 text-sm text-center text-gray-600">
          ¿Ya tienes cuenta?{' '}
          <button type="button" onClick={onVolver} className="text-marca-700 font-semibold hover:underline">
            Iniciar sesión
          </button>
        </p>
      </form>
    </div>
  );
}
