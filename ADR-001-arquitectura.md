# ADR-001 — Decisiones de Arquitectura: ODONTOVAL Web App
**Versión:** 1.3  
**Fecha:** 2026-05-26  
**Autor:** Producto Owner (rol)  
**Estado:** BORRADOR — pendiente de revisión antes de escribir código

---

## 1. Contexto del negocio

ODONTOVAL es un consultorio odontológico que hoy registra sus atenciones en una hoja de cálculo (ODONTOVAL.xlsx) y lleva las historias clínicas en formularios físicos y Google Forms. El sistema actual no permite búsqueda rápida, no está integrado con la facturación y no escala a varios usuarios simultáneos.

**El dueño es odontólogo, no desarrollador.** La app debe sentirse como una herramienta de trabajo médica: simple, confiable y enfocada, sin jerga tecnológica.

---

## 2. Requerimientos funcionales confirmados en los documentos

### 2.1 Módulos obligatorios (extraídos del Drive)

| Módulo | Fuente | Descripción |
|---|---|---|
| **Registro de Pacientes** | HIS.xlsx | Datos básicos: nombre, CI, fecha nacimiento, dirección, teléfono, celular, email, estado civil, ocupación, contacto de emergencia |
| **Historia Médica** | HIS.xlsx, Normas MSP | Anamnesis: condiciones cardíacas, diabetes, HTA, alergias, medicamentos, embarazo, hábitos (alcohol, tabaco) |
| **Historia Odontológica** | HIS.xlsx, Protocolos MSP | Motivo de consulta, tratamientos previos (ortodoncia, endodoncia, implantes, etc.) |
| **Odontograma Interactivo — Adultos** | ontondograma.html | Diagrama SVG de **32 piezas** en notación FDI (dentición permanente: 11–18, 21–28, 31–38, 41–48). 5 caras por pieza (Vestibular, Palatino/Lingual, Mesial, Distal, Oclusal). Colores: Rojo=existente, Azul=sugerido/plan |
| **Odontograma Interactivo — Niños** | Normas MSP / HIS.xlsx | Diagrama SVG de **20 piezas** en notación FDI (dentición decidua: 51–55, 61–65, 71–75, 81–85). Las piezas deciduas tienen solo 5 caras también, pero son morfológicamente distintas. El sistema detecta automáticamente si mostrar el odontograma adulto o infantil según la edad del paciente (< 12 años → infantil; ≥ 12 → adulto; con opción de cambio manual) |
| **Registro Periodontal** | HIS.xlsx (sección odontograma) | Por pieza: Bolsa, Exudado, Margen, Movilidad, Furcas — vistas V (vestibular) y P (palatino) |
| **Control de Evolución** | HIS.xlsx (Control de evolución) | Fecha, tratamiento realizado, firma paciente, firma especialista |
| **Facturación** | ODONTOVAL.xlsx | Fecha, HC (cédula), nombre, tratamiento, Total, Abono, Saldo |
| **Dashboard de Saldos** | ODONTOVAL.xlsx (hoja resumen) | Vista consolidada: nombre, total facturado, total abonado, saldo pendiente |
| **Impresión de Recibos y Facturas** | Decisión confirmada | Generación de PDF imprimible por atención: fecha, paciente, tratamiento, valor, abono, saldo. Logo del consultorio incluido |
| **Consentimiento Informado** | Normas MSP / Protocolos 2014 | Documento PDF imprimible firmado por el paciente antes de cada procedimiento; plantilla editable por clínica |
| **Radiografías e Imágenes** | Decisión confirmada | Subida y visualización de radiografías asociadas a cada paciente/visita. Almacenamiento en Supabase Storage (ver ADR-001-H) |
| **Agenda de Citas** | Decisión confirmada — Fase 1 | Registro de citas con fecha, hora, paciente y tipo de tratamiento. Generador automático de citas de profilaxis cada 6 meses |
| **Recordatorios Automáticos** | Decisión confirmada — Fase 1 | Notificación por WhatsApp y/o email al paciente 24h y 2h antes de su cita |

### 2.2 Catálogo de tratamientos (extraído de ODONTOVAL real)
Los tratamientos que el sistema debe manejar (con posibilidad de agregar más):
- PROFILAXIS, RFC (Resina Fotocurada), EXODONCIA, ENDODONCIA
- PT.S (Prótesis Total Superior), PT.S.I CON MALLA, PF (Prótesis Fija)
- SELLANTES, IVc (Ionómero clase IV), RIV (Restauración IV)
- CEMENTACIÓN, CORONA, PRUEBA DE RODETE, IMPLANTE

### 2.3 Fases del producto

| Fase | Alcance |
|---|---|
| **Fase 1 — MVP** (actual) | Pacientes, Historia clínica, Odontograma (adultos+niños), Periodontal, Evoluciones, Facturación, Recibos PDF, Consentimiento informado PDF, Radiografías, Agenda de citas, Recordatorios WhatsApp/email, Migración de datos históricos |
| **Fase 2 — Siguiente** | App móvil nativa (iOS / Android) con React Native, modo offline, firma digital en pantalla |

