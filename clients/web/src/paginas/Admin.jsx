import React, { useEffect, useState } from 'react';
import { api, BASE, moneda } from '../servicios/api';

/**
 * Panel de administracion (seccion 5.1: panel utilizado por el personal
 * interno). Incluye la vista de salud del sistema, que es la herramienta con la
 * que el operador responde la pregunta 4 del analisis: ver de un vistazo que
 * servicio esta caido y que sigue funcionando.
 */
export default function Admin({ usuario }) {
  const [vista, setVista] = useState('salud');
  const esAdministrador = usuario?.rol === 'administrador';

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <h1 className="sr-only">Panel de administración</h1>
      <nav aria-label="Secciones de administración" className="relative flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
        {[
          ['salud', 'Salud del sistema'],
          ['inventario', 'Inventario'],
          ['pedidos', 'Pedidos'],
          ['notificaciones', 'Notificaciones'],
          ...(esAdministrador ? [['usuarios', 'Usuarios']] : [])
        ].map(([id, etiqueta]) => (
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

      {vista === 'salud' && <Salud />}
      {vista === 'inventario' && <Inventario />}
      {vista === 'pedidos' && <PedidosAdmin />}
      {vista === 'notificaciones' && <Notificaciones />}
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

function Salud() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  const cargar = async () => {
    try {
      // /api/health responde 503 cuando algo esta caido: eso no es un fallo de
      // la consulta, es la informacion que se busca. Se lee el cuerpo igual.
      const respuesta = await fetch(`${BASE}/health`);
      setDatos(await respuesta.json());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, 10000);
    return () => clearInterval(intervalo);
  }, []);

  if (error) return <p role="alert" className="text-red-700">No se pudo consultar la salud: {error}</p>;
  if (!datos) return <p role="status" className="text-gray-500">Consultando...</p>;

  return (
    <div>
      <h2 className="sr-only">Salud del sistema</h2>
      <div className="flex flex-wrap gap-2 items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          Actualizado {new Date(datos.hora).toLocaleTimeString('es-CO')} · se refresca cada 10 s
        </p>
        {datos.servicios_caidos?.length > 0 && (
          <span className="text-sm font-semibold text-red-700">
            {datos.servicios_caidos.length} servicio(s) con problemas
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {datos.servicios?.map((s) => (
          <div
            key={s.servicio}
            className={`rounded-xl border p-4 ${
              s.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold capitalize">{s.servicio}</p>
              <span
                aria-hidden="true"
                className={`w-2.5 h-2.5 rounded-full ${s.ok ? 'bg-green-500' : 'bg-red-500'}`}
              />
            </div>
            <p className={`text-xs ${s.ok ? 'text-green-800' : 'text-red-800'}`}>{s.estado}</p>

            {s.dependencias?.length > 0 && (
              <ul className="mt-3 space-y-1">
                {s.dependencias.map((d) => (
                  <li key={d.nombre} className="text-xs flex items-center gap-1.5 text-gray-600">
                    <span
                      aria-hidden="true"
                      className={d.ok ? 'text-green-600' : d.critica ? 'text-red-600' : 'text-amber-600'}
                    >
                      {d.ok ? '●' : '○'}
                    </span>
                    <span className="truncate">{d.nombre}</span>
                    <span className="sr-only">{d.ok ? ': conectada' : ': caida'}</span>
                    {!d.ok && !d.critica && <span className="text-amber-700">(no critica)</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs text-gray-500 leading-relaxed max-w-2xl">
        Una dependencia marcada como no critica (por ejemplo el message broker) puede estar caida
        sin que el servicio se considere fuera de línea: los eventos quedan pendientes y se
        procesan al restablecerse, pero la venta sigue funcionando.
      </p>
    </div>
  );
}

function Inventario() {
  const [alertas, setAlertas] = useState([]);
  const [sku, setSku] = useState('');
  const [cantidad, setCantidad] = useState(10);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  const cargar = async () => {
    try {
      setAlertas(await api('/inventario/alertas'));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const reponer = async () => {
    setMensaje(null);
    setError(null);
    try {
      const r = await api(`/inventario/stock/${encodeURIComponent(sku)}/entrada`, {
        metodo: 'POST',
        cuerpo: { cantidad: Number(cantidad) }
      });
      setMensaje(`${sku}: ahora hay ${r.stock.cantidad_disponible} unidades.`);
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <h2 className="font-bold mb-3">Alertas de reposicion</h2>
        {error && <p role="alert" className="text-red-700 text-sm mb-3">{error}</p>}
        <div className="relative bg-superficie border border-gray-200 rounded-xl overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 text-left">
              <tr>
                <th className="px-4 py-2">SKU</th>
                <th className="px-4 py-2">Bodega</th>
                <th className="px-4 py-2">Disponible</th>
                <th className="px-4 py-2">Mínimo</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {alertas.map((a, i) => (
                <tr key={i} className={a.cantidad_disponible === 0 ? 'bg-red-50' : ''}>
                  <td className="px-4 py-2 font-mono text-xs">{a.sku}</td>
                  <td className="px-4 py-2">{a.bodega}</td>
                  <td className="px-4 py-2 font-semibold">{a.cantidad_disponible}</td>
                  <td className="px-4 py-2 text-gray-500">{a.stock_minimo}</td>
                </tr>
              ))}
              {alertas.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-4 py-6 text-center text-gray-500">
                    Ningún producto por debajo del mínimo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-superficie border border-gray-200 rounded-xl p-5 h-fit">
        <h2 className="font-bold mb-3">Registrar entrada</h2>
        <div role="status">
          {mensaje && <p className="text-green-700 text-sm mb-3">{mensaje}</p>}
        </div>
        <label htmlFor="entrada-sku" className="block text-xs font-semibold text-gray-700 mb-1">
          SKU
        </label>
        <input
          id="entrada-sku"
          value={sku}
          onChange={(e) => setSku(e.target.value.toUpperCase())}
          placeholder="SKU-TEC-004"
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm mb-3"
        />
        <label htmlFor="entrada-cantidad" className="block text-xs font-semibold text-gray-700 mb-1">
          Cantidad
        </label>
        <input
          id="entrada-cantidad"
          type="number"
          min="1"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm mb-4"
        />
        <button
          onClick={reponer}
          disabled={!sku}
          className="w-full btn-primario text-sm py-2 rounded"
        >
          Registrar
        </button>
      </div>
    </div>
  );
}

function PedidosAdmin() {
  const [pedidos, setPedidos] = useState([]);
  const [error, setError] = useState(null);
  // Bitacora de la saga del pedido elegido (solo administrador: la API
  // responde 403 a un vendedor).
  const [saga, setSaga] = useState(null);

  const verSaga = async (pedido) => {
    try {
      setSaga({ numero: pedido.numero, pasos: await api(`/pedidos/${pedido.id}/saga`) });
      setError(null);
    } catch (e) {
      setSaga(null);
      setError(e.estado === 403 ? 'Solo un administrador puede ver la bitácora de la saga.' : e.message);
    }
  };

  const cargar = async () => {
    try {
      setPedidos(await api('/pedidos'));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const avanzar = async (id, estado) => {
    try {
      await api(`/pedidos/${id}/estado`, { metodo: 'PATCH', cuerpo: { estado } });
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  };

  const SIGUIENTE = {
    pagado: 'en_preparacion',
    en_preparacion: 'enviado',
    enviado: 'entregado'
  };

  return (
    <div>
      <h2 className="font-bold mb-3">Pedidos del sistema</h2>
      {error && <p role="alert" className="text-red-700 text-sm mb-3">{error}</p>}
      <div className="relative bg-superficie border border-gray-200 rounded-xl overflow-x-auto">
        <table className="min-w-full text-sm whitespace-nowrap">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500 text-left">
            <tr>
              <th className="px-4 py-2">Número</th>
              <th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pedidos.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2 font-mono text-xs">{p.numero}</td>
                <td className="px-4 py-2">{p.cliente_id}</td>
                <td className="px-4 py-2 font-semibold">{moneda(p.total)}</td>
                <td className="px-4 py-2">{p.estado.replace('_', ' ')}</td>
                <td className="px-4 py-2">
                  {SIGUIENTE[p.estado] ? (
                    <button
                      onClick={() => avanzar(p.id, SIGUIENTE[p.estado])}
                      className="text-xs btn-oscuro px-2 py-1 rounded"
                    >
                      Marcar {SIGUIENTE[p.estado].replace('_', ' ')}
                      <span className="sr-only"> el pedido {p.numero}</span>
                    </button>
                  ) : (
                    <span className="text-xs text-gray-500">sin acciones</span>
                  )}
                  <button
                    onClick={() => verSaga(p)}
                    className="ml-2 text-xs border border-gray-300 hover:bg-gray-50 px-2 py-1 rounded"
                  >
                    Bitácora<span className="sr-only"> de la saga del pedido {p.numero}</span>
                  </button>
                </td>
              </tr>
            ))}
            {pedidos.length === 0 && (
              <tr>
                <td colSpan="5" className="px-4 py-6 text-center text-gray-500">
                  No hay pedidos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {saga && (
        <section aria-label={`Bitácora de la saga del pedido ${saga.numero}`} className="mt-6 bg-superficie border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold">Bitácora de la saga · {saga.numero}</h3>
            <button onClick={() => setSaga(null)} className="text-sm text-gray-600 hover:text-gray-900">
              Cerrar
            </button>
          </div>
          <ol className="space-y-1 text-sm">
            {saga.pasos.map((paso, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-mono text-xs text-gray-500 w-20">{new Date(paso.creado_en).toLocaleTimeString('es-CO')}</span>
                <span className="font-mono w-56">{paso.paso}</span>
                <span className={paso.estado === 'fallido' ? 'text-red-700' : paso.estado === 'compensado' ? 'text-amber-700' : 'text-gray-700'}>
                  {paso.estado}
                </span>
              </li>
            ))}
            {saga.pasos.length === 0 && <li className="text-gray-500">Sin pasos registrados.</li>}
          </ol>
        </section>
      )}
    </div>
  );
}

function Notificaciones() {
  const [mensajes, setMensajes] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/notificaciones/mensajes')
      .then(setMensajes)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h2 className="font-bold mb-3">Mensajes enviados</h2>
      <p className="text-sm text-gray-500 mb-4">
        Estos mensajes no los genera nadie por peticion directa: son la reaccion del servicio de
        notificaciones a los eventos publicados en el message broker.
      </p>
      {error && <p role="alert" className="text-red-700 text-sm mb-3">{error}</p>}
      <div className="space-y-2">
        {mensajes.map((m) => (
          <div key={m._id} className="bg-superficie border border-gray-200 rounded-lg p-4 text-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-4">
              <div className="min-w-0 break-words">
                <p className="font-semibold">{m.asunto}</p>
                <p className="text-gray-600 text-xs mt-1">{m.cuerpo}</p>
              </div>
              <div className="sm:text-right shrink-0">
                <span className="text-xs bg-gray-100 px-2 py-0.5 rounded uppercase">{m.canal}</span>
                <p className="text-xs text-gray-500 mt-1">{m.destinatario}</p>
                <p className="text-xs text-gray-500">{m.evento}</p>
              </div>
            </div>
          </div>
        ))}
        {mensajes.length === 0 && !error && (
          <p className="text-gray-500 text-sm">Todavía no se ha enviado ningún mensaje.</p>
        )}
      </div>
    </div>
  );
}
