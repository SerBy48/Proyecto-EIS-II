import React, { useEffect, useState } from 'react';
import { api } from '../servicios/api';
import { ErrorCampo, atributosError, reglas, soloTelefono, validar } from '../servicios/validaciones.jsx';
import CampoContrasena from '../componentes/CampoContrasena.jsx';
import Consultas from '../componentes/Consultas.jsx';
import Notificaciones from '../componentes/Notificaciones.jsx';
import FormularioDireccion, { describirDireccion } from '../componentes/FormularioDireccion.jsx';

/** Pedidos que impiden eliminar la cuenta (los mismos que valida auth-service). */
const ESTADOS_EN_CURSO = ['creado', 'pagado', 'en_preparacion', 'enviado'];
const NOMBRE_ESTADO = { creado: 'pendiente de pago', pagado: 'pagado', en_preparacion: 'en preparación', enviado: 'enviado' };

const Seccion = ({ titulo, descripcion, children }) => (
  <section className="bg-superficie border border-gray-200 rounded-xl p-5 sm:p-6">
    <h2 className="text-lg font-bold text-gray-900">{titulo}</h2>
    {descripcion && <p className="text-sm text-gray-600 mt-1 mb-4">{descripcion}</p>}
    {children}
  </section>
);

const Aviso = ({ tipo, children }) =>
  children ? (
    <div
      role={tipo === 'error' ? 'alert' : 'status'}
      className={`rounded-lg p-3 text-sm mb-4 border ${
        tipo === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'
      }`}
    >
      {children}
    </div>
  ) : null;

// Las reglas de clientes-service (controlador.ts), visibles junto al campo.
const ESQUEMA_DATOS = {
  nombre: [reglas.obligatorio('tu nombre')],
  apellido: [reglas.obligatorio('tu apellido')],
  telefono: [reglas.telefonoCliente],
  documento: [reglas.documento]
};

