-- ============================================================
-- ODONTOVAL — Datos de prueba para desarrollo local
-- Ejecutar DESPUÉS de 001_initial_schema.sql
--
-- IDs fijos para que coincidan con LOCAL_CLINIC_ID y LOCAL_USER_SUB
-- definidos en docker-compose.yml
-- ============================================================

-- Limpiar datos previos (orden inverso por FK)
TRUNCATE TABLE consentimientos, factura_items, facturas,
               profilaxis_programadas, radiografias, evoluciones,
               periodontal, odontogramas, citas,
               historia_odontologica, historia_medica,
               pacientes, usuarios_clinica, clinicas
CASCADE;

-- ─────────────────────────────────────────────────────────────
-- CLÍNICA DE PRUEBA
-- ─────────────────────────────────────────────────────────────
INSERT INTO clinicas (id, nombre, ruc, direccion, telefono, email, plan)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'ODONTOVAL Clínica de Prueba',
    '1791234560001',
    'Av. República del Salvador N34-183, Quito',
    '022234567',
    'info@odontoval.com.ec',
    'pro'
);

-- ─────────────────────────────────────────────────────────────
-- USUARIO ODONTÓLOGO (coincide con LOCAL_USER_SUB)
-- ─────────────────────────────────────────────────────────────
INSERT INTO usuarios_clinica (id, clinic_id, cognito_sub, nombre, email, rol)
VALUES (
    '00000000-0000-0000-0000-000000000099',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000099',   -- mismo que LOCAL_USER_SUB
    'Dr. José Andres',
    'dev@odontoval.local',
    'owner'
);

-- ─────────────────────────────────────────────────────────────
-- PACIENTES DE PRUEBA
-- ─────────────────────────────────────────────────────────────
INSERT INTO pacientes (id, clinic_id, cedula, nombres, apellidos, fecha_nacimiento, genero, telefono, email, direccion)
VALUES
    ('10000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000001',
     '1712345678', 'María José', 'García Rodríguez',
     '1988-04-15', 'F', '0991234567', 'mjgarcia@email.com',
     'Quito, Sector La Floresta'),

    ('10000000-0000-0000-0000-000000000002',
     '00000000-0000-0000-0000-000000000001',
     '1798765432', 'Carlos Andrés', 'López Martínez',
     '1975-11-23', 'M', '0987654321', 'calopez@email.com',
     'Quito, Sector Cumbayá'),

    ('10000000-0000-0000-0000-000000000003',
     '00000000-0000-0000-0000-000000000001',
     '1756781234', 'Ana Lucía', 'Torres Vega',
     '1995-07-08', 'F', '0976543210', 'altorres@email.com',
     'Quito, Sector El Batán'),

    ('10000000-0000-0000-0000-000000000004',
     '00000000-0000-0000-0000-000000000001',
     '1734567890', 'Roberto', 'Mendoza Acosta',
     '1962-03-30', 'M', '0965432109', 'rmendoza@email.com',
     'Quito, Sector La Carolina'),

    ('10000000-0000-0000-0000-000000000005',
     '00000000-0000-0000-0000-000000000001',
     '1723456789', 'Sofía Valentina', 'Ruiz Mora',
     '2001-09-12', 'F', '0954321098', 'svruiz@email.com',
     'Quito, Sector Iñaquito');

-- ─────────────────────────────────────────────────────────────
-- HISTORIAS MÉDICAS
-- ─────────────────────────────────────────────────────────────
INSERT INTO historia_medica (paciente_id, grupo_sanguineo, alergias, enfermedades_base, medicamentos_actuales)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'O+',
     'Penicilina', NULL, NULL),

    ('10000000-0000-0000-0000-000000000002', 'A+',
     NULL, 'Hipertensión arterial', 'Losartán 50mg/día'),

    ('10000000-0000-0000-0000-000000000003', 'B-',
     'Látex', 'Diabetes tipo 2', 'Metformina 850mg/día'),

    ('10000000-0000-0000-0000-000000000004', 'AB+',
     NULL, 'Cardiopatía isquémica', 'Aspirina 100mg, Atorvastatina'),

    ('10000000-0000-0000-0000-000000000005', 'O-',
     NULL, NULL, NULL);

-- ─────────────────────────────────────────────────────────────
-- CITAS
-- ─────────────────────────────────────────────────────────────
INSERT INTO citas (id, paciente_id, odontologo_id, fecha_hora, duracion_min, motivo, estado)
VALUES
    -- Cita pasada completada
    ('20000000-0000-0000-0000-000000000001',
     '10000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000099',
     NOW() - INTERVAL '7 days', 60,
     'Limpieza dental y revisión general', 'completada'),

    -- Cita pasada completada
    ('20000000-0000-0000-0000-000000000002',
     '10000000-0000-0000-0000-000000000002',
     '00000000-0000-0000-0000-000000000099',
     NOW() - INTERVAL '3 days', 45,
     'Tratamiento de conducto diente 46', 'completada'),

    -- Cita hoy confirmada
    ('20000000-0000-0000-0000-000000000003',
     '10000000-0000-0000-0000-000000000003',
     '00000000-0000-0000-0000-000000000099',
     NOW() + INTERVAL '2 hours', 30,
     'Revisión ortodoncia', 'confirmada'),

    -- Cita mañana programada
    ('20000000-0000-0000-0000-000000000004',
     '10000000-0000-0000-0000-000000000004',
     '00000000-0000-0000-0000-000000000099',
     NOW() + INTERVAL '1 day', 90,
     'Extracción molar tercero', 'programada'),

    -- Cita próxima semana
    ('20000000-0000-0000-0000-000000000005',
     '10000000-0000-0000-0000-000000000005',
     '00000000-0000-0000-0000-000000000099',
     NOW() + INTERVAL '5 days', 45,
     'Primera consulta y planificación', 'programada');

