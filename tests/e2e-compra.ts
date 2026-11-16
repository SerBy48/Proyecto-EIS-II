/**
 * Prueba de integracion extremo a extremo del flujo de compra.
 *
 * Recorre exactamente los quince pasos de la Actividad 4 del documento, a
 * traves del API Gateway, y verifica tanto el camino feliz como los caminos de
 * fallo que la arquitectura debe manejar:
 *
 *   A. Compra exitosa
 *   B. Pago rechazado -> el stock se libera (compensacion de la saga)
 *   C. Ultima unidad en disputa -> un solo ganador
 *   D. Idempotencia del checkout -> un doble clic no genera dos pedidos
 *   E. Cancelacion de un pedido pagado -> reembolso y devolucion de stock
 *
 * Requiere la infraestructura completa levantada:
 *   npm run infra:up && npm run dev
 *
 * Uso: npm run test:e2e
 */

const GATEWAY = process.env.URL_GATEWAY || 'http://localhost:8080';

const VERDE = '\u001b[32m';
const ROJO = '\u001b[31m';
const AZUL = '\u001b[36m';
const GRIS = '\u001b[90m';
const AMARILLO = '\u001b[33m';
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
    if (detalle !== undefined) {
      console.log(`        ${GRIS}${JSON.stringify(detalle).slice(0, 300)}${FIN}`);
    }
  }
};

const titulo = (texto: string): void => {
  console.log(`\n${AZUL}${texto}${FIN}`);
  console.log(GRIS + '='.repeat(texto.length) + FIN);
};

const paso = (texto: string): void => console.log(`  ${GRIS}${texto}${FIN}`);

interface Respuesta<T = any> {
  estado: number;
  datos: T;
}

const pedir = async <T = any>(
  ruta: string,
  opciones: {
    metodo?: string;
    cuerpo?: unknown;
    token?: string;
    claveIdempotencia?: string;
  } = {}
): Promise<Respuesta<T>> => {
  const cabeceras: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opciones.token) cabeceras.Authorization = `Bearer ${opciones.token}`;
  if (opciones.claveIdempotencia) cabeceras['Idempotency-Key'] = opciones.claveIdempotencia;

  const respuesta = await fetch(`${GATEWAY}${ruta}`, {
    method: opciones.metodo || 'GET',
    headers: cabeceras,
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo)
  });

  const texto = await respuesta.text();
  return { estado: respuesta.status, datos: texto ? JSON.parse(texto) : null };
};

const login = async (email: string): Promise<{ token: string; usuario: any }> => {
  const { datos } = await pedir('/api/auth/login', {
    metodo: 'POST',
    cuerpo: { email, password: 'Password123' }
  });
  if (!datos?.token) throw new Error(`No se pudo autenticar a ${email}: ${JSON.stringify(datos)}`);
  return { token: datos.token, usuario: datos.usuario };
};

