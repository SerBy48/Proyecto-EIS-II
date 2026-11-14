-- ============================================================================
-- clientes_db - Servicio de clientes (seccion 5.4)
-- Datos personales, direcciones de envio y facturacion.
-- ============================================================================
\connect clientes_db

CREATE TABLE clientes (
    id            SERIAL PRIMARY KEY,
    nombre        VARCHAR(100) NOT NULL,
    apellido      VARCHAR(100) NOT NULL,
    email         VARCHAR(150) UNIQUE NOT NULL,
    telefono      VARCHAR(30),
    documento     VARCHAR(30) UNIQUE,
    tipo_documento VARCHAR(10) DEFAULT 'CC'
                   CHECK (tipo_documento IN ('CC', 'CE', 'NIT', 'PAS')),
    activo        BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clientes_email     ON clientes(email);
CREATE INDEX idx_clientes_documento ON clientes(documento);

CREATE TABLE direcciones (
    id           SERIAL PRIMARY KEY,
    cliente_id   INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    tipo         VARCHAR(15) NOT NULL DEFAULT 'envio'
                 CHECK (tipo IN ('envio', 'facturacion')),
    etiqueta     VARCHAR(50),
    linea1       VARCHAR(200) NOT NULL,
    linea2       VARCHAR(200),
    ciudad       VARCHAR(100) NOT NULL,
    departamento VARCHAR(100),
    pais         VARCHAR(60) NOT NULL DEFAULT 'Colombia',
    codigo_postal VARCHAR(20),
    predeterminada BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_direcciones_cliente ON direcciones(cliente_id);

-- Solo una direccion predeterminada por cliente y por tipo.
CREATE UNIQUE INDEX idx_direccion_predeterminada
    ON direcciones(cliente_id, tipo)
    WHERE predeterminada;

-- Proyeccion de solo lectura del historial de compras, alimentada por los
-- eventos "pedido.confirmado" del servicio de pedidos. El servicio de clientes
-- NO consulta la base de pedidos: recibe el hecho de negocio por el broker.
-- Es un ejemplo de consistencia eventual aceptable.
CREATE TABLE historial_compras (
    id           BIGSERIAL PRIMARY KEY,
    cliente_id   INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    pedido_id    INT NOT NULL,
    numero_pedido VARCHAR(30) NOT NULL,
    total        NUMERIC(12, 2) NOT NULL,
    estado       VARCHAR(20) NOT NULL,
    items        INT NOT NULL DEFAULT 0,
    fecha        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (pedido_id)
);

CREATE INDEX idx_historial_cliente ON historial_compras(cliente_id, fecha DESC);

GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public TO clientes_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO clientes_user;