### 2.4 Requerimientos no funcionales
- Máximo 10 usuarios por clínica
- Autenticación exclusivamente con cuenta Google
- Multi-tenant: cada clínica opera en su propio espacio aislado
- Costo mensual: lo más cercano a $0 posible (capa gratuita)
- Tiempo de respuesta < 2 segundos para operaciones comunes
- Responsive: funciona en tablet (para consultorio) y desktop
- Dominio propio: **odontoval.com.ec** (dominio .com.ec ~$15/año)
- Normas técnicas: protocolos MSP Ecuador (CIE-10 para diagnósticos)

---

## 3. Decisiones de arquitectura

### ADR-001-A: Plataforma — Web progresiva, sin app nativa

**Decisión:** Aplicación web única (PWA-ready) en Fase 1. App móvil nativa queda para Fase 2.

**Razón:** El contexto de uso es principalmente en el consultorio desde una tablet o computadora. Una PWA permite instalarla como ícono en dispositivos móviles sin costo adicional de desarrollo. No se justifica duplicar el esfuerzo con una app nativa para menos de 10 usuarios en esta primera fase.

**Fase 2:** App nativa con React Native (iOS + Android), reutilizando toda la lógica de negocio existente. Incluirá modo offline y firma digital en pantalla táctil para el consentimiento informado.

---

### ADR-001-B: Stack tecnológico

**Decisión: 100% AWS** — se mantiene y extiende la infraestructura ya desplegada.

**Infraestructura existente en producción (odontoval.com.ec) — confirmada leyendo el código Terraform:**

| Recurso AWS | Nombre real | Estado |
|---|---|---|
| **S3 — sitio web** | `odontoval-site-prod` | ✅ Desplegado |
| **S3 — emails crudos** | `odontoval-prod-emails` | ✅ Desplegado |
| **S3 — estado Terraform** | `odontoval-tfstate-prod` | ✅ Desplegado |
| **CloudFront** | distribución con OAC, dominio `odontoval.com.ec` + `www` | ✅ Desplegado |
| **ACM** | certificado SSL para `odontoval.com.ec` y `www.odontoval.com.ec` | ✅ Validado |
| **Route 53** | zona DNS para `odontoval.com.ec` | ✅ Desplegado |
| **SES** | dominio `odontoval.com.ec` verificado + DKIM | ✅ Desplegado |
| **SES — recepción** | `info@odontoval.com.ec`, `contacto@odontoval.com.ec` | ✅ Configurado |
| **Lambda** | `odontoval-prod-email-forwarder` (Python 3.12) | ✅ Desplegado |
| **CloudWatch Logs** | `/aws/lambda/odontoval-prod-email-forwarder` (14 días) | ✅ Desplegado |
| **Región AWS** | `us-east-1` | ✅ |
| **IaC** | Terragrunt + Terraform; módulos: `dns`, `static-site`, `email` | ✅ |

**Detalles técnicos relevantes del Terraform existente:**
- S3 privado: acceso solo vía CloudFront OAC (Origin Access Control) — sin acceso público directo
- CloudFront: security headers completos (HSTS, CSP, X-Frame-Options, Referrer-Policy)
- CloudFront Function en `viewer-request`: redirige `*.cloudfront.net` → `odontoval.com.ec`
- SES flow: correo entrante → S3 (`odontoval-prod-emails/`) → Lambda → reenvío a `veritoamorita@hotmail.com` con Reply-To al remitente original; envía desde `noreply@odontoval.com.ec`
- TF state cifrado en S3 con lock file nativo (sin DynamoDB)

**Stack completo objetivo (nuevo a desplegar):**

| Capa | Tecnología AWS | Por qué |
|---|---|---|
| Frontend | **S3 + CloudFront** ✅ ya existe | Continuar con lo desplegado |
| Odontograma | **SVG nativo + React** (build estático en S3) | El odontograma existente es SVG puro; se compila y sube a S3 |
| Backend / API | **API Gateway + Lambda** (Python/Node) | 1M requests/mes gratis; sin servidor que administrar |
| Base de datos | **RDS PostgreSQL** (db.t3.micro) | 750 h/mes gratis, 20 GB almacenamiento; SQL nativo; seguridad por VPC |
| Autenticación | **Cognito User Pool + Google OAuth** | 50 000 MAU gratis; integración nativa con Google; JWT compatible con API Gateway |
| Storage archivos | **S3** ✅ ya existe | Extender el bucket existente para radiografías y PDFs; bucket privado con presigned URLs |
| Email recordatorios | **SES** ✅ ya existe | Reutilizar la configuración y dominio verificado; Lambda adicional para recordatorios |
| Jobs programados | **EventBridge Scheduler** | Free tier incluido; dispara Lambda para recordatorios y generador de profilaxis |
| WhatsApp | **Twilio WhatsApp API** (externo) | No hay alternativa AWS nativa; ~$0.005/mensaje |
| IaC | **Terraform** | Repo de referencia `pumajd/DevOps-Actividad2-Terraform`; se integra al nuevo repo |
| CI/CD | **GitHub Actions** | 2000 min/mes gratis; pipeline que hace build → upload S3 → invalidate CloudFront |

