/**
 * Pruebas de integracion del asistente virtual contra el gateway
 * (npm run test:asistente). Necesita el sistema completo en marcha.
 *
 * Cubre: una frase por intencion, sinonimos y tildes, entidades, contexto de
 * varios turnos, AISLAMIENTO (un cliente no ve por el chat los pedidos de
 * otro), conversaciones ajenas, escalamiento con ticket y correo, edicion de la
 * FAQ por el administrador, validaciones, token invalido y rate limit.
 *
 * Con ASISTENTE_PROBAR_DEGRADACION=1 ademas detiene pedidos-service (docker
 * stop) y comprueba la degradacion elegante; despues lo vuelve a arrancar.
 */
import { execFileSync } from 'node:child_process';

const GATEWAY = process.env.URL_GATEWAY || 'http://localhost:8080';
const MAILPIT = process.env.MAILPIT_URL || 'http://localhost:8025';

const VERDE = '\u001b[32m';
const ROJO = '\u001b[31m';
const AZUL = '\u001b[36m';
const GRIS = '\u001b[90m';
const FIN = '\u001b[0m';

let fallos = 0;
let comprobaciones = 0;
const afirmar = (condicion: boolean, descripcion: string, detalle?: unknown): void => {
  comprobaciones += 1;
  if (condicion) {
    console.log(`  ${VERDE}PASA${FIN}  ${descripcion}`);
  } else {
    fallos += 1;
    console.log(`  ${ROJO}FALLA${FIN} ${descripcion}`);
    if (detalle !== undefined) console.log(`        ${GRIS}${JSON.stringify(detalle).slice(0, 400)}${FIN}`);
  }
};
const titulo = (t: string) => console.log(`\n${AZUL}${t}${FIN}`);

interface Respuesta { estado: number; datos: any }

const pedir = async (ruta: string, opciones: { metodo?: string; cuerpo?: unknown; token?: string } = {}): Promise<Respuesta> => {
  const r = await fetch(`${GATEWAY}${ruta}`, {
    method: opciones.metodo ?? 'GET',
    headers: { 'content-type': 'application/json', ...(opciones.token ? { authorization: `Bearer ${opciones.token}` } : {}) },
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo)
  });
  const texto = await r.text();
  return { estado: r.status, datos: texto ? JSON.parse(texto) : null };
};

const login = async (email: string): Promise<string> => {
  const r = await pedir('/api/auth/login', { metodo: 'POST', cuerpo: { email, password: 'Password123' } });
  if (r.estado !== 200) throw new Error(`No se pudo iniciar sesion como ${email}: ${JSON.stringify(r.datos)}`);
  return r.datos.token;
};

/** Envia un mensaje al asistente. */
const decir = (texto: string, opciones: { token?: string; conversacion?: string } = {}) =>
  pedir('/api/asistente/mensajes', {
    metodo: 'POST',
    token: opciones.token,
    cuerpo: { texto, ...(opciones.conversacion ? { conversacion_id: opciones.conversacion } : {}) }
  });

const textos = (r: Respuesta): string => (r.datos?.respuestas ?? []).filter((x: any) => x.tipo === 'texto').map((x: any) => x.texto).join(' ');
const deTipo = (r: Respuesta, tipo: string) => (r.datos?.respuestas ?? []).find((x: any) => x.tipo === tipo);

