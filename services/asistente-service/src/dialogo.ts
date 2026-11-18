import { BusEventos, ClaimsToken, Eventos, crearLogger } from '@ecommerce/shared';
import {
  FiltrosBusqueda,
  PedidoResumen,
  ProductoResumen,
  ResultadoBusqueda,
  buscarProductos,
  esServicioCaido,
  listarCategorias,
  pedidoDelUsuario,
  pedidosDelUsuario,
  productoPorSku
} from './adaptadores';
import { completarPlantilla, moneda } from './configuracion';
import { MOTIVOS as MOTIVOS_CONSULTA } from './consultas';
import { iaActiva, responderConIa } from './ia';
import {
  Intencion,
  NO_ENTENDIDO,
  Pendiente,
  Resultado,
  Subcategoria,
  Vocabulario,
  extraerConsultaProducto,
  formasDeMarca,
  normalizar,
  singular
} from './motor';

const log = crearLogger('asistente-service');

/**
 * Arbol de dialogo: arma la respuesta de cada intencion. Las respuestas son
 * datos estructurados (texto, productos, pedido, opciones) que la interfaz
 * pinta como texto: nunca HTML.
 *
 * Principio: ninguna respuesta es un callejon sin salida. Si una busqueda no
 * encuentra nada, se ofrecen las secciones del catalogo; si el motor no
 * entiende, primero se intenta encontrar productos con las palabras del
 * mensaje, luego se sugieren las intenciones mas cercanas y solo al final el
 * menu.
 */

/** Filtros con los que la web abre el catalogo (accion ir_catalogo); la web entiende q, subcategoria, marca y en_oferta. */
export interface FiltrosCatalogo {
  q?: string;
  subcategoria?: string;
  marca?: string;
  en_oferta?: boolean;
}

export interface Opcion {
  etiqueta: string;
  /** Texto que se envia como mensaje al elegir la opcion. */
  texto?: string;
  /** Accion de la interfaz: ir a una vista, iniciar sesion... */
  accion?: 'iniciar_sesion' | 'ir_pedidos' | 'ir_carrito' | 'ir_perfil' | 'ir_catalogo';
  filtros?: FiltrosCatalogo;
}

export type Respuesta =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'productos'; productos: ProductoResumen[] }
  | { tipo: 'pedido'; pedido: PedidoResumen }
  | { tipo: 'pedidos'; pedidos: PedidoResumen[] }
  | { tipo: 'opciones'; opciones: Opcion[] }
  // Formulario de consulta al vendedor dentro del chat (RF-53).
  | { tipo: 'formulario_consulta'; motivos: Array<{ clave: string; etiqueta: string }>; motivo: string; referencia: string | null };

export interface Contexto {
  texto: string;
  usuario?: ClaimsToken;
  /** "Bearer <jwt>" del usuario; sin el, nada de pedidos. */
  autorizacion?: string;
  requestId?: string;
  conversacionId: string;
  faq: Map<string, string>;
  /** Para sugerir intenciones cercanas cuando no se entiende el mensaje. */
  intenciones?: Intencion[];
  /** Subcategorias del catalogo (con sus sinonimos y conteos). */
  vocabulario?: Vocabulario;
  bus?: BusEventos;
  registrarTicket: (datos: { texto: string; usuario?: ClaimsToken }) => Promise<string>;
}

export interface Salida {
  respuestas: Respuesta[];
  pendiente?: Pendiente;
}

const ASESOR: Opcion = { etiqueta: 'Escribirle al vendedor', texto: 'Quiero contactar al vendedor' };

export const MENU: Opcion[] = [
  { etiqueta: 'Buscar un producto', texto: 'Quiero buscar un producto' },
  { etiqueta: 'Ofertas', texto: '¿Qué productos están en oferta?' },
  { etiqueta: 'Mis pedidos', texto: 'Cuál es el estado de mis pedidos?' },
  { etiqueta: 'Costo de envío', texto: 'Cuánto cuesta el envío?' },
  { etiqueta: 'Medios de pago', texto: 'Cuáles son los medios de pago?' },
  ASESOR
];

