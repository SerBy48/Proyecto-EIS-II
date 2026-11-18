import React, { useEffect, useState } from 'react';
import { api, moneda } from '../../servicios/api';

/**
 * Pestaña Inventario del panel: alertas de reposicion, entrada de mercancia
 * con su soporte (proveedor, costo, factura o remision) e historial de
 * entradas, y los proveedores con su contacto (RF-51).
 */

const claseCampo = 'w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-superficie';
const etiqueta = 'block text-xs font-semibold text-gray-700 mb-1';

export default function Inventario() {
  const [alertas, setAlertas] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [entradas, setEntradas] = useState([]);
  const [filtroSku, setFiltroSku] = useState('');
  const [error, setError] = useState(null);

  const cargarAlertas = () => api('/inventario/alertas').then(setAlertas).catch((e) => setError(e.message));
  const cargarProveedores = () => api('/inventario/proveedores?todos=true').then(setProveedores).catch((e) => setError(e.message));
  const cargarEntradas = (sku = filtroSku) =>
    api(`/inventario/entradas${sku ? `?sku=${encodeURIComponent(sku)}` : ''}`).then(setEntradas).catch((e) => setError(e.message));

  useEffect(() => {
    cargarAlertas();
    cargarProveedores();
    cargarEntradas('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-8">
      {error && (
        <p role="alert" className="text-red-700 text-sm">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <h2 className="font-bold mb-3">Alertas de reposición</h2>
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

        <div className="lg:col-span-3">
          <RegistrarEntrada
            proveedores={proveedores.filter((p) => p.activo)}
            alProveedorNuevo={cargarProveedores}
            alRegistrar={(sku) => {
              cargarAlertas();
              setFiltroSku(sku);
              cargarEntradas(sku);
            }}
          />
        </div>
      </div>

      <section aria-labelledby="entradas-titulo">
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <h2 id="entradas-titulo" className="font-bold mr-auto">
            Historial de entradas
          </h2>
          <div>
            <label htmlFor="entradas-sku" className={etiqueta}>
              Filtrar por SKU
            </label>
            <input
              id="entradas-sku"
              value={filtroSku}
              onChange={(e) => setFiltroSku(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && cargarEntradas()}
              placeholder="SKU-TEC-004"
              className={claseCampo}
            />
          </div>
          <button onClick={() => cargarEntradas()} className="border border-gray-300 px-3 py-1.5 rounded text-sm hover:bg-gray-100">
            Filtrar
          </button>
          {filtroSku && (
            <button
              onClick={() => {
                setFiltroSku('');
                cargarEntradas('');
              }}
              className="text-sm text-marca-700 font-semibold hover:underline"
            >
              Ver todas
            </button>
          )}
        </div>
        <div className="relative bg-superficie border border-gray-200 rounded-xl overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 text-left">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2 text-right">Cantidad</th>
                <th className="px-3 py-2">Proveedor</th>
                <th className="px-3 py-2 text-right">Costo unitario</th>
                <th className="px-3 py-2">Factura / remisión</th>
                <th className="px-3 py-2">Registró</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entradas.map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(e.creado_en).toLocaleString('es-CO')}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {e.sku}
                    <span className="block text-gray-500 font-sans">{e.bodega}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">{e.cantidad}</td>
                  <td className="px-3 py-2">
                    {e.proveedor ?? <span className="text-gray-500">—</span>}
                    {e.proveedor_contacto && <span className="block text-xs text-gray-500">{e.proveedor_contacto}</span>}
                  </td>
                  <td className="px-3 py-2 text-right">{e.costo_unitario === null ? '—' : moneda(e.costo_unitario)}</td>
                  <td className="px-3 py-2">
                    {e.documento ?? '—'}
                    {e.observacion && <span className="block text-xs text-gray-500">{e.observacion}</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">{e.registrado_por ?? '—'}</td>
                </tr>
              ))}
              {entradas.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-4 py-6 text-center text-gray-500">
                    No hay entradas registradas{filtroSku ? ` para ${filtroSku}` : ''}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Proveedores proveedores={proveedores} recargar={cargarProveedores} />
    </div>
  );
}

const ENTRADA_VACIA = { sku: '', cantidad: '10', proveedor_id: '', costo_unitario: '', documento: '', observacion: '' };

function RegistrarEntrada({ proveedores, alProveedorNuevo, alRegistrar }) {
  const [datos, setDatos] = useState(ENTRADA_VACIA);
  const [producto, setProducto] = useState(null);
  const [sugerencias, setSugerencias] = useState([]);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [proveedorNuevo, setProveedorNuevo] = useState(false);
  const cambiar = (campo, valor) => setDatos((d) => ({ ...d, [campo]: valor }));

  // Buscador de producto: por nombre o por SKU, con el catalogo.
  useEffect(() => {
    const texto = datos.sku.trim();
    if (texto.length < 2) return setSugerencias([]);
    // Una respuesta que llega despues de que se siguio escribiendo se descarta.
    let vigente = true;
    const t = setTimeout(() => {
      api(`/catalogo/productos?q=${encodeURIComponent(texto)}&limite=8&incluir_inactivos=true`)
        .then((r) => {
          if (!vigente) return;
          setSugerencias(r.productos ?? []);
          const exacto = (r.productos ?? []).find((p) => p.sku === texto.toUpperCase());
          setProducto(exacto ?? null);
        })
        .catch(() => setSugerencias([]));
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [datos.sku]);

  const costo = Number(datos.costo_unitario || 0);
  const costoAlto = producto && costo > 0 && costo >= producto.precio_final;

  const registrar = async (e) => {
    e.preventDefault();
    setMensaje(null);
    setError(null);
    const sku = (producto?.sku ?? datos.sku).trim().toUpperCase();
    setGuardando(true);
    try {
      const r = await api(`/inventario/stock/${encodeURIComponent(sku)}/entrada`, {
        metodo: 'POST',
        cuerpo: {
          cantidad: Number(datos.cantidad),
          ...(datos.proveedor_id ? { proveedor_id: Number(datos.proveedor_id) } : {}),
          ...(datos.costo_unitario !== '' ? { costo_unitario: Number(datos.costo_unitario) } : {}),
          documento: datos.documento,
          observacion: datos.observacion
        }
      });
      setMensaje(`${sku}: ahora hay ${r.stock.cantidad_disponible} unidades.`);
      setDatos(ENTRADA_VACIA);
      setProducto(null);
      alRegistrar(sku);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={registrar} aria-labelledby="entrada-titulo" className="bg-superficie border border-gray-200 rounded-xl p-5">
      <h2 id="entrada-titulo" className="font-bold mb-3">
        Registrar entrada de mercancía
      </h2>
      <div role="status">{mensaje && <p className="text-green-700 text-sm mb-3">{mensaje}</p>}</div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label htmlFor="entrada-sku" className={etiqueta}>
            Producto (nombre o SKU)
          </label>
          <input
            id="entrada-sku"
            list="entrada-sugerencias"
            value={datos.sku}
            onChange={(e) => cambiar('sku', e.target.value)}
            placeholder="SKU-TEC-004 o Keychron"
            autoComplete="off"
            required
            aria-describedby="entrada-producto"
            className={claseCampo}
          />
          <datalist id="entrada-sugerencias">
            {sugerencias.map((p) => (
              <option key={p.sku} value={p.sku}>
                {p.nombre}
              </option>
            ))}
          </datalist>
          <p id="entrada-producto" className="text-xs mt-1 text-gray-600">
            {producto
              ? `${producto.nombre} · stock actual ${producto.disponible ?? 'sin registro'} · precio ${moneda(producto.precio_final)}`
              : 'Escribe el nombre o el SKU y elige el producto de la lista.'}
          </p>
        </div>

        <div>
          <label htmlFor="entrada-cantidad" className={etiqueta}>
            Cantidad
          </label>
          <input
            id="entrada-cantidad"
            type="number"
            min="1"
            max="100000"
            step="1"
            value={datos.cantidad}
            onChange={(e) => cambiar('cantidad', e.target.value)}
            required
            className={claseCampo}
          />
        </div>
        <div>
          <label htmlFor="entrada-costo" className={etiqueta}>
            Costo unitario (COP, opcional)
          </label>
          <input
            id="entrada-costo"
            type="number"
            min="0"
            step="1"
            value={datos.costo_unitario}
            onChange={(e) => cambiar('costo_unitario', e.target.value)}
            aria-describedby="entrada-costo-aviso"
            className={claseCampo}
          />
          <p id="entrada-costo-aviso" className={`text-xs mt-1 ${costoAlto ? 'text-amber-800 font-semibold' : 'text-gray-500'}`}>
            {costoAlto ? 'Ojo: el costo es igual o mayor que el precio de venta.' : 'Lo que pagó la tienda por cada unidad.'}
          </p>
        </div>

        <div>
          <label htmlFor="entrada-proveedor" className={etiqueta}>
            Proveedor
          </label>
          <select
            id="entrada-proveedor"
            value={datos.proveedor_id}
            onChange={(e) => cambiar('proveedor_id', e.target.value)}
            className={claseCampo}
          >
            <option value="">Sin proveedor (ajuste o devolución)</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setProveedorNuevo((v) => !v)} className="text-xs text-marca-700 font-semibold mt-1 hover:underline">
            {proveedorNuevo ? 'Cancelar proveedor nuevo' : '+ Proveedor nuevo'}
          </button>
        </div>
        <div>
          <label htmlFor="entrada-documento" className={etiqueta}>
            Factura o remisión (opcional)
          </label>
          <input
            id="entrada-documento"
            value={datos.documento}
            onChange={(e) => cambiar('documento', e.target.value)}
            maxLength={40}
            placeholder="FV-10234"
            className={claseCampo}
          />
        </div>

        {proveedorNuevo && (
          <div className="sm:col-span-2 border border-dashed border-marca-300 rounded-lg p-3">
            <FormularioProveedor
              prefijo="entrada-prov"
              alGuardar={async (p) => {
                await alProveedorNuevo();
                cambiar('proveedor_id', String(p.id));
                setProveedorNuevo(false);
              }}
            />
          </div>
        )}

        <div className="sm:col-span-2">
          <label htmlFor="entrada-observacion" className={etiqueta}>
            Observación (opcional)
          </label>
          <textarea
            id="entrada-observacion"
            value={datos.observacion}
            onChange={(e) => cambiar('observacion', e.target.value)}
            maxLength={300}
            rows={2}
            placeholder="Estado de la mercancía, lote, quién la recibió..."
            className={claseCampo}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="text-red-700 text-sm mt-3">
          {error}
        </p>
      )}
      <button type="submit" disabled={!datos.sku.trim() || guardando} className="mt-4 w-full btn-primario text-sm py-2 rounded">
        {guardando ? 'Registrando...' : 'Registrar entrada'}
      </button>
    </form>
  );
}

const PROVEEDOR_VACIO = { nombre: '', nit: '', contacto: '', telefono: '', email: '' };

function FormularioProveedor({ prefijo, inicial, alGuardar, alCancelar }) {
  const [datos, setDatos] = useState(inicial ?? PROVEEDOR_VACIO);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const cambiar = (campo, valor) => setDatos((d) => ({ ...d, [campo]: valor }));

  // Un formulario dentro de otro no es valido en HTML: se envia con el boton.
  const guardar = async () => {
    setError(null);
    setGuardando(true);
    try {
      const cuerpo = { nombre: datos.nombre, nit: datos.nit, contacto: datos.contacto, telefono: datos.telefono, email: datos.email };
      const guardado = inicial
        ? await api(`/inventario/proveedores/${inicial.id}`, { metodo: 'PATCH', cuerpo })
        : await api('/inventario/proveedores', { metodo: 'POST', cuerpo });
      if (!inicial) setDatos(PROVEEDOR_VACIO);
      await alGuardar(guardado);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const campo = (id, texto, props = {}) => (
    <div>
      <label htmlFor={`${prefijo}-${id}`} className={etiqueta}>
        {texto}
      </label>
      <input id={`${prefijo}-${id}`} value={datos[id] ?? ''} onChange={(e) => cambiar(id, e.target.value)} className={claseCampo} {...props} />
    </div>
  );

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {campo('nombre', 'Razón social', { maxLength: 120 })}
        {campo('nit', 'NIT', { maxLength: 20, placeholder: '900123456-1' })}
        {campo('contacto', 'Persona de contacto', { maxLength: 120 })}
        {campo('telefono', 'Teléfono', { maxLength: 20, inputMode: 'tel' })}
        <div className="sm:col-span-2">{campo('email', 'Correo', { maxLength: 160, type: 'email' })}</div>
      </div>
      {error && (
        <p role="alert" className="text-red-700 text-sm mt-2">
          {error}
        </p>
      )}
      <div className="flex gap-2 mt-3">
        <button type="button" onClick={guardar} disabled={guardando} className="btn-primario text-sm px-4 py-1.5 rounded">
          {guardando ? 'Guardando...' : inicial ? 'Guardar proveedor' : 'Crear proveedor'}
        </button>
        {alCancelar && (
          <button type="button" onClick={alCancelar} className="border border-gray-300 text-sm px-4 py-1.5 rounded hover:bg-gray-100">
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

function Proveedores({ proveedores, recargar }) {
  const [editando, setEditando] = useState(null);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState(null);

  const alternar = async (p) => {
    setError(null);
    try {
      await api(`/inventario/proveedores/${p.id}`, { metodo: 'PATCH', cuerpo: { activo: !p.activo } });
      await recargar();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <section aria-labelledby="proveedores-titulo">
      <div className="flex items-center justify-between mb-3">
        <h2 id="proveedores-titulo" className="font-bold">
          Proveedores
        </h2>
        <button onClick={() => setCreando((v) => !v)} className="btn-primario text-sm px-4 py-1.5 rounded">
          {creando ? 'Cancelar' : 'Nuevo proveedor'}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-red-700 text-sm mb-3">
          {error}
        </p>
      )}
      {creando && (
        <div className="bg-superficie border border-marca-200 rounded-xl p-4 mb-4">
          <FormularioProveedor
            prefijo="prov-nuevo"
            alGuardar={async () => {
              setCreando(false);
              await recargar();
            }}
          />
        </div>
      )}
      <div className="relative bg-superficie border border-gray-200 rounded-xl overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500 text-left">
            <tr>
              <th className="px-3 py-2">Proveedor</th>
              <th className="px-3 py-2">Contacto</th>
              <th className="px-3 py-2">Teléfono</th>
              <th className="px-3 py-2">Correo</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {proveedores.map((p) =>
              editando === p.id ? (
                <tr key={p.id}>
                  <td colSpan="6" className="px-3 py-3">
                    <FormularioProveedor
                      prefijo={`prov-${p.id}`}
                      inicial={p}
                      alCancelar={() => setEditando(null)}
                      alGuardar={async () => {
                        setEditando(null);
                        await recargar();
                      }}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={p.id} className={p.activo ? '' : 'text-gray-500'}>
                  <td className="px-3 py-2">
                    <span className="block font-semibold">{p.nombre}</span>
                    <span className="block text-xs text-gray-500">NIT {p.nit}</span>
                  </td>
                  <td className="px-3 py-2">{p.contacto ?? '—'}</td>
                  <td className="px-3 py-2">{p.telefono ?? '—'}</td>
                  <td className="px-3 py-2">{p.email ?? '—'}</td>
                  <td className="px-3 py-2 text-xs font-semibold">{p.activo ? 'Activo' : 'Inactivo'}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button onClick={() => setEditando(p.id)} className="text-marca-700 font-semibold hover:underline mr-3">
                      Editar<span className="sr-only"> {p.nombre}</span>
                    </button>
                    <button onClick={() => alternar(p)} className="text-gray-700 hover:underline">
                      {p.activo ? 'Desactivar' : 'Activar'}
                      <span className="sr-only"> {p.nombre}</span>
                    </button>
                  </td>
                </tr>
              )
            )}
            {proveedores.length === 0 && (
              <tr>
                <td colSpan="6" className="px-4 py-6 text-center text-gray-500">
                  No hay proveedores registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
