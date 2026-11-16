import React, { useEffect, useId, useRef, useState } from 'react';
import { api, moneda } from '../servicios/api';

/**
 * Asistente virtual: boton flotante y panel de chat, visible en todas las vistas.
 *
 * Seguridad: las respuestas del servidor se pintan SIEMPRE como texto (React
 * escapa todo); nunca se inserta HTML crudo.
 * Accesibilidad: el historial es una region viva (role="log"), Esc cierra el
 * panel y devuelve el foco al boton, y el foco va al campo al abrir.
 */

const LONGITUD_MAXIMA = 500;

const OPCIONES_INICIALES = [
  { etiqueta: 'Costo de envio', texto: 'Cuanto cuesta el envio?' },
  { etiqueta: 'Buscar un producto', texto: 'Quiero buscar un producto' },
  { etiqueta: 'Mis pedidos', texto: 'Cual es el estado de mis pedidos?' },
  { etiqueta: 'Hablar con un asesor', texto: 'Quiero hablar con un asesor' }
];

const bienvenida = () => ({
  id: 'bienvenida',
  de: 'asistente',
  respuestas: [
    { tipo: 'texto', texto: 'Hola, soy el asistente de la tienda. Preguntame por envios, pagos, productos o tus pedidos.' },
    { tipo: 'opciones', opciones: OPCIONES_INICIALES }
  ]
});

const ESTADOS = {
  creado: 'Creado',
  pagado: 'Pagado',
  en_preparacion: 'En preparacion',
  enviado: 'Enviado',
  entregado: 'Entregado',
  cancelado: 'Cancelado'
};

