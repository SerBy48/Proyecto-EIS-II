import React, { useEffect, useRef, useState } from 'react';
import { api } from '../servicios/api';

/**
 * Consultas al vendedor (RF-53): la lista y el hilo de cada una. Lo usa el
 * personal (pestaña Consultas del panel: ve todas y responde) y el cliente
 * (Mi perfil > Mis consultas: ve las suyas y contesta).
 */

const ESTADOS = {
  abierta: { texto: 'Abierta', clase: 'bg-amber-100 text-amber-900' },
  respondida: { texto: 'Respondida', clase: 'bg-green-100 text-green-900' },
  cerrada: { texto: 'Cerrada', clase: 'bg-gray-200 text-gray-700' }
};

const Estado = ({ estado }) => {
  const e = ESTADOS[estado] ?? ESTADOS.abierta;
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded ${e.clase}`}>{e.texto}</span>;
};

const fecha = (v) => new Date(v).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

export default function Consultas({ personal = false, inicial = null }) {
  const [consultas, setConsultas] = useState(null);
  // Desde la campana se abre una consulta concreta: se muestran todas.
  const [filtro, setFiltro] = useState(personal && !inicial ? 'abierta' : '');
  const [abierta, setAbierta] = useState(inicial);
  const [error, setError] = useState(null);

  // Solo cuenta la respuesta del ultimo filtro elegido (H-F5c-04).
  const ultimaPeticion = useRef(0);
  const cargar = async () => {
    const numero = ++ultimaPeticion.current;
    try {
      const lista = await api(`/asistente/consultas${filtro ? `?estado=${filtro}` : ''}`);
      if (numero !== ultimaPeticion.current) return;
      setConsultas(lista);
      setError(null);
    } catch (e) {
      if (numero !== ultimaPeticion.current) return;
      setError(e.message);
      setConsultas([]);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-2">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-bold">{personal ? 'Consultas de clientes' : 'Mis consultas'}</h2>
          <label className="text-sm">
            <span className="sr-only">Filtrar por estado</span>
            <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm bg-superficie">
              <option value="">Todas</option>
              <option value="abierta">Abiertas</option>
              <option value="respondida">Respondidas</option>
              <option value="cerrada">Cerradas</option>
            </select>
          </label>
        </div>
        {error && (
          <p role="alert" className="text-red-700 text-sm mb-3">
            {error}
          </p>
        )}
        {consultas === null ? (
          <p className="text-sm text-gray-500">Cargando...</p>
        ) : consultas.length === 0 ? (
          <p className="text-sm text-gray-500 bg-superficie border border-gray-200 rounded-xl p-4">
            {personal
              ? 'No hay consultas con ese estado.'
              : 'Aún no tienes consultas. Para escribirle al vendedor, abre el asistente y escribe "contactar al vendedor".'}
          </p>
        ) : (
          <ul className="bg-superficie border border-gray-200 rounded-xl divide-y">
            {consultas.map((c) => (
              <li key={c.numero}>
                <button
                  onClick={() => setAbierta(c.numero)}
                  aria-current={abierta === c.numero ? 'true' : undefined}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${abierta === c.numero ? 'bg-marca-50' : ''}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-gray-900">{c.motivo_texto}</span>
                    <Estado estado={c.estado} />
                  </span>
                  <span className="block text-xs text-gray-600 mt-1 line-clamp-2">{c.mensajes[c.mensajes.length - 1]?.texto}</span>
                  <span className="block text-[11px] text-gray-500 mt-1">
                    {c.numero}
                    {personal && ` · ${c.email}`} · {fecha(c.actualizado_en)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="lg:col-span-3">
        {abierta ? (
          <Hilo key={abierta} numero={abierta} personal={personal} alCambiar={cargar} listoParaResponder={abierta === inicial} />
        ) : (
          consultas?.length > 0 && <p className="text-sm text-gray-500">Elige una consulta para ver la conversación.</p>
        )}
      </div>
    </div>
  );
}

/**
 * Hilo de una consulta. Si se llego desde una notificacion (listoParaResponder),
 * el foco queda en el campo de respuesta: abrir la notificacion y escribir.
 */
function Hilo({ numero, personal, alCambiar, listoParaResponder = false }) {
  const [consulta, setConsulta] = useState(null);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const titulo = useRef(null);
  const respuesta = useRef(null);
  const seccion = useRef(null);

  useEffect(() => {
    api(`/asistente/consultas/${encodeURIComponent(numero)}`)
      .then((c) => setConsulta(c))
      .catch((e) => setError(e.message));
  }, [numero]);

  // Con la consulta ya pintada: foco en la respuesta o en el titulo.
  const cargada = Boolean(consulta);
  useEffect(() => {
    if (!cargada) return;
    if (listoParaResponder && respuesta.current) {
      seccion.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      respuesta.current.focus({ preventScroll: true });
    } else {
      titulo.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargada]);

  const enviar = async (e) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      setConsulta(await api(`/asistente/consultas/${encodeURIComponent(numero)}/mensajes`, { metodo: 'POST', cuerpo: { texto } }));
      setTexto('');
      alCambiar();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const cambiarEstado = async (estado) => {
    setError(null);
    try {
      setConsulta(await api(`/asistente/consultas/${encodeURIComponent(numero)}`, { metodo: 'PATCH', cuerpo: { estado } }));
      alCambiar();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!consulta) {
    return error ? (
      <p role="alert" className="text-red-700 text-sm">
        {error}
      </p>
    ) : (
      <p className="text-sm text-gray-500">Cargando...</p>
    );
  }

  return (
    <section ref={seccion} aria-labelledby="hilo-titulo" className="bg-superficie border border-gray-200 rounded-xl p-5 scroll-mt-24">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
        <h3 id="hilo-titulo" ref={titulo} tabIndex={-1} className="font-bold focus:outline-none">
          {consulta.motivo_texto}
        </h3>
        <Estado estado={consulta.estado} />
      </div>
      <p className="text-xs text-gray-500 mb-4">
        {consulta.numero}
        {consulta.referencia && ` · referencia ${consulta.referencia}`}
        {personal && ` · ${consulta.email}`}
      </p>

      <ol className="space-y-3 mb-4" aria-label="Mensajes de la consulta">
        {consulta.mensajes.map((m, i) => {
          const mio = personal ? m.autor === 'vendedor' : m.autor === 'cliente';
          return (
            <li key={i} className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${mio ? 'burbuja-usuario' : 'bg-gray-100 text-gray-900'}`}>
                <p className="text-[11px] font-semibold opacity-80 mb-0.5">
                  {m.autor === 'vendedor' ? 'SerByTek' : personal ? m.nombre : 'Tú'} · {fecha(m.en)}
                </p>
                <p className="whitespace-pre-wrap break-words">{m.texto}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {consulta.estado === 'cerrada' ? (
        <p className="text-sm text-gray-600 border-t border-gray-200 pt-3">
          Esta consulta está cerrada.
          {personal && (
            <button onClick={() => cambiarEstado('abierta')} className="ml-2 text-marca-700 font-semibold hover:underline">
              Reabrir
            </button>
          )}
        </p>
      ) : (
        <form onSubmit={enviar} className="border-t border-gray-200 pt-3">
          <label htmlFor="hilo-respuesta" className="block text-xs font-semibold text-gray-700 mb-1">
            {personal ? 'Respuesta al cliente' : 'Tu mensaje'}
          </label>
          <textarea
            ref={respuesta}
            id="hilo-respuesta"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            maxLength={1000}
            required
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-superficie"
          />
          {error && (
            <p role="alert" className="text-red-700 text-sm mt-2">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            <button type="submit" disabled={enviando || texto.trim().length < 5} className="btn-primario text-sm px-4 py-1.5 rounded">
              {enviando ? 'Enviando...' : personal ? 'Responder' : 'Enviar'}
            </button>
            {personal && (
              <button type="button" onClick={() => cambiarEstado('cerrada')} className="border border-gray-300 text-sm px-4 py-1.5 rounded hover:bg-gray-100">
                Cerrar consulta
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
