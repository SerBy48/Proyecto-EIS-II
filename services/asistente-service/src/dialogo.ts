import { BusEventos, ClaimsToken, Eventos, crearLogger } from '@ecommerce/shared';
import {
  PedidoResumen,
  ProductoResumen,
  buscarProductos,
  esServicioCaido,
  listarCategorias,
  pedidoDelUsuario,
  pedidosDelUsuario,
  productoPorSku
} from './adaptadores';
import { completarPlantilla, moneda } from './configuracion';
import { iaActiva, responderConIa } from './ia';
import { NO_ENTENDIDO, Pendiente, Resultado, extraerConsultaProducto } from './motor';

const log = crearLogger('asistente-service');

/**
 * Arbol de dialogo: arma la respuesta de cada intencion. Las respuestas son
 * datos estructurados (texto, productos, pedido, opciones) que la interfaz
 * pinta como texto: nunca HTML.
 */

export interface Opcion {
  etiqueta: string;
  /** Texto que se envia como mensaje al elegir la opcion. */
  texto?: string;
  /** Accion de la interfaz: ir a una vista, iniciar sesion... */
  accion?: 'iniciar_sesion' | 'ir_pedidos' | 'ir_carrito';
}

export type Respuesta =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'productos'; productos: ProductoResumen[] }
  | { tipo: 'pedido'; pedido: PedidoResumen }
  | { tipo: 'pedidos'; pedidos: PedidoResumen[] }
  | { tipo: 'opciones'; opciones: Opcion[] };

export interface Contexto {
  texto: string;
  usuario?: ClaimsToken;
  /** "Bearer <jwt>" del usuario; sin el, nada de pedidos. */
  autorizacion?: string;
  requestId?: string;
  conversacionId: string;
  faq: Map<string, string>;
  bus?: BusEventos;
  registrarTicket: (datos: { texto: string; usuario?: ClaimsToken }) => Promise<string>;
}

export interface Salida {
  respuestas: Respuesta[];
  pendiente?: Pendiente;
}

export const MENU: Opcion[] = [
  { etiqueta: 'Costo de envío', texto: 'Cuánto cuesta el envío?' },
  { etiqueta: 'Buscar un producto', texto: 'Quiero buscar un producto' },
  { etiqueta: 'Mis pedidos', texto: 'Cuál es el estado de mis pedidos?' },
  { etiqueta: 'Medios de pago', texto: 'Cuáles son los medios de pago?' },
  { etiqueta: 'Hablar con un asesor', texto: 'Quiero hablar con un asesor' }
];

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

// --------------------------------------------------------------- intenciones

const responderFaq = (clave: string, ctx: Contexto): Salida => {
  const respuesta = ctx.faq.get(clave);
  if (!respuesta) return { respuestas: [texto('No tengo esa información todavía.'), opciones(MENU)] };
  const salida: Respuesta[] = [texto(completarPlantilla(respuesta))];
  if (clave === 'faq_horario') salida.push(opciones([{ etiqueta: 'Hablar con un asesor', texto: 'Quiero hablar con un asesor' }]));
  return { respuestas: salida };
};

