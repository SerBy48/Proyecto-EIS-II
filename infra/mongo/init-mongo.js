// ============================================================================
// Inicializacion de MongoDB (seccion 5.11 del documento).
//
// Dos bases documentales, una por servicio:
//   catalogo_db       -> productos, categorias, promociones
//   notificaciones_db -> plantillas, mensajes y estados de envio
//
// El catalogo es documental porque cada categoria de producto tiene atributos
// distintos (un portatil tiene RAM y procesador; una camiseta, talla y color) y
// un esquema relacional rigido obligaria a una tabla de atributos generica o a
// decenas de columnas nulas. Ademas, el indice de texto permite la busqueda que
// exige la seccion 5.5 sin depender de un motor externo.
// ============================================================================

// -------------------------------------------------------------- catalogo ---
const catalogo = db.getSiblingDB('catalogo_db');

catalogo.createUser({
  user: 'catalogo_user',
  pwd: 'catalogo_pass',
  roles: [{ role: 'readWrite', db: 'catalogo_db' }]
});

catalogo.createCollection('productos');
catalogo.createCollection('categorias');
catalogo.createCollection('promociones');

catalogo.productos.createIndex({ sku: 1 }, { unique: true });
catalogo.productos.createIndex({ categoria: 1, marca: 1 });
catalogo.productos.createIndex({ precio: 1 });
catalogo.productos.createIndex({ activo: 1 });
// Indice de texto con pesos: el nombre importa mas que la descripcion.
catalogo.productos.createIndex(
  { nombre: 'text', descripcion: 'text', marca: 'text' },
  { weights: { nombre: 10, marca: 5, descripcion: 1 }, default_language: 'spanish', name: 'idx_texto' }
);

catalogo.categorias.insertMany([
  { slug: 'tecnologia', nombre: 'Tecnologia', orden: 1 },
  { slug: 'hogar', nombre: 'Hogar', orden: 2 },
  { slug: 'deportes', nombre: 'Deportes', orden: 3 }
]);

const ahora = new Date();

catalogo.productos.insertMany([
  {
    sku: 'SKU-TEC-001',
    nombre: 'Portatil Aurora 14 pulgadas',
    descripcion: 'Portatil ultraligero con pantalla de 14 pulgadas, ideal para trabajo y estudio.',
    categoria: 'tecnologia',
    marca: 'Aurora',
    precio: 3499000,
    descuento_porcentaje: 10,
    imagenes: ['/img/portatil-aurora-1.jpg', '/img/portatil-aurora-2.jpg'],
    atributos: { procesador: 'Ryzen 7', ram_gb: 16, almacenamiento: '512 GB SSD', pantalla: '14"' },
    activo: true,
    creado_en: ahora
  },
  {
    sku: 'SKU-TEC-002',
    nombre: 'Audifonos Nimbus con cancelacion de ruido',
    descripcion: 'Audifonos inalambricos con cancelacion activa de ruido y 30 horas de bateria.',
    categoria: 'tecnologia',
    marca: 'Nimbus',
    precio: 549000,
    descuento_porcentaje: 0,
    imagenes: ['/img/audifonos-nimbus.jpg'],
    atributos: { conectividad: 'Bluetooth 5.3', bateria_horas: 30, color: 'Negro' },
    activo: true,
    creado_en: ahora
  },
  {
    sku: 'SKU-TEC-003',
    nombre: 'Monitor Vertex 27 pulgadas QHD',
    descripcion: 'Monitor de 27 pulgadas con resolucion QHD y 144 Hz de refresco.',
    categoria: 'tecnologia',
    marca: 'Vertex',
    precio: 1290000,
    descuento_porcentaje: 15,
    imagenes: ['/img/monitor-vertex.jpg'],
    atributos: { pulgadas: 27, resolucion: '2560x1440', hz: 144 },
    activo: true,
    creado_en: ahora
  },
  {
    // Producto con una sola unidad en inventario: se usa en la prueba de
    // concurrencia de la ultima unidad disponible.
    sku: 'SKU-TEC-004',
    nombre: 'Teclado mecanico Forge edicion limitada',
    descripcion: 'Edicion limitada con switches tactiles y estructura de aluminio. Ultima unidad.',
    categoria: 'tecnologia',
    marca: 'Forge',
    precio: 789000,
    descuento_porcentaje: 0,
    imagenes: ['/img/teclado-forge.jpg'],
    atributos: { switches: 'Tactil marron', layout: 'ANSI 75%', material: 'Aluminio' },
    activo: true,
    creado_en: ahora
  },
  {
    sku: 'SKU-TEC-005',
    nombre: 'Camara web Clarity 1080p',
    descripcion: 'Camara web full HD con microfono dual y enfoque automatico.',
    categoria: 'tecnologia',
    marca: 'Clarity',
    precio: 219000,
    descuento_porcentaje: 5,
    imagenes: ['/img/camara-clarity.jpg'],
    atributos: { resolucion: '1080p', fps: 30 },
    activo: true,
    creado_en: ahora
  },
  {
    sku: 'SKU-HOG-001',
    nombre: 'Cafetera Brisa de goteo 12 tazas',
    descripcion: 'Cafetera programable de 12 tazas con jarra termica.',
    categoria: 'hogar',
    marca: 'Brisa',
    precio: 329000,
    descuento_porcentaje: 0,
    imagenes: ['/img/cafetera-brisa.jpg'],
    atributos: { capacidad_tazas: 12, programable: true },
    activo: true,
    creado_en: ahora
  },
  {
    // Stock por debajo del minimo: dispara la alerta de reposicion.
    sku: 'SKU-HOG-002',
    nombre: 'Juego de sartenes Terra antiadherentes',
    descripcion: 'Juego de tres sartenes con recubrimiento ceramico libre de PFOA.',
    categoria: 'hogar',
    marca: 'Terra',
    precio: 289000,
    descuento_porcentaje: 20,
    imagenes: ['/img/sartenes-terra.jpg'],
    atributos: { piezas: 3, apto_induccion: true },
    activo: true,
    creado_en: ahora
  },
  {
    sku: 'SKU-HOG-003',
    nombre: 'Aspiradora robot Orbit',
    descripcion: 'Aspiradora robot con mapeo laser y estacion de vaciado automatico.',
    categoria: 'hogar',
    marca: 'Orbit',
    precio: 1890000,
    descuento_porcentaje: 12,
    imagenes: ['/img/aspiradora-orbit.jpg'],
    atributos: { mapeo: 'LiDAR', autonomia_min: 150 },
    activo: true,
    creado_en: ahora
  },
  {
    sku: 'SKU-DEP-001',
    nombre: 'Tapete de yoga Sendero 6 mm',
    descripcion: 'Tapete antideslizante de 6 mm con correa de transporte.',
    categoria: 'deportes',
    marca: 'Sendero',
    precio: 129000,
    descuento_porcentaje: 0,
    imagenes: ['/img/tapete-sendero.jpg'],
    atributos: { grosor_mm: 6, material: 'TPE' },
    activo: true,
    creado_en: ahora
  },
  {
    sku: 'SKU-DEP-002',
    nombre: 'Bicicleta estatica Ciclon',
    descripcion: 'Bicicleta estatica con volante de inercia de 18 kg y monitor de pulso.',
    categoria: 'deportes',
    marca: 'Ciclon',
    precio: 1450000,
    descuento_porcentaje: 8,
    imagenes: ['/img/bicicleta-ciclon.jpg'],
    atributos: { volante_kg: 18, niveles_resistencia: 32 },
    activo: true,
    creado_en: ahora
  }
]);