const LIMITE_PRODUCTOS = 4;

const texto = (t: string): Respuesta => ({ tipo: 'texto', texto: t });
const opciones = (lista: Opcion[]): Respuesta => ({ tipo: 'opciones', opciones: lista });

const NOMBRE_ESTADO: Record<string, string> = {
  creado: 'creado (pendiente de pago)',
  pagado: 'pagado',
  en_preparacion: 'en preparación',
  enviado: 'enviado',
  entregado: 'entregado',
  cancelado: 'cancelado'
};
export const describirEstado = (estado: string) => NOMBRE_ESTADO[estado] ?? estado;

const pedirSesion = (que: string): Salida => ({
  respuestas: [
    texto(`Para ${que} necesito que inicies sesión: solo te muestro tus propios pedidos.`),
    opciones([{ etiqueta: 'Iniciar sesión', accion: 'iniciar_sesion' }])
  ]
});

const noDisponible = (que: string): Salida => ({
  respuestas: [
    texto(`No puedo consultar ${que} en este momento. Intenta de nuevo en unos minutos o revisalo directamente en la tienda.`),
    opciones(MENU)
  ]
});

/** Informacion publica de la tienda: lo unico que ve la IA opcional. */
export const informacionPublica = (faq: Map<string, string>): string =>
  [...faq.values()].map((r) => `- ${completarPlantilla(r)}`).join('\n');

// ------------------------------------------------------------ catalogo

const subcategoriasDe = (ctx: Contexto): Subcategoria[] => ctx.vocabulario?.subcategorias ?? [];

const nombreSubcategoria = (slug: string | undefined, ctx: Contexto): string | undefined =>
  slug ? subcategoriasDe(ctx).find((s) => s.slug === slug)?.nombre ?? slug : undefined;

/** Botones con las secciones del catalogo. Si el vocabulario no llego, se consulta al catalogo. */
const opcionesDeSecciones = async (ctx: Contexto): Promise<Opcion[]> => {
  let subcategorias = subcategoriasDe(ctx);
  if (!subcategorias.length) {
    const categorias = await listarCategorias(ctx.requestId);
    subcategorias = categorias.flatMap((c) => c.subcategorias);
  }
  return subcategorias.map((s) => ({
    etiqueta: s.productos !== undefined ? `${s.nombre} (${s.productos})` : s.nombre,
    texto: `Muéstrame ${s.nombre}`
  }));
};

/**
 * Palabras del nombre y los sinonimos de las secciones (de una sola, si se
 * indica). Una consulta hecha solo de ellas es generica: "audifonos" o
 * "celulares, tablets y relojes" piden la seccion, no un producto.
 */
const palabrasDeSecciones = (ctx: Contexto, slug?: string, marca?: string): Set<string> => {
  const palabras = new Set<string>();
  // La marca pedida tambien es parte del filtro, no del nombre del producto.
  if (marca) formasDeMarca(marca).forEach((forma) => forma.split(' ').forEach((p) => palabras.add(singular(p))));
  for (const s of subcategoriasDe(ctx).filter((x) => !slug || x.slug === slug)) {
    for (const frase of [s.slug, s.nombre, ...(s.sinonimos ?? [])]) {
      normalizar(frase).split(' ').forEach((p) => palabras.add(singular(p)));
    }
  }
  return palabras;
};

const filtrosDe = (r: Resultado): FiltrosBusqueda => ({
  ...(r.entidades.subcategoria ? { subcategoria: r.entidades.subcategoria } : {}),
  ...(r.entidades.marca ? { marca: r.entidades.marca } : {}),
  ...(r.entidades.precio_min !== undefined ? { precio_min: r.entidades.precio_min } : {}),
  ...(r.entidades.precio_max !== undefined ? { precio_max: r.entidades.precio_max } : {}),
  ...(r.entidades.economico ? { orden: 'precio_asc' as const } : {})
});

