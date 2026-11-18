-- ============================================================================
-- Datos de prueba.
-- La contrasena de todos los usuarios es: Password123
-- (hash bcrypt de 10 rondas, sustituido por el script de arranque)
-- ============================================================================

-- ---------------------------------------------------------------- auth_db ---
\connect auth_db

INSERT INTO usuarios (email, password_hash, rol, cliente_id) VALUES
  ('admin@tienda.co',    '$2b$10$c5O0M6SUxk0b1seT7/2H/.XN3RjZf/zRc4dE6c05UR48hh0uAPHj.', 'administrador', NULL),
  ('vendedor@tienda.co', '$2b$10$c5O0M6SUxk0b1seT7/2H/.XN3RjZf/zRc4dE6c05UR48hh0uAPHj.', 'vendedor',      NULL),
  ('ana@correo.co',      '$2b$10$c5O0M6SUxk0b1seT7/2H/.XN3RjZf/zRc4dE6c05UR48hh0uAPHj.', 'cliente',       1),
  ('bruno@correo.co',    '$2b$10$c5O0M6SUxk0b1seT7/2H/.XN3RjZf/zRc4dE6c05UR48hh0uAPHj.', 'cliente',       2),
  ('carla@correo.co',    '$2b$10$c5O0M6SUxk0b1seT7/2H/.XN3RjZf/zRc4dE6c05UR48hh0uAPHj.', 'cliente',       3);

-- ------------------------------------------------------------ clientes_db ---
\connect clientes_db

INSERT INTO clientes (nombre, apellido, email, telefono, documento, tipo_documento) VALUES
  ('Ana',   'Restrepo', 'ana@correo.co',   '3001112233', '1020304050', 'CC'),
  ('Bruno', 'Salazar',  'bruno@correo.co', '3004445566', '1020304051', 'CC'),
  ('Carla', 'Mendoza',  'carla@correo.co', '3007778899', '1020304052', 'CC');

INSERT INTO direcciones (cliente_id, tipo, etiqueta, linea1, ciudad, departamento, codigo_postal, predeterminada) VALUES
  (1, 'envio',       'Casa',    'Calle 10 # 43-21, Apto 502', 'Medellín', 'Antioquia',       '050021', TRUE),
  (1, 'facturacion', 'Casa',    'Calle 10 # 43-21, Apto 502', 'Medellín', 'Antioquia',       '050021', TRUE),
  (2, 'envio',       'Oficina', 'Carrera 7 # 71-52, Piso 8',  'Bogotá',   'Bogotá D.C.',     '110231', TRUE),
  (3, 'envio',       'Casa',    'Avenida 6N # 28-10',         'Cali',     'Valle del Cauca', '760045', TRUE);

-- ---------------------------------------------------------- inventario_db ---
\connect inventario_db

INSERT INTO bodegas (codigo, nombre, ciudad) VALUES
  ('BOG-01', 'Centro de distribucion Bogota',  'Bogota'),
  ('MED-01', 'Centro de distribucion Medellin','Medellin');

-- Proveedores de ejemplo (ficticios: nombres, NIT y contactos inventados).
INSERT INTO proveedores (nombre, nit, contacto, telefono, email) VALUES
  ('Distribuidora Andina de Tecnologia S.A.S.', '900123456-1', 'Laura Mejia',   '6015550101', 'compras@andinatec.example'),
  ('Importaciones Pacifico Digital S.A.S.',     '901234567-2', 'Andres Rojas',  '6025550202', 'ventas@pacificodigital.example'),
  ('Mayorista Cafetero de Computo Ltda.',       '800345678-3', 'Diana Osorio',  '6045550303', 'pedidos@cafeterocomputo.example');

