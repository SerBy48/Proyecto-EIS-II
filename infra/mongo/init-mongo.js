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
catalogo.productos.createIndex({ subcategoria: 1, precio: 1 });
catalogo.productos.createIndex({ precio: 1 });
catalogo.productos.createIndex({ activo: 1 });
// Indice de texto con pesos: el nombre importa mas que la descripcion.
catalogo.productos.createIndex(
  { nombre: 'text', descripcion: 'text', marca: 'text', subcategoria: 'text' },
  { weights: { nombre: 10, marca: 5, subcategoria: 3, descripcion: 1 }, default_language: 'spanish', name: 'idx_texto' }
);

// SerByTek es una tienda exclusivamente de tecnologia: una categoria y diez
// subcategorias. Cada subcategoria trae sus sinonimos: el asistente los lee del
// catalogo (GET /categorias) para entender "audifonos", "laptop" o "gpu" sin
// que haya que tocar sus reglas cuando se agrega un producto o una subcategoria.
catalogo.categorias.insertMany([
  {
    slug: 'tecnologia',
    nombre: 'Tecnología',
    orden: 1,
    subcategorias: [
      { slug: 'computadores', nombre: 'Computadores', orden: 1,
        sinonimos: ['computador', 'computadora', 'portatil', 'laptop', 'notebook', 'pc', 'escritorio', 'todo en uno', 'all in one', 'mini pc', 'ordenador'] },
      { slug: 'componentes', nombre: 'Componentes', orden: 2,
        sinonimos: ['componente', 'procesador', 'cpu', 'tarjeta grafica', 'tarjeta de video', 'gpu', 'grafica', 'ram', 'memoria ram', 'placa base', 'board', 'motherboard', 'tarjeta madre', 'fuente de poder', 'fuente', 'gabinete', 'chasis', 'torre'] },
      { slug: 'almacenamiento', nombre: 'Almacenamiento', orden: 3,
        sinonimos: ['ssd', 'nvme', 'disco', 'disco duro', 'disco externo', 'usb', 'memoria usb', 'pendrive', 'microsd', 'memoria sd', 'nas'] },
      { slug: 'perifericos', nombre: 'Periféricos', orden: 4,
        sinonimos: ['periferico', 'teclado', 'mouse', 'raton', 'camara web', 'webcam', 'microfono'] },
      { slug: 'monitores', nombre: 'Monitores', orden: 5,
        sinonimos: ['monitor', 'pantalla', 'display', 'brazo para monitor', 'soporte para monitor'] },
      { slug: 'audio', nombre: 'Audio', orden: 6,
        sinonimos: ['audifono', 'audifonos', 'auricular', 'auriculares', 'diadema', 'headset', 'cascos', 'parlante', 'altavoz', 'bocina', 'barra de sonido', 'sonido'] },
      { slug: 'moviles', nombre: 'Celulares, tablets y relojes', orden: 7,
        sinonimos: ['celular', 'telefono', 'smartphone', 'movil', 'tablet', 'tableta', 'reloj', 'reloj inteligente', 'smartwatch', 'banda', 'pulsera'] },
      { slug: 'redes', nombre: 'Redes', orden: 8,
        sinonimos: ['red', 'router', 'enrutador', 'wifi', 'internet', 'mesh', 'repetidor', 'switch', 'adaptador wifi', 'camara de seguridad'] },
      { slug: 'gaming', nombre: 'Gaming', orden: 9,
        sinonimos: ['gamer', 'videojuego', 'videojuegos', 'juego', 'juegos', 'consola', 'control', 'joystick', 'volante', 'silla gamer', 'realidad virtual', 'vr'] },
      { slug: 'accesorios', nombre: 'Accesorios', orden: 10,
        sinonimos: ['accesorio', 'cargador', 'cable', 'hub', 'adaptador', 'bateria externa', 'power bank', 'base refrigerante', 'maletin', 'morral'] }
    ]
  }
]);

const ahora = new Date();

