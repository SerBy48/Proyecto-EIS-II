import React, { useEffect, useRef, useState } from 'react';
import { api, moneda, urlImagen } from '../../servicios/api';

/**
 * Pestaña Productos del panel (RF-48 a RF-50): precio, oferta con fecha de fin,
 * datos, fotos (subidas desde el PC) e historial de precios. Lo usan el
 * administrador y el vendedor. El servidor valida todo (invariante 2): la web
 * solo ayuda a no equivocarse.
 */

const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
const TAMANO_MAXIMO = 2 * 1024 * 1024;
const POR_PAGINA = 25;

/** Fecha AAAA-MM-DD en hora de Colombia (para el campo de fecha). */
const fechaLocal = (valor) =>
  valor ? new Date(valor).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) : '';
const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
const fechaLegible = (valor) =>
  new Date(valor).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' });

const Campo = ({ id, etiqueta, ayuda, children }) => (
  <div>
    <label htmlFor={id} className="block text-xs font-semibold text-gray-700 mb-1">
      {etiqueta}
    </label>
    {children}
    {ayuda && (
      <p id={`${id}-ayuda`} className="text-xs text-gray-500 mt-1">
        {ayuda}
      </p>
    )}
  </div>
);

const claseCampo = 'w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-superficie';

/** Lee un archivo como data: URL para la vista previa (la CSP permite data:, no blob:). */
const vistaPrevia = (archivo) =>
  new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result));
    lector.onerror = () => rechazar(new Error('No se pudo leer el archivo.'));
    lector.readAsDataURL(archivo);
  });

const validarArchivo = (archivo) => {
  if (!archivo) return 'Elige una foto.';
  if (!TIPOS_IMAGEN.includes(archivo.type)) return 'La foto debe ser JPG, PNG o WebP.';
  if (archivo.size > TAMANO_MAXIMO) return 'La foto no puede pesar más de 2 MB.';
  return null;
};

/** Selector de foto con vista previa; devuelve el File elegido. */
function SelectorFoto({ id, etiqueta, archivo, alElegir, deshabilitado }) {
  const [previa, setPrevia] = useState(null);
  const [error, setError] = useState(null);
  const entrada = useRef(null);

  useEffect(() => {
    if (!archivo) {
      setPrevia(null);
      if (entrada.current) entrada.current.value = '';
    }
  }, [archivo]);

  const elegir = async (e) => {
    const elegido = e.target.files?.[0] ?? null;
    const problema = elegido ? validarArchivo(elegido) : null;
    setError(problema);
    if (problema || !elegido) {
      alElegir(null);
      setPrevia(null);
      e.target.value = '';
      return;
    }
    alElegir(elegido);
    setPrevia(await vistaPrevia(elegido).catch(() => null));
  };

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-gray-700 mb-1">
        {etiqueta}
      </label>
      <input
        ref={entrada}
        id={id}
        type="file"
        accept={TIPOS_IMAGEN.join(',')}
        onChange={elegir}
        disabled={deshabilitado}
        aria-describedby={`${id}-ayuda`}
        className="block w-full text-sm text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:font-semibold file:bg-marca-50 file:text-marca-800"
      />
      <p id={`${id}-ayuda`} className="text-xs text-gray-500 mt-1">
        JPG, PNG o WebP, máximo 2 MB. Se recomienda una foto horizontal (por ejemplo 800 × 520).
      </p>
      {error && (
        <p role="alert" className="text-xs text-red-700 mt-1">
          {error}
        </p>
      )}
      {previa && <img src={previa} alt="Vista previa de la foto elegida" className="mt-2 h-24 rounded border border-gray-200 object-cover" />}
    </div>
  );
}