**Por qué 100% AWS y no híbrido con Supabase:**
- SES ya tiene el dominio `odontoval.com.ec` verificado — esto requiere configuración DNS y aprobación, ya está hecho
- S3 ya existe: usar el mismo bucket para radiografías y PDFs es cero costo adicional
- Un solo vendor = una sola factura, un solo IAM, un solo Terraform provider
- El free tier de AWS cubre exactamente el perfil de < 10 usuarios
- Supabase añadiría un segundo proveedor sin ventaja real dado lo anterior

**Tecnologías descartadas:**
- Supabase: buen producto, pero añade vendor innecesario cuando AWS ya está en uso
- Vercel: reemplazado por S3 + CloudFront (ya desplegado)
- Resend.com: reemplazado por SES (ya verificado y funcionando)
- Firebase: modelo NoSQL no apto para consultas relacionales de facturación

---

### ADR-001-C: Modelo de multi-tenancy

**Decisión:** **`clinic_id` en todas las tablas + políticas de acceso en API Gateway/Lambda.**

Cada clínica tiene un `clinic_id` (UUID generado al registrarse). Todas las tablas de RDS incluyen este campo. La API valida en cada request que el `clinic_id` del JWT de Cognito coincide con el recurso solicitado — ninguna clínica puede ver datos de otra.

```
Cognito JWT (contiene clinic_id) → API Gateway → Lambda (valida clinic_id) → RDS
```

**Por qué no Row Level Security de PostgreSQL:** RLS requiere que la conexión a la DB pase el contexto del usuario directamente, lo que es más natural en Supabase (PostgREST). Con Lambda + RDS, la validación del `clinic_id` se hace en la capa de aplicación (Lambda), que es el patrón estándar en AWS y más fácil de auditar.

**Por qué no una DB por clínica:** RDS free tier es una instancia única. Una DB por clínica requeriría múltiples instancias o un cluster Aurora Serverless (sale del free tier).

**Registro de nueva clínica:** Un odontólogo se registra con Google vía Cognito → Lambda crea registro en tabla `clinicas` → genera `clinic_id` → se guarda en los atributos del usuario en Cognito → queda como `dueño` → puede invitar usuarios adicionales.

---

### ADR-001-D: Modelo de datos (esquema principal)

