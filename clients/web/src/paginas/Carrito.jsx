import React, { useState } from 'react';
import { api, moneda, nuevaClaveIdempotencia } from '../servicios/api';

/**
 * Carrito y checkout.
 *
 * El checkout es el punto donde el usuario ve el resultado de la saga. Los tres
 * desenlaces posibles se muestran de forma distinta a proposito:
 *
 *   201 -> compra confirmada, con numero de pedido
 *   402 -> pago rechazado: el pedido existe pero fue cancelado y el stock se
 *          devolvio. Se explica que NO se hizo ningun cobro.
 *   409 -> stock insuficiente o precio cambiado: nada ocurrio.
 *
 * La clave de idempotencia se genera una sola vez por intento y se reutiliza si
 * el usuario vuelve a pulsar el boton: asi un doble clic no genera dos pedidos.
 */
export default function Carrito({ usuario, carrito, recargarCarrito }) {
  const [medioPago, setMedioPago] = useState('tarjeta_credito');
  const [tokenTarjeta, setTokenTarjeta] = useState('tok_ok_4242');
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const [clave, setClave] = useState(nuevaClaveIdempotencia());
  const [cupon, setCupon] = useState(carrito?.cupon ?? '');

  const items = carrito?.items ?? [];
  const totales = carrito?.totales ?? {};

  const cambiarCantidad = async (sku, cantidad) => {
    setError(null);
    try {
      await api(`/carrito/${usuario.cliente_id}/items/${sku}`, {
        metodo: 'PATCH',
        cuerpo: { cantidad }
      });
      await recargarCarrito();
    } catch (e) {
      setError(e.message);
    }
  };

  const quitar = async (sku) => {
    setError(null);
    try {
      await api(`/carrito/${usuario.cliente_id}/items/${sku}`, { metodo: 'DELETE' });
      await recargarCarrito();
    } catch (e) {
      setError(e.message);
    }
  };

  const aplicarCupon = async (codigo) => {
    setError(null);
    try {
      await api(`/carrito/${usuario.cliente_id}/cupon`, { metodo: 'POST', cuerpo: { codigo } });
      await recargarCarrito();
    } catch (e) {
      setError(e.message);
    }
  };

  const pagar = async () => {
    setProcesando(true);
    setError(null);
    setResultado(null);

    try {
      const datos = await api('/pedidos/checkout', {
        metodo: 'POST',
        headers: { 'Idempotency-Key': clave },
        cuerpo: { medio_pago: medioPago, token_medio_pago: tokenTarjeta }
      });

      setResultado({ tipo: 'exito', datos });
      setClave(nuevaClaveIdempotencia()); // la siguiente compra usa clave nueva
      await recargarCarrito();
    } catch (e) {
      if (e.codigo === 'PAGO_RECHAZADO') {
        setResultado({ tipo: 'rechazo', mensaje: e.message, detalle: e.detalle });
        setClave(nuevaClaveIdempotencia()); // puede reintentar con otra tarjeta
        await recargarCarrito();
      } else if (e.codigo === 'STOCK_INSUFICIENTE') {
        setError(
          `Se agoto el producto ${e.detalle?.sku ?? ''} mientras completaba la compra. ` +
            'Su carrito se conserva; ajuste la cantidad e intente de nuevo.'
        );
      } else if (e.codigo === 'CONFLICTO' && e.detalle?.discrepancias) {
        setError(
          'El precio de un producto cambio mientras compraba. ' +
            'Revise el carrito: los precios ya estan actualizados.'
        );
        await recargarCarrito();
      } else {
        setError(e.message);
      }
    } finally {
      setProcesando(false);
    }
  };

  if (resultado?.tipo === 'exito') {
    const p = resultado.datos.pedido ?? resultado.datos;
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        <div role="status" className="bg-green-50 border border-green-200 rounded-xl p-6 sm:p-8 text-center">
          <div className="text-5xl mb-4" aria-hidden="true">✅</div>
          <h1 className="text-2xl font-bold text-green-900 mb-2">Compra confirmada</h1>
          <p className="text-green-800">
            Tu pedido <strong>{p.numero}</strong> quedo registrado por{' '}
            <strong>{moneda(p.total)}</strong>.
          </p>
          <p className="text-sm text-green-700 mt-3">
            Recibiras la confirmacion por correo. El envio de esa notificacion es asincrono,
            asi que puede tardar unos segundos en llegar.
          </p>
          <button
            onClick={() => setResultado(null)}
            className="mt-6 bg-green-700 hover:bg-green-800 text-white font-semibold px-6 py-2 rounded-lg"
          >
            Seguir comprando
          </button>
        </div>
      </div>
    );
  }

  if (resultado?.tipo === 'rechazo') {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        <div role="alert" className="bg-amber-50 border border-amber-200 rounded-xl p-6 sm:p-8">
          <div className="text-4xl mb-3 text-center" aria-hidden="true">⚠️</div>
          <h1 className="text-xl font-bold text-amber-900 mb-2 text-center">
            No pudimos procesar el pago
          </h1>
          <p className="text-amber-800 text-center">{resultado.mensaje}</p>
          <div className="mt-5 bg-white border border-amber-200 rounded-lg p-4 text-sm text-gray-700">
            <p className="font-semibold mb-2">Que ocurrio con tu compra:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>
                El pedido <strong>{resultado.detalle?.numero}</strong> quedo registrado como
                cancelado.
              </li>
              <li>No se realizo ningun cobro a tu medio de pago.</li>
              <li>Los productos volvieron a estar disponibles para otros clientes.</li>
              <li>Tu carrito se conserva: puedes intentar con otro medio de pago.</li>
            </ul>
          </div>
          <button
            onClick={() => setResultado(null)}
            className="mt-6 w-full bg-amber-700 hover:bg-amber-800 text-white font-semibold py-2 rounded-lg"
          >
            Volver al carrito
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <section className="lg:col-span-2">
        <h1 className="text-xl font-bold text-gray-900 mb-4">Tu carrito</h1>

        {error && (
          <div role="alert" className="mb-4 bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 text-sm">
            {error}
          </div>
        )}

        {items.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-500">
            Tu carrito esta vacio.
          </div>
        ) : (
          <ul className="bg-white border border-gray-200 rounded-xl divide-y">
            {items.map((i) => (
              <li key={i.sku} className="p-4 flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-3">
                <div
                  aria-hidden="true"
                  className="w-14 h-14 shrink-0 bg-gray-100 rounded-lg flex items-center justify-center text-xl"
                >
                  📦
                </div>
                <div className="flex-1 min-w-[calc(100%-4.5rem)] sm:min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{i.nombre}</p>
                  <p className="text-xs text-gray-500">{i.sku}</p>
                  <p className="text-sm text-gray-700 mt-1">{moneda(i.precio_unitario)} c/u</p>
                </div>
                <div className="flex items-center gap-2 ml-[4.5rem] sm:ml-0">
                  <button
                    onClick={() => cambiarCantidad(i.sku, i.cantidad - 1)}
                    aria-label={
                      i.cantidad > 1 ? `Disminuir cantidad de ${i.nombre}` : `Quitar ${i.nombre}`
                    }
                    className="w-8 h-8 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    -
                  </button>
                  <span className="w-8 text-center font-semibold">
                    <span className="sr-only">Cantidad: </span>
                    {i.cantidad}
                  </span>
                  <button
                    onClick={() => cambiarCantidad(i.sku, i.cantidad + 1)}
                    aria-label={`Aumentar cantidad de ${i.nombre}`}
                    className="w-8 h-8 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    +
                  </button>
                </div>
                <div className="ml-auto sm:ml-0 w-28 text-right font-bold text-gray-900">
                  {moneda(i.precio_unitario * i.cantidad)}
                </div>
                <button
                  onClick={() => quitar(i.sku)}
                  className="w-8 h-8 text-gray-500 hover:text-red-600 text-sm"
                  title="Quitar"
                  aria-label={`Quitar ${i.nombre} del carrito`}
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside aria-labelledby="titulo-resumen" className="bg-white border border-gray-200 rounded-xl p-5 h-fit">
        <h2 id="titulo-resumen" className="font-bold text-gray-900 mb-4">Resumen</h2>

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-600">Subtotal</dt>
            <dd>{moneda(totales.subtotal)}</dd>
          </div>
          {totales.descuento > 0 && (
            <div className="flex justify-between text-green-700">
              <dt>Descuento {totales.cupon_aplicado && `(${totales.cupon_aplicado})`}</dt>
              <dd>-{moneda(totales.descuento)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-gray-600">IVA (19%)</dt>
            <dd>{moneda(totales.impuestos)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Envio</dt>
            <dd>{totales.envio === 0 ? 'Gratis' : moneda(totales.envio)}</dd>
          </div>
          <div className="flex justify-between pt-3 border-t font-bold text-base">
            <dt>Total</dt>
            <dd>{moneda(totales.total)}</dd>
          </div>
        </dl>

        <div className="mt-5">
          <label htmlFor="cupon" className="block text-xs font-semibold text-gray-700 mb-1">
            Cupon
          </label>
          <div className="flex gap-2">
            <input
              id="cupon"
              placeholder="BIENVENIDA10"
              value={cupon}
              onChange={(e) => setCupon(e.target.value)}
              className="flex-1 min-w-0 border border-gray-300 rounded px-2 py-1.5 text-sm"
            />
            <button
              onClick={() => aplicarCupon(cupon.trim())}
              disabled={!cupon.trim()}
              className="bg-gray-800 hover:bg-gray-900 disabled:bg-gray-300 text-white text-sm px-3 rounded"
            >
              Aplicar
            </button>
          </div>
        </div>

        <div className="mt-5">
          <label htmlFor="medio-pago" className="block text-xs font-semibold text-gray-700 mb-1">
            Medio de pago
          </label>
          <select
            id="medio-pago"
            value={medioPago}
            onChange={(e) => setMedioPago(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm mb-2"
          >
            <option value="tarjeta_credito">Tarjeta de credito</option>
            <option value="tarjeta_debito">Tarjeta debito</option>
            <option value="pse">PSE</option>
            <option value="efecty">Efecty</option>
          </select>

          {/* En produccion este token lo genera la pasarela; aqui se expone
              para poder probar los distintos desenlaces del pago. */}
          <label htmlFor="token-pasarela" className="block text-xs font-semibold text-gray-700 mb-1">
            Token de la pasarela (pruebas)
          </label>
          <select
            id="token-pasarela"
            value={tokenTarjeta}
            onChange={(e) => setTokenTarjeta(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          >
            <option value="tok_ok_4242">tok_ok_4242 (aprueba)</option>
            <option value="tok_rechazo_1111">tok_rechazo_1111 (rechaza)</option>
            <option value="tok_error_9999">tok_error_9999 (falla la pasarela)</option>
            <option value="tok_lento_7777">tok_lento_7777 (provoca timeout)</option>
          </select>
        </div>

        <button
          onClick={pagar}
          disabled={procesando || items.length === 0}
          className="mt-5 w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-lg transition"
        >
          {procesando ? 'Procesando la compra...' : `Pagar ${moneda(totales.total)}`}
        </button>

        <p className="text-xs text-gray-500 mt-3 leading-relaxed">
          Al confirmar se reserva el stock, se cobra y solo entonces se descuenta el inventario.
          Si el pago falla, la reserva se libera automaticamente.
        </p>
      </aside>
    </div>
  );
}
