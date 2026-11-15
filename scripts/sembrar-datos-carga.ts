/**
 * Poblado masivo para las pruebas no funcionales (Paso 1.1 del plan de
 * estrategias de validacion).
 *
 * Todo pasa por la API del gateway, no por inserciones directas en las bases:
 * cada servicio es dueno de sus datos (inventario, en particular, es el unico
 * que escribe el stock) y un INSERT por fuera produciria datos que el sistema
 * real nunca generaria.
 *
 * Que crea:
 *   - 60 productos (20 por categoria) con nombres y descripciones variados, para
 *     que la busqueda $text de MongoDB trabaje con volumen real.
 *   - Stock alto (10 000 u.) en los SKU que usa la prueba de checkout, y
 *     200 u. en cada producto nuevo (la primera entrada abre su inventario).
 *   - 100 clientes de carga (CLIENTES_CARGA): carga001@correo.co ... carga100@correo.co
 *     (contrasena Password123), cada uno con su direccion de envio.
 *   - Pedidos historicos: un checkout con tok_ok_* por cada uno de los
 *     primeros 60 clientes de carga.
 *
 * Es idempotente y re-ejecutable: lo que ya existe (409) se omite, el stock se
 * completa hasta la meta en lugar de sumarse otra vez, y los checkouts usan
 * claves de idempotencia deterministas.
 *
 * Uso: npm run sembrar:carga   (URL_GATEWAY cambia el destino)
 */

const GATEWAY = process.env.URL_GATEWAY || 'http://localhost:8080';
const API = `${GATEWAY}/api`;
const CONTRASENA = 'Password123';
/**
 * 100 por defecto (lo que pide el plan). Las pruebas de estres y pico llegan a
 * 300 VU, y cada VU necesita su propia cuenta: dos VU con la misma cuenta
 * compartirian el carrito y se vaciarian el checkout entre si. Para esas
 * corridas: CLIENTES_CARGA=300 npm run sembrar:carga
 */
const TOTAL_CLIENTES = Number(process.env.CLIENTES_CARGA || 100);
const CLIENTES_CON_PEDIDO = 60;
const META_STOCK = 10_000;
/** Stock de los 60 productos nuevos: suficiente para que el catalogo los muestre disponibles. */
const META_STOCK_NUEVOS = 200;
const CONCURRENCIA = 5;

/** SKU con stock alto para la carga. SKU-TEC-004 y SKU-HOG-002 NO se tocan: las pruebas existentes dependen de su escasez. */
export const SKUS_CARGA = ['SKU-TEC-001', 'SKU-HOG-001', 'SKU-DEP-001', 'SKU-TEC-002', 'SKU-DEP-002'];

// --------------------------------------------------------------------------
// Cliente HTTP minimo con espera ante 429
// --------------------------------------------------------------------------
interface Respuesta<T = any> {
  estado: number;
  datos: T;
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

const pedir = async <T = any>(
  ruta: string,
  opciones: { metodo?: string; token?: string; cuerpo?: unknown; cabeceras?: Record<string, string> } = {}
): Promise<Respuesta<T>> => {
  for (let intento = 1; ; intento++) {
    const respuesta = await fetch(`${API}${ruta}`, {
      method: opciones.metodo ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(opciones.token ? { Authorization: `Bearer ${opciones.token}` } : {}),
        ...(opciones.cabeceras ?? {})
      },
      body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo)
    });

    // Con los limites normales el poblado puede chocar con el rate limiting.
    // No es un error del poblado: se espera lo que indique el gateway.
    if (respuesta.status === 429 && intento <= 10) {
      const segundos = Number(respuesta.headers.get('retry-after')) || 10;
      contadores.esperas429 += 1;
      await esperar(segundos * 1000);
      continue;
    }

    const texto = await respuesta.text();
    let datos: any = texto;
    try {
      datos = texto ? JSON.parse(texto) : null;
    } catch {
      /* cuerpo no JSON */
    }
    return { estado: respuesta.status, datos };
  }
};

/** Ejecuta las tareas con un tope de concurrencia. */
const enParalelo = async <T>(elementos: T[], tarea: (e: T) => Promise<void>): Promise<void> => {
  let siguiente = 0;
  const trabajadores = Array.from({ length: CONCURRENCIA }, async () => {
    while (siguiente < elementos.length) {
      const elemento = elementos[siguiente++];
      await tarea(elemento);
    }
  });
  await Promise.all(trabajadores);
};

