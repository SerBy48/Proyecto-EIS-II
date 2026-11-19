-- ============================================================================
-- inventario_db - Servicio de inventario (seccion 5.6)
--
-- Esta es la base de datos critica del sistema: es donde se resuelve la
-- condicion de carrera de la pregunta 5 del analisis ("que dos clientes no
-- compren simultaneamente la ultima unidad disponible").
--
-- Mecanismos implementados, todos los que enumera el documento:
--   1. Operacion atomica: descuento condicional dentro de una transaccion.
--   2. Bloqueo optimista: columna version en la tabla de stock.
--   3. Reserva temporal: las reservas expiran y devuelven el stock.
--   4. Serializacion por producto: bloqueo de advertencia por SKU.
--   5. Idempotencia: clave unica por intento de compra.
-- ============================================================================
\connect inventario_db

CREATE TABLE bodegas (
    id        SERIAL PRIMARY KEY,
    codigo    VARCHAR(20) UNIQUE NOT NULL,
    nombre    VARCHAR(100) NOT NULL,
    ciudad    VARCHAR(100),
    activa    BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Stock por producto y bodega.
--
-- Se separan explicitamente las unidades disponibles de las reservadas:
--   cantidad_disponible = unidades que se pueden vender ahora mismo
--   cantidad_reservada  = unidades comprometidas en compras en curso
--
-- Una reserva mueve unidades de disponible a reservada; la confirmacion del
-- pago descuenta de reservada; la liberacion las devuelve a disponible. El
-- CHECK >= 0 es la ultima linea de defensa: si algun camino de codigo
-- intentara dejar el stock negativo, la base de datos aborta la transaccion.
-- ----------------------------------------------------------------------------
CREATE TABLE stock (
    id                  SERIAL PRIMARY KEY,
    sku                 VARCHAR(40) NOT NULL,
    bodega_id           INT NOT NULL REFERENCES bodegas(id),
    cantidad_disponible INT NOT NULL DEFAULT 0 CHECK (cantidad_disponible >= 0),
    cantidad_reservada  INT NOT NULL DEFAULT 0 CHECK (cantidad_reservada  >= 0),
    stock_minimo        INT NOT NULL DEFAULT 5,
    -- Bloqueo optimista: se incrementa en cada escritura. Si dos transacciones
    -- leyeron la misma version, solo una podra escribir con esa version.
    version             INT NOT NULL DEFAULT 1,
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (sku, bodega_id)
);

CREATE INDEX idx_stock_sku ON stock(sku);
-- Indice parcial para la consulta mas frecuente: productos con existencias.
CREATE INDEX idx_stock_disponible ON stock(sku) WHERE cantidad_disponible > 0;

-- ----------------------------------------------------------------------------
-- Reservas temporales.
--
-- clave_idempotencia es UNIQUE: si el servicio de pedidos reintenta la misma
-- solicitud (por un timeout de red, por ejemplo), el segundo intento choca con
-- la restriccion y el servicio devuelve la reserva que ya existia en lugar de
-- descontar stock dos veces.
-- ----------------------------------------------------------------------------
CREATE TABLE reservas (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku                 VARCHAR(40) NOT NULL,
    bodega_id           INT NOT NULL REFERENCES bodegas(id),
    cantidad            INT NOT NULL CHECK (cantidad > 0),
    pedido_id           VARCHAR(40),
    clave_idempotencia  VARCHAR(80) UNIQUE NOT NULL,
    estado              VARCHAR(15) NOT NULL DEFAULT 'activa'
                        CHECK (estado IN ('activa', 'confirmada', 'liberada', 'expirada')),
    expira_en           TIMESTAMPTZ NOT NULL,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cerrado_en          TIMESTAMPTZ
);

CREATE INDEX idx_reservas_estado  ON reservas(estado, expira_en);
CREATE INDEX idx_reservas_pedido  ON reservas(pedido_id);
CREATE INDEX idx_reservas_sku     ON reservas(sku);

-- ----------------------------------------------------------------------------
-- Libro de movimientos: trazabilidad completa de entradas y salidas.
-- Tabla de solo insercion; nunca se actualiza ni se borra.
-- ----------------------------------------------------------------------------
CREATE TABLE movimientos (
    id          BIGSERIAL PRIMARY KEY,
    sku         VARCHAR(40) NOT NULL,
    bodega_id   INT NOT NULL REFERENCES bodegas(id),
    tipo        VARCHAR(15) NOT NULL
                CHECK (tipo IN ('entrada', 'salida', 'reserva', 'liberacion', 'ajuste')),
    cantidad    INT NOT NULL,
    saldo_despues INT NOT NULL,
    referencia  VARCHAR(80),
    request_id  VARCHAR(64),
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_movimientos_sku ON movimientos(sku, creado_en DESC);

-- ----------------------------------------------------------------------------
-- Proveedores y entradas de mercancia (RF-51).
-- La entrada amplia el movimiento con lo que pide la recepcion en bodega:
-- quien la trajo, a que costo y con que factura o remision. El movimiento
-- sigue siendo el libro de stock; la entrada es su soporte documental.
-- ----------------------------------------------------------------------------
CREATE TABLE proveedores (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(120) NOT NULL,
    nit         VARCHAR(20)  NOT NULL UNIQUE,
    contacto    VARCHAR(120),
    telefono    VARCHAR(20),
    email       VARCHAR(160),
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE entradas (
    id             BIGSERIAL PRIMARY KEY,
    movimiento_id  BIGINT NOT NULL UNIQUE REFERENCES movimientos(id),
    sku            VARCHAR(40) NOT NULL,
    bodega_id      INT NOT NULL REFERENCES bodegas(id),
    cantidad       INT NOT NULL CHECK (cantidad > 0),
    proveedor_id   INT REFERENCES proveedores(id),
    costo_unitario NUMERIC(12, 0) CHECK (costo_unitario IS NULL OR costo_unitario >= 0),
    documento      VARCHAR(40),
    observacion    VARCHAR(300),
    registrado_por VARCHAR(160),
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entradas_sku ON entradas(sku, creado_en DESC);
CREATE INDEX idx_entradas_proveedor ON entradas(proveedor_id, creado_en DESC);

-- ============================================================================
-- reservar_stock: la operacion critica del sistema.
--
-- Todo ocurre en una sola sentencia UPDATE condicional. El predicado
-- "cantidad_disponible >= p_cantidad" se evalua sobre la fila ya bloqueada por
-- el motor, de modo que dos transacciones concurrentes sobre el mismo SKU se
-- serializan: la segunda vuelve a evaluar el predicado sobre el valor ya
-- actualizado por la primera y, si no alcanza, no actualiza ninguna fila.
--
-- Devuelve la reserva creada, o estado 'sin_stock' si no habia unidades.
-- ============================================================================
CREATE OR REPLACE FUNCTION reservar_stock(
    p_sku                VARCHAR,
    p_cantidad           INT,
    p_clave_idempotencia VARCHAR,
    p_pedido_id          VARCHAR DEFAULT NULL,
    p_minutos_vigencia   INT     DEFAULT 15,
    p_request_id         VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    resultado      VARCHAR,
    reserva_id     UUID,
    disponible     INT,
    expira_en      TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_existente  reservas;
    v_stock      stock;
    v_reserva_id UUID;
    v_expira     TIMESTAMPTZ;
BEGIN
    -- 1. Idempotencia: si esta clave ya produjo una reserva, se devuelve esa
    --    misma reserva sin tocar el stock. Hace el reintento seguro.
    SELECT * INTO v_existente
      FROM reservas
     WHERE clave_idempotencia = p_clave_idempotencia;

    IF FOUND THEN
        RETURN QUERY
            SELECT 'idempotente'::VARCHAR,
                   v_existente.id,
                   (SELECT s.cantidad_disponible FROM stock s
                     WHERE s.sku = v_existente.sku AND s.bodega_id = v_existente.bodega_id),
                   v_existente.expira_en;
        RETURN;
    END IF;

    -- 2. Serializacion por producto: un bloqueo de advertencia por SKU, valido
    --    durante la transaccion. Ordena las solicitudes sobre el mismo
    --    producto en lanzamientos y ventas de alta demanda.
    PERFORM pg_advisory_xact_lock(hashtext(p_sku));

    -- 3. Descuento condicional atomico. Si no hay unidades suficientes, el
    --    WHERE no encuentra fila y no se actualiza nada.
    UPDATE stock
       SET cantidad_disponible = cantidad_disponible - p_cantidad,
           cantidad_reservada  = cantidad_reservada  + p_cantidad,
           version             = version + 1,
           actualizado_en      = NOW()
     WHERE sku = p_sku
       AND cantidad_disponible >= p_cantidad
     RETURNING * INTO v_stock;

    IF NOT FOUND THEN
        RETURN QUERY
            SELECT 'sin_stock'::VARCHAR,
                   NULL::UUID,
                   COALESCE((SELECT SUM(s.cantidad_disponible)::INT FROM stock s
                              WHERE s.sku = p_sku), 0),
                   NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    -- 4. Reserva temporal con vigencia. Si el pago no se completa dentro del
    --    plazo, el barrido de expiracion devuelve las unidades.
    v_expira := NOW() + (p_minutos_vigencia || ' minutes')::INTERVAL;

    INSERT INTO reservas (sku, bodega_id, cantidad, pedido_id, clave_idempotencia, expira_en)
    VALUES (p_sku, v_stock.bodega_id, p_cantidad, p_pedido_id, p_clave_idempotencia, v_expira)
    RETURNING id INTO v_reserva_id;

    INSERT INTO movimientos (sku, bodega_id, tipo, cantidad, saldo_despues, referencia, request_id)
    VALUES (p_sku, v_stock.bodega_id, 'reserva', p_cantidad, v_stock.cantidad_disponible,
            v_reserva_id::VARCHAR, p_request_id);

    RETURN QUERY
        SELECT 'reservado'::VARCHAR, v_reserva_id, v_stock.cantidad_disponible, v_expira;
END;
$$;

-- ============================================================================
-- confirmar_reserva: el pago fue aprobado, el descuento se vuelve definitivo.
-- Las unidades salen de cantidad_reservada y no regresan a disponible.
-- ============================================================================
CREATE OR REPLACE FUNCTION confirmar_reserva(
    p_reserva_id UUID,
    p_request_id VARCHAR DEFAULT NULL
)
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
    v_reserva reservas;
    v_saldo   INT;
BEGIN
    UPDATE reservas
       SET estado = 'confirmada', cerrado_en = NOW()
     WHERE id = p_reserva_id AND estado = 'activa'
     RETURNING * INTO v_reserva;

    IF NOT FOUND THEN
        -- Idempotente: confirmar dos veces no es un error.
        SELECT * INTO v_reserva FROM reservas WHERE id = p_reserva_id;
        IF NOT FOUND THEN RETURN 'no_encontrada'; END IF;
        RETURN CASE WHEN v_reserva.estado = 'confirmada' THEN 'ya_confirmada'
                    ELSE 'estado_invalido:' || v_reserva.estado END;
    END IF;

    UPDATE stock
       SET cantidad_reservada = cantidad_reservada - v_reserva.cantidad,
           version            = version + 1,
           actualizado_en     = NOW()
     WHERE sku = v_reserva.sku AND bodega_id = v_reserva.bodega_id
     RETURNING cantidad_disponible INTO v_saldo;

    INSERT INTO movimientos (sku, bodega_id, tipo, cantidad, saldo_despues, referencia, request_id)
    VALUES (v_reserva.sku, v_reserva.bodega_id, 'salida', v_reserva.cantidad, v_saldo,
            p_reserva_id::VARCHAR, p_request_id);

    RETURN 'confirmada';
END;
$$;

-- ============================================================================
-- liberar_reserva: transaccion compensatoria del patron Saga.
-- Se invoca cuando el pago se rechaza despues de haber reservado el stock.
-- ============================================================================
CREATE OR REPLACE FUNCTION liberar_reserva(
    p_reserva_id UUID,
    p_motivo     VARCHAR DEFAULT 'liberada',
    p_request_id VARCHAR DEFAULT NULL
)
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
    v_reserva reservas;
    v_saldo   INT;
    v_estado  VARCHAR;
BEGIN
    v_estado := CASE WHEN p_motivo = 'expirada' THEN 'expirada' ELSE 'liberada' END;

    UPDATE reservas
       SET estado = v_estado, cerrado_en = NOW()
     WHERE id = p_reserva_id AND estado = 'activa'
     RETURNING * INTO v_reserva;

    IF NOT FOUND THEN
        SELECT * INTO v_reserva FROM reservas WHERE id = p_reserva_id;
        IF NOT FOUND THEN RETURN 'no_encontrada'; END IF;
        RETURN CASE WHEN v_reserva.estado IN ('liberada', 'expirada') THEN 'ya_liberada'
                    ELSE 'estado_invalido:' || v_reserva.estado END;
    END IF;

    -- Las unidades vuelven a estar disponibles para otros clientes.
    UPDATE stock
       SET cantidad_disponible = cantidad_disponible + v_reserva.cantidad,
           cantidad_reservada  = cantidad_reservada  - v_reserva.cantidad,
           version             = version + 1,
           actualizado_en      = NOW()
     WHERE sku = v_reserva.sku AND bodega_id = v_reserva.bodega_id
     RETURNING cantidad_disponible INTO v_saldo;

    INSERT INTO movimientos (sku, bodega_id, tipo, cantidad, saldo_despues, referencia, request_id)
    VALUES (v_reserva.sku, v_reserva.bodega_id, 'liberacion', v_reserva.cantidad, v_saldo,
            p_reserva_id::VARCHAR, p_request_id);

    RETURN v_estado;
END;
$$;

-- ============================================================================
-- expirar_reservas: barrido periodico. Devuelve las unidades de las reservas
-- cuyo plazo vencio sin que el pago se completara.
-- ============================================================================
CREATE OR REPLACE FUNCTION expirar_reservas()
RETURNS TABLE (reserva_id UUID, sku VARCHAR, cantidad INT)
LANGUAGE plpgsql
AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT id FROM reservas
         WHERE estado = 'activa' AND expira_en < NOW()
         FOR UPDATE SKIP LOCKED
    LOOP
        PERFORM liberar_reserva(r.id, 'expirada', 'barrido-automatico');
    END LOOP;

    RETURN QUERY
        SELECT rr.id, rr.sku, rr.cantidad
          FROM reservas rr
         WHERE rr.estado = 'expirada' AND rr.cerrado_en > NOW() - INTERVAL '1 minute';
END;
$$;

GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public TO inventario_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO inventario_user;
GRANT EXECUTE ON ALL FUNCTIONS        IN SCHEMA public TO inventario_user;