/** " de Audio por menos de $3.000.000" */
const describirFiltros = (filtros: FiltrosBusqueda, ctx: Contexto): string => {
  const partes: string[] = [];
  const seccion = nombreSubcategoria(filtros.subcategoria, ctx);
  if (seccion) partes.push(`en ${seccion}`);
  if (filtros.marca) partes.push(`de ${filtros.marca}`);
  if (filtros.precio_min !== undefined && filtros.precio_max !== undefined) {
    partes.push(`entre ${moneda(filtros.precio_min)} y ${moneda(filtros.precio_max)}`);
  } else if (filtros.precio_max !== undefined) partes.push(`por menos de ${moneda(filtros.precio_max)}`);
  else if (filtros.precio_min !== undefined) partes.push(`desde ${moneda(filtros.precio_min)}`);
  return partes.length ? ` ${partes.join(' ')}` : '';
};

interface Hallazgo extends ResultadoBusqueda {
  filtros: FiltrosBusqueda;
  consulta: string;
  /** Explica que no se encontro exactamente lo pedido y que se muestra en su lugar. */
  nota?: string;
}

/**
 * Busqueda escalonada:
 *   1. el nombre que escribio el usuario con todos los filtros;
 *   2. si nombro una seccion, la seccion completa con sus filtros;
 *   3. cada palabra por separado, de la mas larga a la mas corta;
 *   4. si solo pidio un rango de precio, todo el catalogo en ese rango.
 */
const buscarEscalonado = async (consulta: string, filtros: FiltrosBusqueda, ctx: Contexto): Promise<Hallazgo | null> => {
  // "Muestrame Audio": la seccion completa, sin buscar esas palabras en los
  // nombres (el indice de texto no siempre las encuentra: "celulares").
  // "portatil gamer" no es generica: "gamer" no es de Computadores.
  // Lo mismo con una marca: "que tienen de Logitech" lista todo lo de Logitech.
  const soloSeccion = Boolean((filtros.subcategoria || filtros.marca) && consulta && esGenerica(consulta, ctx, filtros.subcategoria, filtros.marca));
  if (consulta && !soloSeccion) {
    const exacto = await buscarProductos(consulta, ctx.requestId, LIMITE_PRODUCTOS, filtros);
    if (exacto.total) return { ...exacto, filtros, consulta };
  }
  if (filtros.subcategoria || filtros.marca) {
    const seccion = await buscarProductos('', ctx.requestId, LIMITE_PRODUCTOS, filtros);
    if (seccion.total) {
      const nota = consulta && !soloSeccion && !esGenerica(consulta, ctx)
        ? `No encontré exactamente "${consulta}", pero estos son productos${describirFiltros(filtros, ctx)}:`
        : undefined;
      return { ...seccion, filtros, consulta: '', nota };
    }
  }
  if (consulta) {
    const palabras = [...new Set(consulta.split(' '))].filter((p) => p.length >= 3).sort((a, b) => b.length - a.length);
    if (palabras.length > 1) {
      for (const palabra of palabras) {
        const parcial = await buscarProductos(palabra, ctx.requestId, LIMITE_PRODUCTOS, filtros);
        if (parcial.total) {
          return { ...parcial, filtros, consulta: palabra, nota: `No encontré "${consulta}" completo; esto es lo más parecido, por "${palabra}":` };
        }
      }
    }
  }
  if (!consulta && (filtros.precio_min !== undefined || filtros.precio_max !== undefined || filtros.orden || filtros.en_oferta)) {
    const todo = await buscarProductos('', ctx.requestId, LIMITE_PRODUCTOS, filtros);
    if (todo.total) return { ...todo, filtros, consulta: '' };
  }
  return null;
};

/** ¿La consulta solo nombra una seccion ("audifonos", "monitores") y no un producto concreto? */
const esGenerica = (consulta: string, ctx: Contexto, slug?: string, marca?: string): boolean => {
  // Con solo una marca (sin seccion), las palabras validas son las de la marca.
  const secciones = slug || !marca ? palabrasDeSecciones(ctx, slug, marca) : palabrasDeSecciones(ctx, '__ninguna__', marca);
  return consulta.split(' ').every((p) => secciones.has(singular(p)));
};

