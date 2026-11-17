import React, { useEffect, useId, useState } from 'react';
import { api } from '../servicios/api';

/**
 * Formulario de una direccion de envio (perfil, carrito, cambio de direccion
 * de un pedido y registro). El departamento se elige de la lista oficial que
 * publica clientes-service (GET /api/clientes/departamentos): el servidor
 * valida contra la misma lista.
 *
 * Con `soloCampos` no pinta el <form> ni los botones: lo usa el registro, que
 * envia todo junto.
 */

let departamentosEnCache = null;
export const cargarDepartamentos = async () => {
  if (!departamentosEnCache) departamentosEnCache = await api('/clientes/departamentos');
  return departamentosEnCache;
};

export const DIRECCION_VACIA = { etiqueta: '', linea1: '', linea2: '', ciudad: '', departamento: '', codigo_postal: '' };

/** "Calle 10 # 5-20, Apto 301, Neiva, Huila" */
export const describirDireccion = (d) =>
  d ? [d.linea1, d.linea2, d.ciudad, d.departamento].filter(Boolean).join(', ') : '';

export function CamposDireccion({ valor, alCambiar, prefijo }) {
  const [departamentos, setDepartamentos] = useState([]);
  useEffect(() => {
    cargarDepartamentos().then(setDepartamentos).catch(() => setDepartamentos([]));
  }, []);

  const id = (campo) => `${prefijo}-${campo}`;
  const props = (campo) => ({
    id: id(campo),
    value: valor[campo] ?? '',
    onChange: (e) => alCambiar({ ...valor, [campo]: e.target.value }),
    className: 'w-full bg-superficie border border-gray-300 rounded-lg px-3 py-2'
  });
  const etiqueta = (campo, texto, opcional = false) => (
    <label htmlFor={id(campo)} className="block text-sm font-semibold text-gray-700 mb-1">
      {texto}
      {opcional && <span className="font-normal text-gray-500"> (opcional)</span>}
    </label>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-3">
      <div className="sm:col-span-2">
        {etiqueta('linea1', 'Dirección')}
        <input {...props('linea1')} required maxLength={200} autoComplete="address-line1" placeholder="Calle 10 # 5-20" />
      </div>
      <div className="sm:col-span-2">
        {etiqueta('linea2', 'Apartamento, torre o indicaciones', true)}
        <input {...props('linea2')} maxLength={200} autoComplete="address-line2" placeholder="Apto 301, torre B" />
      </div>
      <div>
        {etiqueta('departamento', 'Departamento')}
        <select {...props('departamento')} required autoComplete="address-level1">
          <option value="">Selecciona…</option>
          {departamentos.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
      <div>
        {etiqueta('ciudad', 'Ciudad o municipio')}
        <input {...props('ciudad')} required maxLength={100} autoComplete="address-level2" />
      </div>
      <div>
        {etiqueta('etiqueta', 'Nombre de la dirección', true)}
        <input {...props('etiqueta')} maxLength={50} placeholder="Casa, oficina…" />
      </div>
      <div>
        {etiqueta('codigo_postal', 'Código postal', true)}
        <input {...props('codigo_postal')} inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="postal-code" />
      </div>
    </div>
  );
}

/** Quita los campos opcionales vacios antes de enviarlos. */
export const limpiarDireccion = (d) =>
  Object.fromEntries(Object.entries(d).filter(([campo, valor]) => ['linea1', 'ciudad', 'departamento'].includes(campo) || String(valor ?? '').trim()));

/**
 * Formulario completo: crea o edita una direccion del cliente y devuelve la
 * direccion guardada a `alGuardar`.
 */
export default function FormularioDireccion({ clienteId, inicial, alGuardar, alCancelar, textoGuardar = 'Guardar dirección', predeterminada }) {
  const prefijo = useId().replace(/:/g, '');
  const [valor, setValor] = useState({ ...DIRECCION_VACIA, ...(inicial ?? {}) });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const enviar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const cuerpo = { ...limpiarDireccion(valor), ...(predeterminada ? { predeterminada: true } : {}) };
      const respuesta = inicial?.id
        ? await api(`/clientes/${clienteId}/direcciones/${inicial.id}`, { metodo: 'PATCH', cuerpo })
        : await api(`/clientes/${clienteId}/direcciones`, { metodo: 'POST', cuerpo: { tipo: 'envio', ...cuerpo } });
      await alGuardar(respuesta.direccion);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="space-y-3">
      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}
      <CamposDireccion valor={valor} alCambiar={setValor} prefijo={prefijo} />
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="submit" disabled={guardando} className="btn-primario px-4 py-2 text-sm">
          {guardando ? 'Guardando…' : textoGuardar}
        </button>
        {alCancelar && (
          <button type="button" onClick={alCancelar} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
