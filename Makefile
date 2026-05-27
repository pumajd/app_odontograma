# ==============================================================================
# Makefile - ODONTOVAL
# Requiere: docker, docker compose, node, python 3.12+
# ==============================================================================

.PHONY: help dev dev-down dev-logs dev-reset seed seed-reset frontend test lint \
        db-shell s3-ls s3-presign health

# -- Colores -------------------------------------------------------------------
CYAN  := \033[0;36m
GREEN := \033[0;32m
RESET := \033[0m

help:  ## Muestra esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "$(CYAN)%-18s$(RESET) %s\n", $$1, $$2}'

# -- Entorno local -------------------------------------------------------------

dev:  ## Levanta PostgreSQL + LocalStack + Backend (Docker Compose)
	@echo "Copiando .env.local si no existe..."
	@[ -f frontend/.env.local ] || cp frontend/.env.local.example frontend/.env.local
	@echo "Iniciando servicios..."
	docker compose up --build -d
	@echo ""
	@echo "$(GREEN)Servicios levantados:$(RESET)"
	@echo "   Backend API:  http://localhost:8000"
	@echo "   PostgreSQL:   localhost:5432  (odontoval / odontoval_local)"
	@echo "   LocalStack:   http://localhost:4566"
	@echo ""
	@echo "Carga los datos de prueba con:  make seed"
	@echo "Inicia el frontend con:         make frontend"

dev-down:  ## Detiene y elimina contenedores y volumenes
	docker compose down -v

dev-logs:  ## Muestra los logs de todos los servicios
	docker compose logs -f

dev-reset:  ## Reinicia el entorno y recarga los datos de prueba
	docker compose down -v
	docker compose up --build -d
	@echo "Esperando que PostgreSQL este listo..."
	@sleep 5
	$(MAKE) seed

# -- Seeds (datos de prueba) ---------------------------------------------------

seed:  ## Carga los datos de prueba en la base de datos local
	@echo "Cargando datos de prueba..."
	docker compose exec -T postgres \
	  psql -U odontoval -d odontoval -f /seeds/001_dev_data.sql
	@echo "$(GREEN)Seed completado.$(RESET)"

seed-reset:  ## Limpia y recarga los datos de prueba (no elimina el esquema)
	@echo "Recargando datos de prueba..."
	docker compose exec -T postgres \
	  psql -U odontoval -d odontoval -f /seeds/001_dev_data.sql
	@echo "$(GREEN)Seed recargado.$(RESET)"

# -- Frontend ------------------------------------------------------------------

frontend:  ## Instala dependencias e inicia el servidor de desarrollo Vite
	cd frontend && npm install && npm run dev

# -- Tests backend -------------------------------------------------------------

test:  ## Ejecuta los tests unitarios del backend
	cd backend && python -m pytest -v

lint:  ## Linting del backend con flake8
	cd backend && python -m flake8 src/ --max-line-length=100 --exclude=__pycache__

# -- Utilidades ----------------------------------------------------------------

db-shell:  ## Abre psql en el contenedor de PostgreSQL
	docker compose exec postgres psql -U odontoval -d odontoval

s3-ls:  ## Lista los objetos en el bucket S3 de LocalStack
	aws --endpoint-url=http://localhost:4566 \
	    s3 ls s3://odontoval-local-radiografias/ --recursive

s3-presign:  ## Genera URL de prueba (uso: make s3-presign KEY=clinic/pac/foto.jpg)
	aws --endpoint-url=http://localhost:4566 \
	    s3 presign s3://odontoval-local-radiografias/$(KEY) --expires-in 300

health:  ## Verifica que el backend este respondiendo
	@curl -s http://localhost:8000/health | python3 -m json.tool