/** Datos personales: el correo es la identidad de la cuenta y no se edita aqui. */
function DatosPersonales({ clienteId }) {
  const [datos, setDatos] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [tocados, setTocados] = useState({});

  useEffect(() => {
    api(`/clientes/${clienteId}`)
      .then((c) => setDatos({ ...c, telefono: c.telefono ?? '', documento: c.documento ?? '', tipo_documento: c.tipo_documento ?? 'CC' }))
      .catch((e) => setMensaje({ tipo: 'error', texto: e.message }));
  }, [clienteId]);

  const errores = datos ? validar(datos, ESQUEMA_DATOS) : {};

  const guardar = async (e) => {
    e.preventDefault();
    setMensaje(null);
    if (Object.keys(errores).length) {
      setTocados({ nombre: true, apellido: true, telefono: true, documento: true });
      document.getElementById(`perfil-${Object.keys(errores)[0]}`)?.focus();
      return;
    }
    setGuardando(true);
    try {
      await api(`/clientes/${clienteId}`, {
        metodo: 'PATCH',
        cuerpo: {
          nombre: datos.nombre,
          apellido: datos.apellido,
          telefono: datos.telefono || null,
          tipo_documento: datos.tipo_documento,
          documento: datos.documento || null
        }
      });
      setMensaje({ tipo: 'ok', texto: 'Tus datos quedaron guardados.' });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setGuardando(false);
    }
  };

  if (!datos) return mensaje ? <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso> : <p className="text-gray-500">Cargando…</p>;

  const visible = (nombre) => (tocados[nombre] ? errores[nombre] : null);
  const campo = (nombre) => ({
    id: `perfil-${nombre}`,
    value: datos[nombre],
    onChange: (e) => setDatos((d) => ({ ...d, [nombre]: nombre === 'telefono' ? soloTelefono(e.target.value) : e.target.value })),
    onBlur: () => setTocados((t) => ({ ...t, [nombre]: true })),
    className: `w-full bg-superficie border border-gray-300 rounded-lg px-3 py-2 ${visible(nombre) ? '!border-red-600' : ''}`,
    ...atributosError(`perfil-${nombre}`, visible(nombre))
  });
  const etiqueta = (nombre, texto) => (
    <label htmlFor={`perfil-${nombre}`} className="block text-sm font-semibold text-gray-700 mb-1">
      {texto}
    </label>
  );

  return (
    <form onSubmit={guardar}>
      <Aviso tipo={mensaje?.tipo}>{mensaje?.texto}</Aviso>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          {etiqueta('nombre', 'Nombre')}
          <input {...campo('nombre')} required maxLength={100} autoComplete="given-name" />
          <ErrorCampo id="perfil-nombre" error={visible('nombre')} />
        </div>
        <div>
          {etiqueta('apellido', 'Apellido')}
          <input {...campo('apellido')} required maxLength={100} autoComplete="family-name" />
          <ErrorCampo id="perfil-apellido" error={visible('apellido')} />
        </div>
        <div>
          <label htmlFor="perfil-correo" className="block text-sm font-semibold text-gray-700 mb-1">
            Correo
          </label>
          <input id="perfil-correo" value={datos.email} readOnly aria-describedby="perfil-correo-ayuda" className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-gray-600" />
          <p id="perfil-correo-ayuda" className="text-xs text-gray-500 mt-1">Es tu usuario para iniciar sesión.</p>
        </div>
        <div>
          {etiqueta('telefono', 'Teléfono')}
          <input {...campo('telefono')} type="tel" inputMode="tel" maxLength={20} autoComplete="tel" placeholder="300 123 4567" />
          <ErrorCampo id="perfil-telefono" error={visible('telefono')} />
        </div>
        <div>
          {etiqueta('tipo_documento', 'Tipo de documento')}
          <select {...campo('tipo_documento')}>
            <option value="CC">Cédula de ciudadanía</option>
            <option value="CE">Cédula de extranjería</option>
            <option value="NIT">NIT</option>
            <option value="PAS">Pasaporte</option>
          </select>
        </div>
        <div>
          {etiqueta('documento', 'Número de documento')}
          <input {...campo('documento')} maxLength={30} placeholder="1075123456" />
          <ErrorCampo id="perfil-documento" error={visible('documento')} />
        </div>
      </div>
      <button type="submit" disabled={guardando} className="mt-4 btn-primario px-5 py-2">
        {guardando ? 'Guardando…' : 'Guardar datos'}
      </button>
    </form>
  );
}