const contadores = {
  productosCreados: 0,
  productosExistentes: 0,
  stockCompletado: 0,
  stockYaEnMeta: 0,
  stockSinRegistro: [] as string[],
  clientesCreados: 0,
  clientesExistentes: 0,
  direccionesCreadas: 0,
  pedidosCreados: 0,
  pedidosExistentes: 0,
  esperas429: 0,
  errores: [] as string[]
};

const fallo = (contexto: string, r: Respuesta): void => {
  contadores.errores.push(`${contexto}: HTTP ${r.estado} ${JSON.stringify(r.datos).slice(0, 160)}`);
};

// --------------------------------------------------------------------------
// Catalogo: 60 productos generados de forma determinista
// --------------------------------------------------------------------------
interface ProductoSemilla {
  sku: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  marca: string;
  precio: number;
  descuento_porcentaje: number;
  atributos: Record<string, unknown>;
}

const PLANTILLAS: Record<string, { prefijo: string; tipos: string[]; marcas: string[]; usos: string[]; base: number }> = {
  tecnologia: {
    prefijo: 'TEC',
    tipos: ['Portatil', 'Monitor', 'Teclado mecanico', 'Mouse inalambrico', 'Audifonos', 'Parlante bluetooth', 'Tableta', 'Camara web', 'Disco solido', 'Router wifi'],
    marcas: ['Andina', 'Nexo', 'Volta', 'Orbital'],
    usos: ['para oficina y estudio', 'para videojuegos', 'para diseno grafico', 'para teletrabajo'],
    base: 120_000
  },
  hogar: {
    prefijo: 'HOG',
    tipos: ['Licuadora', 'Cafetera', 'Sarten antiadherente', 'Juego de sabanas', 'Lampara de mesa', 'Aspiradora', 'Olla a presion', 'Ventilador de torre', 'Freidora de aire', 'Set de cuchillos'],
    marcas: ['Casa Viva', 'Hogarena', 'Brisa', 'Terra'],
    usos: ['para cocina familiar', 'para apartamento pequeno', 'de uso diario', 'de alta durabilidad'],
    base: 60_000
  },
  deportes: {
    prefijo: 'DEP',
    tipos: ['Balon de futbol', 'Bicicleta de ruta', 'Mancuernas', 'Colchoneta de yoga', 'Raqueta de tenis', 'Guantes de boxeo', 'Tenis para correr', 'Morral de hidratacion', 'Cuerda para saltar', 'Casco de ciclismo'],
    marcas: ['Cumbre', 'Rapido', 'Atleta', 'Montana'],
    usos: ['para entrenamiento en casa', 'para competencia', 'para principiantes', 'para uso al aire libre'],
    base: 40_000
  }
};

export const generarProductos = (): ProductoSemilla[] => {
  const productos: ProductoSemilla[] = [];
  for (const [categoria, p] of Object.entries(PLANTILLAS)) {
    for (let i = 0; i < 20; i++) {
      const tipo = p.tipos[i % p.tipos.length];
      const marca = p.marcas[i % p.marcas.length];
      const uso = p.usos[(i * 3) % p.usos.length];
      const serie = i < 10 ? 'Basico' : 'Pro';
      productos.push({
        sku: `SKU-${p.prefijo}-${String(101 + i)}`,
        nombre: `${tipo} ${marca} ${serie}`,
        descripcion: `${tipo} de la linea ${serie.toLowerCase()} ${uso}. Producto de carga para pruebas de rendimiento.`,
        categoria,
        marca,
        precio: p.base * (1 + (i % 7)) + (i < 10 ? 0 : p.base),
        descuento_porcentaje: [0, 0, 5, 10, 15][i % 5],
        atributos: { serie, garantia_meses: 6 + (i % 4) * 6 }
      });
    }
  }
  return productos;
};

// --------------------------------------------------------------------------
// Pasos del poblado
// --------------------------------------------------------------------------
const login = async (email: string): Promise<Respuesta> =>
  pedir('/auth/login', { metodo: 'POST', cuerpo: { email, password: CONTRASENA } });

const sembrarProductos = async (admin: string) => {
  await enParalelo(generarProductos(), async (producto) => {
    const r = await pedir('/catalogo/productos', { metodo: 'POST', token: admin, cuerpo: producto });
    if (r.estado === 201) contadores.productosCreados += 1;
    else if (r.estado === 409) contadores.productosExistentes += 1;
    else fallo(`producto ${producto.sku}`, r);
  });
};