/** Boton para ver todos los resultados en el catalogo de la web. */
const opcionVerMas = (h: Hallazgo): Opcion[] =>
  h.total > h.productos.length
    ? [{
        etiqueta: `Ver los ${h.total} en el catálogo`,
        accion: 'ir_catalogo',
        filtros: {
          ...(h.consulta ? { q: h.consulta } : {}),
          ...(h.filtros.subcategoria ? { subcategoria: h.filtros.subcategoria } : {}),
          ...(h.filtros.marca ? { marca: h.filtros.marca } : {}),
          ...(h.filtros.en_oferta ? { en_oferta: true } : {})
        }
      }]
    : [];

const sinResultados = async (consulta: string, filtros: FiltrosBusqueda, ctx: Contexto): Promise<Salida> => {
  const que = consulta ? `"${consulta}"` : 'productos';
  return {
    respuestas: [
      texto(`No encontré ${que}${describirFiltros(filtros, ctx)}. En SerByTek vendemos tecnología; prueba con otra palabra o mira una de estas secciones:`),
      opciones(await opcionesDeSecciones(ctx))
    ],
    pendiente: { intencion: 'buscar_producto', espera: 'producto' }
  };
};

const listaDeProductos = (h: Hallazgo): Respuesta[] => {
  const extra = opcionVerMas(h);
  return [{ tipo: 'productos', productos: h.productos }, ...(extra.length ? [opciones(extra)] : [])];
};

// --------------------------------------------------------------- intenciones

const OPCIONES_FAQ: Record<string, (ctx: Contexto) => Opcion[]> = {
  faq_horario: () => [ASESOR],
  faq_contrasena: () => [ASESOR],
  faq_factura: () => [ASESOR],
  faq_cuenta: (ctx) => (ctx.usuario ? [] : [{ etiqueta: 'Crear cuenta', accion: 'iniciar_sesion' }]),
  faq_direccion: (ctx) => (ctx.usuario ? [{ etiqueta: 'Ir a mi perfil', accion: 'ir_perfil' }, { etiqueta: 'Mis pedidos', accion: 'ir_pedidos' }] : [{ etiqueta: 'Iniciar sesión', accion: 'iniciar_sesion' }]),
  faq_eliminar_cuenta: (ctx) => (ctx.usuario ? [{ etiqueta: 'Ir a mi perfil', accion: 'ir_perfil' }] : []),
  faq_cupones: () => [{ etiqueta: 'Ir al carrito', accion: 'ir_carrito' }],
  faq_tienda: () => [{ etiqueta: 'Ver las secciones', texto: '¿Qué productos venden?' }]
};

const responderFaq = (clave: string, ctx: Contexto): Salida => {
  const respuesta = ctx.faq.get(clave);
  if (!respuesta) return { respuestas: [texto('No tengo esa información todavía. Un asesor puede ayudarte.'), opciones([ASESOR])] };
  const extra = OPCIONES_FAQ[clave]?.(ctx) ?? [];
  return { respuestas: [texto(completarPlantilla(respuesta)), ...(extra.length ? [opciones(extra)] : [])] };
};

const responderCategorias = async (ctx: Contexto): Promise<Salida> => {
  try {
    return {
      respuestas: [
        texto('En SerByTek vendemos solo tecnología. Estas son nuestras secciones; elige una o escribe lo que buscas:'),
        opciones(await opcionesDeSecciones(ctx))
      ],
      pendiente: { intencion: 'buscar_producto', espera: 'producto' }
    };
  } catch (error) {
    if (esServicioCaido(error)) return noDisponible('el catálogo');
    throw error;
  }
};