```sql
-- Clínicas (una por odontólogo dueño)
clinicas (id UUID PK, nombre TEXT, email_dueño TEXT, 
          fecha_creacion TIMESTAMPTZ, activa BOOL)

-- Usuarios con rol por clínica  
usuarios_clinica (id UUID PK, clinic_id UUID FK, 
                  user_id UUID FK,  -- Supabase Auth
                  rol TEXT CHECK (rol IN ('dueño','odontólogo','asistente')),
                  activo BOOL)

-- Pacientes
pacientes (id UUID PK, clinic_id UUID FK,
           nombres TEXT, apellidos TEXT, cedula TEXT UNIQUE,
           fecha_nacimiento DATE, lugar_nacimiento TEXT,
           direccion TEXT, ciudad TEXT, telefono TEXT, celular TEXT,
           email TEXT, estado_civil TEXT, ocupacion TEXT,
           -- Contacto emergencia
           emergencia_nombre TEXT, emergencia_parentesco TEXT, emergencia_telefono TEXT,
           -- Referido por
           referido_por TEXT CHECK (referido_por IN ('AMIGO','AUTOREFERENCIA','CLINICA','DOCTOR','OTRO')),
           created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)

-- Historia médica (una por paciente)
historia_medica (id UUID PK, paciente_id UUID FK, clinic_id UUID FK,
                 -- Condiciones (booleanos)
                 card_alteraciones BOOL, diabetes BOOL, hipertension BOOL, 
                 asma BOOL, hepatitis BOOL, vih BOOL, cancer BOOL,
                 osteoporosis BOOL, tuberculosis BOOL, anemia BOOL,
                 fiebre_reumatica BOOL, artritis BOOL, convulsiones BOOL,
                 alteraciones_psiq BOOL, prob_renales BOOL, lupus BOOL,
                 hipotiroidismo BOOL, hipertiroidismo BOOL, leucemia BOOL,
                 -- Texto libre
                 otras_condiciones TEXT,
                 coagulacion BOOL, anticoagulantes BOOL,
                 medicamentos TEXT, dosis_frecuencia TEXT,
                 alergias TEXT,
                 alcohol BOOL, tabaco BOOL, drogas BOOL,
                 -- Solo mujeres
                 embarazada BOOL, semanas_embarazo INT,
                 anticonceptivos BOOL, menopausia BOOL,
                 updated_at TIMESTAMPTZ)

-- Historia odontológica (anamnesis dental inicial)
historia_odontologica (id UUID PK, paciente_id UUID FK, clinic_id UUID FK,
                       motivo_consulta TEXT,
                       dolor_boca BOOL, dolor_cara BOOL, dolor_cuello BOOL,
                       -- Tratamientos previos
                       prev_ortodoncia BOOL, prev_periodoncia BOOL, 
                       prev_endodoncia BOOL, prev_cirugia BOOL,
                       prev_implantes BOOL, prev_restauracion BOOL,
                       created_at TIMESTAMPTZ)

-- Odontograma (estado por pieza dental)
odontogramas (id UUID PK, paciente_id UUID FK, clinic_id UUID FK,
              fecha DATE,
              -- Tipo de odontograma según dentición del paciente
              tipo TEXT CHECK (tipo IN ('adulto', 'niño')) NOT NULL,
              -- adulto: piezas 11-18, 21-28, 31-38, 41-48  (32 piezas permanentes)
              -- niño:   piezas 51-55, 61-65, 71-75, 81-85  (20 piezas deciduas)
              -- JSON con estado de las piezas
              -- Estructura: {"11": {"vestibular": "caries", "palatino": "sano", "mesial": "resina", "distal": "sano", "oclusal": "sano"}, ...}
              estado_piezas JSONB,
              -- Prótesis totales (solo aplica en adultos)
              protesis_superior TEXT, -- 'existente' | 'sugerida' | null
              protesis_inferior TEXT,
              notas TEXT,
              created_by UUID FK, created_at TIMESTAMPTZ)

-- Registro periodontal (por odontograma)
periodontal (id UUID PK, odontograma_id UUID FK, clinic_id UUID FK,
             pieza_num INT CHECK (pieza_num BETWEEN 11 AND 48),
             -- Cara Vestibular
             v_bolsa_d INT, v_bolsa_c INT, v_bolsa_m INT,
             v_exudado TEXT, v_margen TEXT, v_movilidad INT, v_furcas TEXT,
             -- Cara Palatina/Lingual
             p_bolsa_d INT, p_bolsa_c INT, p_bolsa_m INT,
             p_exudado TEXT, p_margen TEXT)

-- Control de evolución (visitas)
evoluciones (id UUID PK, paciente_id UUID FK, clinic_id UUID FK,
             fecha DATE,
             pieza_tratada INT,
             tratamiento TEXT,
             descripcion TEXT,
             firma_paciente BOOL,
             profesional_id UUID FK,
             created_at TIMESTAMPTZ)

-- Facturación
facturas (id UUID PK, paciente_id UUID FK, clinic_id UUID FK,
          fecha DATE,
          tratamiento TEXT,
          total NUMERIC(10,2),
          abono NUMERIC(10,2),
          saldo NUMERIC(10,2) GENERATED ALWAYS AS (total - abono) STORED,
          notas TEXT,
          recibo_pdf_url TEXT,       -- URL del PDF generado en Supabase Storage
          created_by UUID FK, created_at TIMESTAMPTZ)

-- Consentimiento informado (uno por procedimiento/visita)
consentimientos (id UUID PK, paciente_id UUID FK, clinic_id UUID FK,
                 fecha DATE,
                 tipo_procedimiento TEXT,
                 texto_consentimiento TEXT,   -- plantilla personalizable por clínica
                 firmado BOOL DEFAULT FALSE,
                 pdf_url TEXT,               -- PDF generado y almacenado
                 created_by UUID FK, created_at TIMESTAMPTZ)

-- Radiografías e imágenes clínicas
radiografias (id UUID PK, paciente_id UUID FK, clinic_id UUID FK,
              fecha DATE,
              tipo TEXT,            -- 'periapical' | 'panoramica' | 'bite_wing' | 'otra'
              pieza_referencia INT, -- pieza dental relacionada (puede ser null)
              descripcion TEXT,
              storage_path TEXT,    -- path en Supabase Storage: clinic_id/paciente_id/archivo
              created_by UUID FK, created_at TIMESTAMPTZ)

-- Citas
citas (id UUID PK, paciente_id UUID FK, clinic_id UUID FK,
       fecha_hora TIMESTAMPTZ,
       duracion_min INT DEFAULT 30,
       tipo_tratamiento TEXT,
       estado TEXT CHECK (estado IN ('pendiente','confirmada','atendida','cancelada','no_asistio')),
       notas TEXT,
       -- Recordatorios
       recordatorio_whatsapp_enviado BOOL DEFAULT FALSE,
       recordatorio_email_enviado BOOL DEFAULT FALSE,
       profesional_id UUID FK,
       created_at TIMESTAMPTZ)

-- Profilaxis programadas (generador automático)
profilaxis_programadas (id UUID PK, paciente_id UUID FK, clinic_id UUID FK,
                        ultima_profilaxis DATE,
                        proxima_sugerida DATE,   -- ultima + 6 meses
                        cita_generada_id UUID FK, -- referencia a citas (null si aún no se agendó)
                        notificado BOOL DEFAULT FALSE)
```

---

### ADR-001-E: Odontograma dual — adultos y niños

**Decisión:** El módulo de odontograma implementa **dos variantes** del mismo componente SVG, seleccionable por el profesional.

**Dentición permanente (adultos) — 32 piezas FDI:**
```
Cuadrante 1 (superior derecho): 18 17 16 15 14 13 12 11
Cuadrante 2 (superior izquierdo):             21 22 23 24 25 26 27 28
Cuadrante 4 (inferior derecho): 48 47 46 45 44 43 42 41
Cuadrante 3 (inferior izquierdo):            31 32 33 34 35 36 37 38
```

