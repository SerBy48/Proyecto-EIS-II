-- ============================================================================
-- Creacion de una base de datos por servicio (seccion 5.11 del documento).
--
-- El principio aplicado es "base de datos por servicio": cada microservicio es
-- el unico propietario de sus datos. Aqui se materializa como bases de datos
-- separadas dentro de la misma instancia de PostgreSQL, cada una con su propio
-- usuario y sin permisos cruzados: ningun servicio puede leer las tablas de
-- otro ni siquiera por error.
--
-- En produccion cada una de estas bases viviria en su propia instancia.
-- ============================================================================

-- Autenticacion: usuarios, credenciales, roles, tokens de renovacion
CREATE USER auth_user     WITH PASSWORD 'auth_pass';
CREATE DATABASE auth_db       OWNER auth_user;

-- Clientes: datos personales, direcciones
CREATE USER clientes_user WITH PASSWORD 'clientes_pass';
CREATE DATABASE clientes_db   OWNER clientes_user;

-- Inventario: stock por bodega, reservas, movimientos
CREATE USER inventario_user WITH PASSWORD 'inventario_pass';
CREATE DATABASE inventario_db OWNER inventario_user;

-- Pedidos: pedidos, items, historial de estados
CREATE USER pedidos_user  WITH PASSWORD 'pedidos_pass';
CREATE DATABASE pedidos_db    OWNER pedidos_user;

-- Pagos: transacciones con referencias tokenizadas (nunca datos de tarjeta)
CREATE USER pagos_user    WITH PASSWORD 'pagos_pass';
CREATE DATABASE pagos_db      OWNER pagos_user;

-- Se revoca el acceso publico para que un servicio no pueda conectarse a la
-- base de otro aunque conozca el nombre.
REVOKE ALL ON DATABASE auth_db       FROM PUBLIC;
REVOKE ALL ON DATABASE clientes_db   FROM PUBLIC;
REVOKE ALL ON DATABASE inventario_db FROM PUBLIC;
REVOKE ALL ON DATABASE pedidos_db    FROM PUBLIC;
REVOKE ALL ON DATABASE pagos_db      FROM PUBLIC;
