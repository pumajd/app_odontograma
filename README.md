# ODONTOVAL — Sistema de Gestión Odontológica

PWA multi-tenant para registro de odontogramas, historia clínica, facturación y gestión de citas.  
Dominio: **odontoval.com.ec** | Región AWS: **us-east-1**

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│  Usuario (navegador / móvil)                                │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS
              ┌────────▼────────┐
              │   CloudFront    │  CDN global + cabeceras de seguridad
              └────────┬────────┘
          ┌────────────┴────────────┐
          │                         │
   ┌──────▼──────┐         ┌────────▼────────┐
   │  S3 (React) │         │  API Gateway    │  REST API
   │  PWA build  │         └────────┬────────┘
   └─────────────┘                  │
                            ┌───────▼────────┐
                            │ Lambda Backend │  Python 3.12
                            └───────┬────────┘
                     ┌─────────────┬┴──────────────┐
              ┌──────▼──────┐  ┌───▼────┐  ┌───────▼──────┐
              │  RDS Postgres│  │S3 Imgs │  │   Cognito    │
              │  (datos)     │  │(radios)│  │ (Google Auth)│
              └─────────────┘  └────────┘  └──────────────┘
                                    │
                            ┌───────▼────────┐
                            │  EventBridge   │  Recordatorios / profilaxis
                            │  Scheduler     │
                            └───────┬────────┘
                                    │
                            ┌───────▼────────┐
                            │  SES + Lambda  │  Email forwarder (existente)
                            └────────────────┘
```

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, PWA |
| Odontograma | SVG interactivo (FDI notation) |
| PDF | @react-pdf/renderer (recibos, consentimientos) |
| Auth | AWS Cognito + Google OAuth |
| Backend | AWS Lambda Python 3.12 + API Gateway REST |
| Base de datos | AWS RDS PostgreSQL 15 (db.t3.micro) |
| Almacenamiento | AWS S3 (sitio estático + radiografías) |
| CDN | AWS CloudFront con OAC |
| Correo | AWS SES (envío y recepción) |
| Recordatorios | AWS EventBridge Scheduler + Twilio WhatsApp |
| IaC | Terraform + Terragrunt |
| CI/CD | GitHub Actions |

---

## Estructura del repositorio

```
app_odontograma/
├── .github/
│   └── workflows/
│       ├── ci.yml          # PR: lint + test + terraform plan
│       └── deploy.yml      # main: terraform apply + deploy frontend
├── frontend/               # React PWA
│   ├── src/
│   │   ├── components/
│   │   │   ├── Odontograma/   # SVG adulto (FDI 11-48) y niño (FDI 51-85)
│   │   │   ├── Pacientes/
│   │   │   ├── Citas/
│   │   │   └── Facturacion/
│   │   ├── pages/
│   │   ├── services/          # llamadas a la API
│   │   └── hooks/
│   └── package.json
├── backend/                # Lambda handlers Python
│   ├── src/
│   │   ├── handlers/          # pacientes, odontogramas, citas, facturas
│   │   ├── models/
│   │   └── utils/
│   ├── tests/
│   └── requirements.txt
├── database/
│   └── migrations/
│       └── 001_initial_schema.sql
├── scripts/
│   └── migrate_xlsx.py     # migración idempotente desde ODONTOVAL.xlsx
├── terraform/
│   ├── modules/
│   │   ├── auth/           # Cognito User Pool + Google IdP
│   │   ├── database/       # RDS PostgreSQL
│   │   ├── api/            # API Gateway + Lambda backend
│   │   ├── scheduler/      # EventBridge Scheduler
│   │   ├── storage/        # S3 radiografías
│   │   ├── dns/            # Route 53 (existente)
│   │   ├── email/          # SES + Lambda forwarder (existente)
│   │   └── static-site/    # S3 + CloudFront (existente)
│   └── live/prod/
│       ├── auth/
│       ├── database/
│       ├── api/
│       ├── scheduler/
│       ├── storage/
│       ├── dns/
│       ├── email/
│       └── static-site/
└── ADR-001-arquitectura.md
```

---

## Inicio rápido

### Prerrequisitos

- Node.js 20+
- Python 3.12+
- Terraform 1.9+ y Terragrunt 0.67+
- AWS CLI configurado con perfil `odontoval`

### Frontend (desarrollo local)

```bash
cd frontend
npm install
npm run dev
# Abre http://localhost:5173
```

### Backend (prueba local con SAM)

```bash
cd backend
pip install -r requirements.txt
# Para pruebas unitarias:
pytest tests/
```

### Infraestructura

```bash
cd terraform/live/prod/<modulo>
terragrunt plan   # revisa cambios
terragrunt apply  # aplica (requiere aprobación manual)
```

### Orden de despliegue (primera vez)

```
1. dns          → crea la zona Route 53
2. static-site  → S3 + CloudFront
3. email        → SES + Lambda forwarder
4. auth         → Cognito + Google OAuth
5. database     → RDS PostgreSQL
6. storage      → S3 radiografías
7. api          → API Gateway + Lambda backend
8. scheduler    → EventBridge recordatorios
```

---

## Variables de entorno requeridas

### GitHub Secrets (para CI/CD)

| Secret | Descripción |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | IAM key con permisos de deploy |
| `AWS_SECRET_ACCESS_KEY` | IAM secret |
| `TWILIO_ACCOUNT_SID` | Cuenta Twilio para WhatsApp |
| `TWILIO_AUTH_TOKEN` | Token Twilio |
| `DB_PASSWORD` | Contraseña RDS (generada con `openssl rand -base64 32`) |
| `GOOGLE_CLIENT_ID` | Client ID de Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Client Secret de Google OAuth |

### Frontend (.env.local)

```
VITE_API_URL=https://api.odontoval.com.ec
VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
VITE_COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_COGNITO_DOMAIN=auth.odontoval.com.ec
```

---

## Convenciones

- **Ramas:** `main` (producción), `develop` (integración), `feature/*`
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)
- **Notación dental:** FDI (adultos 11-48, deciduos 51-85)
- **Multi-tenancy:** todas las tablas incluyen `clinic_id` como FK obligatoria
- **Idioma:** código en inglés, comentarios y commits en español

---

## Documentos del proyecto

| Documento | Descripción |
|-----------|-------------|
| [ADR-001-arquitectura.md](./ADR-001-arquitectura.md) | Decisiones de arquitectura |
| [COSTO-002-analisis-nube-vs-onpremise.md](./COSTO-002-analisis-nube-vs-onpremise.md) | Análisis de costos AWS vs GCP vs On-Premise |