// Los productos se crean con fechas escalonadas para que "mas recientes" tenga
// un orden estable.
let orden = 0;
const producto = (sku, nombre, subcategoria, marca, precio, descuento, descripcion, atributos) => ({
  sku,
  nombre,
  descripcion,
  categoria: 'tecnologia',
  subcategoria,
  marca,
  precio,
  descuento_porcentaje: descuento,
  imagenes: [],
  atributos,
  activo: true,
  creado_en: new Date(ahora.getTime() - 60000 * orden++)
});

catalogo.productos.insertMany([
  // --------------------------------------------------------- computadores
  producto('SKU-TEC-001', 'Portátil Aurora 14 pulgadas', 'computadores', 'Aurora', 3499000, 10,
    'Portátil ultraligero con pantalla de 14 pulgadas, ideal para trabajo y estudio.',
    { procesador: 'Ryzen 7', ram_gb: 16, almacenamiento: '512 GB SSD', pantalla: '14"' }),
  producto('SKU-TEC-011', 'Portátil gamer Titan 16 RTX 4060', 'computadores', 'Titan', 6299000, 5,
    'Portátil para juegos con gráfica RTX 4060, pantalla de 165 Hz y teclado RGB.',
    { procesador: 'Core i7', ram_gb: 16, almacenamiento: '1 TB SSD', grafica: 'RTX 4060 8 GB', pantalla: '16" 165 Hz' }),
  producto('SKU-TEC-012', 'Portátil Lumen 15 para estudiantes', 'computadores', 'Lumen', 1899000, 0,
    'Portátil liviano y económico para clases virtuales, ofimática y navegación.',
    { procesador: 'Core i3', ram_gb: 8, almacenamiento: '256 GB SSD', pantalla: '15,6"' }),
  producto('SKU-TEC-013', 'Computador de escritorio Atlas Ryzen 5', 'computadores', 'Atlas', 2799000, 0,
    'Torre de escritorio lista para trabajar, con WiFi 6 y espacio para ampliar.',
    { procesador: 'Ryzen 5', ram_gb: 16, almacenamiento: '1 TB SSD' }),
  producto('SKU-TEC-014', 'Todo en uno Horizonte 24 pulgadas', 'computadores', 'Horizonte', 3199000, 8,
    'Computador todo en uno con pantalla táctil de 24 pulgadas y cámara emergente.',
    { procesador: 'Core i5', ram_gb: 16, almacenamiento: '512 GB SSD', pantalla: '24" táctil' }),
  producto('SKU-TEC-015', 'Mini PC Nexo N100', 'computadores', 'Nexo', 1149000, 0,
    'Computador compacto y silencioso que cabe detrás del monitor.',
    { procesador: 'Intel N100', ram_gb: 8, almacenamiento: '256 GB SSD' }),

  // ---------------------------------------------------------- componentes
  producto('SKU-TEC-016', 'Procesador Kronos R7 de 8 núcleos', 'componentes', 'Kronos', 1499000, 0,
    'Procesador de 8 núcleos y 16 hilos para juegos y creación de contenido.',
    { nucleos: 8, hilos: 16, frecuencia_ghz: 5.1, socket: 'AM5' }),
  producto('SKU-TEC-017', 'Tarjeta gráfica Volt RTX 4070 12 GB', 'componentes', 'Volt', 3299000, 7,
    'Tarjeta gráfica para jugar en 1440p con trazado de rayos.',
    { memoria: '12 GB GDDR6X', conectores: 'HDMI 2.1, 3x DisplayPort' }),
  producto('SKU-TEC-018', 'Memoria RAM Pulsar DDR5 32 GB', 'componentes', 'Pulsar', 529000, 0,
    'Kit de dos módulos de 16 GB DDR5 a 6000 MHz con disipador.',
    { capacidad: '2 x 16 GB', tipo: 'DDR5', velocidad_mhz: 6000 }),
  producto('SKU-TEC-019', 'Placa base Cimiento B650 ATX', 'componentes', 'Cimiento', 899000, 0,
    'Placa base ATX con WiFi 6E, dos ranuras M.2 y soporte para DDR5.',
    { socket: 'AM5', formato: 'ATX', wifi: 'WiFi 6E' }),
  producto('SKU-TEC-020', 'Fuente de poder Watt 750 W 80 Plus Gold', 'componentes', 'Watt', 459000, 0,
    'Fuente modular de 750 W con certificación 80 Plus Gold.',
    { potencia_w: 750, certificacion: '80 Plus Gold', modular: true }),
  producto('SKU-TEC-021', 'Gabinete Prisma con vidrio templado', 'componentes', 'Prisma', 349000, 10,
    'Gabinete media torre con panel de vidrio templado y tres ventiladores ARGB.',
    { formato: 'Media torre ATX', ventiladores: 3 }),

  // ------------------------------------------------------- almacenamiento
  // SKU-TEC-007: stock por debajo del minimo, dispara la alerta de reposicion.
  producto('SKU-TEC-007', 'Disco SSD externo Rayo 1 TB', 'almacenamiento', 'Rayo', 289000, 20,
    'SSD portátil USB-C de 1 TB con lectura de hasta 1050 MB/s.',
    { capacidad: '1 TB', interfaz: 'USB-C 3.2', lectura_mb_s: 1050 }),
  producto('SKU-TEC-022', 'SSD NVMe Cometa 1 TB Gen4', 'almacenamiento', 'Cometa', 389000, 0,
    'Unidad M.2 NVMe PCIe 4.0 de 1 TB para arranque rápido y juegos.',
    { capacidad: '1 TB', interfaz: 'PCIe 4.0 x4', lectura_mb_s: 7000 }),
  producto('SKU-TEC-023', 'Disco duro Bóveda 2 TB', 'almacenamiento', 'Bóveda', 299000, 0,
    'Disco duro interno de 3,5 pulgadas y 7200 rpm para respaldos.',
    { capacidad: '2 TB', rpm: 7200 }),
  producto('SKU-TEC-024', 'Memoria USB Chispa 128 GB', 'almacenamiento', 'Chispa', 59000, 0,
    'Memoria USB 3.2 metálica con llavero.',
    { capacidad: '128 GB', interfaz: 'USB 3.2' }),
  producto('SKU-TEC-025', 'Tarjeta microSD Chispa 256 GB', 'almacenamiento', 'Chispa', 99000, 10,
    'Tarjeta microSD A2 para celulares, cámaras y consolas portátiles.',
    { capacidad: '256 GB', clase: 'A2 U3' }),
  producto('SKU-TEC-026', 'Servidor NAS Bóveda de 2 bahías', 'almacenamiento', 'Bóveda', 1290000, 0,
    'Almacenamiento en red para la casa o la oficina, con copias automáticas.',
    { bahias: 2, red: '2,5 GbE' }),

  // ---------------------------------------------------------- perifericos
  // SKU-TEC-004: UNA sola unidad, para la prueba de la ultima unidad disponible.
  producto('SKU-TEC-004', 'Teclado mecánico Forge edición limitada', 'perifericos', 'Forge', 789000, 0,
    'Edición limitada con switches táctiles y estructura de aluminio. Última unidad.',
    { switches: 'Táctil marrón', layout: 'ANSI 75%', material: 'Aluminio' }),
  producto('SKU-TEC-005', 'Cámara web Clarity 1080p', 'perifericos', 'Clarity', 219000, 5,
    'Cámara web Full HD con micrófono dual y enfoque automático.',
    { resolucion: '1080p', fps: 30 }),
  producto('SKU-TEC-006', 'Mouse inalámbrico Pulse Pro', 'perifericos', 'Pulse', 329000, 0,
    'Mouse ergonómico inalámbrico con rueda de desplazamiento rápido y tres equipos emparejados.',
    { conectividad: 'Bluetooth y receptor USB', dpi: 8000, bateria_dias: 70 }),
  producto('SKU-TEC-027', 'Teclado inalámbrico Forge Slim', 'perifericos', 'Forge', 249000, 0,
    'Teclado delgado en español con teclas silenciosas y batería recargable.',
    { distribucion: 'Español', conectividad: 'Bluetooth' }),
  producto('SKU-TEC-028', 'Mouse gamer Pulse Viper 26000 DPI', 'perifericos', 'Pulse', 279000, 15,
    'Mouse para juegos de 58 gramos con sensor óptico de 26000 DPI.',
    { dpi: 26000, peso_g: 58 }),
  producto('SKU-TEC-029', 'Micrófono USB Eco Studio', 'perifericos', 'Eco', 389000, 0,
    'Micrófono de condensador USB para streaming, pódcast y reuniones.',
    { patron: 'Cardioide', conexion: 'USB-C' }),

  // ------------------------------------------------------------ monitores
  producto('SKU-TEC-003', 'Monitor Vertex 27 pulgadas QHD', 'monitores', 'Vertex', 1290000, 15,
    'Monitor de 27 pulgadas con resolución QHD y 144 Hz de refresco.',
    { pulgadas: 27, resolucion: '2560x1440', hz: 144 }),
  producto('SKU-TEC-030', 'Monitor Vertex 24 pulgadas Full HD', 'monitores', 'Vertex', 599000, 0,
    'Monitor IPS de 24 pulgadas para oficina, con bordes delgados.',
    { pulgadas: 24, resolucion: '1920x1080', hz: 75 }),
  producto('SKU-TEC-031', 'Monitor curvo Vertex 34 ultrapanorámico', 'monitores', 'Vertex', 2190000, 10,
    'Monitor curvo de 34 pulgadas 21:9 para productividad y simuladores.',
    { pulgadas: 34, resolucion: '3440x1440', hz: 165 }),
  producto('SKU-TEC-032', 'Monitor gamer Vertex 27 pulgadas 240 Hz', 'monitores', 'Vertex', 1990000, 0,
    'Monitor para esports con 240 Hz y 1 ms de respuesta.',
    { pulgadas: 27, resolucion: '1920x1080', hz: 240 }),
  producto('SKU-TEC-033', 'Monitor portátil Lumen 15,6 pulgadas', 'monitores', 'Lumen', 749000, 0,
    'Segunda pantalla portátil USB-C con funda que sirve de soporte.',
    { pulgadas: 15.6, conexion: 'USB-C y mini HDMI' }),
  producto('SKU-TEC-034', 'Brazo doble para monitor Ergo', 'monitores', 'Ergo', 229000, 0,
    'Soporte de escritorio con resorte de gas para dos monitores de hasta 32 pulgadas.',
    { monitores: 2, pulgadas_max: 32 }),

  // ---------------------------------------------------------------- audio
  producto('SKU-TEC-002', 'Audífonos Nimbus con cancelación de ruido', 'audio', 'Nimbus', 549000, 0,
    'Audífonos inalámbricos con cancelación activa de ruido y 30 horas de batería.',
    { conectividad: 'Bluetooth 5.3', bateria_horas: 30, color: 'Negro' }),
  producto('SKU-TEC-008', 'Barra de sonido Eco Cinema 5.1', 'audio', 'Eco', 1890000, 12,
    'Barra de sonido 5.1 con subwoofer inalámbrico y Dolby Atmos.',
    { canales: '5.1', potencia_w: 400 }),
  producto('SKU-TEC-035', 'Audífonos inalámbricos Nimbus Buds', 'audio', 'Nimbus', 299000, 10,
    'Audífonos de botón con estuche de carga y resistencia al sudor.',
    { conectividad: 'Bluetooth 5.3', bateria_horas: 24 }),
  producto('SKU-TEC-036', 'Diadema gamer Nimbus Storm 7.1', 'audio', 'Nimbus', 399000, 0,
    'Diadema con sonido envolvente 7.1 y micrófono desmontable.',
    { sonido: '7.1 virtual', conexion: 'USB y 3,5 mm' }),
  producto('SKU-TEC-037', 'Parlante Bluetooth Eco Go 20 W', 'audio', 'Eco', 249000, 0,
    'Parlante portátil resistente al agua con 12 horas de batería.',
    { potencia_w: 20, proteccion: 'IP67' }),
  producto('SKU-TEC-038', 'Audífonos de estudio Nimbus Pro', 'audio', 'Nimbus', 649000, 0,
    'Audífonos cerrados de monitoreo para producción musical.',
    { impedancia_ohm: 38, cable: 'Desmontable' }),

  // --------------------------------------------- celulares, tablets y relojes
  producto('SKU-TEC-039', 'Celular Orion X 256 GB', 'moviles', 'Orion', 2899000, 5,
    'Celular 5G con pantalla AMOLED de 6,7 pulgadas y triple cámara de 50 MP.',
    { almacenamiento: '256 GB', ram_gb: 12, pantalla: '6,7" AMOLED' }),
  producto('SKU-TEC-040', 'Celular Orion Lite 128 GB', 'moviles', 'Orion', 1099000, 0,
    'Celular de gama media con batería de 5000 mAh y carga rápida.',
    { almacenamiento: '128 GB', ram_gb: 6, bateria_mah: 5000 }),
  producto('SKU-TEC-041', 'Tablet Orion Tab 11', 'moviles', 'Orion', 1599000, 10,
    'Tablet de 11 pulgadas con lápiz incluido, ideal para tomar notas.',
    { pantalla: '11"', almacenamiento: '128 GB' }),
  producto('SKU-TEC-042', 'Tablet Lumen Kids 8 pulgadas', 'moviles', 'Lumen', 549000, 0,
    'Tablet para niños con funda resistente y control parental.',
    { pantalla: '8"', almacenamiento: '64 GB' }),
  producto('SKU-TEC-043', 'Reloj inteligente Orion Watch', 'moviles', 'Orion', 899000, 0,
    'Reloj inteligente con GPS, monitor de ritmo cardíaco y pagos sin contacto.',
    { pantalla: '1,4" AMOLED', bateria_dias: 7 }),
  producto('SKU-TEC-044', 'Banda inteligente Orion Fit 3', 'moviles', 'Orion', 199000, 0,
    'Banda de actividad con medición de sueño y 14 días de batería.',
    { bateria_dias: 14, resistencia: '5 ATM' }),

  // ---------------------------------------------------------------- redes
  producto('SKU-TEC-045', 'Router WiFi 6 Enlace AX3000', 'redes', 'Enlace', 459000, 0,
    'Router de doble banda WiFi 6 para hogares con muchos dispositivos.',
    { estandar: 'WiFi 6', velocidad: 'AX3000' }),
  producto('SKU-TEC-046', 'Sistema WiFi mesh Enlace Malla de 3 nodos', 'redes', 'Enlace', 1290000, 10,
    'Tres nodos mesh que cubren hasta 450 m² sin zonas muertas.',
    { nodos: 3, cobertura_m2: 450 }),
  producto('SKU-TEC-047', 'Repetidor WiFi Enlace Plus', 'redes', 'Enlace', 149000, 0,
    'Repetidor de doble banda que se conecta directo al tomacorriente.',
    { estandar: 'WiFi 5', velocidad: 'AC1200' }),
  producto('SKU-TEC-048', 'Switch Enlace de 8 puertos gigabit', 'redes', 'Enlace', 189000, 0,
    'Switch no administrable de 8 puertos gigabit en carcasa metálica.',
    { puertos: 8, velocidad: '1 Gbps' }),
  producto('SKU-TEC-049', 'Adaptador WiFi USB Enlace Nano', 'redes', 'Enlace', 79000, 0,
    'Adaptador WiFi USB de doble banda para computadores de escritorio.',
    { estandar: 'WiFi 5', interfaz: 'USB' }),
  producto('SKU-TEC-050', 'Cámara de seguridad WiFi Vigía 2K', 'redes', 'Vigía', 229000, 0,
    'Cámara de seguridad para interiores con visión nocturna y detección de movimiento.',
    { resolucion: '2K', vision_nocturna: true }),

  // --------------------------------------------------------------- gaming
  producto('SKU-TEC-009', 'Control inalámbrico Fénix', 'gaming', 'Fénix', 129000, 0,
    'Control inalámbrico para PC y celular con vibración y batería recargable.',
    { conectividad: 'Bluetooth y USB', bateria_horas: 20 }),
  producto('SKU-TEC-010', 'Silla gamer Fénix Pro', 'gaming', 'Fénix', 1450000, 8,
    'Silla ergonómica con soporte lumbar, reposabrazos 4D y reclinación de 165°.',
    { reclinacion: '165°', peso_max_kg: 150 }),
  producto('SKU-TEC-051', 'Consola portátil Fénix Go', 'gaming', 'Fénix', 2499000, 0,
    'Consola portátil para jugar tu biblioteca de PC en cualquier lugar.',
    { pantalla: '7" 120 Hz', almacenamiento: '512 GB' }),
  producto('SKU-TEC-052', 'Volante con pedales Fénix Racing', 'gaming', 'Fénix', 1190000, 0,
    'Volante con force feedback de 900° y pedalera de tres pedales.',
    { rotacion: '900°', force_feedback: true }),
  producto('SKU-TEC-053', 'Mousepad XL Fénix RGB', 'gaming', 'Fénix', 119000, 0,
    'Mousepad de escritorio de 90 x 40 cm con borde iluminado.',
    { medidas_cm: '90 x 40', iluminacion: 'RGB' }),
  producto('SKU-TEC-054', 'Gafas de realidad virtual Fénix VR', 'gaming', 'Fénix', 2290000, 10,
    'Gafas de realidad virtual independientes con controles de seguimiento.',
    { almacenamiento: '128 GB', resolucion_por_ojo: '1832x1920' }),

  // ----------------------------------------------------------- accesorios
  producto('SKU-TEC-055', 'Hub USB-C Nexo 7 en 1', 'accesorios', 'Nexo', 189000, 0,
    'Hub con HDMI 4K, lector de tarjetas, tres USB y carga de 100 W.',
    { puertos: 7, hdmi: '4K 60 Hz' }),
  producto('SKU-TEC-056', 'Cargador GaN Watt 65 W', 'accesorios', 'Watt', 169000, 10,
    'Cargador compacto de 65 W con dos USB-C y un USB-A para portátil y celular.',
    { potencia_w: 65, puertos: 3 }),
  producto('SKU-TEC-057', 'Batería externa Watt 20000 mAh', 'accesorios', 'Watt', 159000, 0,
    'Batería portátil con carga rápida de 22,5 W y pantalla de nivel.',
    { capacidad_mah: 20000, potencia_w: 22.5 }),
  producto('SKU-TEC-058', 'Base refrigerante Glaciar para portátil', 'accesorios', 'Glaciar', 119000, 0,
    'Base con cinco ventiladores y altura regulable para portátiles de hasta 17 pulgadas.',
    { ventiladores: 5, pulgadas_max: 17 }),
  producto('SKU-TEC-059', 'Maletín Ruta para portátil de 15,6 pulgadas', 'accesorios', 'Ruta', 199000, 0,
    'Maletín impermeable con compartimento acolchado y puerto USB.',
    { pulgadas_max: 15.6, material: 'Poliéster impermeable' }),
  producto('SKU-TEC-060', 'Cable HDMI 2.1 Enlace de 2 metros', 'accesorios', 'Enlace', 59000, 0,
    'Cable HDMI 2.1 trenzado compatible con 4K a 120 Hz y 8K.',
    { longitud_m: 2, version: 'HDMI 2.1' })
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
    clave: 'pedido.direccion_cambiada',
    canal: 'email',
    asunto: 'Cambiamos la dirección de envío de tu pedido {{numero}}',
    cuerpo: 'Hola {{nombre}}, tu pedido {{numero}} ahora se enviará a {{direccion}} {{restantes_texto}}',
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

print('MongoDB inicializado: catalogo_db (60 productos de tecnologia, 3 promociones) y notificaciones_db (6 plantillas).');