const completarStock = async (admin: string, sku: string, meta: number) => {
  const actual = await pedir<Array<{ disponible?: number; cantidad_disponible?: number }>>(`/inventario/stock/${sku}`, { token: admin });
  // 404 = el SKU aun no tiene registro de inventario: la entrada lo abre.
  if (actual.estado !== 200 && actual.estado !== 404) return fallo(`stock ${sku}`, actual);
  const filas = actual.estado === 200 && Array.isArray(actual.datos) ? actual.datos : [];

  const disponible = filas.reduce((s, f) => s + Number(f.cantidad_disponible ?? f.disponible ?? 0), 0);
  if (disponible >= meta) {
    contadores.stockYaEnMeta += 1;
    return;
  }

  const r = await pedir(`/inventario/stock/${sku}/entrada`, {
    metodo: 'POST',
    token: admin,
    cuerpo: { cantidad: meta - disponible }
  });
  if (r.estado === 200) contadores.stockCompletado += 1;
  else if (r.estado === 404) contadores.stockSinRegistro.push(sku);
  else fallo(`entrada ${sku}`, r);
};

interface ClienteCarga {
  numero: number;
  email: string;
  token?: string;
  clienteId?: number;
}

const prepararCliente = async (c: ClienteCarga) => {
  const sufijo = String(c.numero).padStart(3, '0');

  // Se intenta crear primero y se inicia sesion despues: asi no se generan
  // logins fallidos, que son los que cuenta el limitador de login.
  const alta = await pedir('/clientes', {
    metodo: 'POST',
    cuerpo: {
      nombre: `Carga${sufijo}`,
      apellido: 'Prueba',
      email: c.email,
      telefono: `300${String(1_000_000 + c.numero)}`,
      documento: `900000${sufijo}`
    }
  });

  if (alta.estado === 201) {
    const registro = await pedir('/auth/registro', {
      metodo: 'POST',
      cuerpo: { email: c.email, password: CONTRASENA, cliente_id: alta.datos.cliente.id }
    });
    if (registro.estado !== 201 && registro.estado !== 409) return fallo(`registro ${c.email}`, registro);
    contadores.clientesCreados += 1;
  } else if (alta.estado === 409) {
    contadores.clientesExistentes += 1;
  } else {
    return fallo(`cliente ${c.email}`, alta);
  }

  const sesion = await login(c.email);
  if (sesion.estado !== 200 || !sesion.datos?.usuario?.cliente_id) return fallo(`login ${c.email}`, sesion);
  c.token = sesion.datos.token;
  c.clienteId = sesion.datos.usuario.cliente_id;

  // Si la consulta falla no se crea nada: crear "por si acaso" duplicaria la
  // direccion en cada re-ejecucion, y el poblado debe ser idempotente.
  const direcciones = await pedir<unknown[]>(`/clientes/${c.clienteId}/direcciones`, { token: c.token });
  if (direcciones.estado !== 200) return fallo(`direcciones ${c.email}`, direcciones);
  if (Array.isArray(direcciones.datos) && direcciones.datos.length) return;

  const nueva = await pedir(`/clientes/${c.clienteId}/direcciones`, {
    metodo: 'POST',
    token: c.token,
    cuerpo: {
      tipo: 'envio',
      etiqueta: 'Casa',
      linea1: `Calle ${10 + (c.numero % 80)} # ${c.numero}-20`,
      ciudad: ['Neiva', 'Bogota', 'Medellin', 'Cali'][c.numero % 4],
      departamento: ['Huila', 'Cundinamarca', 'Antioquia', 'Valle del Cauca'][c.numero % 4],
      codigo_postal: '410001',
      predeterminada: true
    }
  });
  if (nueva.estado === 201) contadores.direccionesCreadas += 1;
  else fallo(`direccion ${c.email}`, nueva);
};

const crearPedidoHistorico = async (c: ClienteCarga) => {
  if (!c.token || !c.clienteId) return;

  const previos = await pedir<unknown[]>('/pedidos', { token: c.token });
  if (previos.estado === 200 && Array.isArray(previos.datos) && previos.datos.length) {
    contadores.pedidosExistentes += 1;
    return;
  }

  const skus = [SKUS_CARGA[c.numero % 3], SKUS_CARGA[(c.numero + 1) % 3]];
  for (const [i, sku] of skus.entries()) {
    const r = await pedir(`/carrito/${c.clienteId}/items`, {
      metodo: 'POST',
      token: c.token,
      cuerpo: { sku, cantidad: 1 + ((c.numero + i) % 2) }
    });
    if (r.estado !== 200 && r.estado !== 201) return fallo(`carrito ${c.email} ${sku}`, r);
  }

  const compra = await pedir('/pedidos/checkout', {
    metodo: 'POST',
    token: c.token,
    cabeceras: { 'Idempotency-Key': `sembrado-carga-${c.numero}` },
    cuerpo: { medio_pago: 'tarjeta_credito', token_medio_pago: `tok_ok_${4000 + c.numero}` }
  });
  if (compra.estado === 201) contadores.pedidosCreados += 1;
  else if (compra.estado === 200) contadores.pedidosExistentes += 1;
  else fallo(`checkout ${c.email}`, compra);
};