const responderBusqueda = async (r: Resultado, ctx: Contexto): Promise<Salida> => {
  const consulta = extraerConsultaProducto(ctx.texto);
  const filtros = filtrosDe(r);
  try {
    // "Quiero buscar un producto", "busco tecnologia": se ofrecen las secciones.
    if (!consulta && !Object.keys(filtros).length) {
      return {
        respuestas: [
          texto(r.entidades.categoria
            ? 'En SerByTek todo es tecnología. ¿Qué buscas? Escribe el nombre o elige una sección:'
            : 'Claro. ¿Qué producto buscas? Escribe su nombre o elige una sección:'),
          opciones(await opcionesDeSecciones(ctx))
        ],
        pendiente: { intencion: 'buscar_producto', espera: 'producto' }
      };
    }
    const hallazgo = await buscarEscalonado(consulta, filtros, ctx);
    if (!hallazgo) return sinResultados(consulta, filtros, ctx);

    const encabezado =
      hallazgo.nota ??
      (filtros.orden === 'precio_asc'
        ? `Estas son las opciones más económicas${describirFiltros(filtros, ctx)}:`
        : hallazgo.consulta && !esGenerica(hallazgo.consulta, ctx)
          ? `Esto encontré para "${hallazgo.consulta}"${describirFiltros(filtros, ctx)}:`
          : `Esto tenemos${describirFiltros(filtros, ctx) || ' en el catálogo'}:`);
    return { respuestas: [texto(encabezado), ...listaDeProductos(hallazgo)] };
  } catch (error) {
    if (esServicioCaido(error)) return noDisponible('el catálogo');
    throw error;
  }
};

const responderOfertas = async (r: Resultado, ctx: Contexto): Promise<Salida> => {
  const filtros: FiltrosBusqueda = { ...filtrosDe(r), en_oferta: true, orden: 'descuento' };
  try {
    const hallazgo = await buscarEscalonado(extraerConsultaProducto(ctx.texto), filtros, ctx);
    if (!hallazgo) {
      return {
        respuestas: [
          texto(`Ahora mismo no hay ofertas${describirFiltros(filtros, ctx)}.`),
          opciones([{ etiqueta: 'Ver todas las ofertas', texto: '¿Qué productos están en oferta?' }, { etiqueta: 'Buscar un producto', texto: 'Quiero buscar un producto' }])
        ]
      };
    }
    return {
      respuestas: [texto(hallazgo.nota ?? `Estas son las ofertas vigentes${describirFiltros(filtros, ctx)}, con el mayor descuento primero:`), ...listaDeProductos(hallazgo)]
    };
  } catch (error) {
    if (esServicioCaido(error)) return noDisponible('las ofertas');
    throw error;
  }
};

const frasePrecio = (p: ProductoResumen): string => {
  const existencias =
    p.disponible === null
      ? 'ahora no puedo confirmar cuantas unidades hay'
      : p.disponible > 0
        ? `hay ${p.disponible} unidad${p.disponible === 1 ? '' : 'es'} disponible${p.disponible === 1 ? '' : 's'}`
        : 'está agotado por ahora';
  const descuento = p.descuento_porcentaje ? ` (con ${p.descuento_porcentaje} % de descuento)` : '';
  return `${p.nombre} (${p.sku}) cuesta ${moneda(p.precio_final)}${descuento} antes de IVA y ${existencias}.`;
};

/** "Hay audifonos disponibles?": resumen de la seccion, no el precio de un solo producto. */
const resumenDeDisponibilidad = (h: Hallazgo, ctx: Contexto): string => {
  const conStock = h.productos.filter((p) => (p.disponible ?? 0) > 0).length;
  const donde = describirFiltros(h.filtros, ctx) || (h.consulta ? ` para "${h.consulta}"` : '');
  if (h.productos.every((p) => p.disponible === null)) return `Encontré ${h.total} producto${h.total === 1 ? '' : 's'}${donde}, pero ahora no puedo confirmar las existencias:`;
  if (!conStock) return `Encontré ${h.total} producto${h.total === 1 ? '' : 's'}${donde}, pero por ahora están agotados:`;
  return `Sí, tenemos ${h.total} producto${h.total === 1 ? '' : 's'}${donde}. Estos son ${h.productos.length === h.total ? 'todos' : 'algunos'}, con su precio y disponibilidad:`;
};