const clave = (prefijo: string) =>
  `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const vaciarCarrito = async (token: string, clienteId: number) => {
  await pedir(`/api/carrito/${clienteId}`, { metodo: 'DELETE', token });
};

const stockDe = async (sku: string, tokenAdmin: string): Promise<number> => {
  const { datos } = await pedir(`/api/inventario/stock/${sku}`, { token: tokenAdmin });
  if (!Array.isArray(datos)) return 0;
  return datos.reduce((suma: number, f: any) => suma + Number(f.cantidad_disponible), 0);
};

const reponer = async (sku: string, cantidad: number, tokenAdmin: string) => {
  await pedir(`/api/inventario/stock/${sku}/entrada`, {
    metodo: 'POST',
    cuerpo: { cantidad },
    token: tokenAdmin
  });
};

// ===========================================================================

const escenarioA = async (admin: string): Promise<void> => {
  titulo('Escenario A: compra exitosa (los 15 pasos del flujo)');

  paso('Pasos 1-4: el cliente inicia sesion y obtiene su token');
  const ana = await login('ana@correo.co');
  afirmar(Boolean(ana.token), 'El servicio de autenticacion emite un JWT');
  afirmar(ana.usuario.rol === 'cliente', 'El token identifica el rol del usuario');

  await vaciarCarrito(ana.token, ana.usuario.cliente_id);

  paso('Pasos 5-6: consulta del catalogo con disponibilidad real');
  const catalogo = await pedir('/api/catalogo/productos?categoria=tecnologia');
  afirmar(catalogo.estado === 200, 'El catalogo responde');
  const disponible = catalogo.datos.productos?.find((p: any) => p.hay_stock === true);
  afirmar(Boolean(disponible), 'Hay al menos un producto con existencias', {
    productos: catalogo.datos.productos?.length
  });
  if (!disponible) return;

  afirmar(
    disponible.disponible !== null,
    'La disponibilidad viene del servicio de inventario, no del catalogo'
  );

  paso(`Paso 7: se agrega ${disponible.sku} al carrito`);
  const agregado = await pedir(`/api/carrito/${ana.usuario.cliente_id}/items`, {
    metodo: 'POST',
    cuerpo: { sku: disponible.sku, cantidad: 1 },
    token: ana.token
  });
  afirmar(agregado.estado === 200, 'El producto se agrega al carrito');
  afirmar(
    agregado.datos.items[0].precio_unitario === disponible.precio_final,
    'El precio lo pone el catalogo, no el cliente'
  );
  afirmar(agregado.datos.totales.impuestos > 0, 'El carrito calcula los impuestos');

  const stockAntes = await stockDe(disponible.sku, admin);

  paso('Pasos 8-15: checkout completo (saga)');
  const compra = await pedir('/api/pedidos/checkout', {
    metodo: 'POST',
    cuerpo: { medio_pago: 'tarjeta_credito', token_medio_pago: 'tok_ok_4242' },
    token: ana.token,
    claveIdempotencia: clave('e2e-A')
  });

  afirmar(compra.estado === 201, 'La compra se confirma', compra.datos);
  afirmar(compra.datos.pedido?.estado === 'pagado', 'El pedido queda en estado pagado');
  afirmar(Boolean(compra.datos.pedido?.numero), 'Se genera un numero de pedido');
  afirmar(Boolean(compra.datos.pago?.referencia), 'Se registra la referencia del pago');

  const stockDespues = await stockDe(disponible.sku, admin);
  afirmar(
    stockDespues === stockAntes - 1,
    `El inventario se descuenta definitivamente (${stockAntes} -> ${stockDespues})`
  );

  paso('El carrito queda vacio tras la compra');
  const carritoFinal = await pedir(`/api/carrito/${ana.usuario.cliente_id}`, { token: ana.token });
  afirmar(carritoFinal.datos.items.length === 0, 'El carrito se vacia');

  paso('El pedido aparece en el historial del cliente');
  const pedidos = await pedir('/api/pedidos', { token: ana.token });
  afirmar(
    pedidos.datos.some((p: any) => p.numero === compra.datos.pedido.numero),
    'El pedido aparece en la lista del cliente'
  );

  paso('La bitacora de la saga registra todos los pasos');
  const saga = await pedir(`/api/pedidos/${compra.datos.pedido.id}/saga`, { token: admin });
  const pasos = (saga.datos as any[])?.map((s) => s.paso) ?? [];
  afirmar(pasos.includes('validar_cliente'), 'Registra la validacion del cliente');
  afirmar(pasos.includes('verificar_precios'), 'Registra la verificacion de precios');
  afirmar(pasos.includes('reservar_stock'), 'Registra la reserva de stock');
  afirmar(pasos.includes('cobrar'), 'Registra el cobro');
  afirmar(pasos.includes('confirmar_reserva'), 'Registra la confirmacion de la reserva');

  paso('El evento asincrono genera la notificacion');
  await new Promise((r) => setTimeout(r, 1500)); // consistencia eventual
  const mensajes = await pedir('/api/notificaciones/mensajes?evento=pedido.confirmado', {
    token: admin
  });
  afirmar(
    Array.isArray(mensajes.datos) && mensajes.datos.length > 0,
    'El servicio de notificaciones reacciono al evento',
    { mensajes: mensajes.datos?.length }
  );

  paso('El correo de confirmacion llega al buzon (SMTP real, Mailpit)');
  const correo = await buscarCorreo(compra.datos.pedido.numero);
  afirmar(correo !== null, `Llega un correo con el numero ${compra.datos.pedido.numero}`, { mailpit: MAILPIT });
  afirmar(
    correo?.To?.some((d: { Address: string }) => d.Address === ana.usuario.email) ?? false,
    'El correo va dirigido al cliente que compro',
    correo?.To
  );
};

/**
 * Busca en Mailpit el correo de un pedido. Reintenta durante unos segundos: el
 * correo es asincrono y la cola de notificaciones puede traer eventos atrasados
 * de pruebas anteriores (consume ~10 por segundo, hallazgo R6).
 */
const MAILPIT = process.env.MAILPIT_URL || 'http://localhost:8025';
const buscarCorreo = async (numeroPedido: string, esperaMs = 15_000): Promise<any | null> => {
  const consulta = encodeURIComponent(`subject:"${numeroPedido}"`);
  const limite = Date.now() + esperaMs;
  while (Date.now() < limite) {
    try {
      const respuesta = await fetch(`${MAILPIT}/api/v1/search?query=${consulta}`);
      const datos = (await respuesta.json()) as { messages?: any[] };
      if (datos.messages?.length) return datos.messages[0];
    } catch {
      /* Mailpit aun no responde: se reintenta */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
};

const escenarioB = async (admin: string): Promise<void> => {
  titulo('Escenario B: pago rechazado (compensacion de la saga)');

  const bruno = await login('bruno@correo.co');
  await vaciarCarrito(bruno.token, bruno.usuario.cliente_id);

  const catalogo = await pedir('/api/catalogo/productos?categoria=hogar');
  const producto = catalogo.datos.productos?.find((p: any) => p.hay_stock === true);
  if (!producto) {
    console.log(`  ${AMARILLO}OMITIDO${FIN} no hay productos con stock para este escenario`);
    return;
  }

  await pedir(`/api/carrito/${bruno.usuario.cliente_id}/items`, {
    metodo: 'POST',
    cuerpo: { sku: producto.sku, cantidad: 1 },
    token: bruno.token
  });

  const stockAntes = await stockDe(producto.sku, admin);
  paso(`Stock de ${producto.sku} antes de intentar la compra: ${stockAntes}`);

  paso('Se paga con una tarjeta que la pasarela rechaza');
  const compra = await pedir('/api/pedidos/checkout', {
    metodo: 'POST',
    cuerpo: { medio_pago: 'tarjeta_credito', token_medio_pago: 'tok_rechazo_1111' },
    token: bruno.token,
    claveIdempotencia: clave('e2e-B')
  });

  afirmar(compra.estado === 402, 'La API responde 402 (pago requerido)', compra.datos);
  afirmar(compra.datos.codigo === 'PAGO_RECHAZADO', 'El codigo de error es explicito');
  afirmar(Boolean(compra.datos.detalle?.numero), 'El pedido existe y se puede consultar');

  const stockDespues = await stockDe(producto.sku, admin);
  afirmar(
    stockDespues === stockAntes,
    `COMPENSACION: el stock vuelve a su valor original (${stockAntes} -> ${stockDespues})`
  );

  const pedido = await pedir(`/api/pedidos/${compra.datos.detalle.numero}`, { token: bruno.token });
  afirmar(pedido.datos?.estado === 'cancelado', 'El pedido queda cancelado, no pagado');

  paso('El carrito se conserva para que el cliente reintente');
  const carrito = await pedir(`/api/carrito/${bruno.usuario.cliente_id}`, { token: bruno.token });
  afirmar(carrito.datos.items.length > 0, 'El carrito NO se vacia tras un pago rechazado');

  paso('La bitacora muestra la compensacion');
  const saga = await pedir(`/api/pedidos/${pedido.datos.id}/saga`, { token: admin });
  const compensados = (saga.datos as any[])?.filter((s) => s.estado === 'compensado') ?? [];
  afirmar(compensados.length > 0, 'Hay pasos marcados como compensados', {
    pasos: compensados.map((c) => c.paso)
  });

  await vaciarCarrito(bruno.token, bruno.usuario.cliente_id);
};

const escenarioC = async (admin: string): Promise<void> => {
  titulo('Escenario C: dos clientes disputan la ultima unidad');

  const SKU = 'SKU-TEC-004';

  // Se deja el producto con exactamente una unidad.
  const actual = await stockDe(SKU, admin);
  if (actual < 1) {
    await reponer(SKU, 1 - actual, admin);
  } else if (actual > 1) {
    paso(`Ajustando el stock de ${SKU} a 1 unidad (habia ${actual})`);
    // Se consume el exceso con reservas confirmadas para dejarlo en 1.
    for (let i = 0; i < actual - 1; i++) {
      await pedir('/api/inventario/reservas', {
        metodo: 'POST',
        cuerpo: { sku: SKU, cantidad: 1 },
        token: admin,
        claveIdempotencia: clave(`ajuste-${i}`)
      });
    }
  }

  const disponibleAhora = await stockDe(SKU, admin);
  afirmar(disponibleAhora === 1, `${SKU} tiene exactamente 1 unidad disponible`, {
    disponibleAhora
  });
  if (disponibleAhora !== 1) return;

  const ana = await login('ana@correo.co');
  const bruno = await login('bruno@correo.co');
  await vaciarCarrito(ana.token, ana.usuario.cliente_id);
  await vaciarCarrito(bruno.token, bruno.usuario.cliente_id);

  await pedir(`/api/carrito/${ana.usuario.cliente_id}/items`, {
    metodo: 'POST',
    cuerpo: { sku: SKU, cantidad: 1 },
    token: ana.token
  });
  await pedir(`/api/carrito/${bruno.usuario.cliente_id}/items`, {
    metodo: 'POST',
    cuerpo: { sku: SKU, cantidad: 1 },
    token: bruno.token
  });

  paso('Ambos pulsan "Pagar" en el mismo instante');
  const [compraAna, compraBruno] = await Promise.all([
    pedir('/api/pedidos/checkout', {
      metodo: 'POST',
      cuerpo: { medio_pago: 'tarjeta_credito', token_medio_pago: 'tok_ok_4242' },
      token: ana.token,
      claveIdempotencia: clave('e2e-C-ana')
    }),
    pedir('/api/pedidos/checkout', {
      metodo: 'POST',
      cuerpo: { medio_pago: 'tarjeta_credito', token_medio_pago: 'tok_ok_4242' },
      token: bruno.token,
      claveIdempotencia: clave('e2e-C-bruno')
    })
  ]);

  paso(`Ana:   HTTP ${compraAna.estado}`);
  paso(`Bruno: HTTP ${compraBruno.estado}`);

  const exitosas = [compraAna, compraBruno].filter((c) => c.estado === 201);
  const rechazadas = [compraAna, compraBruno].filter((c) => c.estado === 409);

  afirmar(exitosas.length === 1, 'Exactamente UNA compra se completa', {
    ana: compraAna.estado,
    bruno: compraBruno.estado
  });
  afirmar(rechazadas.length === 1, 'La otra recibe 409 por falta de stock');
  afirmar(
    rechazadas[0]?.datos?.codigo === 'STOCK_INSUFICIENTE',
    'El motivo del rechazo es explicito'
  );

  const stockFinal = await stockDe(SKU, admin);
  afirmar(stockFinal === 0, 'El stock queda en 0, nunca negativo (no hubo sobreventa)', {
    stockFinal
  });

  await vaciarCarrito(ana.token, ana.usuario.cliente_id);
  await vaciarCarrito(bruno.token, bruno.usuario.cliente_id);
};

const escenarioD = async (admin: string): Promise<void> => {
  titulo('Escenario D: idempotencia del checkout (doble clic)');

  const carla = await login('carla@correo.co');
  await vaciarCarrito(carla.token, carla.usuario.cliente_id);

  const catalogo = await pedir('/api/catalogo/productos?categoria=deportes');
  const producto = catalogo.datos.productos?.find((p: any) => p.hay_stock === true);
  if (!producto) {
    console.log(`  ${AMARILLO}OMITIDO${FIN} no hay productos con stock`);
    return;
  }

  await pedir(`/api/carrito/${carla.usuario.cliente_id}/items`, {
    metodo: 'POST',
    cuerpo: { sku: producto.sku, cantidad: 1 },
    token: carla.token
  });

  const stockAntes = await stockDe(producto.sku, admin);
  const claveUnica = clave('e2e-D');

  paso('Se envia el mismo checkout dos veces con la MISMA clave de idempotencia');
  const primera = await pedir('/api/pedidos/checkout', {
    metodo: 'POST',
    cuerpo: { medio_pago: 'pse', token_medio_pago: 'tok_ok_9999' },
    token: carla.token,
    claveIdempotencia: claveUnica
  });

  const segunda = await pedir('/api/pedidos/checkout', {
    metodo: 'POST',
    cuerpo: { medio_pago: 'pse', token_medio_pago: 'tok_ok_9999' },
    token: carla.token,
    claveIdempotencia: claveUnica
  });

  afirmar(primera.estado === 201, 'La primera compra se procesa', primera.datos);
  afirmar(segunda.estado === 200, 'La segunda devuelve 200, no crea otro pedido');
  afirmar(segunda.datos.idempotente === true, 'La respuesta se marca como idempotente');

  const numeroPrimera = primera.datos.pedido?.numero;
  const numeroSegunda = segunda.datos.numero ?? segunda.datos.pedido?.numero;
  afirmar(numeroPrimera === numeroSegunda, 'Ambas respuestas refieren al MISMO pedido', {
    numeroPrimera,
    numeroSegunda
  });

  const stockDespues = await stockDe(producto.sku, admin);
  afirmar(
    stockDespues === stockAntes - 1,
    `El stock se descuenta UNA sola vez (${stockAntes} -> ${stockDespues})`
  );
};

const escenarioE = async (admin: string): Promise<void> => {
  titulo('Escenario E: cancelacion de un pedido pagado');

  const ana = await login('ana@correo.co');
  await vaciarCarrito(ana.token, ana.usuario.cliente_id);

  const catalogo = await pedir('/api/catalogo/productos?categoria=hogar');
  const producto = catalogo.datos.productos?.find((p: any) => p.hay_stock === true);
  if (!producto) {
    console.log(`  ${AMARILLO}OMITIDO${FIN} no hay productos con stock`);
    return;
  }

  await pedir(`/api/carrito/${ana.usuario.cliente_id}/items`, {
    metodo: 'POST',
    cuerpo: { sku: producto.sku, cantidad: 1 },
    token: ana.token
  });

  const compra = await pedir('/api/pedidos/checkout', {
    metodo: 'POST',
    cuerpo: { medio_pago: 'tarjeta_credito', token_medio_pago: 'tok_ok_4242' },
    token: ana.token,
    claveIdempotencia: clave('e2e-E')
  });

  if (compra.estado !== 201) {
    console.log(`  ${AMARILLO}OMITIDO${FIN} no se pudo crear el pedido de partida`);
    return;
  }

  const stockTrasCompra = await stockDe(producto.sku, admin);
  paso(`Pedido ${compra.datos.pedido.numero} creado. Stock: ${stockTrasCompra}`);

  const cancelacion = await pedir(`/api/pedidos/${compra.datos.pedido.id}/cancelar`, {
    metodo: 'POST',
    cuerpo: { motivo: 'Prueba E2E' },
    token: ana.token
  });

  afirmar(cancelacion.estado === 200, 'El pedido se cancela', cancelacion.datos);
  afirmar(
    cancelacion.datos.compensaciones?.some((c: string) => c.startsWith('reembolso')),
    'Se ejecuta el reembolso',
    cancelacion.datos.compensaciones
  );
  afirmar(
    cancelacion.datos.compensaciones?.some((c: string) => c.startsWith('stock_devuelto')),
    'Se devuelve el inventario'
  );

  const stockFinal = await stockDe(producto.sku, admin);
  afirmar(
    stockFinal === stockTrasCompra + 1,
    `El stock vuelve a subir (${stockTrasCompra} -> ${stockFinal})`
  );

  paso('Cancelar de nuevo es idempotente');
  const segunda = await pedir(`/api/pedidos/${compra.datos.pedido.id}/cancelar`, {
    metodo: 'POST',
    cuerpo: { motivo: 'Prueba E2E repetida' },
    token: ana.token
  });
  afirmar(segunda.datos.idempotente === true, 'La segunda cancelacion no repite las compensaciones');
};

const escenarioSeguridad = async (): Promise<void> => {
  titulo('Escenario F: controles de seguridad');

  const ana = await login('ana@correo.co');

  const sinToken = await pedir('/api/pedidos');
  afirmar(sinToken.estado === 401, 'Sin token: 401');

  const tokenFalso = await pedir('/api/pedidos', { token: 'token.claramente.invalido' });
  afirmar(tokenFalso.estado === 401, 'Token invalido: 401');

  const rbac = await pedir('/api/inventario/alertas', { token: ana.token });
  afirmar(rbac.estado === 403, 'Un cliente no accede a rutas de personal interno: 403');

  const reservaDirecta = await pedir('/api/inventario/reservas', {
    metodo: 'POST',
    cuerpo: { sku: 'SKU-TEC-001', cantidad: 100 },
    token: ana.token,
    claveIdempotencia: clave('hackeo')
  });
  afirmar(reservaDirecta.estado === 403, 'Un cliente no puede reservar stock por su cuenta: 403');

  const otroCliente = await pedir('/api/clientes/2', { token: ana.token });
  afirmar(otroCliente.estado === 403, 'Un cliente no ve el perfil de otro: 403');

  const catalogoPublico = await pedir('/api/catalogo/productos');
  afirmar(catalogoPublico.estado === 200, 'El catalogo es publico: 200 sin token');
};

// ===========================================================================

const principal = async (): Promise<void> => {
  console.log(`${AZUL}==============================================================${FIN}`);
  console.log(`${AZUL} Prueba de integracion extremo a extremo${FIN}`);
  console.log(`${AZUL} Gateway: ${GATEWAY}${FIN}`);
  console.log(`${AZUL}==============================================================${FIN}`);

  // Comprobacion previa: todos los servicios deben responder.
  try {
    const salud = await pedir('/api/health');
    const caidos = salud.datos?.servicios_caidos ?? [];
    if (caidos.length) {
      console.error(
        `\n${ROJO}Hay servicios caidos: ${caidos.join(', ')}${FIN}\n` +
          `Levante todo con: npm run infra:up && npm run dev\n`
      );
      process.exit(1);
    }
    console.log(`${VERDE}Todos los servicios responden correctamente.${FIN}`);
  } catch (error) {
    console.error(
      `\n${ROJO}No fue posible contactar al API Gateway en ${GATEWAY}.${FIN}\n` +
        `Levante el sistema con: npm run infra:up && npm run dev\n` +
        `Detalle: ${error instanceof Error ? error.message : error}\n`
    );
    process.exit(1);
  }

  const { token: admin } = await login('admin@tienda.co');

  // Se repone stock para que las pruebas sean repetibles.
  for (const [sku, cantidad] of [
    ['SKU-TEC-001', 50],
    ['SKU-TEC-002', 25],
    ['SKU-HOG-001', 40],
    ['SKU-DEP-001', 60]
  ] as Array<[string, number]>) {
    const actual = await stockDe(sku, admin);
    if (actual < 10) await reponer(sku, cantidad, admin);
  }

  await escenarioA(admin);
  await escenarioB(admin);
  await escenarioC(admin);
  await escenarioD(admin);
  await escenarioE(admin);
  await escenarioSeguridad();

  console.log('');
  console.log(GRIS + '-'.repeat(62) + FIN);
  if (fallos === 0) {
    console.log(`${VERDE}Las ${comprobaciones} comprobaciones pasaron.${FIN}\n`);
  } else {
    console.log(`${ROJO}${fallos} de ${comprobaciones} comprobaciones fallaron.${FIN}\n`);
  }

  process.exit(fallos === 0 ? 0 : 1);
};

void principal();
