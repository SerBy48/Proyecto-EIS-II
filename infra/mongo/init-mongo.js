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

// SerByTek es una tienda de demostracion exclusivamente de tecnologia, con
// marcas y productos reales y precios de referencia: una categoria y diez
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
  // Foto ilustrativa de la seccion (Unsplash, ver clients/web/public/productos/CREDITOS.md).
  imagenes: [`/productos/${subcategoria}.webp`],
  atributos,
  activo: true,
  creado_en: new Date(ahora.getTime() - 60000 * orden++)
});

catalogo.productos.insertMany([
  // --------------------------------------------------------- computadores
  producto('SKU-TEC-001', 'Portátil Lenovo IdeaPad Slim 5 14"', 'computadores', 'Lenovo', 3499000, 10,
    'Portátil ultraligero de 14 pulgadas con pantalla OLED, ideal para trabajo y estudio.',
    { procesador: 'AMD Ryzen 7 8845HS', ram_gb: 16, almacenamiento: '512 GB SSD', pantalla: '14" OLED' }),
  producto('SKU-TEC-011', 'Portátil gamer ASUS TUF Gaming F16 RTX 4060', 'computadores', 'ASUS', 6299000, 5,
    'Portátil para juegos con gráfica GeForce RTX 4060, pantalla de 165 Hz y teclado RGB.',
    { procesador: 'Intel Core i7-13650HX', ram_gb: 16, almacenamiento: '1 TB SSD', grafica: 'RTX 4060 8 GB', pantalla: '16" 165 Hz' }),
  producto('SKU-TEC-012', 'Portátil Acer Aspire 3 15,6"', 'computadores', 'Acer', 1899000, 0,
    'Portátil liviano y económico para clases virtuales, ofimática y navegación.',
    { procesador: 'Intel Core i3-N305', ram_gb: 8, almacenamiento: '256 GB SSD', pantalla: '15,6"' }),
  producto('SKU-TEC-013', 'Computador de escritorio HP Pro Tower 290 G9', 'computadores', 'HP', 2799000, 0,
    'Torre de escritorio lista para trabajar, con WiFi y espacio para ampliar.',
    { procesador: 'Intel Core i5-13500', ram_gb: 16, almacenamiento: '1 TB SSD' }),
  producto('SKU-TEC-014', 'Todo en uno Lenovo IdeaCentre AIO 3 24"', 'computadores', 'Lenovo', 3199000, 8,
    'Computador todo en uno con pantalla Full HD de 24 pulgadas y cámara emergente.',
    { procesador: 'Intel Core i5-13420H', ram_gb: 16, almacenamiento: '512 GB SSD', pantalla: '24"' }),
  producto('SKU-TEC-015', 'Mini PC Beelink Mini S12 Pro N100', 'computadores', 'Beelink', 1149000, 0,
    'Computador compacto y silencioso que cabe detrás del monitor.',
    { procesador: 'Intel N100', ram_gb: 16, almacenamiento: '500 GB SSD' }),

  // ---------------------------------------------------------- componentes
  producto('SKU-TEC-016', 'Procesador AMD Ryzen 7 7700X', 'componentes', 'AMD', 1499000, 0,
    'Procesador de 8 núcleos y 16 hilos para juegos y creación de contenido.',
    { nucleos: 8, hilos: 16, frecuencia_ghz: 5.4, socket: 'AM5' }),
  producto('SKU-TEC-017', 'Tarjeta gráfica ASUS Dual GeForce RTX 4070 12 GB', 'componentes', 'ASUS', 3299000, 7,
    'Tarjeta gráfica para jugar en 1440p con trazado de rayos y DLSS 3.',
    { memoria: '12 GB GDDR6X', conectores: 'HDMI 2.1, 3x DisplayPort' }),
  producto('SKU-TEC-018', 'Memoria RAM Kingston FURY Beast DDR5 32 GB', 'componentes', 'Kingston', 529000, 0,
    'Kit de dos módulos de 16 GB DDR5 a 6000 MHz con disipador.',
    { capacidad: '2 x 16 GB', tipo: 'DDR5', velocidad_mhz: 6000 }),
  producto('SKU-TEC-019', 'Placa base MSI B650 Gaming Plus WiFi', 'componentes', 'MSI', 899000, 0,
    'Placa base ATX para AM5 con WiFi 6E, dos ranuras M.2 y soporte para DDR5.',
    { socket: 'AM5', formato: 'ATX', wifi: 'WiFi 6E' }),
  producto('SKU-TEC-020', 'Fuente de poder Corsair RM750e 750 W 80 Plus Gold', 'componentes', 'Corsair', 459000, 0,
    'Fuente modular de 750 W con certificación 80 Plus Gold.',
    { potencia_w: 750, certificacion: '80 Plus Gold', modular: true }),
  producto('SKU-TEC-021', 'Gabinete NZXT H5 Flow', 'componentes', 'NZXT', 349000, 10,
    'Gabinete media torre con panel frontal perforado y vidrio templado.',
    { formato: 'Media torre ATX', ventiladores: 2 }),

  // ------------------------------------------------------- almacenamiento
  // SKU-TEC-007: stock por debajo del minimo, dispara la alerta de reposicion.
  producto('SKU-TEC-007', 'Disco SSD externo Samsung T7 1 TB', 'almacenamiento', 'Samsung', 289000, 20,
    'SSD portátil USB-C de 1 TB con lectura de hasta 1050 MB/s.',
    { capacidad: '1 TB', interfaz: 'USB-C 3.2', lectura_mb_s: 1050 }),
  producto('SKU-TEC-022', 'SSD NVMe WD Black SN770 1 TB', 'almacenamiento', 'WD', 389000, 0,
    'Unidad M.2 NVMe PCIe 4.0 de 1 TB para arranque rápido y juegos.',
    { capacidad: '1 TB', interfaz: 'PCIe 4.0 x4', lectura_mb_s: 5150 }),
  producto('SKU-TEC-023', 'Disco duro Seagate BarraCuda 2 TB', 'almacenamiento', 'Seagate', 299000, 0,
    'Disco duro interno de 3,5 pulgadas y 7200 rpm para respaldos.',
    { capacidad: '2 TB', rpm: 7200 }),
  producto('SKU-TEC-024', 'Memoria USB SanDisk Ultra Flair 128 GB', 'almacenamiento', 'SanDisk', 59000, 0,
    'Memoria USB 3.0 metálica con llavero.',
    { capacidad: '128 GB', interfaz: 'USB 3.0' }),
  producto('SKU-TEC-025', 'Tarjeta microSD Samsung EVO Plus 256 GB', 'almacenamiento', 'Samsung', 99000, 10,
    'Tarjeta microSD A2 para celulares, cámaras y consolas portátiles.',
    { capacidad: '256 GB', clase: 'A2 U3' }),
  producto('SKU-TEC-026', 'Servidor NAS Synology DiskStation DS223j', 'almacenamiento', 'Synology', 1290000, 0,
    'Almacenamiento en red de 2 bahías para la casa o la oficina, con copias automáticas.',
    { bahias: 2, red: '1 GbE' }),

  // ---------------------------------------------------------- perifericos
  // SKU-TEC-004: UNA sola unidad, para la prueba de la ultima unidad disponible.
  producto('SKU-TEC-004', 'Teclado mecánico Keychron Q1 Max edición limitada', 'perifericos', 'Keychron', 789000, 0,
    'Edición limitada en aluminio, inalámbrico y con switches táctiles. Última unidad.',
    { switches: 'Gateron Jupiter Brown', layout: 'ANSI 75%', material: 'Aluminio' }),
  producto('SKU-TEC-005', 'Cámara web Logitech C920s Full HD', 'perifericos', 'Logitech', 219000, 5,
    'Cámara web Full HD con micrófono estéreo y tapa de privacidad.',
    { resolucion: '1080p', fps: 30 }),
  producto('SKU-TEC-006', 'Mouse inalámbrico Logitech MX Master 3S', 'perifericos', 'Logitech', 329000, 0,
    'Mouse ergonómico inalámbrico con clics silenciosos, rueda MagSpeed y tres equipos emparejados.',
    { conectividad: 'Bluetooth y receptor USB', dpi: 8000, bateria_dias: 70 }),
  producto('SKU-TEC-027', 'Teclado inalámbrico Logitech Pebble Keys 2 K380s', 'perifericos', 'Logitech', 189000, 0,
    'Teclado delgado y silencioso para tres dispositivos.',
    { distribucion: 'Español', conectividad: 'Bluetooth' }),
  producto('SKU-TEC-028', 'Mouse gamer Razer DeathAdder V3 Pro', 'perifericos', 'Razer', 599000, 15,
    'Mouse inalámbrico para esports de 63 gramos con sensor de 30000 DPI.',
    { dpi: 30000, peso_g: 63 }),
  producto('SKU-TEC-029', 'Micrófono USB HyperX SoloCast', 'perifericos', 'HyperX', 249000, 0,
    'Micrófono de condensador USB para streaming, pódcast y reuniones.',
    { patron: 'Cardioide', conexion: 'USB-C' }),

  // ------------------------------------------------------------ monitores
  producto('SKU-TEC-003', 'Monitor Samsung Odyssey G5 27" QHD', 'monitores', 'Samsung', 1290000, 15,
    'Monitor curvo de 27 pulgadas con resolución QHD y 165 Hz.',
    { pulgadas: 27, resolucion: '2560x1440', hz: 165 }),
  producto('SKU-TEC-030', 'Monitor LG 24MS500 24" Full HD', 'monitores', 'LG', 599000, 0,
    'Monitor IPS de 24 pulgadas para oficina, con bordes delgados.',
    { pulgadas: 24, resolucion: '1920x1080', hz: 100 }),
  producto('SKU-TEC-031', 'Monitor curvo LG UltraWide 34WQ60C 34"', 'monitores', 'LG', 2190000, 10,
    'Monitor curvo de 34 pulgadas 21:9 para productividad y simuladores.',
    { pulgadas: 34, resolucion: '3440x1440', hz: 60 }),
  producto('SKU-TEC-032', 'Monitor gamer ASUS TUF VG279QM 27" 280 Hz', 'monitores', 'ASUS', 1990000, 0,
    'Monitor para esports con 280 Hz y 1 ms de respuesta.',
    { pulgadas: 27, resolucion: '1920x1080', hz: 280 }),
  producto('SKU-TEC-033', 'Monitor portátil ASUS ZenScreen MB166CR 15,6"', 'monitores', 'ASUS', 1190000, 0,
    'Segunda pantalla portátil USB-C con funda que sirve de soporte.',
    { pulgadas: 15.6, conexion: 'USB-C' }),
  producto('SKU-TEC-034', 'Brazo doble para monitor North Bayou F160', 'monitores', 'North Bayou', 229000, 0,
    'Soporte de escritorio con resorte de gas para dos monitores de hasta 30 pulgadas.',
    { monitores: 2, pulgadas_max: 30 }),

  // ---------------------------------------------------------------- audio
  producto('SKU-TEC-002', 'Audífonos Sony WH-1000XM5 con cancelación de ruido', 'audio', 'Sony', 1499000, 0,
    'Audífonos inalámbricos con cancelación activa de ruido y 30 horas de batería.',
    { conectividad: 'Bluetooth 5.2', bateria_horas: 30, color: 'Negro' }),
  producto('SKU-TEC-008', 'Barra de sonido Samsung HW-Q600C 3.1.2', 'audio', 'Samsung', 1890000, 12,
    'Barra de sonido 3.1.2 con subwoofer inalámbrico y Dolby Atmos.',
    { canales: '3.1.2', potencia_w: 360 }),
  producto('SKU-TEC-035', 'Audífonos inalámbricos Samsung Galaxy Buds FE', 'audio', 'Samsung', 299000, 10,
    'Audífonos de botón con cancelación de ruido y estuche de carga.',
    { conectividad: 'Bluetooth 5.2', bateria_horas: 21 }),
  producto('SKU-TEC-036', 'Diadema gamer HyperX Cloud III', 'audio', 'HyperX', 399000, 0,
    'Diadema con sonido espacial y micrófono desmontable.',
    { sonido: 'DTS Headphone:X', conexion: 'USB y 3,5 mm' }),
  producto('SKU-TEC-037', 'Parlante Bluetooth JBL Flip 6', 'audio', 'JBL', 499000, 0,
    'Parlante portátil resistente al agua y al polvo con 12 horas de batería.',
    { potencia_w: 30, proteccion: 'IP67' }),
  producto('SKU-TEC-038', 'Audífonos de estudio Audio-Technica ATH-M50x', 'audio', 'Audio-Technica', 649000, 0,
    'Audífonos cerrados de monitoreo para producción musical.',
    { impedancia_ohm: 38, cable: 'Desmontable' }),

  // --------------------------------------------- celulares, tablets y relojes
  producto('SKU-TEC-039', 'Celular Samsung Galaxy S24 256 GB', 'moviles', 'Samsung', 3799000, 5,
    'Celular 5G con pantalla de 6,2 pulgadas y triple cámara de 50 MP.',
    { almacenamiento: '256 GB', ram_gb: 8, pantalla: '6,2" AMOLED' }),
  producto('SKU-TEC-040', 'Celular Xiaomi Redmi Note 13 128 GB', 'moviles', 'Xiaomi', 899000, 0,
    'Celular de gama media con pantalla AMOLED de 120 Hz y carga rápida.',
    { almacenamiento: '128 GB', ram_gb: 6, bateria_mah: 5000 }),
  producto('SKU-TEC-041', 'Tablet Samsung Galaxy Tab S9 FE', 'moviles', 'Samsung', 1599000, 10,
    'Tablet de 10,9 pulgadas con lápiz S Pen incluido, ideal para tomar notas.',
    { pantalla: '10,9"', almacenamiento: '128 GB' }),
  producto('SKU-TEC-042', 'Tablet Lenovo Tab M8', 'moviles', 'Lenovo', 549000, 0,
    'Tablet de 8 pulgadas para toda la familia, con control parental.',
    { pantalla: '8"', almacenamiento: '32 GB' }),
  producto('SKU-TEC-043', 'Reloj inteligente Samsung Galaxy Watch6 40 mm', 'moviles', 'Samsung', 899000, 0,
    'Reloj inteligente con GPS, monitor de ritmo cardíaco y pagos sin contacto.',
    { pantalla: '1,3" AMOLED', bateria_horas: 40 }),
  producto('SKU-TEC-044', 'Banda inteligente Xiaomi Smart Band 8', 'moviles', 'Xiaomi', 199000, 0,
    'Banda de actividad con medición de sueño y 16 días de batería.',
    { bateria_dias: 16, resistencia: '5 ATM' }),

  // ---------------------------------------------------------------- redes
  producto('SKU-TEC-045', 'Router WiFi 6 TP-Link Archer AX55 AX3000', 'redes', 'TP-Link', 459000, 0,
    'Router de doble banda WiFi 6 para hogares con muchos dispositivos.',
    { estandar: 'WiFi 6', velocidad: 'AX3000' }),
  producto('SKU-TEC-046', 'Sistema WiFi mesh TP-Link Deco X20 (3 unidades)', 'redes', 'TP-Link', 1290000, 10,
    'Tres nodos mesh WiFi 6 que cubren toda la casa sin zonas muertas.',
    { nodos: 3, cobertura_m2: 550 }),
  producto('SKU-TEC-047', 'Repetidor WiFi TP-Link RE315', 'redes', 'TP-Link', 149000, 0,
    'Repetidor de doble banda que se conecta directo al tomacorriente.',
    { estandar: 'WiFi 5', velocidad: 'AC1200' }),
  producto('SKU-TEC-048', 'Switch TP-Link TL-SG108 de 8 puertos gigabit', 'redes', 'TP-Link', 119000, 0,
    'Switch no administrable de 8 puertos gigabit en carcasa metálica.',
    { puertos: 8, velocidad: '1 Gbps' }),
  producto('SKU-TEC-049', 'Adaptador WiFi USB TP-Link Archer T3U Nano', 'redes', 'TP-Link', 79000, 0,
    'Adaptador WiFi USB de doble banda para computadores de escritorio.',
    { estandar: 'WiFi 5', interfaz: 'USB' }),
  producto('SKU-TEC-050', 'Cámara de seguridad WiFi Xiaomi Smart Camera C300', 'redes', 'Xiaomi', 229000, 0,
    'Cámara de seguridad para interiores con visión nocturna y detección de personas.',
    { resolucion: '2K', vision_nocturna: true }),

  // --------------------------------------------------------------- gaming
  producto('SKU-TEC-009', 'Control inalámbrico Xbox', 'gaming', 'Microsoft', 289000, 0,
    'Control inalámbrico para Xbox, PC y celular, con vibración y texturas de agarre.',
    { conectividad: 'Bluetooth y USB-C', bateria: '2 pilas AA' }),
  producto('SKU-TEC-010', 'Silla gamer Corsair TC100 Relaxed', 'gaming', 'Corsair', 1450000, 8,
    'Silla ergonómica con cojín lumbar, reposabrazos ajustables y reclinación de 160°.',
    { reclinacion: '160°', peso_max_kg: 120 }),
  producto('SKU-TEC-051', 'Consola portátil Steam Deck OLED 512 GB', 'gaming', 'Valve', 3299000, 0,
    'Consola portátil para jugar tu biblioteca de Steam en cualquier lugar.',
    { pantalla: '7,4" OLED 90 Hz', almacenamiento: '512 GB' }),
  producto('SKU-TEC-052', 'Volante Logitech G29 con pedales', 'gaming', 'Logitech', 1190000, 0,
    'Volante con force feedback de 900° y pedalera de tres pedales para PC y PlayStation.',
    { rotacion: '900°', force_feedback: true }),
  producto('SKU-TEC-053', 'Mousepad Razer Goliathus Extended Chroma', 'gaming', 'Razer', 249000, 0,
    'Mousepad de escritorio de 92 x 29 cm con borde iluminado.',
    { medidas_cm: '92 x 29', iluminacion: 'RGB' }),
  producto('SKU-TEC-054', 'Gafas de realidad virtual Meta Quest 3S 128 GB', 'gaming', 'Meta', 2290000, 10,
    'Gafas de realidad mixta independientes con controles de seguimiento.',
    { almacenamiento: '128 GB' }),

  // ----------------------------------------------------------- accesorios
  producto('SKU-TEC-055', 'Hub USB-C UGREEN 7 en 1', 'accesorios', 'UGREEN', 189000, 0,
    'Hub con HDMI 4K, lector de tarjetas, tres USB y carga de 100 W.',
    { puertos: 7, hdmi: '4K 60 Hz' }),
  producto('SKU-TEC-056', 'Cargador Anker Nano 65 W GaN', 'accesorios', 'Anker', 169000, 10,
    'Cargador compacto de 65 W con dos USB-C y un USB-A para portátil y celular.',
    { potencia_w: 65, puertos: 3 }),
  producto('SKU-TEC-057', 'Batería externa Anker PowerCore 20000 mAh', 'accesorios', 'Anker', 159000, 0,
    'Batería portátil con carga rápida y dos puertos.',
    { capacidad_mah: 20000, potencia_w: 20 }),
  producto('SKU-TEC-058', 'Base refrigerante Cooler Master NotePal X3', 'accesorios', 'Cooler Master', 119000, 0,
    'Base con ventilador de 200 mm y altura regulable para portátiles de hasta 17 pulgadas.',
    { ventiladores: 1, pulgadas_max: 17 }),
  producto('SKU-TEC-059', 'Mochila Targus para portátil de 15,6"', 'accesorios', 'Targus', 199000, 0,
    'Mochila con compartimento acolchado, resistente al agua.',
    { pulgadas_max: 15.6, material: 'Poliéster' }),
  producto('SKU-TEC-060', 'Cable HDMI 2.1 UGREEN de 2 metros', 'accesorios', 'UGREEN', 59000, 0,
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
