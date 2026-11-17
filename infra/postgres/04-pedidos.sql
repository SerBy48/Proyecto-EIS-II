-- ============================================================================
-- pedidos_db - Servicio de pedidos (seccion 5.8)
-- El orquestador de la compra. Es el unico propietario del dato del pedido.
-- ============================================================================
\connect pedidos_db

CREATE TABLE pedidos (
    id              SERIAL PRIMARY KEY,
    numero          VARCHAR(30) UNIQUE NOT NULL,
    -- Referencias por identificador a agregados de otros servicios.
    cliente_id      INT NOT NULL,
    direccion_envio JSONB NOT NULL,
    estado          VARCHAR(20) NOT NULL DEFAULT 'creado'
                    CHECK (estado IN ('creado', 'pagado', 'en_preparacion',
                                      'enviado', 'entregado', 'cancelado')),
    subtotal        NUMERIC(12, 2) NOT NULL DEFAULT 0,
    impuestos       NUMERIC(12, 2) NOT NULL DEFAULT 0,
    envio           NUMERIC(12, 2) NOT NULL DEFAULT 0,
    descuento       NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total           NUMERIC(12, 2) NOT NULL DEFAULT 0,
    -- Clave de idempotencia del checkout: impide que un doble clic o un
    -- reintento del cliente generen dos pedidos identicos.
    clave_idempotencia VARCHAR(80) UNIQUE NOT NULL,
    transaccion_pago_id VARCHAR(40),
    motivo_cancelacion  VARCHAR(200),
    -- Veces que el cliente cambio la direccion despues de comprar (maximo 2,
    -- antes de que el pedido salga). El CHECK es la ultima defensa del limite.
    cambios_direccion SMALLINT NOT NULL DEFAULT 0
                      CHECK (cambios_direccion BETWEEN 0 AND 2),
    request_id      VARCHAR(64),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pedidos_cliente ON pedidos(cliente_id, creado_en DESC);
CREATE INDEX idx_pedidos_estado  ON pedidos(estado);
CREATE INDEX idx_pedidos_numero  ON pedidos(numero);

CREATE TABLE pedido_items (
    id             SERIAL PRIMARY KEY,
    pedido_id      INT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    sku            VARCHAR(40) NOT NULL,
    nombre         VARCHAR(200) NOT NULL,
    cantidad       INT NOT NULL CHECK (cantidad > 0),
    -- El precio se congela al momento de la compra: si el catalogo cambia el
    -- precio manana, el pedido de hoy conserva el que el cliente acepto.
    precio_unitario NUMERIC(12, 2) NOT NULL CHECK (precio_unitario >= 0),
    subtotal       NUMERIC(12, 2) NOT NULL,
    -- Identificador de la reserva en el servicio de inventario, necesario para
    -- confirmarla o compensarla.
    reserva_id     UUID
);

CREATE INDEX idx_items_pedido ON pedido_items(pedido_id);

-- ----------------------------------------------------------------------------
-- Historial de estados: cada transicion queda registrada. Permite auditar el
-- ciclo de vida y reconstruir que paso en una compra concreta.
-- ----------------------------------------------------------------------------
CREATE TABLE historial_estados (
    id           BIGSERIAL PRIMARY KEY,
    pedido_id    INT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    estado_anterior VARCHAR(20),
    estado_nuevo VARCHAR(20) NOT NULL,
    motivo       VARCHAR(200),
    request_id   VARCHAR(64),
    creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_historial_pedido ON historial_estados(pedido_id, creado_en);

-- ----------------------------------------------------------------------------
-- Bitacora de la saga.
--
-- El checkout es una transaccion distribuida que abarca cuatro servicios y no
-- puede resolverse con un COMMIT. Cada paso se registra aqui con su estado, de
-- modo que si el proceso se interrumpe a mitad de camino se sabe exactamente
-- que pasos hay que compensar.
-- ----------------------------------------------------------------------------
CREATE TABLE saga_pasos (
    id          BIGSERIAL PRIMARY KEY,
    pedido_id   INT REFERENCES pedidos(id) ON DELETE CASCADE,
    clave_idempotencia VARCHAR(80) NOT NULL,
    paso        VARCHAR(40) NOT NULL,
    estado      VARCHAR(15) NOT NULL
                CHECK (estado IN ('iniciado', 'completado', 'fallido', 'compensado')),
    detalle     JSONB,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saga_clave  ON saga_pasos(clave_idempotencia, creado_en);
CREATE INDEX idx_saga_pedido ON saga_pasos(pedido_id);

-- Secuencia para el numero de pedido visible al cliente.
CREATE SEQUENCE seq_numero_pedido START 1000;

CREATE OR REPLACE FUNCTION generar_numero_pedido()
RETURNS VARCHAR
LANGUAGE sql
AS $$
    SELECT 'PED-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(nextval('seq_numero_pedido')::TEXT, 6, '0');
$$;

-- Registra automaticamente cada cambio de estado en el historial.
CREATE OR REPLACE FUNCTION fn_registrar_cambio_estado()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.estado IS DISTINCT FROM OLD.estado THEN
        INSERT INTO historial_estados (pedido_id, estado_anterior, estado_nuevo, motivo, request_id)
        VALUES (NEW.id, OLD.estado, NEW.estado, NEW.motivo_cancelacion, NEW.request_id);
    END IF;
    NEW.actualizado_en := NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cambio_estado
    BEFORE UPDATE ON pedidos
    FOR EACH ROW
    EXECUTE FUNCTION fn_registrar_cambio_estado();

GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public TO pedidos_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pedidos_user;
GRANT EXECUTE ON ALL FUNCTIONS        IN SCHEMA public TO pedidos_user;