const responderBusqueda = async (ctx: Contexto): Promise<Salida> => {
  const consulta = extraerConsultaProducto(ctx.texto);
  try {
    if (!consulta) {
      const categorias = await listarCategorias(ctx.requestId);
      return {
        respuestas: [
          texto('Claro. ¿Qué producto buscas? Escribe su nombre o elige una categoría.'),
          opciones(categorias.map((c) => ({ etiqueta: `${c.categoria} (${c.productos})`, texto: `Busco ${c.categoria}` })))
        ],
        pendiente: { intencion: 'buscar_producto', espera: 'producto' }
      };
    }
    const productos = await buscarProductos(consulta, ctx.requestId);
    if (!productos.length) {
      return {
        respuestas: [texto(`No encontré productos para "${consulta}". Prueba con otra palabra, por ejemplo la marca o la categoría.`)],
        pendiente: { intencion: 'buscar_producto', espera: 'producto' }
      };
    }
    return { respuestas: [texto(`Esto encontré para "${consulta}":`), { tipo: 'productos', productos }] };
  } catch (error) {
    if (esServicioCaido(error)) return noDisponible('el catálogo');
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
  return `${p.nombre} (${p.sku}) cuesta ${moneda(p.precio_final)} antes de IVA y ${existencias}.`;
};

const responderPrecio = async (r: Resultado, ctx: Contexto): Promise<Salida> => {
  try {
    if (r.entidades.sku) {
      const producto = await productoPorSku(r.entidades.sku, ctx.requestId);
      if (!producto) return { respuestas: [texto(`No encontré el producto ${r.entidades.sku}. Revisa el código.`)] };
      return { respuestas: [texto(frasePrecio(producto)), { tipo: 'productos', productos: [producto] }] };
    }
    const consulta = extraerConsultaProducto(ctx.texto);
    if (!consulta) {
      return {
        respuestas: [texto('¿De qué producto quieres saber el precio? Escribe su nombre o su código (por ejemplo SKU-TEC-001).')],
        pendiente: { intencion: 'precio_disponibilidad', espera: 'producto' }
      };
    }
    const [primero, ...otros] = await buscarProductos(consulta, ctx.requestId);
    if (!primero) return { respuestas: [texto(`No encontré productos para "${consulta}".`)] };
    return { respuestas: [texto(frasePrecio(primero)), { tipo: 'productos', productos: [primero, ...otros] }] };
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
          opciones([{ etiqueta: 'Hablar con un asesor', texto: 'Quiero hablar con un asesor' }])
        ]
      };
    }
    return { respuestas: [texto(`El pedido ${pedido.numero} está ${describirEstado(pedido.estado)} y ya no se puede cancelar.`), tarjeta] };
  } catch (error) {
    if (esServicioCaido(error)) return noDisponible('tus pedidos');
    throw error;
  }
};

const responderEscalamiento = async (ctx: Contexto): Promise<Salida> => {
  const numero = await ctx.registrarTicket({ texto: ctx.texto, usuario: ctx.usuario });
  // El aviso a operaciones es asincrono: si el broker falla, el ticket ya quedo
  // registrado y la conversacion sigue (invariante 12).
  await ctx.bus?.publicar(Eventos.ASISTENTE_ESCALAMIENTO, {
    ticket: numero,
    conversacion_id: ctx.conversacionId,
    cliente_id: ctx.usuario?.cliente_id ?? null,
    contacto: ctx.usuario?.email ?? 'visitante sin sesión'
  }, ctx.requestId);
  return {
    respuestas: [
      texto(
        `Listo, registré tu solicitud con el número ${numero}. Un asesor la revisará ${
          ctx.usuario ? 'y te escribirá a tu correo' : 'en el horario de atención; si inicias sesión, podrá escribirte a tu correo'
        }.`
      )
    ]
  };
};

// ------------------------------------------------------------------- entrada

export const responder = async (r: Resultado, ctx: Contexto): Promise<Salida> => {
  switch (r.intencion) {
    case 'saludo':
      return {
        respuestas: [
          texto(`¡Hola! Soy el asistente de la tienda. Puedo responder preguntas frecuentes, buscar productos y contarte el estado de tus pedidos.`),
          opciones(MENU)
        ]
      };
    case 'ayuda':
      return { respuestas: [texto('Esto es lo que puedo hacer por ti:'), opciones(MENU)] };
    case 'despedida':
      return { respuestas: [texto('¡Con gusto! Si necesitas algo más, aquí estoy.')] };
    case 'buscar_producto':
      return responderBusqueda(ctx);
    case 'precio_disponibilidad':
      return responderPrecio(r, ctx);
    case 'estado_pedido':
      return responderEstadoPedido(r, ctx);
    case 'cancelar_pedido':
      return responderCancelacion(r, ctx);
    case 'humano':
      return responderEscalamiento(ctx);
    case NO_ENTENDIDO: {
      if (iaActiva()) {
        const respuestaIa = await responderConIa(ctx.texto, informacionPublica(ctx.faq));
        if (respuestaIa) return { respuestas: [texto(respuestaIa), opciones(MENU)] };
      }
      return {
        respuestas: [texto('No estoy seguro de haberte entendido. ¿Puedes decirlo de otra forma? También puedes elegir una opción:'), opciones(MENU)]
      };
    }
    default:
      if (r.intencion.startsWith('faq_')) return responderFaq(r.intencion, ctx);
      log.warn('Intencion sin respuesta definida', { intencion: r.intencion });
      return { respuestas: [texto('Todavía no sé responder eso.'), opciones(MENU)] };
  }
};