-- El stock esta pensado para las pruebas del documento:
--   SKU-TEC-004 tiene UNA sola unidad: es el producto con el que se prueba la
--   condicion de carrera de la ultima unidad disponible.
--   SKU-TEC-007 esta por debajo del minimo: dispara la alerta de reposicion.
INSERT INTO stock (sku, bodega_id, cantidad_disponible, stock_minimo) VALUES
  ('SKU-TEC-001', 1, 50, 10),
  ('SKU-TEC-002', 1, 25,  5),
  ('SKU-TEC-003', 1, 12,  5),
  ('SKU-TEC-004', 1,  1,  2),
  ('SKU-TEC-005', 2, 30,  8),
  ('SKU-TEC-006', 1, 40, 10),
  ('SKU-TEC-007', 1,  3, 10),
  ('SKU-TEC-008', 2, 18,  5),
  ('SKU-TEC-009', 1, 60, 15),
  ('SKU-TEC-010', 2,  8,  5),
  ('SKU-TEC-011', 1, 14,  5),
  ('SKU-TEC-012', 2,  6,  5),
  ('SKU-TEC-013', 1, 20,  5),
  ('SKU-TEC-014', 1, 45,  5),
  ('SKU-TEC-015', 2, 16,  5),
  ('SKU-TEC-016', 1, 10,  5),
  ('SKU-TEC-017', 1, 28,  5),
  ('SKU-TEC-018', 2, 13,  5),
  ('SKU-TEC-019', 1, 24,  5),
  ('SKU-TEC-020', 1, 22,  5),
  ('SKU-TEC-021', 2, 15,  5),
  ('SKU-TEC-022', 1,  9,  5),
  ('SKU-TEC-023', 1, 30,  5),
  ('SKU-TEC-024', 2, 12,  5),
  ('SKU-TEC-025', 1,  7,  5),
  ('SKU-TEC-026', 1, 40,  5),
  ('SKU-TEC-027', 2, 18,  5),
  ('SKU-TEC-028', 1, 26,  5),
  ('SKU-TEC-029', 1, 11,  5),
  ('SKU-TEC-030', 2, 35,  5),
  ('SKU-TEC-031', 1, 14,  5),
  ('SKU-TEC-032', 1,  6,  5),
  ('SKU-TEC-033', 2, 20,  5),
  ('SKU-TEC-034', 1, 45,  5),
  ('SKU-TEC-035', 1, 16,  5),
  ('SKU-TEC-036', 2, 10,  5),
  ('SKU-TEC-037', 1, 28,  5),
  ('SKU-TEC-038', 1, 13,  5),
  ('SKU-TEC-039', 2, 24,  5),
  ('SKU-TEC-040', 1, 22,  5),
  ('SKU-TEC-041', 1, 15,  5),
  ('SKU-TEC-042', 2,  9,  5),
  ('SKU-TEC-043', 1, 30,  5),
  ('SKU-TEC-044', 1, 12,  5),
  ('SKU-TEC-045', 2,  7,  5),
  ('SKU-TEC-046', 1, 40,  5),
  ('SKU-TEC-047', 1, 18,  5),
  ('SKU-TEC-048', 2, 26,  5),
  ('SKU-TEC-049', 1, 11,  5),
  ('SKU-TEC-050', 1, 35,  5),
  ('SKU-TEC-051', 2, 14,  5),
  ('SKU-TEC-052', 1,  6,  5),
  ('SKU-TEC-053', 1, 20,  5),
  ('SKU-TEC-054', 2, 45,  5),
  ('SKU-TEC-055', 1, 16,  5),
  ('SKU-TEC-056', 1, 10,  5),
  ('SKU-TEC-057', 2, 28,  5),
  ('SKU-TEC-058', 1, 13,  5),
  ('SKU-TEC-059', 1, 24,  5),
  ('SKU-TEC-060', 2, 22,  5);

INSERT INTO movimientos (sku, bodega_id, tipo, cantidad, saldo_despues, referencia)
SELECT sku, bodega_id, 'entrada', cantidad_disponible, cantidad_disponible, 'carga-inicial'
  FROM stock;
