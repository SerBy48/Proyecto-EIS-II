-- ============================================================================
-- auth_db - Servicio de autenticacion (seccion 5.3)
-- Usuarios, credenciales con hash, roles y tokens de renovacion.
-- ============================================================================
\connect auth_db

CREATE TABLE usuarios (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(150) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    rol             VARCHAR(20) NOT NULL
                    CHECK (rol IN ('cliente', 'vendedor', 'administrador')),
    -- Referencia por identificador al agregado del servicio de clientes.
    -- No hay clave foranea: esa tabla vive en otra base de datos y pertenece
    -- a otro servicio. La integridad se mantiene por contrato de API.
    cliente_id      INT,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    intentos_fallidos INT NOT NULL DEFAULT 0,
    bloqueado_hasta TIMESTAMPTZ,
    ultimo_acceso   TIMESTAMPTZ,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_rol   ON usuarios(rol);

-- Un cliente tiene como maximo una cuenta. Sin esta restriccion, cualquiera
-- podia registrarse con el cliente_id de otra persona y leer sus datos
-- (docs/calidad/SEGURIDAD.md, hallazgo S-01). El controlador lo valida antes;
-- el indice cierra la carrera entre dos registros simultaneos.
CREATE UNIQUE INDEX uq_usuarios_cliente ON usuarios(cliente_id) WHERE cliente_id IS NOT NULL;

-- Tokens de renovacion. Se almacena el hash, no el token, para que un volcado
-- de esta tabla no permita suplantar sesiones. La revocacion es explicita.
CREATE TABLE tokens_renovacion (
    id            SERIAL PRIMARY KEY,
    usuario_id    INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash    VARCHAR(64) UNIQUE NOT NULL,
    expira_en     TIMESTAMPTZ NOT NULL,
    revocado_en   TIMESTAMPTZ,
    creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tokens_usuario ON tokens_renovacion(usuario_id);
CREATE INDEX idx_tokens_hash    ON tokens_renovacion(token_hash);

-- Auditoria de accesos: registro inmutable, solo inserciones.
CREATE TABLE auditoria_accesos (
    id          BIGSERIAL PRIMARY KEY,
    usuario_id  INT,
    email       VARCHAR(150),
    accion      VARCHAR(30) NOT NULL,
    exitoso     BOOLEAN NOT NULL,
    ip          VARCHAR(45),
    request_id  VARCHAR(64),
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auditoria_usuario ON auditoria_accesos(usuario_id, creado_en DESC);

GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public TO auth_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO auth_user;