**Dentición decidua (niños) — 20 piezas FDI:**
```
Cuadrante 5 (superior derecho): 55 54 53 52 51
Cuadrante 6 (superior izquierdo):          61 62 63 64 65
Cuadrante 8 (inferior derecho): 85 84 83 82 81
Cuadrante 7 (inferior izquierdo):          71 72 73 74 75
```

**Regla de selección automática:**
- Edad del paciente < 6 años → odontograma de niño (solo decidua)
- Edad 6–12 años → odontograma de niño con opción de cambio manual (dentición mixta)
- Edad ≥ 12 años → odontograma de adulto por defecto
- En todos los casos: el profesional puede cambiar el tipo manualmente con un selector visible

**Comportamiento en base de datos:** Ambos odontogramas se guardan en la misma tabla `odontogramas`, diferenciados por el campo `tipo`. Un mismo paciente puede tener registros de ambos tipos a lo largo de su historia clínica (p. ej., atendido de niño y luego de adulto).

**Componente React:** Se implementa un componente único `<OdontogramaInteractivo tipo="adulto|niño" />` que renderiza el SVG correspondiente según la prop, reutilizando la lógica de colores y el modal de tratamientos.

---

### ADR-001-F: Almacenamiento de radiografías — S3 vs Google Drive

**Decisión:** **AWS S3** (bucket existente, extendido) para radiografías e imágenes clínicas.

**Análisis comparativo:**

| Criterio | AWS S3 ✅ elegido | Google Drive API |
|---|---|---|
| Ya está desplegado | ✅ Bucket existente en producción | ❌ Requiere nuevo OAuth y configuración |
| Seguridad / aislamiento | ✅ Presigned URLs + políticas IAM por prefix | ⚠️ Permisos manuales por carpeta |
| Integración con el backend | ✅ SDK AWS ya usado en Lambda | ❌ OAuth adicional, complejidad extra |
| URL con expiración | ✅ Presigned URL (15 min configurable) | ⚠️ Links públicos o permisos de Drive |
| Costo gratuito | ✅ 5 GB free tier, 20 000 GET/mes gratis | ✅ 15 GB en cuenta Google personal |
| Visualización inline | ✅ URL temporal → render en `<img>` o visor | ⚠️ Requiere embed de Google Viewer |
| Cumplimiento datos médicos | ✅ Bucket privado, sin acceso público | ⚠️ Depende de la configuración del usuario |

**Razón de la decisión:** S3 ya está corriendo. Extender el bucket existente es cero configuración adicional. Las presigned URLs garantizan que solo usuarios autenticados con el `clinic_id` correcto pueden acceder a las imágenes. Google Drive añadiría un segundo OAuth y dependería de que el odontólogo configure bien los permisos de su Drive personal.

**Límite del free tier:** 5 GB. Para un consultorio de < 10 usuarios con radiografías de ~1–3 MB cada una, esto cubre aproximadamente 1 600–5 000 imágenes antes de salir del free tier. Cuando se supere, el costo es $0.023/GB/mes (S3 Standard) — menos de $1/mes por los primeros años de uso.

**Estructura dentro del bucket existente:**
```
s3://odontoval-prod/
  ├── (archivos actuales del sitio web)
  └── clinicas/
        └── {clinic_id}/
              └── {paciente_id}/
                    ├── radiografias/
                    │     └── 2026-05-26_periapical_pieza14.jpg
                    └── pdfs/
                          ├── recibo_2026-05-26.pdf
                          └── consentimiento_endodoncia.pdf
```

---

### ADR-001-G: Impresión de recibos, facturas y consentimiento informado

**Decisión:** Generación de PDF en el navegador usando la biblioteca **`@react-pdf/renderer`**, sin servidor adicional.

**Documentos imprimibles:**

1. **Recibo de pago:** Número de recibo, fecha, nombre paciente, CI, detalle del tratamiento, valor total, abono recibido, saldo pendiente, logo y nombre del consultorio, firma del profesional.

2. **Consentimiento informado:** Plantilla predefinida por tipo de procedimiento (exodoncia, endodoncia, cirugía, etc.) con: nombre del paciente, CI, descripción del procedimiento, riesgos informados, autorización firmada. El texto de cada plantilla es editable por el dueño de la clínica desde Configuración.

**Flujo de impresión:**
```
Usuario hace clic en "Imprimir recibo" / "Imprimir consentimiento"
  → Se genera el PDF en memoria (cliente)
  → Se abre el diálogo de impresión del navegador
  → Opcionalmente: guardar copia del PDF en Supabase Storage
```

**Por qué en el cliente y no en el servidor:** Evita un Edge Function adicional, el PDF se genera instantáneamente sin esperar red, y el plan gratuito de Supabase tiene límite de invocaciones.

---

### ADR-001-H: Agenda de citas y generador de profilaxis

**Decisión:** Módulo de agenda integrado en la app con generación automática de citas de profilaxis cada 6 meses.