// --------------------------------------------------------------------------
// Conteo final por entidad (leido de la API, no de las variables locales)
// --------------------------------------------------------------------------
const contarTotales = async (admin: string) => {
  const productos = await pedir('/catalogo/productos?limite=1');
  const categorias = await pedir<Array<{ slug?: string; total?: number }>>('/catalogo/categorias');
  const pedidosAdmin = await pedir<unknown[]>('/pedidos', { token: admin });
  const stock = await pedir<Array<{ sku: string; disponible: number }>>(
    `/inventario/disponibilidad?skus=${SKUS_CARGA.join(',')}`,
    { token: admin }
  );
  return {
    productos_activos: productos.datos?.total ?? productos.datos?.paginacion?.total ?? '¿?',
    categorias: categorias.datos,
    pedidos_visibles_admin: Array.isArray(pedidosAdmin.datos) ? pedidosAdmin.datos.length : '¿?',
    disponibilidad_skus_carga: stock.datos
  };
};

const principal = async () => {
  const inicio = Date.now();
  console.log(`Poblado de carga contra ${GATEWAY}\n`);

  const sesionAdmin = await login('admin@tienda.co');
  if (sesionAdmin.estado !== 200) {
    console.error('No se pudo iniciar sesion como administrador:', sesionAdmin);
    process.exit(1);
  }
  const admin: string = sesionAdmin.datos.token;

  console.log('1/4 Productos...');
  await sembrarProductos(admin);

  console.log('2/4 Stock de los SKU de carga y de los productos nuevos...');
  const metas: Array<[string, number]> = [
    ...SKUS_CARGA.map((sku): [string, number] => [sku, META_STOCK]),
    ...generarProductos().map((p): [string, number] => [p.sku, META_STOCK_NUEVOS])
  ];
  await enParalelo(metas, ([sku, meta]) => completarStock(admin, sku, meta));

  console.log('3/4 Clientes de carga con direccion...');
  const clientes: ClienteCarga[] = Array.from({ length: TOTAL_CLIENTES }, (_, i) => ({
    numero: i + 1,
    email: `carga${String(i + 1).padStart(3, '0')}@correo.co`
  }));
  await enParalelo(clientes, prepararCliente);

  console.log('4/4 Pedidos historicos...');
  await enParalelo(clientes.slice(0, CLIENTES_CON_PEDIDO), crearPedidoHistorico);

  const totales = await contarTotales(admin);
  const resumen = {
    fecha: new Date().toISOString(),
    gateway: GATEWAY,
    duracion_s: Math.round((Date.now() - inicio) / 100) / 10,
    resultado_de_esta_ejecucion: {
      productos: { creados: contadores.productosCreados, ya_existian: contadores.productosExistentes },
      stock: {
        completados_a_meta: contadores.stockCompletado,
        ya_en_meta: contadores.stockYaEnMeta,
        meta_unidades: { skus_de_carga: META_STOCK, productos_nuevos: META_STOCK_NUEVOS },
        sin_registro_de_inventario: contadores.stockSinRegistro.length
      },
      clientes: { creados: contadores.clientesCreados, ya_existian: contadores.clientesExistentes, direcciones_creadas: contadores.direccionesCreadas },
      pedidos: { creados: contadores.pedidosCreados, ya_existian: contadores.pedidosExistentes },
      esperas_por_429: contadores.esperas429,
      errores: contadores.errores.length
    },
    totales_en_el_sistema: totales,
    skus_sin_registro_de_inventario: contadores.stockSinRegistro,
    detalle_errores: contadores.errores
  };

  console.log('\n' + JSON.stringify(resumen, null, 2));
  process.exit(contadores.errores.length ? 1 : 0);
};

if (process.argv[1]?.includes('sembrar-datos-carga')) {
  principal().catch((error) => {
    console.error('Fallo inesperado del poblado:', error);
    process.exit(1);
  });
}