-- ─────────────────────────────────────────────────────────────
-- ODONTOGRAMA — paciente 1
-- ─────────────────────────────────────────────────────────────
INSERT INTO odontogramas (id, paciente_id, odontologo_id, tipo, datos_json, observaciones)
VALUES (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000099',
    'adulto',
    '{
      "11": {"estado":"", "superficies":["","","","",""]},
      "12": {"estado":"", "superficies":["obturado","","","",""]},
      "13": {"estado":"", "superficies":["","","","",""]},
      "14": {"estado":"", "superficies":["caries","","","",""]},
      "15": {"estado":"", "superficies":["","","","",""]},
      "16": {"estado":"corona", "superficies":["","","","",""]},
      "17": {"estado":"", "superficies":["","","","",""]},
      "18": {"estado":"ausente", "superficies":["","","","",""]},
      "21": {"estado":"", "superficies":["","","","",""]},
      "22": {"estado":"", "superficies":["","","","",""]},
      "23": {"estado":"", "superficies":["","","","",""]},
      "24": {"estado":"", "superficies":["","","","",""]},
      "25": {"estado":"", "superficies":["obturado","","","",""]},
      "26": {"estado":"", "superficies":["","","","",""]},
      "27": {"estado":"", "superficies":["","","","",""]},
      "28": {"estado":"ausente", "superficies":["","","","",""]},
      "31": {"estado":"", "superficies":["","","","",""]},
      "32": {"estado":"", "superficies":["","","","",""]},
      "33": {"estado":"", "superficies":["","","","",""]},
      "34": {"estado":"", "superficies":["","","","",""]},
      "35": {"estado":"", "superficies":["","","","",""]},
      "36": {"estado":"", "superficies":["caries","caries","","",""]},
      "37": {"estado":"", "superficies":["","","","",""]},
      "38": {"estado":"ausente", "superficies":["","","","",""]},
      "41": {"estado":"", "superficies":["","","","",""]},
      "42": {"estado":"", "superficies":["","","","",""]},
      "43": {"estado":"", "superficies":["","","","",""]},
      "44": {"estado":"", "superficies":["","","","",""]},
      "45": {"estado":"", "superficies":["","","","",""]},
      "46": {"estado":"", "superficies":["obturado","obturado","","",""]},
      "47": {"estado":"", "superficies":["","","","",""]},
      "48": {"estado":"ausente", "superficies":["","","","",""]}
    }',
    'Paciente con caries en 14 y 36. Corona en 16. Terceros molares ausentes.'
);

-- ─────────────────────────────────────────────────────────────
-- FACTURAS
-- ─────────────────────────────────────────────────────────────
INSERT INTO facturas (id, clinic_id, paciente_id, odontologo_id, numero,
                      subtotal, iva, total, estado, metodo_pago, observaciones)
VALUES
    ('40000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000001',
     '10000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000099',
     'REC-0001',
     65.00, 9.75, 74.75,
     'emitida', 'efectivo', 'Pago en efectivo'),

    ('40000000-0000-0000-0000-000000000002',
     '00000000-0000-0000-0000-000000000001',
     '10000000-0000-0000-0000-000000000002',
     '00000000-0000-0000-0000-000000000099',
     'REC-0002',
     120.00, 18.00, 138.00,
     'emitida', 'tarjeta', 'Tratamiento de conducto');

INSERT INTO factura_items (factura_id, descripcion, cantidad, precio_unitario, subtotal)
VALUES
    ('40000000-0000-0000-0000-000000000001', 'Consulta general',    1, 30.00, 30.00),
    ('40000000-0000-0000-0000-000000000001', 'Limpieza dental',     1, 35.00, 35.00),
    ('40000000-0000-0000-0000-000000000002', 'Tratamiento conducto',1, 80.00, 80.00),
    ('40000000-0000-0000-0000-000000000002', 'Radiografía periapical', 2, 20.00, 40.00);

-- ─────────────────────────────────────────────────────────────
-- PROFILAXIS PROGRAMADAS
-- ─────────────────────────────────────────────────────────────
INSERT INTO profilaxis_programadas (paciente_id, proxima_fecha, notificado)
VALUES
    ('10000000-0000-0000-0000-000000000001', CURRENT_DATE + INTERVAL '15 days', FALSE),
    ('10000000-0000-0000-0000-000000000002', CURRENT_DATE + INTERVAL '45 days', FALSE),
    ('10000000-0000-0000-0000-000000000003', CURRENT_DATE - INTERVAL '5 days',  FALSE),  -- vencida
    ('10000000-0000-0000-0000-000000000004', CURRENT_DATE + INTERVAL '90 days', FALSE),
    ('10000000-0000-0000-0000-000000000005', CURRENT_DATE + INTERVAL '180 days',FALSE);

-- ─────────────────────────────────────────────────────────────
-- VERIFICACIÓN
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
    RAISE NOTICE '=== Seed completado ===';
    RAISE NOTICE 'Clínica:    %', (SELECT nombre FROM clinicas LIMIT 1);
    RAISE NOTICE 'Pacientes:  %', (SELECT COUNT(*) FROM pacientes);
    RAISE NOTICE 'Citas:      %', (SELECT COUNT(*) FROM citas);
    RAISE NOTICE 'Facturas:   %', (SELECT COUNT(*) FROM facturas);
    RAISE NOTICE 'Odontogramas: %', (SELECT COUNT(*) FROM odontogramas);
END $$;