const responderPrecio = async (r: Resultado, ctx: Contexto): Promise<Salida> => {
  try {
    if (r.entidades.sku) {
      const producto = await productoPorSku(r.entidades.sku, ctx.requestId);
      if (!producto) return { respuestas: [texto(`No encontré el producto ${r.entidades.sku}. Revisa el código.`)] };
      return { respuestas: [texto(frasePrecio(producto)), { tipo: 'productos', productos: [producto] }] };
    }
    const consulta = extraerConsultaProducto(ctx.texto);
    const filtros = filtrosDe(r);
    if (!consulta && !Object.keys(filtros).length) {
      return {
        respuestas: [texto('¿De qué producto quieres saber el precio o la disponibilidad? Escribe su nombre o su código (por ejemplo SKU-TEC-001).')],
        pendiente: { intencion: 'precio_disponibilidad', espera: 'producto' }
      };
    }
    const hallazgo = await buscarEscalonado(consulta, filtros, ctx);
    if (!hallazgo) return sinResultados(consulta, filtros, ctx);

    const [primero] = hallazgo.productos;
    const especifico = !hallazgo.nota && hallazgo.consulta && !esGenerica(hallazgo.consulta, ctx);
    if (hallazgo.total === 1 || especifico) {
      return { respuestas: [texto(frasePrecio(primero)), ...listaDeProductos(hallazgo)] };
    }
    return { respuestas: [texto(hallazgo.nota ?? resumenDeDisponibilidad(hallazgo, ctx)), ...listaDeProductos(hallazgo)] };
  } catch (error) {
    if (esServicioCaido(error)) return noDisponible('los precios');
    throw error;
  }
};

const responderEstadoPedido = async (r: Resultado, ctx: Contexto): Promise<Salida> => {
  if (!ctx.usuario || !ctx.autorizacion) return pedirSesion('consultar tus pedidos');
  try {
    if (r.entidades.pedido) {
      const pedido = await pedidoDelUsuario(r.entidades.pedido, ctx.autorizacion, ctx.requestId);
      if (!pedido) {
        // Igual que la API: un pedido de otra persona se responde como inexistente.
        return { respuestas: [texto(`No encontré el pedido ${r.entidades.pedido} entre tus pedidos.`)] };
      }
      return {
        respuestas: [
          texto(`Tu pedido ${pedido.numero} está ${describirEstado(pedido.estado)}.`),
          { tipo: 'pedido', pedido: resumirPedido(pedido) }
        ]
      };
    }
    const lista = await pedidosDelUsuario(ctx.autorizacion, ctx.requestId);
    if (!lista.length) return { respuestas: [texto('Todavía no tienes pedidos.'), opciones(MENU)] };
    const ultimos = lista.slice(0, 3).map(resumirPedido);
    return {
      respuestas: [
        texto(`Tu último pedido, ${ultimos[0].numero}, está ${describirEstado(ultimos[0].estado)}. Estos son los más recientes; si quieres el detalle de uno, escribe su número.`),
        { tipo: 'pedidos', pedidos: ultimos },
        opciones([{ etiqueta: 'Ver todos mis pedidos', accion: 'ir_pedidos' }])
      ],
      pendiente: { intencion: 'estado_pedido', espera: 'pedido' }
    };
  } catch (error) {
    if (esServicioCaido(error)) return noDisponible('tus pedidos');
    throw error;
  }
};

const resumirPedido = (p: PedidoResumen): PedidoResumen => ({
  id: p.id,
  numero: p.numero,
  estado: p.estado,
  total: p.total,
  creado_en: p.creado_en,
  ...(p.cantidad_items !== undefined ? { cantidad_items: p.cantidad_items } : {})
});

