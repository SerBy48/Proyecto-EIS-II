import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../servicios/api';

/** Cada cuanto se consulta si hay notificaciones nuevas (y al volver a la pestaña). */
const INTERVALO_MS = 30_000;

/** Evento de ventana con el que la vista completa pide actualizar el conteo. */
export const EVENTO_BANDEJA = 'serbytek:bandeja-actualizada';

const haceCuanto = (fecha) => {
  const minutos = Math.round((Date.now() - new Date(fecha).getTime()) / 60000);
  if (minutos < 1) return 'ahora';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  return new Date(fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
};

/**
 * Campana de notificaciones junto al perfil (RF-52). Muestra cuantas hay sin
 * leer y las ultimas diez; al abrir una, la marca como leida y lleva a donde
 * corresponde (pedidos, consultas, inventario). "Ver todas" abre la vista
 * completa, paginada (componentes/Notificaciones.jsx). Se actualiza cada 30 s
 * y cada vez que la pestaña vuelve a estar visible: sin WebSockets.
 */
export default function Campana({ usuario, onAbrir }) {
  const [bandeja, setBandeja] = useState({ no_leidas: 0, notificaciones: [] });
  const [abierta, setAbierta] = useState(false);
  const [error, setError] = useState(null);
  const contenedor = useRef(null);
  const boton = useRef(null);

  const cargar = useCallback(async () => {
    try {
      setBandeja(await api('/notificaciones/bandeja?limite=10'));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    cargar();
    const temporizador = setInterval(() => {
      if (document.visibilityState === 'visible') cargar();
    }, INTERVALO_MS);
    const alVolver = () => document.visibilityState === 'visible' && cargar();
    document.addEventListener('visibilitychange', alVolver);
    // La vista completa avisa cuando marca leidas: el conteo se pone al dia ya.
    window.addEventListener(EVENTO_BANDEJA, cargar);
    return () => {
      clearInterval(temporizador);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener(EVENTO_BANDEJA, cargar);
    };
  }, [cargar, usuario?.email]);

  // Cerrar con Escape o con un clic fuera.
  useEffect(() => {
    if (!abierta) return undefined;
    const alTeclear = (e) => {
      if (e.key === 'Escape') {
        setAbierta(false);
        boton.current?.focus();
      }
    };
    const alHacerClic = (e) => {
      if (!contenedor.current?.contains(e.target)) setAbierta(false);
    };
    document.addEventListener('keydown', alTeclear);
    document.addEventListener('mousedown', alHacerClic);
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.removeEventListener('mousedown', alHacerClic);
    };
  }, [abierta]);

  const marcar = async (ids) => {
    try {
      await api('/notificaciones/bandeja/leidas', { metodo: 'POST', cuerpo: ids ? { ids } : {} });
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  };

  const abrir = async (n) => {
    setAbierta(false);
    if (!n.leida) await marcar([n.id]);
    onAbrir?.(n.destino, n);
  };

  const { no_leidas: noLeidas, notificaciones } = bandeja;
  const etiqueta = noLeidas ? `Notificaciones, ${noLeidas} sin leer` : 'Notificaciones';

  return (
    <div ref={contenedor} className="relative">
      <button
        ref={boton}
        onClick={() => {
          setAbierta((a) => !a);
          if (!abierta) cargar();
        }}
        aria-label={etiqueta}
        aria-expanded={abierta}
        aria-haspopup="true"
        title={etiqueta}
        className="relative w-9 h-9 inline-flex items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {noLeidas > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1.5 -right-1.5 min-w-[1.25rem] h-5 px-1 rounded-full insignia-alerta text-[11px] font-bold leading-5 text-center"
          >
            {noLeidas > 99 ? '99+' : noLeidas}
          </span>
        )}
      </button>
      {/* El conteo tambien para lectores de pantalla cuando cambia. */}
      <span className="sr-only" role="status" aria-live="polite">
        {noLeidas ? `${noLeidas} notificaciones sin leer` : ''}
      </span>

      {abierta && (
        <div
          role="region"
          aria-label="Notificaciones"
          className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] bg-superficie border border-gray-200 rounded-xl shadow-xl z-50"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h2 className="font-bold text-sm">Notificaciones</h2>
            {noLeidas > 0 && (
              <button onClick={() => marcar()} className="text-xs font-semibold text-marca-700 hover:underline">
                Marcar todas como leídas
              </button>
            )}
          </div>
          {error && (
            <p role="alert" className="px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
          <ul className="max-h-96 overflow-y-auto divide-y divide-gray-100">
            {notificaciones.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => abrir(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex gap-3 ${n.leida ? '' : 'bg-marca-50'}`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.leida ? 'bg-transparent' : 'bg-marca-600'}`}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-900">
                      {n.asunto}
                      {!n.leida && <span className="sr-only"> (sin leer)</span>}
                    </span>
                    {n.texto && <span className="block text-xs text-gray-600 mt-0.5 line-clamp-2">{n.texto}</span>}
                    <span className="block text-[11px] text-gray-500 mt-1">
                      {haceCuanto(n.creado_en)}
                      {n.de_operaciones && ' · buzón de operaciones'}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {notificaciones.length === 0 && !error && (
              <li className="px-4 py-8 text-center text-sm text-gray-500">No tienes notificaciones.</li>
            )}
          </ul>
          {/* La campana solo trae las diez ultimas: el resto, en la vista completa. */}
          <div className="border-t border-gray-200">
            <button
              onClick={() => {
                setAbierta(false);
                onAbrir?.('notificaciones');
              }}
              className="w-full px-4 py-2.5 text-sm font-semibold text-marca-700 hover:bg-gray-50 rounded-b-xl"
            >
              Ver todas las notificaciones
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