export default function Productos() {
  const [secciones, setSecciones] = useState([]);
  const [filtros, setFiltros] = useState({ q: '', subcategoria: '', inactivos: true });
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState({ total: 0, productos: [] });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [editando, setEditando] = useState(null);
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    api('/catalogo/categorias', { publica: true })
      .then((cats) => setSecciones(cats.flatMap((c) => c.subcategorias ?? [])))
      .catch(() => setSecciones([]));
  }, []);

  const cargar = async () => {
    setCargando(true);
    const p = new URLSearchParams({ pagina: String(pagina), limite: String(POR_PAGINA), orden: 'nombre' });
    if (filtros.q.trim()) p.set('q', filtros.q.trim());
    if (filtros.subcategoria) p.set('subcategoria', filtros.subcategoria);
    if (filtros.inactivos) p.set('incluir_inactivos', 'true');
    try {
      setDatos(await api(`/catalogo/productos?${p}`));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(cargar, filtros.q ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros, pagina]);

  const nombreSeccion = (slug) => secciones.find((s) => s.slug === slug)?.nombre ?? slug;
  const totalPaginas = Math.max(1, Math.ceil(datos.total / POR_PAGINA));

  const alGuardar = async (texto, sku) => {
    setAviso(texto);
    await cargar();
    if (sku) {
      const actualizado = await api(`/catalogo/productos/${encodeURIComponent(sku)}`).catch(() => null);
      if (actualizado) setEditando(actualizado);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex-1 min-w-[12rem]">
          <Campo id="productos-buscar" etiqueta="Buscar">
            <input
              id="productos-buscar"
              type="search"
              value={filtros.q}
              onChange={(e) => {
                setPagina(1);
                setFiltros((f) => ({ ...f, q: e.target.value }));
              }}
              placeholder="Nombre, marca o SKU (SKU-TEC-001)"
              className={claseCampo}
            />
          </Campo>
        </div>
        <Campo id="productos-seccion" etiqueta="Sección">
          <select
            id="productos-seccion"
            value={filtros.subcategoria}
            onChange={(e) => {
              setPagina(1);
              setFiltros((f) => ({ ...f, subcategoria: e.target.value }));
            }}
            className={claseCampo}
          >
            <option value="">Todas</option>
            {secciones.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700 pb-1.5">
          <input
            type="checkbox"
            checked={filtros.inactivos}
            onChange={(e) => setFiltros((f) => ({ ...f, inactivos: e.target.checked }))}
          />
          Incluir inactivos
        </label>
        <button
          onClick={() => {
            setEditando(null);
            setCreando(true);
          }}
          className="btn-primario text-sm px-4 py-2 rounded"
        >
          Nuevo producto
        </button>
      </div>

      <div role="status" aria-live="polite">
        {aviso && <p className="text-green-700 text-sm mb-3">{aviso}</p>}
      </div>
      {error && (
        <p role="alert" className="text-red-700 text-sm mb-3">
          {error}
        </p>
      )}

      {creando && (
        <NuevoProducto
          secciones={secciones}
          alCancelar={() => setCreando(false)}
          alCrear={async (texto, sku) => {
            setCreando(false);
            await alGuardar(texto, sku);
          }}
        />
      )}
      {editando && (
        <EditarProducto
          key={editando.sku}
          producto={editando}
          secciones={secciones}
          alCerrar={() => setEditando(null)}
          alGuardar={alGuardar}
        />
      )}

      <div className="relative bg-superficie border border-gray-200 rounded-xl overflow-x-auto">
        <table className="min-w-full text-sm">
          <caption className="sr-only">Productos del catálogo</caption>
          <thead className="bg-gray-50 text-xs uppercase text-gray-500 text-left">
            <tr>
              <th className="px-3 py-2">
                <span className="sr-only">Foto</span>
              </th>
              <th className="px-3 py-2">Producto</th>
              <th className="px-3 py-2">Sección</th>
              <th className="px-3 py-2 text-right">Precio</th>
              <th className="px-3 py-2">Oferta</th>
              <th className="px-3 py-2 text-right">Stock</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {datos.productos.map((p) => (
              <tr key={p.sku} className={p.activo === false ? 'text-gray-500' : ''}>
                <td className="px-3 py-2">
                  {p.imagenes?.[0] ? (
                    <img src={urlImagen(p.imagenes[0])} alt="" loading="lazy" className="w-12 h-9 rounded object-cover bg-gray-100" />
                  ) : (
                    <span className="block w-12 h-9 rounded bg-gray-100" />
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className="block font-semibold text-gray-900">{p.nombre}</span>
                  <span className="block text-xs text-gray-500">
                    {p.sku} · {p.marca}
                  </span>
                </td>
                <td className="px-3 py-2">{nombreSeccion(p.subcategoria)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <span className="block font-semibold">{moneda(p.precio_final)}</span>
                  {p.descuento_porcentaje > 0 && <span className="block text-xs text-gray-500 line-through">{moneda(p.precio)}</span>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {p.descuento_porcentaje > 0 ? (
                    <>
                      <span className="font-semibold text-red-800">-{p.descuento_porcentaje}%</span>
                      <span className="block text-xs text-gray-500">
                        {p.oferta_hasta ? `hasta ${fechaLegible(p.oferta_hasta)}` : 'sin fecha de fin'}
                      </span>
                    </>
                  ) : p.descuento_configurado > 0 ? (
                    <span className="text-xs text-gray-500">Vencida ({p.descuento_configurado}%)</span>
                  ) : (
                    <span className="text-xs text-gray-500">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">{p.disponible ?? '—'}</td>
                <td className="px-3 py-2">
                  {p.activo === false ? (
                    <span className="text-xs font-semibold text-gray-600">Inactivo</span>
                  ) : (
                    <span className="text-xs font-semibold text-green-800">Activo</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={async () => {
                      setCreando(false);
                      setAviso(null);
                      setEditando(await api(`/catalogo/productos/${encodeURIComponent(p.sku)}`).catch(() => p));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="text-marca-700 font-semibold hover:underline"
                  >
                    Editar<span className="sr-only"> {p.nombre}</span>
                  </button>
                </td>
              </tr>
            ))}
            {!cargando && datos.productos.length === 0 && (
              <tr>
                <td colSpan="8" className="px-4 py-6 text-center text-gray-500">
                  No hay productos con esos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <nav aria-label="Páginas de productos" className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button onClick={() => setPagina((n) => n - 1)} disabled={pagina === 1} className="px-3 py-1.5 border border-gray-300 rounded disabled:text-gray-400">
            Anterior
          </button>
          <span>
            Página {pagina} de {totalPaginas}
          </span>
          <button
            onClick={() => setPagina((n) => n + 1)}
            disabled={pagina >= totalPaginas}
            className="px-3 py-1.5 border border-gray-300 rounded disabled:text-gray-400"
          >
            Siguiente
          </button>
        </nav>
      )}
    </div>
  );
}

/** Campos comunes del alta y la edicion. */
function CamposProducto({ valores, cambiar, secciones, prefijo }) {
  const descuento = Number(valores.descuento_porcentaje || 0);
  const precioFinal = Math.round(Number(valores.precio || 0) * (1 - descuento / 100));
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Campo id={`${prefijo}-nombre`} etiqueta="Nombre">
        <input id={`${prefijo}-nombre`} value={valores.nombre} onChange={(e) => cambiar('nombre', e.target.value)} maxLength={120} required className={claseCampo} />
      </Campo>
      <Campo id={`${prefijo}-marca`} etiqueta="Marca">
        <input id={`${prefijo}-marca`} value={valores.marca} onChange={(e) => cambiar('marca', e.target.value)} maxLength={60} className={claseCampo} />
      </Campo>
      <Campo id={`${prefijo}-seccion`} etiqueta="Sección">
        <select id={`${prefijo}-seccion`} value={valores.subcategoria} onChange={(e) => cambiar('subcategoria', e.target.value)} required className={claseCampo}>
          <option value="">Elige una sección</option>
          {secciones.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <Campo id={`${prefijo}-precio`} etiqueta="Precio de lista (COP)" ayuda="Entre $1.000 y $100.000.000, sin decimales.">
        <input
          id={`${prefijo}-precio`}
          type="number"
          min="1000"
          step="1"
          value={valores.precio}
          onChange={(e) => cambiar('precio', e.target.value)}
          aria-describedby={`${prefijo}-precio-ayuda`}
          required
          className={claseCampo}
        />
      </Campo>
      <Campo id={`${prefijo}-descuento`} etiqueta="Oferta (% de descuento)" ayuda="0 = sin oferta. Máximo 90 %.">
        <input
          id={`${prefijo}-descuento`}
          type="number"
          min="0"
          max="90"
          step="1"
          value={valores.descuento_porcentaje}
          onChange={(e) => cambiar('descuento_porcentaje', e.target.value)}
          aria-describedby={`${prefijo}-descuento-ayuda`}
          className={claseCampo}
        />
      </Campo>
      <Campo
        id={`${prefijo}-hasta`}
        etiqueta="Fin de la oferta (opcional)"
        ayuda={descuento > 0 ? 'La oferta vale hasta el final de ese día; vacío = sin fecha de fin.' : 'Primero pon un descuento.'}
      >
        <input
          id={`${prefijo}-hasta`}
          type="date"
          min={hoy()}
          value={valores.oferta_hasta}
          onChange={(e) => cambiar('oferta_hasta', e.target.value)}
          disabled={descuento <= 0}
          aria-describedby={`${prefijo}-hasta-ayuda`}
          className={claseCampo}
        />
      </Campo>
      <div className="sm:col-span-2">
        <Campo id={`${prefijo}-descripcion`} etiqueta="Descripción">
          <textarea
            id={`${prefijo}-descripcion`}
            value={valores.descripcion}
            onChange={(e) => cambiar('descripcion', e.target.value)}
            maxLength={2000}
            rows={3}
            className={claseCampo}
          />
        </Campo>
      </div>
      <p className="sm:col-span-2 text-sm text-gray-700">
        Precio que verá el cliente: <strong>{moneda(precioFinal)}</strong>
        {descuento > 0 && ` (${descuento}% de descuento${valores.oferta_hasta ? ` hasta el ${fechaLegible(`${valores.oferta_hasta}T12:00:00-05:00`)}` : ''})`}
      </p>
    </div>
  );
}

const VACIO = { sku: '', nombre: '', marca: '', subcategoria: '', precio: '', descuento_porcentaje: 0, oferta_hasta: '', descripcion: '', stock_inicial: '' };

function NuevoProducto({ secciones, alCancelar, alCrear }) {
  const [valores, setValores] = useState(VACIO);
  const [foto, setFoto] = useState(null);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const cambiar = (campo, valor) => setValores((v) => ({ ...v, [campo]: valor }));

  const crear = async (e) => {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      const descuento = Number(valores.descuento_porcentaje || 0);
      const { producto } = await api('/catalogo/productos', {
        metodo: 'POST',
        cuerpo: {
          sku: valores.sku,
          nombre: valores.nombre,
          marca: valores.marca || undefined,
          categoria: 'tecnologia',
          subcategoria: valores.subcategoria,
          precio: Number(valores.precio),
          descuento_porcentaje: descuento,
          ...(descuento > 0 && valores.oferta_hasta ? { oferta_hasta: valores.oferta_hasta } : {}),
          descripcion: valores.descripcion
        }
      });
      const avisos = [`${producto.nombre} creado.`];
      if (foto) {
        await api(`/catalogo/productos/${encodeURIComponent(producto.sku)}/imagenes`, { metodo: 'POST', archivo: foto })
          .then(() => avisos.push('Foto subida.'))
          .catch((err) => avisos.push(`La foto no se subió: ${err.message}`));
      }
      const stock = Number(valores.stock_inicial || 0);
      if (stock > 0) {
        await api(`/inventario/stock/${encodeURIComponent(producto.sku)}/entrada`, {
          metodo: 'POST',
          cuerpo: { cantidad: stock, observacion: 'Stock inicial al crear el producto' }
        })
          .then(() => avisos.push(`${stock} unidades en inventario.`))
          .catch((err) => avisos.push(`El stock no se registró: ${err.message}`));
      }
      await alCrear(avisos.join(' '), producto.sku);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={crear} aria-labelledby="nuevo-producto-titulo" className="bg-superficie border border-marca-200 rounded-xl p-5 mb-6">
      <h2 id="nuevo-producto-titulo" className="font-bold mb-4">
        Nuevo producto
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Campo id="nuevo-sku" etiqueta="SKU" ayuda="Letras, números y guiones; por ejemplo SKU-TEC-061.">
          <input
            id="nuevo-sku"
            value={valores.sku}
            onChange={(e) => cambiar('sku', e.target.value.toUpperCase())}
            maxLength={40}
            required
            aria-describedby="nuevo-sku-ayuda"
            className={claseCampo}
          />
        </Campo>
        <Campo id="nuevo-stock" etiqueta="Stock inicial (opcional)" ayuda="Se registra como primera entrada de inventario.">
          <input
            id="nuevo-stock"
            type="number"
            min="0"
            step="1"
            value={valores.stock_inicial}
            onChange={(e) => cambiar('stock_inicial', e.target.value)}
            aria-describedby="nuevo-stock-ayuda"
            className={claseCampo}
          />
        </Campo>
      </div>
      <CamposProducto valores={valores} cambiar={cambiar} secciones={secciones} prefijo="nuevo" />
      <div className="mt-3">
        <SelectorFoto id="nuevo-foto" etiqueta="Foto (opcional)" archivo={foto} alElegir={setFoto} />
        <p className="text-xs text-gray-500 mt-1">Sin foto, el producto muestra la foto de su sección.</p>
      </div>
      {error && (
        <p role="alert" className="text-red-700 text-sm mt-3">
          {error}
        </p>
      )}
      <div className="flex gap-2 mt-4">
        <button type="submit" disabled={guardando} className="btn-primario text-sm px-4 py-2 rounded">
          {guardando ? 'Creando...' : 'Crear producto'}
        </button>
        <button type="button" onClick={alCancelar} className="border border-gray-300 text-sm px-4 py-2 rounded hover:bg-gray-100">
          Cancelar
        </button>
      </div>
    </form>
  );
}

const valoresDe = (p) => ({
  nombre: p.nombre ?? '',
  marca: p.marca ?? '',
  subcategoria: p.subcategoria ?? '',
  precio: String(p.precio ?? ''),
  descuento_porcentaje: String(p.descuento_configurado ?? p.descuento_porcentaje ?? 0),
  // Una fecha ya vencida no se muestra: el campo de fecha no admite el pasado.
  oferta_hasta: (() => {
    const f = fechaLocal(p.oferta_hasta_configurada ?? p.oferta_hasta);
    return f && f >= hoy() ? f : '';
  })(),
  descripcion: p.descripcion ?? '',
  activo: p.activo !== false
});

function EditarProducto({ producto, secciones, alCerrar, alGuardar }) {
  const original = valoresDe(producto);
  const [valores, setValores] = useState(original);
  const [foto, setFoto] = useState(null);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [historial, setHistorial] = useState(null);
  const titulo = useRef(null);
  const [fechaTocada, setFechaTocada] = useState(false);
  const cambiar = (campo, valor) => {
    if (campo === 'oferta_hasta') setFechaTocada(true);
    setValores((v) => ({ ...v, [campo]: valor }));
  };
  const sku = encodeURIComponent(producto.sku);

  useEffect(() => {
    titulo.current?.focus();
    api(`/catalogo/productos/${sku}/historial-precios`).then(setHistorial).catch(() => setHistorial([]));
  }, [sku]);

  const guardar = async (e) => {
    e.preventDefault();
    setError(null);
    // Solo lo que cambio: el historial de precios registra cambios reales.
    const cambios = {};
    if (valores.nombre !== original.nombre) cambios.nombre = valores.nombre;
    if (valores.marca !== original.marca) cambios.marca = valores.marca;
    if (valores.subcategoria !== original.subcategoria) cambios.subcategoria = valores.subcategoria;
    if (valores.descripcion !== original.descripcion) cambios.descripcion = valores.descripcion;
    if (valores.precio !== original.precio) cambios.precio = Number(valores.precio);
    if (valores.descuento_porcentaje !== original.descuento_porcentaje) cambios.descuento_porcentaje = Number(valores.descuento_porcentaje || 0);
    const descuento = Number(valores.descuento_porcentaje || 0);
    // La fecha se envia si se toco o si cambio el descuento (una oferta nueva
    // sin fecha no hereda la fecha vencida de la anterior).
    if (descuento > 0 && (fechaTocada || cambios.descuento_porcentaje !== undefined)) cambios.oferta_hasta = valores.oferta_hasta || null;
    if (valores.activo !== original.activo) cambios.activo = valores.activo;
    if (!Object.keys(cambios).length) {
      setError('No hay cambios para guardar.');
      return;
    }
    setGuardando(true);
    try {
      await api(`/catalogo/productos/${sku}`, { metodo: 'PATCH', cuerpo: cambios });
      await alGuardar(`${valores.nombre}: cambios guardados.`, producto.sku);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const subirFoto = async () => {
    setError(null);
    setGuardando(true);
    try {
      await api(`/catalogo/productos/${sku}/imagenes`, { metodo: 'POST', archivo: foto });
      setFoto(null);
      await alGuardar(`${producto.nombre}: foto subida.`, producto.sku);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const quitarFoto = async (ruta) => {
    const id = ruta.split('/').pop();
    setError(null);
    try {
      await api(`/catalogo/productos/${sku}/imagenes/${id}`, { metodo: 'DELETE' });
      await alGuardar(`${producto.nombre}: foto eliminada.`, producto.sku);
    } catch (err) {
      setError(err.message);
    }
  };

  const propias = (producto.imagenes ?? []).filter((r) => !r.endsWith('.webp'));

  return (
    <section aria-labelledby="editar-producto-titulo" className="bg-superficie border border-marca-200 rounded-xl p-5 mb-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <h2 id="editar-producto-titulo" ref={titulo} tabIndex={-1} className="font-bold focus:outline-none">
          Editar {producto.nombre} <span className="font-normal text-gray-500 text-sm">({producto.sku})</span>
        </h2>
        <button onClick={alCerrar} className="text-sm border border-gray-300 px-3 py-1 rounded hover:bg-gray-100">
          Cerrar
        </button>
      </div>

      <form onSubmit={guardar}>
        <CamposProducto valores={valores} cambiar={cambiar} secciones={secciones} prefijo="editar" />
        <label className="inline-flex items-center gap-2 text-sm text-gray-700 mt-3">
          <input type="checkbox" checked={valores.activo} onChange={(e) => cambiar('activo', e.target.checked)} />
          Activo (visible en la tienda)
        </label>
        {error && (
          <p role="alert" className="text-red-700 text-sm mt-3">
            {error}
          </p>
        )}
        <div className="mt-4">
          <button type="submit" disabled={guardando} className="btn-primario text-sm px-4 py-2 rounded">
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="font-semibold text-sm mb-2">Fotos</h3>
          <ul className="flex flex-wrap gap-3 mb-3">
            {(producto.imagenes ?? []).map((ruta, i) => (
              <li key={ruta} className="relative">
                <img src={urlImagen(ruta)} alt={`Foto ${i + 1} de ${producto.nombre}`} className="w-28 h-20 rounded object-cover border border-gray-200" />
                {ruta.endsWith('.webp') ? (
                  <span className="block text-[11px] text-gray-500 mt-0.5">Foto del catálogo</span>
                ) : (
                  <button onClick={() => quitarFoto(ruta)} className="block text-xs text-red-700 font-semibold mt-0.5 hover:underline">
                    Quitar<span className="sr-only"> foto {i + 1}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
          <SelectorFoto id="editar-foto" etiqueta="Agregar una foto" archivo={foto} alElegir={setFoto} deshabilitado={guardando || propias.length >= 6} />
          <button onClick={subirFoto} disabled={!foto || guardando} className="mt-2 btn-primario text-sm px-4 py-1.5 rounded">
            Subir foto
          </button>
          <p className="text-xs text-gray-500 mt-1">La primera foto subida reemplaza la del catálogo; hasta 6 por producto.</p>
        </div>

        <div>
          <h3 className="font-semibold text-sm mb-2">Historial de precios</h3>
          {historial === null ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : historial.length === 0 ? (
            <p className="text-sm text-gray-500">Sin cambios registrados desde que se creó el producto.</p>
          ) : (
            <ul className="text-sm divide-y divide-gray-100 border border-gray-200 rounded-lg">
              {historial.map((h, i) => (
                <li key={i} className="px-3 py-2">
                  <span className="block">
                    {h.antes ? (
                      <>
                        {moneda(h.antes.precio)}
                        {h.antes.descuento_porcentaje ? ` (-${h.antes.descuento_porcentaje}%)` : ''} → {moneda(h.despues.precio)}
                        {h.despues.descuento_porcentaje ? ` (-${h.despues.descuento_porcentaje}%)` : ''}
                      </>
                    ) : (
                      <>Precio inicial {moneda(h.despues.precio)}</>
                    )}
                    {h.despues.oferta_hasta && ` hasta ${fechaLegible(h.despues.oferta_hasta)}`}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {new Date(h.fecha).toLocaleString('es-CO')} · {h.usuario ?? 'sistema'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