export default function Asistente({ usuario, alAgregar, onNavegar, onIniciarSesion }) {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState(() => [bienvenida()]);
  const [conversacionId, setConversacionId] = useState(null);
  const [texto, setTexto] = useState('');
  const [escribiendo, setEscribiendo] = useState(false);
  const [error, setError] = useState(null);

  const idPanel = useId();
  const botonRef = useRef(null);
  const campoRef = useRef(null);
  const finalRef = useRef(null);
  const secuencia = useRef(0);

  // La conversacion pertenece a una identidad: al entrar o salir se empieza otra.
  useEffect(() => {
    setMensajes([bienvenida()]);
    setConversacionId(null);
    setError(null);
  }, [usuario?.id]);

  useEffect(() => {
    if (abierto) campoRef.current?.focus();
  }, [abierto]);

  useEffect(() => {
    finalRef.current?.scrollIntoView({ block: 'end' });
  }, [mensajes, escribiendo]);

  const cerrar = () => {
    setAbierto(false);
    botonRef.current?.focus();
  };

  const enviar = async (contenido) => {
    const limpio = contenido.trim();
    if (!limpio || escribiendo) return;
    setError(null);
    setTexto('');
    setMensajes((m) => [...m, { id: `u${++secuencia.current}`, de: 'usuario', texto: limpio }]);
    setEscribiendo(true);
    try {
      const respuesta = await api('/asistente/mensajes', {
        metodo: 'POST',
        cuerpo: { texto: limpio, ...(conversacionId ? { conversacion_id: conversacionId } : {}) }
      });
      setConversacionId(respuesta.conversacion_id);
      setMensajes((m) => [...m, { id: `a${++secuencia.current}`, de: 'asistente', respuestas: respuesta.respuestas }]);
    } catch (e) {
      setError(
        e.estado === 429
          ? 'Estas escribiendo muy rapido. Espera un momento.'
          : 'El asistente no esta disponible en este momento. La tienda sigue funcionando con normalidad.'
      );
    } finally {
      setEscribiendo(false);
      campoRef.current?.focus();
    }
  };

  const elegirOpcion = (opcion) => {
    if (opcion.accion === 'iniciar_sesion') {
      onIniciarSesion();
      cerrar();
    } else if (opcion.accion === 'ir_pedidos') {
      onNavegar('pedidos');
    } else if (opcion.accion === 'ir_carrito') {
      onNavegar('carrito');
    } else if (opcion.texto) {
      enviar(opcion.texto);
    }
  };

  const esCliente = usuario?.rol === 'cliente';

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {abierto && (
        <section
          id={idPanel}
          role="dialog"
          aria-modal="false"
          aria-label="Asistente virtual"
          onKeyDown={(e) => e.key === 'Escape' && cerrar()}
          className="w-[calc(100vw-2rem)] sm:w-96 h-[32rem] max-h-[calc(100vh-6rem)] bg-white border border-gray-200 rounded-xl shadow-xl flex flex-col"
        >
          <header className="flex items-center justify-between px-4 py-3 border-b">
            <h2 className="font-semibold text-gray-900">Asistente virtual</h2>
            <button onClick={cerrar} aria-label="Cerrar el asistente" className="text-gray-500 hover:text-gray-800 px-2 py-1 rounded">
              ✕
            </button>
          </header>

          <div role="log" aria-live="polite" aria-label="Conversacion" className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm">
            {mensajes.map((m) =>
              m.de === 'usuario' ? (
                <p key={m.id} className="ml-auto max-w-[85%] w-fit bg-indigo-600 text-white rounded-lg px-3 py-2 break-words">
                  <span className="sr-only">Tu: </span>
                  {m.texto}
                </p>
              ) : (
                <div key={m.id} className="max-w-[90%] space-y-2">
                  <span className="sr-only">Asistente: </span>
                  {m.respuestas.map((r, i) => (
                    <Respuesta key={i} r={r} esCliente={esCliente} alAgregar={alAgregar} alElegir={elegirOpcion} deshabilitado={escribiendo} />
                  ))}
                </div>
              )
            )}
            {escribiendo && (
              <p className="text-gray-500 italic" aria-label="El asistente esta escribiendo">
                Escribiendo…
              </p>
            )}
            <div ref={finalRef} />
          </div>

          {error && (
            <div role="alert" className="mx-4 mb-2 bg-red-50 border border-red-200 text-red-800 rounded-lg p-2 text-xs">
              {error}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar(texto);
            }}
            className="border-t p-3 flex gap-2"
          >
            <label htmlFor={`${idPanel}-campo`} className="sr-only">
              Escribe tu pregunta
            </label>
            <input
              id={`${idPanel}-campo`}
              ref={campoRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={LONGITUD_MAXIMA}
              placeholder="Escribe tu pregunta"
              autoComplete="off"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={escribiendo || !texto.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold px-4 rounded-lg text-sm"
            >
              Enviar
            </button>
          </form>
        </section>
      )}

      <button
        ref={botonRef}
        onClick={() => (abierto ? cerrar() : setAbierto(true))}
        aria-expanded={abierto}
        aria-controls={abierto ? idPanel : undefined}
        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-full shadow-lg px-5 py-3"
      >
        {abierto ? 'Cerrar asistente' : '¿Necesitas ayuda?'}
      </button>
    </div>
  );
}

function Respuesta({ r, esCliente, alAgregar, alElegir, deshabilitado }) {
  if (r.tipo === 'texto') {
    return <p className="bg-gray-100 text-gray-900 rounded-lg px-3 py-2 break-words">{r.texto}</p>;
  }

  if (r.tipo === 'productos') {
    return (
      <ul className="space-y-2" aria-label="Productos">
        {r.productos.map((p) => (
          <li key={p.sku} className="border border-gray-200 rounded-lg p-3">
            <p className="font-semibold text-gray-900">{p.nombre}</p>
            <p className="text-gray-600">
              {moneda(p.precio_final)} ·{' '}
              {p.disponible === null ? 'Disponibilidad no confirmada' : p.disponible > 0 ? `${p.disponible} disponibles` : 'Agotado'}
            </p>
            <p className="text-xs text-gray-500">{p.sku}</p>
            {esCliente && p.disponible !== 0 && (
              <button
                onClick={() => alAgregar(p.sku)}
                className="mt-2 text-indigo-700 border border-indigo-200 hover:bg-indigo-50 rounded-lg px-3 py-1 text-xs font-semibold"
                aria-label={`Agregar ${p.nombre} al carrito`}
              >
                Agregar al carrito
              </button>
            )}
          </li>
        ))}
      </ul>
    );
  }

  if (r.tipo === 'pedido' || r.tipo === 'pedidos') {
    const lista = r.tipo === 'pedido' ? [r.pedido] : r.pedidos;
    return (
      <ul className="space-y-2" aria-label="Pedidos">
        {lista.map((p) => (
          <li key={p.id} className="border border-gray-200 rounded-lg p-3">
            <p className="font-semibold text-gray-900">{p.numero}</p>
            <p className="text-gray-600">
              {ESTADOS[p.estado] ?? p.estado} · {moneda(p.total)}
            </p>
            <p className="text-xs text-gray-500">{new Date(p.creado_en).toLocaleDateString('es-CO')}</p>
          </li>
        ))}
      </ul>
    );
  }

  if (r.tipo === 'opciones') {
    return (
      <div className="flex flex-wrap gap-2" role="group" aria-label="Opciones rapidas">
        {r.opciones.map((o) => (
          <button
            key={o.etiqueta}
            onClick={() => alElegir(o)}
            disabled={deshabilitado}
            className="border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 rounded-full px-3 py-1 text-xs"
          >
            {o.etiqueta}
          </button>
        ))}
      </div>
    );
  }

  return null;
}
