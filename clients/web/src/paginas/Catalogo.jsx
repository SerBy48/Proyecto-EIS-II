import React, { useEffect, useState } from 'react';
import { api, moneda } from '../servicios/api';

/**
 * Catalogo de productos (consume el servicio de catalogo a traves del gateway).
 *
 * El indicador de disponibilidad tiene TRES estados, no dos:
 *   hay_stock true  -> disponible
 *   hay_stock false -> agotado
 *   hay_stock null  -> el servicio de inventario no respondio
 *
 * Ese tercer estado es la degradacion elegante del documento: el catalogo sigue
 * mostrandose aunque inventario este caido, pero no miente diciendo que hay
 * existencias cuando no lo sabe.
 */
export default function Catalogo({ usuario, alAgregar }) {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [filtros, setFiltros] = useState({ q: '', categoria: '', orden: '' });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [agregando, setAgregando] = useState(null);
  // Paginacion: antes solo se veian los 20 primeros productos y el resto solo
  // se encontraba buscandolo por nombre (hallazgo U-02 de USABILIDAD.md).
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const POR_PAGINA = 20;

  const cargar = async () => {
    setCargando(true);
    setError(null);
    try {
      const parametros = new URLSearchParams();
      if (filtros.q) parametros.set('q', filtros.q);
      if (filtros.categoria) parametros.set('categoria', filtros.categoria);
      if (filtros.orden) parametros.set('orden', filtros.orden);
      parametros.set('pagina', String(pagina));
      parametros.set('limite', String(POR_PAGINA));

      const datos = await api(`/catalogo/productos?${parametros}`);
      setProductos(datos.productos || []);
      setTotal(datos.total ?? 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    api('/catalogo/categorias')
      .then(setCategorias)
      .catch(() => setCategorias([]));
  }, []);

  useEffect(() => {
    const temporizador = setTimeout(cargar, filtros.q ? 350 : 0);
    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.q, filtros.categoria, filtros.orden, pagina]);

  // Un filtro nuevo siempre empieza en la primera pagina.
  const cambiarFiltro = (cambio) => {
    setFiltros({ ...filtros, ...cambio });
    setPagina(1);
  };

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const irAPagina = (n) => {
    setPagina(n);
    window.scrollTo({ top: 0 });
  };

  const agregar = async (sku) => {
    setAgregando(sku);
    try {
      await alAgregar(sku);
    } finally {
      setAgregando(null);
    }
  };

  const etiquetaStock = (p) => {
    if (p.hay_stock === null) {
      return <span className="text-xs text-gray-500">Disponibilidad no verificada</span>;
    }
    if (!p.hay_stock) {
      return <span className="text-xs font-semibold text-red-600">Agotado</span>;
    }
    if (p.disponible <= 3) {
      return (
        <span className="text-xs font-semibold text-amber-700">
          Ultimas {p.disponible} unidades
        </span>
      );
    }
    return <span className="text-xs font-semibold text-green-700">Disponible</span>;
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <h1 className="sr-only">Catalogo de productos</h1>
      <div role="search" className="flex flex-wrap gap-3 mb-6">
        <label htmlFor="filtro-q" className="sr-only">Buscar productos</label>
        <input
          id="filtro-q"
          type="search"
          placeholder="Buscar productos..."
          value={filtros.q}
          onChange={(e) => cambiarFiltro({ q: e.target.value })}
          className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <label htmlFor="filtro-categoria" className="sr-only">Categoria</label>
        <select
          id="filtro-categoria"
          value={filtros.categoria}
          onChange={(e) => cambiarFiltro({ categoria: e.target.value })}
          className="flex-1 sm:flex-none border border-gray-300 rounded-lg px-3 py-2"
        >
          <option value="">Todas las categorias</option>
          {categorias.map((c) => (
            <option key={c.categoria} value={c.categoria}>
              {c.categoria} ({c.productos})
            </option>
          ))}
        </select>
        <label htmlFor="filtro-orden" className="sr-only">Ordenar por</label>
        <select
          id="filtro-orden"
          value={filtros.orden}
          onChange={(e) => cambiarFiltro({ orden: e.target.value })}
          className="flex-1 sm:flex-none border border-gray-300 rounded-lg px-3 py-2"
        >
          <option value="">Mas recientes</option>
          <option value="precio_asc">Precio: menor a mayor</option>
          <option value="precio_desc">Precio: mayor a menor</option>
          <option value="nombre">Nombre</option>
        </select>
      </div>

      {!cargando && !error && total > 0 && (
        <p className="text-sm text-gray-600 mb-4" aria-live="polite">
          Mostrando {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, total)} de {total} productos
          {filtros.q && <> para «{filtros.q}»</>}
        </p>
      )}

      {error && (
        <div role="alert" className="mb-6 bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">
          <p className="font-semibold">No fue posible cargar el catalogo</p>
          <p className="text-sm mt-1">{error}</p>
          <button onClick={cargar} className="mt-3 text-sm underline">
            Reintentar
          </button>
        </div>
      )}

      {cargando ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" role="status" aria-busy="true">
          <span className="sr-only">Cargando productos...</span>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} aria-hidden="true" className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="h-32 bg-gray-100 rounded-lg mb-4" />
              <div className="h-4 bg-gray-100 rounded mb-2" />
              <div className="h-4 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {productos.map((p) => (
            <article
              key={p.sku}
              className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col hover:shadow-md transition"
            >
              <div
                aria-hidden="true"
                className="h-32 bg-gradient-to-br from-indigo-50 to-gray-100 rounded-lg mb-4 flex items-center justify-center text-4xl"
              >
                {p.categoria === 'tecnologia' ? '💻' : p.categoria === 'hogar' ? '🏠' : '🏃'}
              </div>

              <p className="text-xs text-gray-500 uppercase tracking-wide">{p.marca}</p>
              <h2 className="font-semibold text-gray-900 leading-snug mb-1">{p.nombre}</h2>
              <p className="text-xs text-gray-500 mb-3">{p.sku}</p>

              <div className="mt-auto">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-lg font-bold text-gray-900">{moneda(p.precio_final)}</span>
                  {p.descuento_porcentaje > 0 && (
                    <>
                      <span className="text-sm text-gray-500 line-through">
                        <span className="sr-only">Precio anterior: </span>
                        {moneda(p.precio)}
                      </span>
                      <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">
                        -{p.descuento_porcentaje}%
                      </span>
                    </>
                  )}
                </div>

                <div className="mb-3">{etiquetaStock(p)}</div>

                <button
                  onClick={() => agregar(p.sku)}
                  disabled={!usuario || p.hay_stock === false || agregando === p.sku}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-500 text-white text-sm font-semibold py-2 rounded-lg transition"
                >
                  {agregando === p.sku
                    ? 'Agregando...'
                    : !usuario
                      ? 'Inicie sesion para comprar'
                      : p.hay_stock === false
                        ? 'Agotado'
                        : 'Agregar al carrito'}
                  <span className="sr-only">: {p.nombre}</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {!cargando && !error && totalPaginas > 1 && (
        <nav aria-label="Paginas del catalogo" className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => irAPagina(pagina - 1)}
            disabled={pagina === 1}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:text-gray-400 disabled:bg-gray-50 hover:bg-gray-50"
          >
            Anterior
          </button>
          {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => irAPagina(n)}
              aria-current={n === pagina ? 'page' : undefined}
              aria-label={`Pagina ${n}`}
              className={`w-9 py-1.5 rounded-lg text-sm font-semibold ${
                n === pagina ? 'bg-indigo-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => irAPagina(pagina + 1)}
            disabled={pagina === totalPaginas}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:text-gray-400 disabled:bg-gray-50 hover:bg-gray-50"
          >
            Siguiente
          </button>
        </nav>
      )}

      {!cargando && !error && productos.length === 0 && (
        <p className="text-center text-gray-500 py-12">
          No se encontraron productos con esos criterios.
        </p>
      )}
    </div>
  );
}
