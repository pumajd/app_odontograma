# live/prod/env.hcl
# Variables específicas del entorno de producción.
# Referenciado desde terragrunt.hcl raíz y los módulos hijos.

locals {
  project     = "odontoval"       # Cambia por el nombre de tu proyecto
  environment = "prod"
  aws_region  = "us-east-1"       # Cambia por tu región
}
