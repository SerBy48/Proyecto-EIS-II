import React, { useEffect, useRef, useState } from 'react';
import { api, moneda } from '../servicios/api';
import Consultas from '../componentes/Consultas.jsx';
import Notificaciones from '../componentes/Notificaciones.jsx';
import { describirDireccion } from '../componentes/FormularioDireccion.jsx';
import Inventario from './admin/Inventario.jsx';
import Productos from './admin/Productos.jsx';
import Salud from './admin/Salud.jsx';

/**
 * Panel de administracion (seccion 5.1: panel utilizado por el personal
 * interno). La vista de salud del sistema es solo del administrador: es la
 * herramienta con la que responde la pregunta 4 del analisis (que servicio
 * esta caido, que sigue funcionando y que hacer). El vendedor entra a
 * Productos.
 */
export default function Admin({ usuario, pestanaInicial, consultaInicial, pedidoInicial, alAbrirNotificacion }) {
  const esAdministrador = usuario?.rol === 'administrador';
  const pestanas = [
    ...(esAdministrador ? [['salud', 'Salud del sistema']] : []),
    ['productos', 'Productos'],
    ['inventario', 'Inventario'],
    ['pedidos', 'Pedidos'],
    ['consultas', 'Consultas'],
    ['notificaciones', 'Notificaciones'],
    ...(esAdministrador ? [['usuarios', 'Usuarios']] : [])
  ];
  const [vista, setVista] = useState(() =>
    pestanas.some(([id]) => id === pestanaInicial) ? pestanaInicial : esAdministrador ? 'salud' : 'productos'
  );

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <h1 className="sr-only">Panel de administración</h1>
      <nav aria-label="Secciones de administración" className="relative flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
        {pestanas.map(([id, etiqueta]) => (
          <button
            key={id}
            onClick={() => setVista(id)}
            aria-current={vista === id ? 'page' : undefined}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              vista === id
                ? 'border-marca-600 text-marca-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </nav>

      {vista === 'salud' && esAdministrador && <Salud />}
      {vista === 'productos' && <Productos />}
      {vista === 'inventario' && <Inventario />}
      {vista === 'consultas' && <Consultas personal inicial={consultaInicial} />}
      {vista === 'pedidos' && <PedidosAdmin inicial={pedidoInicial} />}
      {vista === 'notificaciones' && <PestanaNotificaciones esAdministrador={esAdministrador} alAbrir={alAbrirNotificacion} />}
      {vista === 'usuarios' && esAdministrador && <Usuarios yo={usuario} />}
    </div>
  );
}

const NOMBRE_ROL = { cliente: 'Cliente', vendedor: 'Vendedor', administrador: 'Administrador' };

/**
 * Usuarios internos (solo administrador). SerByTek es una sola tienda: el
 * "vendedor" es personal de la tienda que maneja inventario y pedidos, no un
 * comerciante con su propio catalogo. Aqui el administrador crea vendedores,
 * cambia el rol de una cuenta interna y desactiva cuentas.
 */
function Usuarios({ yo }) {
  const [usuarios, setUsuarios] = useState(null);
  const [filtro, setFiltro] = useState('internos');
  const [nuevo, setNuevo] = useState({ email: '', password: '', rol: 'vendedor' });
  const [mensaje, setMensaje] = useState(null);
  const [creando, setCreando] = useState(false);

  const cargar = async () => {
    try {
      setUsuarios(await api('/auth/usuarios'));
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message });
    }
  };
  useEffect(() => {
    cargar();
  }, []);

  const crear = async (e) => {
    e.preventDefault();
    setCreando(true);
    setMensaje(null);
    try {
      await api('/auth/usuarios', { metodo: 'POST', cuerpo: nuevo });
      setMensaje({ tipo: 'ok', texto: `Se creó la cuenta ${nuevo.email} con el rol ${NOMBRE_ROL[nuevo.rol].toLowerCase()}.` });
      setNuevo({ email: '', password: '', rol: 'vendedor' });
      await cargar();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setCreando(false);
    }
  };

  const cambiar = async (u, cambios, texto) => {
    setMensaje(null);
    try {
      await api(`/auth/usuarios/${u.id}`, { metodo: 'PATCH', cuerpo: cambios });
      setMensaje({ tipo: 'ok', texto });
      await cargar();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    }
  };

  const visibles = (usuarios ?? []).filter((u) => (filtro === 'internos' ? u.rol !== 'cliente' : filtro === 'todos' ? true : u.rol === filtro));

  return (
    <div className="space-y-6">
      <h2 className="sr-only">Usuarios</h2>
      <div role="status" aria-live="polite">
        {mensaje && (
          <div className={`rounded-lg p-3 text-sm border ${mensaje.tipo === 'ok' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {mensaje.texto}
          </div>
        )}
      </div>

      <form onSubmit={crear} className="bg-superficie border border-gray-200 rounded-xl p-4 sm:p-5">
        <h3 className="font-bold text-gray-900 mb-1">Crear cuenta interna</h3>
        <p className="text-sm text-gray-600 mb-4">
          Los vendedores registran entradas de mercancía y avanzan los pedidos. Comparte la contraseña inicial por un canal seguro.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="sm:col-span-2">
            <label htmlFor="usuario-correo" className="block text-sm font-semibold text-gray-700 mb-1">Correo</label>
            <input id="usuario-correo" type="email" required maxLength={150} value={nuevo.email} onChange={(e) => setNuevo((n) => ({ ...n, email: e.target.value }))} className="w-full bg-superficie border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label htmlFor="usuario-rol" className="block text-sm font-semibold text-gray-700 mb-1">Rol</label>
            <select id="usuario-rol" value={nuevo.rol} onChange={(e) => setNuevo((n) => ({ ...n, rol: e.target.value }))} className="w-full bg-superficie border border-gray-300 rounded-lg px-3 py-2">
              <option value="vendedor">Vendedor</option>
              <option value="administrador">Administrador</option>
            </select>
          </div>
          <div>
            <label htmlFor="usuario-password" className="block text-sm font-semibold text-gray-700 mb-1">Contraseña inicial</label>
            <input id="usuario-password" type="text" required minLength={8} autoComplete="new-password" value={nuevo.password} onChange={(e) => setNuevo((n) => ({ ...n, password: e.target.value }))} className="w-full bg-superficie border border-gray-300 rounded-lg px-3 py-2" />
          </div>
        </div>
        <button type="submit" disabled={creando} className="mt-4 btn-primario px-5 py-2 text-sm">
          {creando ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>

      <div className="bg-superficie border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-900">Cuentas</h3>
          <label className="text-sm text-gray-700">
            <span className="mr-2">Mostrar</span>
            <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className="bg-superficie border border-gray-300 rounded-lg px-2 py-1">
              <option value="internos">Personal interno</option>
              <option value="vendedor">Vendedores</option>
              <option value="administrador">Administradores</option>
              <option value="cliente">Clientes</option>
              <option value="todos">Todas</option>
            </select>
          </label>
        </div>
        {!usuarios ? (
          <p className="p-4 text-gray-500">Cargando…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <caption className="sr-only">Cuentas de usuario</caption>
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2">Correo</th>
                  <th className="px-4 py-2">Rol</th>
                  <th className="px-4 py-2">Estado</th>
                  <th className="px-4 py-2">Último acceso</th>
                  <th className="px-4 py-2"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {visibles.map((u) => {
                  const soyYo = u.id === yo?.id || u.email === yo?.email;
                  return (
                    <tr key={u.id}>
                      <td className="px-4 py-2 break-all">{u.email}{soyYo && <span className="text-xs text-gray-500"> (tú)</span>}</td>
                      <td className="px-4 py-2">{NOMBRE_ROL[u.rol]}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.activo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                          {u.activo ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString('es-CO') : '—'}</td>
                      <td className="px-4 py-2 text-right whitespace-nowrap space-x-3">
                        {!soyYo && u.rol !== 'cliente' && (
                          <button
                            onClick={() => cambiar(u, { rol: u.rol === 'vendedor' ? 'administrador' : 'vendedor' }, `${u.email} ahora es ${u.rol === 'vendedor' ? 'administrador' : 'vendedor'}.`)}
                            className="text-marca-700 font-semibold hover:underline text-xs"
                          >
                            {u.rol === 'vendedor' ? 'Hacer administrador' : 'Hacer vendedor'}
                            <span className="sr-only"> a {u.email}</span>
                          </button>
                        )}
                        {!soyYo && (
                          <button
                            onClick={() => cambiar(u, { activo: !u.activo }, `La cuenta ${u.email} quedó ${u.activo ? 'desactivada' : 'activa'}.`)}
                            className={`font-semibold hover:underline text-xs ${u.activo ? 'text-red-700' : 'text-green-800'}`}
                          >
                            {u.activo ? 'Desactivar' : 'Activar'}
                            <span className="sr-only"> la cuenta {u.email}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!visibles.length && <p className="p-4 text-gray-500 text-sm">No hay cuentas con ese filtro.</p>}
          </div>
        )}
      </div>
    </div>
  );
}


const NOMBRE_ESTADO = {
  creado: 'Creado',
  pagado: 'Pagado',
  en_preparacion: 'En preparación',
  enviado: 'Enviado',
  entregado: 'Entregado',
  cancelado: 'Cancelado'
};
const estadoLegible = (estado) => NOMBRE_ESTADO[estado] ?? estado;
const fechaHora = (v) => (v ? new Date(v).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

const SIGUIENTE = {
  pagado: 'en_preparacion',
  en_preparacion: 'enviado',
  enviado: 'entregado'
};

/**
 * Pedidos del sistema. Cada pedido muestra cuando se creo y cuando cambio por
 * ultima vez; el detalle trae los productos, la direccion y la linea de tiempo
 * de sus estados con fecha y hora (tabla historial_estados, que llena un
 * trigger en cada transicion). Reemplaza la "bitacora de la saga", que era
 * informacion tecnica del checkout y no ayudaba a atender un pedido.
 */
function PedidosAdmin({ inicial }) {
  const [pedidos, setPedidos] = useState([]);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [detalle, setDetalle] = useState(null);
  const panel = useRef(null);

  const verDetalle = async (idONumero) => {
    try {
      setDetalle(await api(`/pedidos/${encodeURIComponent(idONumero)}`));
      setError(null);
      setTimeout(() => panel.current?.focus(), 0);
    } catch (e) {
      setError(e.message);
    }
  };

  const cargar = async () => {
    try {
      setPedidos(await api(`/pedidos${filtro ? `?estado=${filtro}` : ''}`));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  // Desde una notificacion se abre el pedido indicado.
  useEffect(() => {
    if (inicial) verDetalle(inicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicial]);

  const avanzar = async (id, estado) => {
    try {
      await api(`/pedidos/${id}/estado`, { metodo: 'PATCH', cuerpo: { estado } });
      await cargar();
      if (detalle?.id === id) await verDetalle(id);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-bold mr-auto">Pedidos del sistema</h2>
        <label className="text-sm text-gray-700">
          <span className="mr-2">Estado</span>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className="bg-superficie border border-gray-300 rounded-lg px-2 py-1">
            <option value="">Todos</option>
            {Object.entries(NOMBRE_ESTADO).map(([id, texto]) => (
              <option key={id} value={id}>
                {texto}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="text-red-700 text-sm">
          {error}
        </p>
      )}
      <div className="relative bg-superficie border border-gray-200 rounded-xl overflow-x-auto">
        <table className="min-w-full text-sm whitespace-nowrap">
          <caption className="sr-only">Pedidos del sistema</caption>
          <thead className="bg-gray-50 text-xs uppercase text-gray-500 text-left">
            <tr>
              <th className="px-4 py-2">Número</th>
              <th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Creado</th>
              <th className="px-4 py-2">Último cambio</th>
              <th className="px-4 py-2">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pedidos.map((p) => (
              <tr key={p.id} className={detalle?.id === p.id ? 'bg-marca-50' : ''}>
                <td className="px-4 py-2 font-mono text-xs">{p.numero}</td>
                <td className="px-4 py-2">{p.cliente_id}</td>
                <td className="px-4 py-2 font-semibold">{moneda(p.total)}</td>
                <td className="px-4 py-2">{estadoLegible(p.estado)}</td>
                <td className="px-4 py-2 text-gray-600">{fechaHora(p.creado_en)}</td>
                <td className="px-4 py-2 text-gray-600">{fechaHora(p.actualizado_en ?? p.creado_en)}</td>
                <td className="px-4 py-2 space-x-2">
                  {SIGUIENTE[p.estado] && (
                    <button onClick={() => avanzar(p.id, SIGUIENTE[p.estado])} className="text-xs btn-oscuro px-2 py-1 rounded">
                      Marcar {estadoLegible(SIGUIENTE[p.estado]).toLowerCase()}
                      <span className="sr-only"> el pedido {p.numero}</span>
                    </button>
                  )}
                  <button onClick={() => verDetalle(p.id)} className="text-xs border border-gray-300 hover:bg-gray-50 px-2 py-1 rounded">
                    Detalle<span className="sr-only"> del pedido {p.numero}</span>
                  </button>
                </td>
              </tr>
            ))}
            {pedidos.length === 0 && (
              <tr>
                <td colSpan="7" className="px-4 py-6 text-center text-gray-500">
                  No hay pedidos{filtro ? ` en estado ${estadoLegible(filtro).toLowerCase()}` : ''}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detalle && (
        <section
          ref={panel}
          tabIndex={-1}
          aria-labelledby="detalle-pedido-titulo"
          className="bg-superficie border border-gray-200 rounded-xl p-5 focus:outline-none scroll-mt-24"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h3 id="detalle-pedido-titulo" className="font-bold">
                Pedido {detalle.numero}
              </h3>
              <p className="text-sm text-gray-600">
                Cliente {detalle.cliente_id} · {estadoLegible(detalle.estado)} · total {moneda(detalle.total)}
              </p>
            </div>
            <button onClick={() => setDetalle(null)} className="text-sm text-gray-600 hover:text-gray-900">
              Cerrar<span className="sr-only"> el detalle del pedido</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Historial de estados</h4>
              <ol className="relative border-l-2 border-gray-200 ml-2 space-y-4">
                {detalle.historial.map((h, i) => (
                  <li key={i} className="ml-4">
                    <span
                      aria-hidden="true"
                      className={`absolute -left-[7px] mt-1 w-3 h-3 rounded-full ${h.estado_nuevo === 'cancelado' ? 'bg-red-600' : 'bg-marca-600'}`}
                    />
                    <p className="text-sm font-semibold text-gray-900">
                      {h.estado_anterior ? `${estadoLegible(h.estado_anterior)} → ${estadoLegible(h.estado_nuevo)}` : estadoLegible(h.estado_nuevo)}
                    </p>
                    <p className="text-xs text-gray-600">
                      <time dateTime={h.creado_en}>{fechaHora(h.creado_en)}</time>
                    </p>
                    {h.motivo && <p className="text-xs text-gray-700 mt-0.5">Motivo: {h.motivo}</p>}
                  </li>
                ))}
                {detalle.historial.length === 0 && <li className="ml-4 text-sm text-gray-500">Sin cambios de estado registrados.</li>}
              </ol>
              <p className="text-xs text-gray-500 mt-3">Creado el {fechaHora(detalle.creado_en)}</p>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Productos</h4>
                <ul className="text-sm divide-y divide-gray-100 border border-gray-200 rounded-lg">
                  {detalle.items.map((i) => (
                    <li key={i.sku} className="flex justify-between gap-3 px-3 py-2">
                      <span className="min-w-0">
                        <span className="block truncate">{i.nombre}</span>
                        <span className="block text-xs text-gray-500">
                          {i.sku} · {i.cantidad} × {moneda(i.precio_unitario)}
                        </span>
                      </span>
                      <span className="font-semibold shrink-0">{moneda(i.subtotal)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {detalle.direccion_envio && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-1">Dirección de envío</h4>
                  <p className="text-sm text-gray-700">{describirDireccion(detalle.direccion_envio)}</p>
                  {detalle.cambios_direccion > 0 && (
                    <p className="text-xs text-gray-500">El cliente cambió la dirección {detalle.cambios_direccion} vez(es).</p>
                  )}
                </div>
              )}
              {SIGUIENTE[detalle.estado] && (
                <button onClick={() => avanzar(detalle.id, SIGUIENTE[detalle.estado])} className="btn-oscuro text-sm px-3 py-1.5 rounded">
                  Marcar {estadoLegible(SIGUIENTE[detalle.estado]).toLowerCase()}
                </button>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Pestaña Notificaciones del panel: la bandeja del personal (la propia y la del
 * buzon de operaciones), con cada notificacion abrible: una consulta abre su
 * hilo listo para responder. El administrador tiene ademas el registro de
 * todos los envios del sistema (correos a clientes incluidos).
 */
function PestanaNotificaciones({ esAdministrador, alAbrir }) {
  const [modo, setModo] = useState('bandeja');
  return (
    <div className="space-y-4">
      {esAdministrador && (
        <div role="group" aria-label="Qué mostrar" className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-sm">
          {[
            ['bandeja', 'Mi bandeja'],
            ['registro', 'Registro de envíos']
          ].map(([id, texto]) => (
            <button
              key={id}
              onClick={() => setModo(id)}
              aria-pressed={modo === id}
              className={`px-3 py-1.5 font-semibold ${modo === id ? 'btn-primario rounded-none' : 'bg-superficie text-gray-700 hover:bg-gray-100'}`}
            >
              {texto}
            </button>
          ))}
        </div>
      )}
      {modo === 'bandeja' ? <Notificaciones personal onAbrir={alAbrir} /> : <RegistroEnvios />}
    </div>
  );
}

/** Registro de envios (solo administrador): todo lo que salio por correo. */
function RegistroEnvios() {
  const [mensajes, setMensajes] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/notificaciones/mensajes')
      .then(setMensajes)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h2 className="font-bold mb-1">Registro de envíos</h2>
      <p className="text-sm text-gray-600 mb-4">
        Los últimos 50 correos que envió el sistema, a clientes y al personal. Nadie los envía a mano: son la reacción del servicio de notificaciones a
        los eventos del message broker. Los enlaces de recuperación de contraseña no se guardan.
      </p>
      {error && (
        <p role="alert" className="text-red-700 text-sm mb-3">
          {error}
        </p>
      )}
      <div className="space-y-2">
        {mensajes.map((m) => (
          <div key={m._id} className="bg-superficie border border-gray-200 rounded-lg p-4 text-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-4">
              <div className="min-w-0 break-words">
                <p className="font-semibold">{m.asunto}</p>
                <p className="text-gray-600 text-xs mt-1">{m.texto ?? m.cuerpo}</p>
              </div>
              <div className="sm:text-right shrink-0">
                <span className="text-xs bg-gray-100 px-2 py-0.5 rounded uppercase">{m.canal}</span>
                <p className="text-xs text-gray-500 mt-1">{m.destinatario}</p>
                <p className="text-xs text-gray-500">{fechaHora(m.creado_en)}</p>
                <p className="text-xs text-gray-500">{m.estado}</p>
              </div>
            </div>
          </div>
        ))}
        {mensajes.length === 0 && !error && <p className="text-gray-500 text-sm">Todavía no se ha enviado ningún mensaje.</p>}
      </div>
    </div>
  );
}