**Flujo de agenda:**
1. El profesional crea una cita: selecciona paciente, fecha/hora, tipo de tratamiento y duración
2. La cita queda en estado `pendiente`
3. El sistema envía recordatorio automático (ver ADR-001-I)
4. Tras la atención, el profesional la marca como `atendida`

**Generador de profilaxis:**
- Cuando se registra una evolución con tratamiento `PROFILAXIS`, el sistema crea automáticamente un registro en `profilaxis_programadas` con `proxima_sugerida = fecha_actual + 6 meses`
- Un job programado (Supabase Edge Function con `pg_cron`) revisa semanalmente los pacientes cuya próxima profilaxis es en los siguientes 30 días y genera una cita borrador o envía una notificación al profesional para que la confirme
- El profesional confirma o ajusta la fecha sugerida con un clic

---

### ADR-001-I: Recordatorios automáticos — WhatsApp y Email

**Decisión:** Recordatorios por **WhatsApp** vía Twilio y por **email** vía Resend.com.

**Análisis de opciones para WhatsApp:**

| Opción | Costo | Facilidad | Limitación |
|---|---|---|---|
| **Twilio WhatsApp API** | Gratis hasta 1000 mensajes/mes (sandbox) | Media | Requiere aprobación de Meta para producción |
| **CallMeBot** | Gratis | Alta | Solo funciona si el destinatario activó el bot |
| **WhatsApp Business API directa** | Pago por mensaje | Alta | Costoso para volumen bajo |

**Decisión para WhatsApp:** Twilio (sandbox gratuito para desarrollo y pruebas; en producción, el costo es ~$0.005 por mensaje = menos de $1/mes con < 200 citas mensuales).

**Para email:** Resend.com — 3000 emails/mes gratis, integración con React Email para plantillas HTML profesionales.

**Cuándo se envían los recordatorios:**
- 24 horas antes de la cita → WhatsApp + Email
- 2 horas antes de la cita → solo WhatsApp (recordatorio final)
- Cita de profilaxis próxima (30 días antes) → Email con link para confirmar

**Implementación:** Supabase Edge Function con `pg_cron` ejecutando cada hora, consultando citas en el rango de tiempo correspondiente.

---

### ADR-001-J: Migración de datos históricos

**Decisión:** **Sí se migran** los datos históricos de ODONTOVAL.xlsx a la nueva base de datos.

**Datos a migrar:**

| Origen | Destino | Notas |
|---|---|---|
| ODONTOVAL.xlsx — hoja INGRESOS | Tabla `facturas` | Mapear: FECHA→fecha, HC→cedula (unir con paciente), TRATAMIENTO→tratamiento, Total/ABONO/SALDO→campos numéricos |
| ODONTOVAL.xlsx — hoja Saldo x Paciente | Tabla `pacientes` | Crear registros de paciente con nombre y cedula; saldo se recalcula desde facturas |
| HISTORIA_CLINICA_EJEMPLOS.xlsx | Tabla `pacientes` + `historia_odontologica` | Mapear campos del formulario Google Form |

**Proceso de migración:**
1. Se escribe un **script Python** (`scripts/migrate_odontoval.py`) que lee el XLSX y carga los datos vía API de Supabase
2. El script es idempotente: puede ejecutarse varias veces sin duplicar registros (clave: cedula de paciente)
3. Los registros sin cédula (detectados en el análisis: ej. `BRAVO AJILA MIGUEL`) se marcan con flag `requiere_actualizacion = true` para que el profesional los complete manualmente
4. La migración se corre una sola vez en el deploy inicial
5. Se provee una pantalla en la app para ver los registros pendientes de completar

**Datos que NO se migran automáticamente:**
- Radiografías físicas (deben digitalizarse manualmente)
- Odontogramas históricos (no existen en formato digital)
- Historias clínicas en papel (el odontólogo las ingresa progresivamente)

---

### ADR-001-K: Autenticación y autorización (AWS Cognito)

**Flujo:**
1. Usuario entra a `odontoval.com.ec` → Click "Entrar con Google"
2. Cognito Hosted UI redirige a Google OAuth 2.0
3. Retorno con tokens (id_token + access_token) → React los guarda en memoria
4. Si es primera vez: Lambda `odontoval-registro-clinica` crea la clínica y asigna rol `dueño`
5. Si ya existe: acceso directo al dashboard; el `clinic_id` viaja en el JWT en cada llamada a API Gateway

**Configuración Cognito:**
- User Pool con proveedor de identidad Google (OAuth 2.0)
- App Client para la SPA (flujo Authorization Code + PKCE)
- Atributos personalizados: `custom:clinic_id`, `custom:rol`
- Dominio Hosted UI: `auth.odontoval.com.ec`

**Invitación de usuarios:** El dueño ingresa el email → Lambda genera link de invitación → SES lo envía al nuevo usuario → el invitado entra con Google → Lambda vincula el `clinic_id` en Cognito.

**Roles (atributo Cognito + tabla `usuarios_clinica` en RDS):**
- `dueño`: acceso total, incluyendo configuración y gestión de usuarios
- `odontólogo`: pacientes, historias, odontograma, evoluciones, citas
- `asistente`: solo lectura de pacientes + registro de abonos en facturación

