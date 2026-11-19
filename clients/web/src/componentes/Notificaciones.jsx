import React, { useEffect, useRef, useState } from 'react';
import { api } from '../servicios/api';
import { EVENTO_BANDEJA } from './Campana.jsx';

/**
 * Todas las notificaciones (RF-52): la campana muestra las diez ultimas; esta
 * vista pagina el resto, filtra las no leidas y abre cada una en su sitio (la
 * consulta lista para responder, el pedido, el inventario). La usan el cliente
 * (Mi perfil > Notificaciones) y el personal (panel > Notificaciones).
 */

const POR_PAGINA = 15;

const fecha = (v) => new Date(v).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

/** Texto del boton segun a donde lleva la notificacion. */
const ACCION = {
  consultas: 'Abrir la consulta',
  pedidos: 'Ver el pedido',
  inventario: 'Ir al inventario',
  carrito: 'Ir al carrito'
};

export default function Notificaciones({ onAbrir, personal = false }) {
  const [datos, setDatos] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [soloNoLeidas, setSoloNoLeidas] = useState(false);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const ultimaPeticion = useRef(0);

  const cargar = async () => {
    const numero = ++ultimaPeticion.current;
    try {
      const r = await api(`/notificaciones/bandeja?limite=${POR_PAGINA}&pagina=${pagina}${soloNoLeidas ? '&solo_no_leidas=true' : ''}`);
      if (numero !== ultimaPeticion.current) return;
      setDatos(r);
      setError(null);
    } catch (e) {
      if (numero !== ultimaPeticion.current) return;
      setError(e.message);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, soloNoLeidas]);

  const marcar = async (ids) => {
    try {
      const r = await api('/notificaciones/bandeja/leidas', { metodo: 'POST', cuerpo: ids ? { ids } : {} });
      if (!ids) setAviso(r.marcadas === 1 ? 'Se marcó 1 notificación como leída.' : `Se marcaron ${r.marcadas} notificaciones como leídas.`);
      window.dispatchEvent(new Event(EVENTO_BANDEJA));
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  };

  const abrir = async (n) => {
    if (!n.leida) await marcar([n.id]);
    onAbrir?.(n.destino, n);
  };

  const notificaciones = datos?.notificaciones ?? [];
  const paginas = datos?.paginas ?? 1;

  return (
    <section aria-labelledby="notificaciones-titulo">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 id="notificaciones-titulo" className="font-bold mr-auto">
          Notificaciones
          {datos && (
            <span className="ml-2 text-sm font-normal text-gray-600">
              {datos.no_leidas ? `${datos.no_leidas} sin leer` : 'todas leídas'} · {datos.total} {soloNoLeidas ? 'sin leer' : 'en total'}
            </span>
          )}
        </h2>
        <label className="text-sm text-gray-700 inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={soloNoLeidas}
            onChange={(e) => {
              setSoloNoLeidas(e.target.checked);
              setPagina(1);
            }}
          />
          Solo sin leer
        </label>
        {datos?.no_leidas > 0 && (
          <button onClick={() => marcar()} className="text-sm font-semibold text-marca-700 hover:underline">
            Marcar todas como leídas
          </button>
        )}
      </div>

      {personal && (
        <p className="text-sm text-gray-600 mb-4">
          Incluye el buzón de operaciones que comparte el personal (consultas de clientes, alertas de reposición y pagos rechazados). Cada persona marca
          sus propias leídas.
        </p>
      )}

      <div role="status" aria-live="polite">
        {aviso && <p className="mb-3 text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg p-2">{aviso}</p>}
      </div>
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {!datos ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : notificaciones.length === 0 ? (
        <p className="text-sm text-gray-500 bg-superficie border border-gray-200 rounded-xl p-6 text-center">
          {soloNoLeidas ? 'No tienes notificaciones sin leer.' : 'No tienes notificaciones.'}
        </p>
      ) : (
        <ul className="bg-superficie border border-gray-200 rounded-xl divide-y divide-gray-100">
          {notificaciones.map((n) => (
            <li key={n.id} className={`flex flex-col sm:flex-row gap-3 px-4 py-3 ${n.leida ? '' : 'bg-marca-50'}`}>
              <span aria-hidden="true" className={`hidden sm:block mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.leida ? 'bg-transparent' : 'bg-marca-600'}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">
                  {n.asunto}
                  {!n.leida && <span className="ml-2 text-[11px] font-semibold text-marca-800">Nueva</span>}
                </p>
                {n.texto && <p className="text-sm text-gray-700 mt-0.5 break-words">{n.texto}</p>}
                <p className="text-xs text-gray-500 mt-1">
                  {fecha(n.creado_en)}
                  {n.de_operaciones && ' · buzón de operaciones'}
                  {n.ticket && ` · ${n.ticket}`}
                  {n.pedido && ` · ${n.pedido}`}
                </p>
              </div>
              <div className="flex sm:flex-col items-start sm:items-end gap-2 shrink-0">
                {ACCION[n.destino] && (
                  <button onClick={() => abrir(n)} className="btn-primario text-xs px-3 py-1.5 rounded">
                    {n.destino === 'consultas' && personal ? 'Responder la consulta' : ACCION[n.destino]}
                    <span className="sr-only">: {n.asunto}</span>
                  </button>
                )}
                {!n.leida && (
                  <button onClick={() => marcar([n.id])} className="text-xs text-gray-600 hover:text-gray-900 hover:underline">
                    Marcar como leída<span className="sr-only">: {n.asunto}</span>
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {paginas > 1 && (
        <nav aria-label="Páginas de notificaciones" className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} className="border border-gray-300 rounded px-3 py-1.5 disabled:opacity-50">
            Anterior
          </button>
          <span>
            Página {pagina} de {paginas}
          </span>
          <button disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)} className="border border-gray-300 rounded px-3 py-1.5 disabled:opacity-50">
            Siguiente
          </button>
        </nav>
      )}
    </section>
  );
}
