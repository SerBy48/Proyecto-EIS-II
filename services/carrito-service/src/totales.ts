/**
 * Calculo de los totales del carrito (seccion 5.7: subtotales, impuestos, costo
 * de envio y cupones). Es una funcion pura: no consulta el catalogo ni Redis,
 * asi que se prueba sin red (services/carrito-service/test/totales.test.ts).
 *
 * Reglas:
 *   - El descuento del cupon se aplica sobre el subtotal y ANTES del IVA.
 *   - El envio depende del subtotal SIN descuento: un cupon no hace perder el
 *     envio gratis. El pedido copia este valor tal cual (saga-checkout.ts).
 *   - Un cupon cuyo minimo de compra no se alcanza no se aplica.
 */

export interface ItemConPrecio {
  precio_unitario: number;
  cantidad: number;
}

export interface Promocion {
  codigo: string;
  tipo: string; // porcentaje | monto_fijo | envio_gratis
  valor: number;
  minimo_compra?: number;
}

export interface Totales {
  subtotal: number;
  descuento: number;
  impuestos: number;
  envio: number;
  total: number;
  cupon_aplicado?: string;
}

export interface ReglasTotales {
  porcentajeIva: number;
  envioBase: number;
  umbralEnvioGratis: number;
}

/** Valores de la configuracion; los mismos que lee el asistente para las FAQ. */
export const reglasDesdeEntorno = (): ReglasTotales => ({
  porcentajeIva: Number(process.env.PORCENTAJE_IVA || 19),
  envioBase: Number(process.env.COSTO_ENVIO_BASE || 15000),
  umbralEnvioGratis: Number(process.env.UMBRAL_ENVIO_GRATIS || 500000)
});

export const calcularTotales = (
  items: ItemConPrecio[],
  promocion: Promocion | null,
  reglas: ReglasTotales = reglasDesdeEntorno()
): Totales => {
  const subtotal = items.reduce((suma, i) => suma + i.precio_unitario * i.cantidad, 0);

  let descuento = 0;
  let envio = subtotal >= reglas.umbralEnvioGratis || subtotal === 0 ? 0 : reglas.envioBase;
  let cuponAplicado: string | undefined;

  if (promocion && subtotal >= (promocion.minimo_compra ?? 0)) {
    cuponAplicado = promocion.codigo;
    if (promocion.tipo === 'porcentaje') {
      descuento = Math.round(subtotal * (promocion.valor / 100));
    } else if (promocion.tipo === 'monto_fijo') {
      descuento = Math.min(promocion.valor, subtotal);
    } else if (promocion.tipo === 'envio_gratis') {
      envio = 0;
    }
  }

  const baseImponible = subtotal - descuento;
  const impuestos = Math.round(baseImponible * (reglas.porcentajeIva / 100));

  return {
    subtotal,
    descuento,
    impuestos,
    envio,
    total: baseImponible + impuestos + envio,
    ...(cuponAplicado ? { cupon_aplicado: cuponAplicado } : {})
  };
};