---

### ADR-001-L: Estructura del repositorio GitHub

El Terraform existente (repo separado `pumajd/DevOps-Actividad2-Terraform`) se toma como referencia de patrones. El nuevo repo `odontoval` consolida todo:

```
odontoval/
├── .github/
│   └── workflows/
│       ├── ci.yml              # Lint + tests en cada PR
│       └── deploy.yml          # Build → S3 upload → CloudFront invalidate
│
├── terraform/                  # Basado en pumajd/DevOps-Actividad2-Terraform
│   ├── main.tf                 # Provider AWS
│   ├── variables.tf
│   ├── outputs.tf
│   ├── modules/
│   │   ├── cognito/            # User Pool + Google OAuth
│   │   ├── rds/                # PostgreSQL db.t3.micro
│   │   ├── lambda/             # Funciones Lambda (API + jobs)
│   │   ├── api_gateway/        # REST API Gateway
│   │   ├── s3_cloudfront/      # ← YA EXISTE, solo se importa
│   │   ├── ses/                # ← YA EXISTE, solo se importa
│   │   └── eventbridge/        # Schedulers de recordatorios
│   └── environments/
│       ├── staging.tfvars
│       └── production.tfvars
│
├── frontend/                   # React SPA (build estático → S3)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── login.tsx
│   │   │   ├── dashboard/
│   │   │   ├── pacientes/
│   │   │   ├── odontograma/
│   │   │   ├── agenda/
│   │   │   ├── facturacion/
│   │   │   └── configuracion/
│   │   ├── components/
│   │   │   ├── odontograma/    # OdontogramaInteractivo.tsx (SVG adultos + niños)
│   │   │   ├── pacientes/
│   │   │   ├── pdf/            # ReciboPDF.tsx, ConsentimientoPDF.tsx
│   │   │   └── ui/
│   │   ├── lib/
│   │   │   ├── cognito.ts      # Cliente AWS Cognito (amazon-cognito-identity-js)
│   │   │   ├── api.ts          # Cliente para API Gateway
│   │   │   └── types.ts
│   │   └── public/
│   │       └── branding/       # favico.png, logos odontoval
│
├── backend/                    # Funciones Lambda (Python)
│   ├── api/                    # Handlers de API Gateway
│   │   ├── pacientes.py
│   │   ├── historias.py
│   │   ├── odontogramas.py
│   │   ├── facturas.py
│   │   └── citas.py
│   ├── jobs/                   # EventBridge Scheduler
│   │   ├── recordatorios.py    # Consulta citas → SES + Twilio
│   │   └── profilaxis.py       # Genera citas profilaxis pendientes
│   └── migrations/             # SQL de migraciones RDS
│       ├── 001_init.sql
│       └── 002_seed_tratamientos.sql
│
├── scripts/
│   └── migrate_odontoval.py    # Migración de ODONTOVAL.xlsx → RDS
│
└── README.md
```

---

### ADR-001-M: CI/CD (basado en el repo de referencia)

**Pipeline GitHub Actions — patrón tomado de `pumajd/DevOps-Actividad2-Terraform`:**

```
PR abierto → ci.yml:
  → Lint (ESLint + Prettier)
  → Tests unitarios (Vitest para frontend, pytest para Lambda)
  → Build React → carpeta /dist
  → Terraform plan (solo muestra cambios, no aplica)

Merge a main → deploy.yml:
  → Terraform apply (infra: Cognito, RDS, Lambda, EventBridge)
  → Migraciones SQL en RDS (via Lambda de migración)
  → Build React → aws s3 sync dist/ s3://odontoval-prod/
  → Invalidación CloudFront (distribución existente)
  → Deploy Lambda functions (zip + update function code)
  → Smoke test: GET /api/health → espera 200
```

**Secretos GitHub Actions requeridos:**
```
AWS_ACCESS_KEY_ID          # IAM user con permisos mínimos
AWS_SECRET_ACCESS_KEY
AWS_REGION                 # us-east-1 (donde está SES verificado)
CLOUDFRONT_DISTRIBUTION_ID # ID de la distribución existente
S3_BUCKET_NAME             # bucket existente de odontoval
TWILIO_ACCOUNT_SID         # para recordatorios WhatsApp
TWILIO_AUTH_TOKEN
```

---

## 4. Incidencias detectadas en los documentos fuente

| Ubicación | Problema encontrado | Corrección sugerida |
|---|---|---|
| `ODONTOVAL.xlsx` | Algunas filas de HC tienen cédulas vacías (ej: `BRAVO AJILA MIGUEL`) | El campo HC debe ser obligatorio en la app nueva. Para migración, marcar como "sin cédula - requiere actualización" |
| `ODONTOVAL.xlsx` | Notas informales en columna SALDO (ej: `"baja 224"`, `"205"`) | La app debe tener campo separado `notas` por fila de factura; no mezclar con el saldo numérico |
| `ontondograma.html` | El odontograma existente usa solo 3 tratamientos (Caries, Resina, Corona) | Ampliar a catálogo completo: Exodoncia, Endodoncia, Sellante, Implante, Prótesis parcial, Ausente |
| `ontondograma.html` | No tiene persistencia: al recargar se pierde todo | La app nueva guarda en base de datos en tiempo real (Supabase Realtime) |
| `HIS.xlsx` | El control periodontal está diseñado para V y P, pero el odontograma actual no lo implementa | Implementar el módulo periodontal como pantalla separada dentro de la visita |
| `HISTORIA CLINICA.pdf` | El formulario Google Forms no está vinculado a ningún sistema | Reemplazar completamente con el módulo de historia clínica de la app |
| `HIS.xlsx` | El campo "Control de cintas testigo" no tiene equivalente digital claro | Implementar como sección de "esterilización" en el control de evolución |

