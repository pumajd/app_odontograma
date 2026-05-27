locals {
  name_prefix = "${var.project}-${var.environment}"

  common_tags = merge(
    {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
      Module      = "database"
    },
    var.tags
  )
}

# ─────────────────────────────────────────────
# Security Group para RDS — solo permite tráfico desde Lambdas
# ─────────────────────────────────────────────
resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-rds-sg"
  description = "Acceso a RDS PostgreSQL solo desde Lambdas ODONTOVAL"
  vpc_id      = var.vpc_id
  tags        = local.common_tags

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = var.lambda_security_group_ids
    description     = "PostgreSQL desde Lambdas"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ─────────────────────────────────────────────
# Subnet Group para RDS (subnets privadas)
# ─────────────────────────────────────────────
resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db-subnet-group"
  subnet_ids = var.private_subnet_ids
  tags       = local.common_tags
}

# ─────────────────────────────────────────────
# Parameter Group — configuración PostgreSQL 15
# ─────────────────────────────────────────────
resource "aws_db_parameter_group" "pg15" {
  name   = "${local.name_prefix}-pg15"
  family = "postgres15"
  tags   = local.common_tags

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"  # logear queries > 1 segundo
  }
}

# ─────────────────────────────────────────────
# RDS PostgreSQL — db.t3.micro (Free Tier)
# ─────────────────────────────────────────────
resource "aws_db_instance" "main" {
  identifier = "${local.name_prefix}-db"
  tags       = local.common_tags

  # Motor
  engine               = "postgres"
  engine_version       = "15.8"
  instance_class       = var.instance_class   # db.t3.micro por defecto
  allocated_storage    = var.allocated_storage # 20 GB por defecto
  storage_type         = "gp2"
  storage_encrypted    = true

  # Credenciales
  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  # Red
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false  # solo accesible desde la VPC

  # Configuración
  parameter_group_name = aws_db_parameter_group.pg15.name
  multi_az             = false    # Free Tier no soporta Multi-AZ
  skip_final_snapshot  = var.environment != "prod"

  # Backups automáticos
  backup_retention_period = 7     # 7 días de backups
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  # Actualizaciones automáticas de parches menores
  auto_minor_version_upgrade = true

  # Monitoreo
  monitoring_interval = 0   # desactivado en Free Tier (requiere Enhanced Monitoring)

  lifecycle {
    prevent_destroy = true   # nunca destruir la BD accidentalmente
  }
}