function Direcciones({ clienteId }) {
  const [direcciones, setDirecciones] = useState(null);
  const [editando, setEditando] = useState(null); // id, 'nueva' o null
  const [mensaje, setMensaje] = useState(null);

  const cargar = async () => {
    try {
      setDirecciones((await api(`/clientes/${clienteId}/direcciones`)).filter((d) => d.tipo === 'envio'));
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message });
    }
  };
  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  const accion = async (promesa, texto) => {
    setMensaje(null);
    try {
      await promesa;
      await cargar();
      setMensaje({ tipo: 'ok', texto });
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message });
    }
  };

  const predeterminar = (d) =>
    accion(api(`/clientes/${clienteId}/direcciones/${d.id}`, { metodo: 'PATCH', cuerpo: { predeterminada: true } }), `"${d.etiqueta || d.linea1}" es ahora tu dirección predeterminada.`);
  const eliminar = (d) => {
    if (!window.confirm(`¿Eliminar la dirección "${describirDireccion(d)}"?`)) return;
    accion(api(`/clientes/${clienteId}/direcciones/${d.id}`, { metodo: 'DELETE' }), 'Dirección eliminada.');
  };

  if (!direcciones) return <p className="text-gray-500">Cargando…</p>;

  return (
    <div>
      <Aviso tipo={mensaje?.tipo}>{mensaje?.texto}</Aviso>
      {direcciones.length === 0 && editando !== 'nueva' && (
        <p className="text-sm text-gray-600 mb-3">Aún no tienes direcciones. Agrega una para poder comprar.</p>
      )}
      <ul className="space-y-3">
        {direcciones.map((d) => (
          <li key={d.id} className="border border-gray-200 rounded-lg p-3">
            {editando === d.id ? (
              <FormularioDireccion
                clienteId={clienteId}
                inicial={d}
                alGuardar={async () => {
                  setEditando(null);
                  await cargar();
                  setMensaje({ tipo: 'ok', texto: 'Dirección actualizada.' });
                }}
                alCancelar={() => setEditando(null)}
              />
            ) : (
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-[12rem]">
                  <p className="font-semibold text-gray-900">
                    {d.etiqueta || 'Dirección'}
                    {d.predeterminada && (
                      <span className="ml-2 text-xs font-semibold bg-marca-100 text-marca-800 px-2 py-0.5 rounded-full">Predeterminada</span>
                    )}
                  </p>
                  <p className="text-sm text-gray-700">{describirDireccion(d)}</p>
                  {d.codigo_postal && <p className="text-xs text-gray-500">Código postal {d.codigo_postal}</p>}
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  {!d.predeterminada && (
                    <button onClick={() => predeterminar(d)} className="text-marca-700 font-semibold hover:underline">
                      Usar como predeterminada
                    </button>
                  )}
                  <button onClick={() => setEditando(d.id)} className="text-gray-700 hover:underline">
                    Editar<span className="sr-only"> {d.etiqueta || d.linea1}</span>
                  </button>
                  <button onClick={() => eliminar(d)} className="text-red-700 hover:underline">
                    Eliminar<span className="sr-only"> {d.etiqueta || d.linea1}</span>
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {editando === 'nueva' ? (
        <div className="mt-3 border border-gray-200 rounded-lg p-3">
          <FormularioDireccion
            clienteId={clienteId}
            predeterminada={direcciones.length === 0}
            alGuardar={async () => {
              setEditando(null);
              await cargar();
              setMensaje({ tipo: 'ok', texto: 'Dirección agregada.' });
            }}
            alCancelar={() => setEditando(null)}
          />
        </div>
      ) : (
        <button onClick={() => setEditando('nueva')} className="mt-3 text-sm text-marca-700 font-semibold hover:underline">
          + Agregar dirección
        </button>
      )}
    </div>
  );
}

/**
 * Eliminar la cuenta. Bloqueado mientras haya pedidos en curso: la web lo
 * anticipa con la lista de pedidos, y auth-service lo vuelve a comprobar.
 */
function EliminarCuenta({ alEliminar }) {
  const [enCurso, setEnCurso] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/pedidos')
      .then((pedidos) => setEnCurso(pedidos.filter((p) => ESTADOS_EN_CURSO.includes(p.estado))))
      .catch(() => setEnCurso([]));
  }, []);

  const eliminar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await api('/auth/cuenta', { metodo: 'DELETE', cuerpo: { password } });
      alEliminar();
    } catch (err) {
      setError(err.message);
      if (err.detalle?.pendientes) setEnCurso(err.detalle.pendientes);
    } finally {
      setEnviando(false);
    }
  };

  if (enCurso === null) return <p className="text-gray-500 text-sm">Revisando tus pedidos…</p>;

  if (enCurso.length) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
        <p className="font-semibold">No puedes eliminar tu cuenta todavía.</p>
        <p className="mt-1">Tienes pedidos en curso. Cuando se entreguen o los canceles, podrás eliminarla:</p>
        <ul className="mt-2 list-disc list-inside">
          {enCurso.map((p) => (
            <li key={p.numero}>
              <span className="font-mono">{p.numero}</span> · {NOMBRE_ESTADO[p.estado] ?? p.estado}
            </li>
          ))}
        </ul>
        <button disabled className="mt-3 btn-peligro px-4 py-2" aria-describedby="motivo-bloqueo">
          Eliminar mi cuenta
        </button>
        <p id="motivo-bloqueo" className="sr-only">Bloqueado porque tienes pedidos en curso.</p>
      </div>
    );
  }

  if (!confirmando) {
    return (
      <button onClick={() => setConfirmando(true)} className="border border-red-300 text-red-700 hover:bg-red-50 font-semibold px-4 py-2 rounded-lg">
        Eliminar mi cuenta
      </button>
    );
  }

  return (
    <form onSubmit={eliminar} className="border border-red-200 bg-red-50 rounded-lg p-4">
      <p className="text-sm text-red-900 font-semibold">¿Eliminar tu cuenta? Esta acción no se puede deshacer.</p>
      <ul className="mt-2 text-sm text-red-900 list-disc list-inside space-y-1">
        <li>Borramos tus datos personales y tus direcciones, y cerramos tus sesiones.</li>
        <li>Tus pedidos anteriores se conservan sin tus datos, por obligaciones contables.</li>
      </ul>
      {error && (
        <div role="alert" className="mt-3 bg-superficie border border-red-300 text-red-800 rounded-lg p-2 text-sm">
          {error}
        </div>
      )}
      <label htmlFor="eliminar-password" className="block text-sm font-semibold text-red-900 mt-3 mb-1">
        Confirma con tu contraseña
      </label>
      <CampoContrasena id="eliminar-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        <button type="submit" disabled={enviando || !password} className="flex-1 btn-peligro py-2">
          {enviando ? 'Eliminando…' : 'Sí, eliminar mi cuenta'}
        </button>
        <button type="button" onClick={() => setConfirmando(false)} className="flex-1 border border-gray-300 bg-superficie hover:bg-gray-100 font-semibold py-2 rounded-lg">
          No, conservarla
        </button>
      </div>
    </form>
  );
}

