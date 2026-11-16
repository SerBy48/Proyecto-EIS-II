import React, { useEffect, useRef, useState } from 'react';
import { api, moneda } from '../servicios/api';

/** Historial de pedidos del cliente, con su ciclo de vida y cancelacion. */
export default function MisPedidos({ usuario }) {
  const [pedidos, setPedidos] = useState([]);
  const [detalle, setDetalle] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  // Cancelacion en dos pasos, con su propio error y su confirmacion de exito
  // (hallazgos U-03 y U-04 de docs/calidad/USABILIDAD.md).
  const [confirmando, setConfirmando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState(null);
  const [aviso, setAviso] = useState(null);

  const cargar = async () => {
    setCargando(true);
    try {
      setPedidos(await api('/pedidos'));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Foco del modal: al abrir pasa al dialogo, al cerrar vuelve al boton que lo
  // abrio. Sin esto, un usuario de teclado queda detras del velo.
  const dialogo = useRef(null);
  const origenFoco = useRef(null);
  const alertaDetalle = useRef(null);

  // El error aparece al final del dialogo, que puede tener desplazamiento: se
  // lleva a la vista y recibe el foco para que se lea completo.
  useEffect(() => {
    if (!errorDetalle) return;
    alertaDetalle.current?.scrollIntoView({ block: 'nearest' });
    alertaDetalle.current?.focus();
    // Tambien al recargar el detalle: el historial nuevo empuja el aviso hacia abajo.
  }, [errorDetalle, detalle]);

  useEffect(() => {
    if (!detalle) return;
    dialogo.current?.focus();
    const alTeclear = (e) => e.key === 'Escape' && cerrarDetalle();
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('keydown', alTeclear);
      origenFoco.current?.focus();
    };
  }, [detalle]);

  const cerrarDetalle = () => {
    setDetalle(null);
    setConfirmando(false);
    setErrorDetalle(null);
  };

  const verDetalle = async (id) => {
    origenFoco.current = document.activeElement;
    setAviso(null);
    setConfirmando(false);
    setErrorDetalle(null);
    try {
      setDetalle(await api(`/pedidos/${id}`));
    } catch (e) {
      setError(e.message);
    }
  };

  const cancelar = async (pedido) => {
    setCancelando(true);
    setErrorDetalle(null);
    try {
      await api(`/pedidos/${pedido.id}/cancelar`, {
        metodo: 'POST',
        cuerpo: { motivo: 'Cancelado por el cliente' }
      });
      await cargar();
      cerrarDetalle();
      setAviso(`El pedido ${pedido.numero} fue cancelado. Si ya se había cobrado, el reembolso se procesa automaticamente.`);
    } catch (e) {
      // El error se muestra DENTRO del dialogo: antes quedaba detras del velo
      // y el usuario creia que no habia pasado nada. Ademas se recarga el
      // detalle, porque el pedido pudo cambiar de estado (p. ej. ya se despacho).
      setErrorDetalle(e.message);
      setConfirmando(false);
      try {
        setDetalle(await api(`/pedidos/${pedido.id}`));
        await cargar();
      } catch {
        /* se conserva el detalle anterior */
      }
    } finally {
      setCancelando(false);
    }
  };

  const COLORES = {
    creado: 'bg-gray-100 text-gray-700',
    pagado: 'bg-blue-100 text-blue-800',
    en_preparacion: 'bg-amber-100 text-amber-800',
    enviado: 'bg-indigo-100 text-indigo-800',
    entregado: 'bg-green-100 text-green-800',
    cancelado: 'bg-red-100 text-red-800'
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Mis pedidos</h1>

      {error && (
        <div role="alert" className="mb-4 bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      <div role="status" aria-live="polite">
        {aviso && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 text-sm">
            {aviso}
          </div>
        )}
      </div>

      {cargando ? (
        <p role="status" className="text-gray-500">Cargando...</p>
      ) : pedidos.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-500">
          Aun no tienes pedidos.
        </div>
      ) : (
        <div className="relative bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="min-w-full text-sm whitespace-nowrap">
            <caption className="sr-only">Historial de pedidos</caption>
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pedidos.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{p.numero}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(p.creado_en).toLocaleString('es-CO')}
                  </td>
                  <td className="px-4 py-3">{p.cantidad_items}</td>
                  <td className="px-4 py-3 font-semibold">{moneda(p.total)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${COLORES[p.estado]}`}>
                      {p.estado.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => verDetalle(p.id)} className="text-indigo-600 hover:underline text-xs">
                      Ver detalle<span className="sr-only"> del pedido {p.numero}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detalle && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={cerrarDetalle}>
          <div
            ref={dialogo}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-detalle"
            tabIndex={-1}
            className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] overflow-auto p-4 sm:p-6 focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 id="titulo-detalle" className="text-lg font-bold">
                  <span className="sr-only">Detalle del pedido </span>
                  {detalle.numero}
                </h2>
                <p className="text-sm text-gray-500">
                  {new Date(detalle.creado_en).toLocaleString('es-CO')}
                </p>
              </div>
              <button
                onClick={cerrarDetalle}
                aria-label="Cerrar detalle"
                className="w-8 h-8 text-gray-500 hover:text-gray-700"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>

            <table className="w-full text-sm mb-4">
              <tbody className="divide-y">
                {detalle.items?.map((i) => (
                  <tr key={i.sku}>
                    <td className="py-2">
                      <p className="font-medium">{i.nombre}</p>
                      <p className="text-xs text-gray-500">{i.sku} · {i.cantidad} x {moneda(i.precio_unitario)}</p>
                    </td>
                    <td className="py-2 text-right font-semibold">{moneda(i.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <dl className="text-sm space-y-1 border-t pt-3">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{moneda(detalle.subtotal)}</dd></div>
              <div className="flex justify-between"><dt>IVA</dt><dd>{moneda(detalle.impuestos)}</dd></div>
              <div className="flex justify-between"><dt>Envío</dt><dd>{moneda(detalle.envio)}</dd></div>
              <div className="flex justify-between font-bold"><dt>Total</dt><dd>{moneda(detalle.total)}</dd></div>
            </dl>

            {detalle.direccion_envio && (
              <div className="mt-4 text-sm bg-gray-50 rounded-lg p-3">
                <p className="font-semibold text-xs uppercase text-gray-500 mb-1">Dirección de envío</p>
                <p>{detalle.direccion_envio.linea1}</p>
                <p className="text-gray-600">
                  {detalle.direccion_envio.ciudad}, {detalle.direccion_envio.departamento}
                </p>
              </div>
            )}

            {detalle.historial?.length > 0 && (
              <div className="mt-4">
                <p className="font-semibold text-xs uppercase text-gray-500 mb-2">
                  Historial de estados
                </p>
                <ol className="text-sm space-y-1">
                  {detalle.historial.map((h, i) => (
                    <li key={i} className="flex flex-col sm:flex-row sm:gap-3">
                      <span className="text-gray-500 text-xs sm:w-36 shrink-0">
                        {new Date(h.creado_en).toLocaleString('es-CO')}
                      </span>
                      <span>
                        {h.estado_anterior ? `${h.estado_anterior} → ` : ''}
                        <strong>{h.estado_nuevo}</strong>
                        {h.motivo && <span className="text-gray-500"> · {h.motivo}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {errorDetalle && (
              <div ref={alertaDetalle} tabIndex={-1} role="alert" className="mt-6 bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm focus:outline-none">
                <p className="font-semibold">No se pudo cancelar el pedido</p>
                <p className="mt-1">{errorDetalle}</p>
              </div>
            )}

            {['creado', 'pagado'].includes(detalle.estado) && !confirmando && (
              <button
                onClick={() => setConfirmando(true)}
                className="mt-6 w-full border border-red-300 text-red-700 hover:bg-red-50 font-semibold py-2 rounded-lg"
              >
                Cancelar pedido
              </button>
            )}

            {/* Cancelar es irreversible: se pide confirmacion explicita. */}
            {confirmando && (
              <div className="mt-6 border border-red-200 bg-red-50 rounded-lg p-4">
                <p id="pregunta-cancelar" className="text-sm text-red-900 font-semibold">
                  ¿Cancelar el pedido {detalle.numero}? Esta accion no se puede deshacer.
                </p>
                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => cancelar(detalle)}
                    disabled={cancelando}
                    aria-describedby="pregunta-cancelar"
                    className="flex-1 bg-red-700 hover:bg-red-800 disabled:bg-red-300 text-white font-semibold py-2 rounded-lg"
                  >
                    {cancelando ? 'Cancelando...' : 'Si, cancelar pedido'}
                  </button>
                  <button
                    onClick={() => setConfirmando(false)}
                    disabled={cancelando}
                    className="flex-1 border border-gray-300 bg-white hover:bg-gray-50 font-semibold py-2 rounded-lg"
                  >
                    No, conservarlo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