const responderCancelacion = async (r: Resultado, ctx: Contexto): Promise<Salida> => {
  if (!ctx.usuario || !ctx.autorizacion) return pedirSesion('ayudarte a cancelar un pedido');
  if (!r.entidades.pedido) {
    return {
      respuestas: [
        texto('Puedes cancelar un pedido mientras esté creado o pagado (si ya está pagado, el reembolso es automático). ¿Cuál es el número del pedido?')
      ],
      pendiente: { intencion: 'cancelar_pedido', espera: 'pedido' }
    };
  }
  try {
    const pedido = await pedidoDelUsuario(r.entidades.pedido, ctx.autorizacion, ctx.requestId);
    if (!pedido) return { respuestas: [texto(`No encontré el pedido ${r.entidades.pedido} entre tus pedidos.`)] };
    const tarjeta: Respuesta = { tipo: 'pedido', pedido: resumirPedido(pedido) };
    if (['creado', 'pagado'].includes(pedido.estado)) {
      return {
        respuestas: [
          texto(`El pedido ${pedido.numero} aún se puede cancelar. Hazlo desde "Mis pedidos": abre el pedido y pulsa "Cancelar pedido"; te pediremos confirmarlo.`),
          tarjeta,
          opciones([{ etiqueta: 'Ir a mis pedidos', accion: 'ir_pedidos' }])
        ]
      };
    }
    if (pedido.estado === 'en_preparacion') {
      return {
        respuestas: [
          texto(`El pedido ${pedido.numero} ya está en preparación y no se puede cancelar desde la tienda. Un asesor puede ayudarte.`),
          tarjeta,
          opciones([ASESOR])
        ]
      };
    }
    return { respuestas: [texto(`El pedido ${pedido.numero} está ${describirEstado(pedido.estado)} y ya no se puede cancelar.`), tarjeta] };
  } catch (error) {
    if (esServicioCaido(error)) return noDisponible('tus pedidos');
    throw error;
  }
};

/** Motivo que se preselecciona en el formulario segun lo que dijo el cliente. */
const motivoSugerido = (r: Resultado, ctx: Contexto): string => {
  const t = normalizar(ctx.texto);
  if (r.entidades.pedido || /\bpedido|envio|entrega|llego\b/.test(t)) return 'pedido';
  if (/garantia|devolu|cambio|reclamo|queja|dano/.test(t)) return 'garantia';
  if (/pago|factura|cobro|tarjeta|pse/.test(t)) return 'pago';
  if (r.entidades.sku || r.entidades.subcategoria || r.entidades.marca || /producto/.test(t)) return 'producto';
  return 'otro';
};

/**
 * "Quiero hablar con el vendedor" (RF-53).
 *  - Cliente con sesion: un formulario dentro del chat (motivo, referencia y
 *    pregunta). Al enviarlo, la web llama a POST /consultas y el vendedor
 *    responde desde el panel; la respuesta le llega a la campana y al correo.
 *  - Visitante: se registra el ticket de antes (F3) y se le ofrece iniciar
 *    sesion, porque sin cuenta no hay a quien devolverle la respuesta.
 *  - Personal: las consultas se atienden en el panel, no en el chat.
 */
const responderEscalamiento = async (r: Resultado, ctx: Contexto): Promise<Salida> => {
  if (ctx.usuario?.rol === 'cliente') {
    return {
      respuestas: [
        texto('Claro. Escribe tu consulta y se la envío al vendedor; te avisaremos en la campana de notificaciones y por correo cuando responda.'),
        {
          tipo: 'formulario_consulta',
          motivos: Object.entries(MOTIVOS_CONSULTA).map(([clave, etiqueta]) => ({ clave, etiqueta })),
          motivo: motivoSugerido(r, ctx),
          referencia: r.entidades.pedido ?? r.entidades.sku ?? null
        }
      ]
    };
  }
  if (ctx.usuario) {
    return { respuestas: [texto('Las consultas de los clientes se responden en el panel de administración, pestaña Consultas.')] };
  }

  const numero = await ctx.registrarTicket({ texto: ctx.texto, usuario: ctx.usuario });
  // El aviso a operaciones es asincrono: si el broker falla, el ticket ya quedo
  // registrado y la conversacion sigue (invariante 12).
  await ctx.bus?.publicar(Eventos.ASISTENTE_ESCALAMIENTO, {
    ticket: numero,
    conversacion_id: ctx.conversacionId,
    cliente_id: null,
    contacto: 'visitante sin sesión'
  }, ctx.requestId);
  return {
    respuestas: [
      texto(`Registré tu solicitud con el número ${numero}. Para que el vendedor pueda responderte, inicia sesión y escríbeme "contactar al vendedor": te mostraré un formulario para tu pregunta.`),
      opciones([{ etiqueta: 'Iniciar sesión', accion: 'iniciar_sesion' }])
    ]
  };
};