const principal = async (): Promise<void> => {
  console.log(`\n${AZUL}Asistente virtual${FIN}  ${GRIS}${GATEWAY}${FIN}`);
  const [ana, bruno, admin, vendedor] = await Promise.all([
    login('ana@correo.co'),
    login('bruno@correo.co'),
    login('admin@tienda.co'),
    login('vendedor@tienda.co')
  ]);

  // ------------------------------------------------------------------
  titulo('1. Intenciones sin sesion');
  const saludo = await decir('hola');
  afirmar(saludo.estado === 200 && saludo.datos.intencion === 'saludo', 'Saludo', saludo.datos);
  afirmar(Boolean(deTipo(saludo, 'opciones')), 'El saludo ofrece el menu de opciones rapidas');
  afirmar(typeof saludo.datos.conversacion_id === 'string', 'Devuelve un id de conversacion');

  const envio = await decir('¿Cuánto vale el ENVÍO?');
  afirmar(envio.datos.intencion === 'faq_envio', 'Tildes, mayusculas y sinonimos: "vale el ENVIO" -> faq_envio', envio.datos.intencion);
  afirmar(/15\.000/.test(textos(envio)) && /500\.000/.test(textos(envio)), 'Las cifras salen de la configuracion (COSTO_ENVIO_BASE, UMBRAL_ENVIO_GRATIS)', textos(envio));

  const iva = await decir('el precio incluye iva?');
  afirmar(iva.datos.intencion === 'faq_iva' && /19/.test(textos(iva)), 'FAQ del IVA con el porcentaje configurado', textos(iva));

  const busqueda = await decir('tienen portatiles?');
  const productos = deTipo(busqueda, 'productos')?.productos ?? [];
  afirmar(busqueda.datos.intencion === 'buscar_producto' && productos.length > 0, 'Busqueda de producto devuelve tarjetas del catalogo', busqueda.datos);
  afirmar(productos.every((p: any) => p.sku && typeof p.precio_final === 'number'), 'Cada tarjeta trae SKU y precio');

  const precio = await decir('precio del SKU-TEC-001');
  const catalogo = await pedir('/api/catalogo/productos/SKU-TEC-001');
  afirmar(precio.datos.intencion === 'precio_disponibilidad', 'Entidad SKU -> precio y disponibilidad');
  afirmar(
    deTipo(precio, 'productos')?.productos?.[0]?.precio_final === catalogo.datos.precio_final,
    'El precio es el vigente del catalogo (invariante 2)',
    { asistente: deTipo(precio, 'productos'), catalogo: catalogo.datos.precio_final }
  );

  const sinSesion = await decir('cual es el estado de mis pedidos');
  afirmar(sinSesion.datos.intencion === 'estado_pedido', 'Sin sesion, la intencion de pedidos se reconoce');
  afirmar(
    /inicies sesión/.test(textos(sinSesion)) && deTipo(sinSesion, 'opciones')?.opciones?.[0]?.accion === 'iniciar_sesion',
    'Sin sesion pide iniciar sesion y no muestra ningun pedido',
    sinSesion.datos.respuestas
  );
  afirmar(!deTipo(sinSesion, 'pedidos') && !deTipo(sinSesion, 'pedido'), 'Sin sesion no hay tarjetas de pedido');

  const raro = await decir('cual es la capital de Francia');
  afirmar(raro.datos.intencion === 'no_entendido' && Boolean(deTipo(raro, 'opciones')), 'Frase fuera de dominio: pide reformular y ofrece el menu');

  // ------------------------------------------------------------------
  titulo('2. Pedidos con la identidad del usuario');
  const pedidosAna = (await pedir('/api/pedidos', { token: ana })).datos as any[];
  const pedidosBruno = (await pedir('/api/pedidos', { token: bruno })).datos as any[];
  afirmar(pedidosAna.length > 0 && pedidosBruno.length > 0, 'Ana y Bruno tienen pedidos (los crea test:e2e)', {
    ana: pedidosAna.length,
    bruno: pedidosBruno.length
  });

  const misPedidos = await decir('mis pedidos', { token: ana });
  const listados = deTipo(misPedidos, 'pedidos')?.pedidos ?? [];
  afirmar(listados.length > 0, 'Con sesion lista los pedidos recientes', misPedidos.datos);
  afirmar(
    listados.every((p: any) => pedidosAna.some((a) => a.numero === p.numero)),
    'Todos los pedidos listados son de Ana',
    listados.map((p: any) => p.numero)
  );

  const objetivo = pedidosAna[pedidosAna.length - 1];
  const turno2 = await decir(`el ${objetivo.id}`, { token: ana, conversacion: misPedidos.datos.conversacion_id });
  afirmar(
    turno2.datos.intencion === 'estado_pedido' && deTipo(turno2, 'pedido')?.pedido?.numero === objetivo.numero,
    'Contexto de varios turnos: "el <id>" responde el pedido pedido en el turno anterior',
    turno2.datos
  );

  const porNumero = await decir(`donde esta mi pedido ${objetivo.numero}`, { token: ana });
  afirmar(deTipo(porNumero, 'pedido')?.pedido?.estado === objetivo.estado, 'Entidad numero de pedido: estado correcto', porNumero.datos);

  // ------------------------------------------------------------------
  titulo('3. Aislamiento entre clientes (invariantes 1 y 11)');
  const ajenoPorNumero = await decir(`estado del pedido ${objetivo.numero}`, { token: bruno });
  afirmar(!deTipo(ajenoPorNumero, 'pedido') && /No encontré/.test(textos(ajenoPorNumero)), 'Bruno NO ve el pedido de Ana por su numero', ajenoPorNumero.datos);

  const ajenoPorId = await decir(`pedido ${objetivo.id}`, { token: bruno });
  afirmar(!deTipo(ajenoPorId, 'pedido') && /No encontré/.test(textos(ajenoPorId)), 'Bruno NO ve el pedido de Ana por su id', ajenoPorId.datos);

  const cancelarAjeno = await decir(`quiero cancelar el pedido ${objetivo.numero}`, { token: bruno });
  afirmar(!deTipo(cancelarAjeno, 'pedido'), 'Tampoco por la guia de cancelacion', cancelarAjeno.datos);

  const conversacionAjena = await decir('mis pedidos', { token: bruno, conversacion: misPedidos.datos.conversacion_id });
  afirmar(
    conversacionAjena.datos.conversacion_id !== misPedidos.datos.conversacion_id,
    'Con el id de la conversacion de Ana, Bruno empieza una conversacion nueva'
  );
  afirmar(
    (deTipo(conversacionAjena, 'pedidos')?.pedidos ?? []).every((p: any) => pedidosBruno.some((b) => b.numero === p.numero)),
    'Y solo ve sus propios pedidos'
  );

  const verPropia = await pedir(`/api/asistente/conversaciones/${misPedidos.datos.conversacion_id}`, { token: ana });
  const verAjena = await pedir(`/api/asistente/conversaciones/${misPedidos.datos.conversacion_id}`, { token: bruno });
  const verAnonima = await pedir(`/api/asistente/conversaciones/${misPedidos.datos.conversacion_id}`);
  afirmar(verPropia.estado === 200, 'Ana consulta su conversacion');
  afirmar(verAjena.estado === 404, 'Bruno no puede leer la conversacion de Ana (404)', verAjena);
  afirmar(verAnonima.estado === 401, 'Sin sesion, 401');

  const tarjeta = await decir('mi tarjeta es 4111 1111 1111 1111', { token: ana, conversacion: misPedidos.datos.conversacion_id });
  const guardada = await pedir(`/api/asistente/conversaciones/${tarjeta.datos.conversacion_id}`, { token: ana });
  afirmar(!JSON.stringify(guardada.datos).includes('4111'), 'La conversacion se guarda sin el numero de tarjeta (enmascarado)');

  // ------------------------------------------------------------------
  titulo('4. Escalamiento a un humano');
  const escalar = await decir('quiero hablar con un asesor', { token: ana });
  const ticket = textos(escalar).match(/TCK-[A-Z0-9]+/)?.[0];
  afirmar(escalar.datos.intencion === 'humano' && Boolean(ticket), 'Registra un ticket y le da el numero al cliente', escalar.datos);
  const ticketsAdmin = await pedir('/api/asistente/tickets', { token: admin });
  afirmar(ticketsAdmin.datos.some((t: any) => t.numero === ticket && t.email === 'ana@correo.co'), 'El administrador ve el ticket con el contacto');
  afirmar((await pedir('/api/asistente/tickets', { token: vendedor })).estado === 200, 'El vendedor tambien');
  afirmar((await pedir('/api/asistente/tickets', { token: ana })).estado === 403, 'Un cliente no (403)');

  let correo: any = null;
  for (let i = 0; i < 30 && !correo; i++) {
    const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`subject:"${ticket}"`)}`).then((x) => x.json()).catch(() => null);
    correo = (r as any)?.messages?.[0] ?? null;
    if (!correo) await new Promise((x) => setTimeout(x, 500));
  }
  afirmar(Boolean(correo), 'Operaciones recibe el aviso por correo (evento asistente.escalamiento -> notificaciones -> Mailpit)', { ticket });

  // ------------------------------------------------------------------
  titulo('5. El administrador edita la FAQ sin desplegar');
  const faq = (await pedir('/api/asistente/faq', { token: admin })).datos as any[];
  const original = faq.find((f) => f.clave === 'faq_horario')?.respuesta;
  const cambio = await pedir('/api/asistente/faq/faq_horario', { metodo: 'PATCH', token: admin, cuerpo: { respuesta: 'PRUEBA-FAQ: atendemos {{horario_atencion}}.' } });
  afirmar(cambio.estado === 200, 'PATCH /faq/:clave como administrador');
  const horario = await decir('cual es el horario de atencion');
  afirmar(textos(horario).startsWith('PRUEBA-FAQ'), 'El asistente responde con el texto nuevo de inmediato', textos(horario));
  await pedir('/api/asistente/faq/faq_horario', { metodo: 'PATCH', token: admin, cuerpo: { respuesta: original } });
  afirmar((await pedir('/api/asistente/faq/faq_horario', { metodo: 'PATCH', token: ana, cuerpo: { respuesta: 'x' } })).estado === 403, 'Un cliente no puede editarla (403)');
  afirmar((await pedir('/api/asistente/intenciones', { token: admin })).datos.length >= 10, 'El administrador consulta las intenciones');

  // ------------------------------------------------------------------
  titulo('6. Validaciones y abuso');
  afirmar((await decir('   ')).estado === 400, 'Mensaje vacio -> 400');
  afirmar((await decir('a'.repeat(501))).estado === 400, 'Mensaje de mas de 500 caracteres -> 400');
  afirmar((await pedir('/api/asistente/mensajes', { metodo: 'POST', cuerpo: { texto: { $ne: 1 } } })).estado === 400, 'Texto que no es una cadena -> 400');
  const inyeccion = await pedir('/api/asistente/mensajes', { metodo: 'POST', cuerpo: { texto: 'hola', conversacion_id: { $ne: null } } });
  afirmar(inyeccion.estado === 200 && typeof inyeccion.datos.conversacion_id === 'string', 'conversacion_id con operador NoSQL se ignora: conversacion nueva');
  const script = await decir('<script>alert(1)</script>');
  afirmar(script.estado === 200 && !JSON.stringify(script.datos).includes('<script>'), 'El HTML del usuario no vuelve en la respuesta');
  const invalido = await decir('hola', { token: 'no-es-un-jwt' });
  afirmar(invalido.estado === 401 && invalido.datos.codigo === 'TOKEN_INVALIDO', 'Token invalido -> 401 (no se trata como visitante)', invalido.datos);

  // ------------------------------------------------------------------
  if (process.env.ASISTENTE_PROBAR_DEGRADACION === '1') {
    titulo('7. Degradacion elegante con pedidos-service detenido');
    execFileSync('docker', ['stop', 'ecom_pedidos'], { stdio: 'ignore' });
    try {
      const caido = await decir('mis pedidos', { token: ana });
      afirmar(caido.estado === 200 && /No puedo consultar tus pedidos/.test(textos(caido)), 'El asistente lo dice en lugar de fallar', caido.datos);
      const faqConCaida = await decir('cuanto cuesta el envio');
      afirmar(faqConCaida.estado === 200 && faqConCaida.datos.intencion === 'faq_envio', 'Lo demas sigue funcionando');
    } finally {
      execFileSync('docker', ['start', 'ecom_pedidos'], { stdio: 'ignore' });
      for (let i = 0; i < 60; i++) {
        const salud = await fetch('http://127.0.0.1:3006/health').then((r) => r.ok).catch(() => false);
        if (salud) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  // ------------------------------------------------------------------
  titulo('8. Rate limit propio del asistente (al final: agota la cuota de este cliente)');
  let limitado: Respuesta | undefined;
  for (let i = 0; i < 40 && !limitado; i++) {
    const r = await decir('hola', { token: vendedor });
    if (r.estado === 429) limitado = r;
  }
  afirmar(limitado?.datos?.codigo === 'LIMITE_ASISTENTE', 'Tras 30 mensajes por minuto responde 429 LIMITE_ASISTENTE', limitado?.datos);

  console.log('');
  if (fallos) {
    console.log(`${ROJO}${fallos} de ${comprobaciones} comprobaciones fallaron.${FIN}\n`);
    process.exit(1);
  }
  console.log(`${VERDE}Las ${comprobaciones} comprobaciones pasaron.${FIN}\n`);
};

principal().catch((error) => {
  console.error(`${ROJO}Error inesperado:${FIN}`, error);
  process.exit(1);
});
