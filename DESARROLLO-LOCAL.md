# Guía de desarrollo local — ODONTOVAL

Prueba toda la aplicación en tu máquina **sin necesidad de AWS real**.

## Requisitos previos

| Herramienta | Versión mínima | Instalación |
|-------------|----------------|-------------|
| Docker Desktop | 4.x | https://docs.docker.com/get-docker/ |
| Node.js | 20 LTS | https://nodejs.org |
| Python | 3.12 | https://python.org |
| AWS CLI | 2.x | https://aws.amazon.com/cli/ (solo para `make s3-ls`) |

## Arquitectura local

```
┌─────────────────────────────────────────────────────┐
│  Tu máquina                                         │
│                                                     │
│  ┌───────────────┐    HTTP :8000    ┌─────────────┐ │
│  │  Vite dev     │ ──────────────▶ │  Flask      │ │
│  │  :5173        │                 │  local_srv  │ │
│  └───────────────┘                 └──────┬──────┘ │
│                                           │         │
│                            ┌──────────────▼──────┐  │
│                            │   Docker Compose    │  │
│                            │                     │  │
│                            │  ┌───────────────┐  │  │
│                            │  │  PostgreSQL   │  │  │
│                            │  │  :5432        │  │  │
│                            │  └───────────────┘  │  │
│                            │  ┌───────────────┐  │  │
│                            │  │  LocalStack   │  │  │
│                            │  │  S3 + SES     │  │  │
│                            │  │  :4566        │  │  │
│                            │  └───────────────┘  │  │
│                            └─────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Inicio rápido

```bash
# 1. Levantar PostgreSQL + LocalStack + Backend API
make dev

# 2. En otra terminal, iniciar el frontend
make frontend

# 3. Abrir en el navegador
open http://localhost:5173
```

Eso es todo. La primera vez tarda ~2 minutos en descargar las imágenes Docker.

## ¿Qué simula cada servicio?

### PostgreSQL (puerto 5432)
- Equivale a RDS PostgreSQL 15 en producción.
- La migración `database/migrations/001_initial_schema.sql` se ejecuta automáticamente al crear el contenedor.
- Datos: `docker volume odontoval_postgres_data` (persiste entre reinicios).

### LocalStack (puerto 4566)
- Simula S3 y SES de AWS sin costo ni credenciales reales.
- El bucket `odontoval-local-radiografias` se crea automáticamente al arrancar.
- Las presigned URLs apuntan a `http://localhost:4566` en lugar de `s3.amazonaws.com`.
- SES: los emails "se envían" pero no llegan a ningún lado (solo se registran en LocalStack).

### Backend Flask (puerto 8000)
- Carga los mismos handlers Lambda de `backend/src/handlers/`.
- Modo `LOCAL_DEV=true`: omite la validación JWT de Cognito y usa un usuario de prueba fijo.
- Recarga automáticamente el código cuando detecta cambios en `backend/src/`.

## Variables de entorno del backend (LOCAL_DEV)

Definidas en `docker-compose.yml`:

| Variable | Valor local | Descripción |
|----------|-------------|-------------|
| `LOCAL_DEV` | `true` | Activa el modo local (salta validación JWT) |
| `LOCAL_CLINIC_ID` | `000...001` | UUID de la clínica de prueba |
| `LOCAL_USER_SUB` | `000...099` | UUID del usuario de prueba |
| `LOCAL_USER_EMAIL` | `dev@odontoval.local` | Email del usuario |
| `DB_HOST` | `postgres` | Resuelto por Docker Compose |
| `AWS_ENDPOINT_URL` | `http://localstack:4566` | Redirige boto3 a LocalStack |

## Variables de entorno del frontend

Copia `frontend/.env.local.example` a `frontend/.env.local` (se hace automáticamente con `make dev`).

En modo local, la autenticación de Cognito está desactivada. El frontend usa un token ficticio que el backend acepta sin validar.

> Si quieres probar el flujo real de Google OAuth, pon los valores reales de Cognito
> en `frontend/.env.local` y elimina `VITE_LOCAL_DEV=true`.

## Comandos útiles

```bash
make dev          # Levantar todos los servicios Docker
make dev-down     # Detener y eliminar contenedores y datos
make dev-reset    # Reset completo (borra todos los datos)
make dev-logs     # Ver logs en tiempo real
make frontend     # Iniciar Vite en :5173
make test         # Ejecutar tests unitarios de Python
make lint         # Linting con flake8
make db-shell     # Consola SQL directa: psql
make health       # Verificar que el backend responde
make s3-ls        # Listar archivos subidos a S3 local
```

## Acceso directo a la base de datos

```bash
make db-shell
```

Desde psql puedes consultar, por ejemplo:
```sql
SELECT id, nombres, apellidos, cedula FROM pacientes LIMIT 10;
SELECT id, numero, total, estado FROM facturas ORDER BY fecha_emision DESC;
```

## Subida de radiografías en local

El flujo de presigned URL funciona igual que en producción pero apuntando a LocalStack:

1. Frontend llama `POST /radiografias` → backend genera presigned URL de LocalStack.
2. Frontend sube el archivo con `PUT` a `http://localhost:4566/...`.
3. Frontend llama `PATCH /radiografias/{id}/confirmar`.

Para ver los archivos subidos:
```bash
make s3-ls
```

## Solución de problemas frecuentes

**El backend no arranca / error de conexión a BD**
```bash
docker compose ps          # verificar que postgres esté healthy
docker compose logs postgres
```

**LocalStack tarda en iniciar**
El health check espera hasta 150 segundos. Si tarda más:
```bash
docker compose logs localstack
```

**Error `sslmode=require` al conectar a PostgreSQL**
Asegúrate de que `LOCAL_DEV=true` esté en las variables del contenedor `backend`.

**Los cambios en el backend no se reflejan**
El servidor Flask tiene `debug=True` y recarga automáticamente. Si aun así no se reflejan:
```bash
docker compose restart backend
```

**Puerto 5432 ocupado (PostgreSQL local instalado en Windows)**
Cambia el puerto en `docker-compose.yml`:
```yaml
ports:
  - "5433:5432"   # usa 5433 externamente
```
Y actualiza `make db-shell` si lo necesitas.

## Diferencias con producción

| Aspecto | Local | Producción |
|---------|-------|------------|
| Auth | Sin validación (LOCAL_DEV) | JWT Cognito RS256 |
| Base de datos | Docker PostgreSQL | RDS Multi-AZ |
| S3 | LocalStack :4566 | AWS S3 real |
| SES | LocalStack (no envía) | AWS SES real |
| CORS | `localhost:5173` | `odontoval.com.ec` |
| SSL/TLS | Sin SSL en BD | `sslmode=require` |
| Lambda | Flask local | AWS Lambda Python 3.12 |