catalogo.promociones.insertMany([
  {
    codigo: 'BIENVENIDA10',
    descripcion: '10% de descuento en la primera compra',
    tipo: 'porcentaje',
    valor: 10,
    minimo_compra: 100000,
    activo: true,
    vigente_hasta: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  },
  {
    codigo: 'ENVIOGRATIS',
    descripcion: 'Envio gratis en compras superiores a 500.000',
    tipo: 'envio_gratis',
    valor: 0,
    minimo_compra: 500000,
    activo: true,
    vigente_hasta: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  },
  {
    codigo: 'EXPIRADO',
    descripcion: 'Cupon vencido, usado para probar el rechazo',
    tipo: 'porcentaje',
    valor: 50,
    minimo_compra: 0,
    activo: true,
    vigente_hasta: new Date(Date.now() - 24 * 60 * 60 * 1000)
  }
]);

// --------------------------------------------------------- notificaciones ---
const notif = db.getSiblingDB('notificaciones_db');

notif.createUser({
  user: 'notificaciones_user',
  pwd: 'notificaciones_pass',
  roles: [{ role: 'readWrite', db: 'notificaciones_db' }]
});

notif.createCollection('mensajes');
notif.createCollection('plantillas');

notif.mensajes.createIndex({ destinatario: 1, creado_en: -1 });
notif.mensajes.createIndex({ estado: 1 });
notif.mensajes.createIndex({ evento: 1 });
// Clave de deduplicacion: si el broker entrega el mismo evento dos veces, el
// indice unico impide enviar el correo por duplicado.
notif.mensajes.createIndex({ clave_dedupe: 1 }, { unique: true, sparse: true });

notif.plantillas.insertMany([
  {
    clave: 'pedido.confirmado',
    canal: 'email',
    asunto: 'Tu pedido {{numero}} fue confirmado',
    cuerpo: 'Hola {{nombre}}, recibimos tu pedido {{numero}} por {{total}}. Te avisaremos cuando salga de nuestra bodega.',
    activo: true
  },
  {
    clave: 'pedido.cancelado',
    canal: 'email',
    // detalle_cobro lo pone quien cancela: la saga ("No se realizo ningun
    // cobro") o la cancelacion posterior ("El reembolso ... fue procesado").
    asunto: 'Tu pedido {{numero}} fue cancelado',
    cuerpo: 'Hola {{nombre}}, tu pedido {{numero}} fue cancelado. Motivo: {{motivo}}. {{detalle_cobro}}',
    activo: true
  },
  {
    clave: 'pago.rechazado',
    canal: 'email',
    asunto: 'No pudimos procesar tu pago',
    cuerpo: 'Hola {{nombre}}, el pago del pedido {{numero}} fue rechazado ({{motivo}}). Puedes intentar con otro medio de pago.',
    activo: true
  },
  {
    clave: 'inventario.stock_minimo',
    canal: 'email',
    asunto: 'Alerta de reposicion: {{sku}}',
    cuerpo: 'El producto {{sku}} quedo en {{disponible}} unidades, por debajo del minimo de {{minimo}}.',
    activo: true
  },
  {
    clave: 'carrito.abandonado',
    canal: 'push',
    asunto: 'Dejaste productos en tu carrito',
    cuerpo: 'Hola {{nombre}}, todavia tienes {{items}} producto(s) esperandote.',
    activo: true
  }
]);

print('MongoDB inicializado: catalogo_db (10 productos, 3 promociones) y notificaciones_db (5 plantillas).');