---

## 5. Arquitectura de despliegue (diagrama)

```
Usuario (browser / tablet)
        │  odontoval.com.ec
        ▼
  [CloudFront CDN] ✅ ya existe
  React SPA (archivos estáticos en S3) ✅ ya existe
        │
        ├──► [Cognito Hosted UI]  auth.odontoval.com.ec
        │     Google OAuth 2.0 → JWT con clinic_id + rol
        │
        ├──► [API Gateway REST]
        │     /api/pacientes, /api/odontogramas,
        │     /api/facturas, /api/citas, /api/radiografias
        │          │
        │          ▼
        │     [Lambda — Python]  (valida JWT + clinic_id)
        │          │
        │          ▼
        │     [RDS PostgreSQL]  VPC privada
        │     db.t3.micro, 20 GB
        │
        ├──► [S3 bucket privado]  ✅ extender el existente
        │     /radiografias/{clinic_id}/{paciente_id}/
        │     /pdfs/{clinic_id}/recibos/
        │     /pdfs/{clinic_id}/consentimientos/
        │     → acceso vía presigned URLs (15 min)
        │
        ├──► [SES] ✅ ya existe, dominio verificado
        │     Recordatorios de citas + invitaciones
        │          ↓
        │     Lambda odontoval-prod-email-forwarder ✅ ya existe
        │          ↓
        │     veritoamorita@hotmail.com (Reply-To al remitente)
        │
        └──► [Twilio WhatsApp API]  externo
              Recordatorios 24h y 2h antes de cita

[EventBridge Scheduler]
  → cada hora  → Lambda recordatorios.py  → SES + Twilio
  → cada lunes → Lambda profilaxis.py     → genera citas borrador

[GitHub Actions CI/CD]  (patrón: pumajd/DevOps-Actividad2-Terraform)
  → Terraform apply  (Cognito, RDS, Lambda, EventBridge, API Gateway)
  → aws s3 sync      (frontend React)
  → CloudFront invalidation
  → Lambda deploy    (backend Python)
```

---

## 6. Decisiones confirmadas (cerradas)

Todas las decisiones pendientes de la versión anterior han sido resueltas:

| # | Decisión | Resolución | ADR |
|---|---|---|---|
| 1 | Dominio | `odontoval.com.ec` (~$15/año) | ADR-001-B |
| 2 | Migración de datos | ✅ SÍ — script Python desde ODONTOVAL.xlsx | ADR-001-J |
| 3 | Radiografías | ✅ SÍ — S3 existente (5 GB free tier), presigned URLs | ADR-001-F |
| 4 | Recibos e impresión | ✅ SÍ — PDF en cliente con @react-pdf/renderer | ADR-001-G |
| 5 | Consentimiento informado | ✅ SÍ — PDF imprimible con plantillas editables | ADR-001-G |
| 6 | App móvil | 🔜 Fase 2 — React Native reutilizando lógica | ADR-001-A |
| 7 | Recordatorios WhatsApp/email | ✅ SÍ — Twilio + SES (ya configurado) | ADR-001-I |
| 9 | Stack de infraestructura | ✅ 100% AWS — S3+CloudFront+SES+Lambda+RDS+Cognito | ADR-001-B |
| 8 | Generador de citas profilaxis | ✅ SÍ — pg_cron + citas automáticas cada 6 meses | ADR-001-H |

---

## 7. Resumen ejecutivo (para el dueño del consultorio)

> **ODONTOVAL Web** (odontoval.com.ec) es una página web privada para tu consultorio. Entras con tu cuenta de Google — sin contraseña nueva que recordar. Desde ahí puedes buscar cualquier paciente, ver su historial completo, marcar los dientes en el odontograma (uno para adultos y otro para niños), subir radiografías, imprimir recibos de pago y consentimientos informados, y manejar tu agenda de citas. El sistema te avisa automáticamente a cada paciente por WhatsApp o correo 24 horas antes de su cita, y te recuerda qué pacientes necesitan su limpieza de los 6 meses. Toda la información histórica de tu hoja de cálculo actual se transfiere a la nueva app. Solo tú y las personas que tú autorices pueden ver la información. El costo de mantenerlo encendido es cercano a **$0/mes** para tu volumen de trabajo actual.

---

*Próximos pasos: revisar y aprobar este documento → **Tarea 2 (Análisis de costos detallado)** → Tarea 3 (Repositorio y código base)*
