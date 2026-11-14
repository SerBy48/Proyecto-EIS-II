-- ============================================================================
-- pagos_db - Servicio de pagos (seccion 5.9)
--
-- Cumplimiento PCI-DSS: en esta base NUNCA se almacenan datos completos de
-- tarjeta. Solo se guarda la referencia tokenizada que devuelve la pasarela,
-- los ultimos cuatro digitos para que el cliente reconozca su medio de pago, y
-- la marca. No hay columnas para numero completo, CVV ni fecha de vencimiento,
-- deliberadamente: lo que no existe no se puede filtrar.
-- ============================================================================
\connect pagos_db

CREATE TABLE transacciones (
    id                  SERIAL PRIMARY KEY,
    referencia          VARCHAR(40) UNIQUE NOT NULL,
    pedido_id           INT NOT NULL,
    numero_pedido       VARCHAR(30),
    cliente_id          INT NOT NULL,
    monto               NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
    moneda              VARCHAR(3) NOT NULL DEFAULT 'COP',
    medio_pago          VARCHAR(20) NOT NULL
                        CHECK (medio_pago IN ('tarjeta_credito', 'tarjeta_debito', 'pse', 'efecty')),
    -- Referencia tokenizada de la pasarela. Nunca el dato real.
    token_medio_pago    VARCHAR(80),
    ultimos_cuatro      VARCHAR(4),
    marca               VARCHAR(20),
    estado              VARCHAR(15) NOT NULL DEFAULT 'iniciada'
                        CHECK (estado IN ('iniciada', 'aprobada', 'rechazada', 'reembolsada')),
    codigo_autorizacion VARCHAR(40),
    codigo_rechazo      VARCHAR(40),
    mensaje_pasarela    VARCHAR(200),
    clave_idempotencia  VARCHAR(80) UNIQUE NOT NULL,
    request_id          VARCHAR(64),
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resuelto_en         TIMESTAMPTZ
);

CREATE INDEX idx_transacciones_pedido  ON transacciones(pedido_id);
CREATE INDEX idx_transacciones_cliente ON transacciones(cliente_id, creado_en DESC);
CREATE INDEX idx_transacciones_estado  ON transacciones(estado);

CREATE TABLE reembolsos (
    id             SERIAL PRIMARY KEY,
    transaccion_id INT NOT NULL REFERENCES transacciones(id),
    monto          NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
    motivo         VARCHAR(200),
    estado         VARCHAR(15) NOT NULL DEFAULT 'procesado'
                   CHECK (estado IN ('procesado', 'fallido')),
    referencia_pasarela VARCHAR(40),
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reembolsos_transaccion ON reembolsos(transaccion_id);

-- ----------------------------------------------------------------------------
-- Auditoria de las llamadas a la pasarela externa.
-- Tabla de solo insercion: registro inmutable para conciliacion contable y
-- para investigar disputas. La carga util se guarda ya enmascarada.
-- ----------------------------------------------------------------------------
CREATE TABLE auditoria_pasarela (
    id             BIGSERIAL PRIMARY KEY,
    transaccion_id INT,
    operacion      VARCHAR(30) NOT NULL,
    exitoso        BOOLEAN NOT NULL,
    codigo_respuesta VARCHAR(20),
    latencia_ms    INT,
    carga_enmascarada JSONB,
    request_id     VARCHAR(64),
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auditoria_transaccion ON auditoria_pasarela(transaccion_id, creado_en);

GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public TO pagos_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pagos_user;