/**
 * El motor no reconocio una intencion. Antes de rendirse:
 *   1. la IA opcional, si esta activa (solo preguntas generales);
 *   2. el catalogo, con las palabras del mensaje ("rtx 4070", "algo para streaming");
 *   3. las intenciones mas cercanas como sugerencia;
 *   4. el menu y el asesor.
 */
const responderNoEntendido = async (r: Resultado, ctx: Contexto): Promise<Salida> => {
  if (iaActiva()) {
    const respuestaIa = await responderConIa(ctx.texto, informacionPublica(ctx.faq));
    if (respuestaIa) return { respuestas: [texto(respuestaIa), opciones(MENU)] };
  }

  const consulta = extraerConsultaProducto(ctx.texto);
  if (consulta.replace(/\s/g, '').length >= 3) {
    try {
      const hallazgo = await buscarEscalonado(consulta, {}, ctx);
      if (hallazgo) {
        return {
          respuestas: [
            texto(hallazgo.nota ?? `Encontré esto en el catálogo para "${hallazgo.consulta}":`),
            ...listaDeProductos(hallazgo),
            opciones([{ etiqueta: 'No era eso', texto: '¿Qué puedes hacer?' }, ASESOR])
          ]
        };
      }
    } catch (error) {
      // Si el catalogo no responde, se sigue con las sugerencias.
      log.con({ request_id: ctx.requestId }).warn('Busqueda de respaldo no disponible', { error: error instanceof Error ? error.message : error });
    }
  }

  const porClave = new Map((ctx.intenciones ?? []).map((i) => [i.clave, i]));
  const sugeridas = (r.sugerencias ?? [])
    .map((clave) => porClave.get(clave))
    .filter((i): i is Intencion => Boolean(i?.ejemplo && i.descripcion))
    .map((i) => ({ etiqueta: i.descripcion!, texto: i.ejemplo! }));
  if (sugeridas.length) {
    return { respuestas: [texto('¿Te refieres a alguna de estas opciones?'), opciones([...sugeridas, ASESOR])] };
  }

  return {
    respuestas: [
      texto('No tengo una respuesta para eso. Puedo ayudarte a buscar productos de tecnología, con envíos, pagos, garantías y el estado de tus pedidos; o, si prefieres, te comunico con un asesor:'),
      opciones(MENU)
    ]
  };
};

// ------------------------------------------------------------------- entrada

export const responder = async (r: Resultado, ctx: Contexto): Promise<Salida> => {
  switch (r.intencion) {
    case 'saludo':
      return {
        respuestas: [
          texto('¡Hola! Soy el asistente de SerByTek. Puedo buscar productos y ofertas, resolver dudas de envíos, pagos y garantías, y contarte el estado de tus pedidos.'),
          opciones(MENU)
        ]
      };
    case 'ayuda':
      return {
        respuestas: [
          texto('Puedo buscar productos por nombre, sección o precio (por ejemplo, "portátiles de menos de 3 millones"), mostrarte las ofertas, responder dudas de envíos, pagos, garantías y tu cuenta, y contarte el estado de tus pedidos. Elige una opción o escríbeme:'),
          opciones(MENU)
        ]
      };
    case 'despedida':
      return { respuestas: [texto('¡Con gusto! Si necesitas algo más, aquí estoy.')] };
    case 'categorias':
      return responderCategorias(ctx);
    case 'ofertas':
      return responderOfertas(r, ctx);
    case 'buscar_producto':
      return responderBusqueda(r, ctx);
    case 'precio_disponibilidad':
      return responderPrecio(r, ctx);
    case 'estado_pedido':
      return responderEstadoPedido(r, ctx);
    case 'cancelar_pedido':
      return responderCancelacion(r, ctx);
    case 'humano':
      return responderEscalamiento(r, ctx);
    case NO_ENTENDIDO:
      return responderNoEntendido(r, ctx);
    default:
      if (r.intencion.startsWith('faq_')) return responderFaq(r.intencion, ctx);
      log.warn('Intencion sin respuesta definida', { intencion: r.intencion });
      return { respuestas: [texto('Todavía no sé responder eso.'), opciones(MENU)] };
  }
};