export default function Perfil({ usuario, alEliminarCuenta, seccionInicial, consultaInicial, alAbrirNotificacion }) {
  const [seccion, setSeccion] = useState(['consultas', 'notificaciones'].includes(seccionInicial) ? seccionInicial : 'datos');
  const pestanas = (
    <nav aria-label="Secciones del perfil" className="flex gap-2 border-b border-gray-200 overflow-x-auto">
      {[
        ['datos', 'Mis datos'],
        ['consultas', 'Mis consultas'],
        ['notificaciones', 'Notificaciones']
      ].map(([id, texto]) => (
        <button
          key={id}
          onClick={() => setSeccion(id)}
          aria-current={seccion === id ? 'page' : undefined}
          className={`px-4 py-2 text-sm font-semibold border-b-2 whitespace-nowrap ${
            seccion === id ? 'border-marca-600 text-marca-700' : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          {texto}
        </button>
      ))}
    </nav>
  );

  if (seccion === 'notificaciones') {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Mi perfil</h1>
        {pestanas}
        <Notificaciones onAbrir={alAbrirNotificacion} />
      </div>
    );
  }

  if (seccion === 'consultas') {
    return (
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Mi perfil</h1>
        {pestanas}
        <Consultas inicial={consultaInicial ?? null} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Mi perfil</h1>
      {pestanas}
      <Seccion titulo="Datos personales">
        <DatosPersonales clienteId={usuario.cliente_id} />
      </Seccion>
      <Seccion
        titulo="Direcciones de envío"
        descripcion="La predeterminada aparece marcada al pagar; puedes elegir otra en ese momento."
      >
        <Direcciones clienteId={usuario.cliente_id} />
      </Seccion>
      <Seccion titulo="Eliminar cuenta" descripcion="Si eliminas tu cuenta, no podrás recuperarla.">
        <EliminarCuenta alEliminar={alEliminarCuenta} />
      </Seccion>
    </div>
  );
}
