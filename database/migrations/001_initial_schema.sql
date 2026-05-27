-- ============================================================
-- ODONTOVAL — Esquema inicial de base de datos
-- Motor: PostgreSQL 15 (RDS)
-- Convención: UUID como PK, clinic_id en todas las tablas (multi-tenancy)
-- ============================================================

-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- CLÍNICAS — entidad raíz del modelo multi-tenant
-- ─────────────────────────────────────────────────────────────
CREATE TABLE clinicas (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre          VARCHAR(200) NOT NULL,
    ruc             VARCHAR(13),
    direccion       TEXT,
    telefono        VARCHAR(20),
    email           VARCHAR(150),
    logo_url        TEXT,
    plan            VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
    max_usuarios    INT NOT NULL DEFAULT 10,
    activa          BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- USUARIOS POR CLÍNICA — odontólogos y asistentes
-- ─────────────────────────────────────────────────────────────
CREATE TABLE usuarios_clinica (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id       UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
    cognito_sub     VARCHAR(100) NOT NULL,  -- sub del JWT de Cognito (Google)
    nombre          VARCHAR(200) NOT NULL,
    email           VARCHAR(150) NOT NULL,
    rol             VARCHAR(20) NOT NULL DEFAULT 'odontologo'
                    CHECK (rol IN ('owner', 'odontologo', 'asistente')),
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (clinic_id, cognito_sub)
);

CREATE INDEX idx_usuarios_cognito ON usuarios_clinica (cognito_sub);

-- ─────────────────────────────────────────────────────────────
-- PACIENTES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE pacientes (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id        UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
    cedula           VARCHAR(20) NOT NULL,
    nombres          VARCHAR(150) NOT NULL,
    apellidos        VARCHAR(150) NOT NULL,
    fecha_nacimiento DATE,
    genero           VARCHAR(10) CHECK (genero IN ('M', 'F', 'otro', '')),
    telefono         VARCHAR(20),
    email            VARCHAR(150),
    direccion        TEXT,
    fecha_creacion   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (clinic_id, cedula)  -- cédula única por clínica
);

CREATE INDEX idx_pacientes_clinic ON pacientes (clinic_id);
CREATE INDEX idx_pacientes_cedula ON pacientes (cedula);
CREATE INDEX idx_pacientes_apellidos ON pacientes (clinic_id, apellidos);

-- ─────────────────────────────────────────────────────────────
-- HISTORIA MÉDICA — datos de salud general del paciente
-- ─────────────────────────────────────────────────────────────
CREATE TABLE historia_medica (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paciente_id         UUID NOT NULL UNIQUE REFERENCES pacientes(id) ON DELETE CASCADE,
    grupo_sanguineo     VARCHAR(5),
    alergias            TEXT,
    enfermedades_base   TEXT,    -- hipertensión, diabetes, etc.
    medicamentos        TEXT,
    embarazo            BOOLEAN,
    fumador             BOOLEAN,
    observaciones       TEXT,
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- HISTORIA ODONTOLÓGICA — resumen de tratamientos previos
-- ─────────────────────────────────────────────────────────────
CREATE TABLE historia_odontologica (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paciente_id             UUID NOT NULL UNIQUE REFERENCES pacientes(id) ON DELETE CASCADE,
    ultimo_tratamiento      DATE,
    tratamientos_previos    TEXT,
    observaciones           TEXT,
    actualizado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- ODONTOGRAMAS — estado dental registrado por visita
-- tipo: 'adulto' (FDI 11-48) | 'niño' (FDI 51-85)
-- datos_json: estado de cada diente en formato JSON
-- ─────────────────────────────────────────────────────────────
CREATE TABLE odontogramas (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paciente_id      UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    odontologo_id    UUID REFERENCES usuarios_clinica(id),
    tipo             VARCHAR(10) NOT NULL CHECK (tipo IN ('adulto', 'niño')),
    datos_json       JSONB NOT NULL DEFAULT '{}',
    observaciones    TEXT,
    fecha_registro   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_odontogramas_paciente ON odontogramas (paciente_id);
CREATE INDEX idx_odontogramas_datos    ON odontogramas USING GIN (datos_json);

-- ─────────────────────────────────────────────────────────────
-- PERIODONTAL — índice periodontal por sextantes
-- ─────────────────────────────────────────────────────────────
CREATE TABLE periodontal (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paciente_id      UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    odontologo_id    UUID REFERENCES usuarios_clinica(id),
    sextantes        JSONB NOT NULL DEFAULT '{}',  -- profundidad de sondaje por diente
    clasificacion    VARCHAR(50),                   -- ej: "Periodontitis Estadio II"
    observaciones    TEXT,
    fecha_registro   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- EVOLUCIONES — notas de evolución clínica por visita
-- ─────────────────────────────────────────────────────────────
CREATE TABLE evoluciones (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paciente_id      UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    odontologo_id    UUID REFERENCES usuarios_clinica(id),
    cie10_codigo     VARCHAR(10),     -- ej: K02.1 (caries de dentina)
    descripcion      TEXT NOT NULL,
    tratamiento      TEXT,
    dientes          TEXT,            -- ej: "16, 26" en notación FDI
    fecha_atencion   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evoluciones_paciente ON evoluciones (paciente_id);

-- ─────────────────────────────────────────────────────────────
-- RADIOGRAFÍAS — metadatos; el archivo está en S3
-- ─────────────────────────────────────────────────────────────
CREATE TABLE radiografias (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paciente_id      UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    odontologo_id    UUID REFERENCES usuarios_clinica(id),
    tipo             VARCHAR(50),   -- periapical, panorámica, bite-wing, etc.
    s3_key           TEXT NOT NULL, -- key en el bucket S3 de radiografías
    descripcion      TEXT,
    dientes          TEXT,
    fecha_toma       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_radiografias_paciente ON radiografias (paciente_id);

-- ─────────────────────────────────────────────────────────────
-- CITAS — agenda de citas
-- ─────────────────────────────────────────────────────────────
CREATE TABLE citas (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paciente_id          UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    odontologo_id        UUID REFERENCES usuarios_clinica(id),
    fecha_hora           TIMESTAMPTZ NOT NULL,
    duracion_min         INT NOT NULL DEFAULT 30,
    motivo               TEXT,
    estado               VARCHAR(20) NOT NULL DEFAULT 'programada'
                         CHECK (estado IN ('programada', 'confirmada', 'completada', 'cancelada')),
    recordatorio_enviado BOOLEAN NOT NULL DEFAULT FALSE,
    notas                TEXT,
    fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_citas_paciente   ON citas (paciente_id);
CREATE INDEX idx_citas_fecha      ON citas (fecha_hora);
CREATE INDEX idx_citas_recordatorio ON citas (recordatorio_enviado, fecha_hora)
    WHERE estado = 'programada' AND recordatorio_enviado = FALSE;

-- ─────────────────────────────────────────────────────────────
-- PROFILAXIS PROGRAMADAS — citas de limpieza cada 6 meses
-- ─────────────────────────────────────────────────────────────
CREATE TABLE profilaxis_programadas (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paciente_id      UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    proxima_fecha    DATE NOT NULL,
    ultima_fecha     DATE,
    notificado       BOOLEAN NOT NULL DEFAULT FALSE,
    generada_cita_id UUID REFERENCES citas(id)
);

CREATE INDEX idx_profilaxis_fecha ON profilaxis_programadas (proxima_fecha, notificado);

-- ─────────────────────────────────────────────────────────────
-- FACTURAS / RECIBOS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE facturas (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id        UUID NOT NULL REFERENCES clinicas(id),
    paciente_id      UUID NOT NULL REFERENCES pacientes(id),
    odontologo_id    UUID REFERENCES usuarios_clinica(id),
    numero           VARCHAR(20) NOT NULL,    -- número secuencial de recibo
    subtotal         NUMERIC(10,2) NOT NULL DEFAULT 0,
    iva              NUMERIC(10,2) NOT NULL DEFAULT 0,
    total            NUMERIC(10,2) NOT NULL DEFAULT 0,
    estado           VARCHAR(20) NOT NULL DEFAULT 'emitida'
                     CHECK (estado IN ('emitida', 'pagada', 'anulada')),
    metodo_pago      VARCHAR(30),
    observaciones    TEXT,
    fecha_emision    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (clinic_id, numero)
);

CREATE TABLE factura_items (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    factura_id       UUID NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
    descripcion      TEXT NOT NULL,
    cantidad         INT NOT NULL DEFAULT 1,
    precio_unitario  NUMERIC(10,2) NOT NULL,
    subtotal         NUMERIC(10,2) NOT NULL
);

CREATE INDEX idx_facturas_clinic   ON facturas (clinic_id);
CREATE INDEX idx_facturas_paciente ON facturas (paciente_id);

-- ─────────────────────────────────────────────────────────────
-- CONSENTIMIENTOS INFORMADOS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE consentimientos (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paciente_id      UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    odontologo_id    UUID REFERENCES usuarios_clinica(id),
    tipo_tratamiento TEXT NOT NULL,
    texto_completo   TEXT NOT NULL,
    firmado          BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_firma      TIMESTAMPTZ,
    pdf_s3_key       TEXT  -- copia PDF firmada guardada en S3
);

CREATE INDEX idx_consentimientos_paciente ON consentimientos (paciente_id);
