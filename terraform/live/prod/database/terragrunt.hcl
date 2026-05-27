# live/prod/database/terragrunt.hcl
# Paso 5: RDS PostgreSQL db.t3.micro
# NOTA: Para el primer deploy se requiere una VPC con subnets privadas.
# Si se usa la VPC default de AWS, ajustar los IDs de subnets abajo.

terraform {
  source = "../../../modules//database"
}

locals {
  env_vars    = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  project     = local.env_vars.locals.project
  environment = local.env_vars.locals.environment
  aws_region  = local.env_vars.locals.aws_region
}

remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  config = {
    bucket       = "${local.project}-tfstate-${local.environment}"
    key          = "database/terraform.tfstate"
    region       = local.aws_region
    encrypt      = true
    use_lockfile = true
  }
}

generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
provider "aws" {
  region = "${local.aws_region}"
  default_tags {
    tags = {
      Project     = "${local.project}"
      Environment = "${local.environment}"
      ManagedBy   = "terragrunt"
    }
  }
}
EOF
}

inputs = {
  project     = local.project
  environment = local.environment

  # VPC — usar la default de AWS (ajustar si se crea VPC dedicada)
  vpc_id             = get_env("TF_VAR_vpc_id", "")
  private_subnet_ids = split(",", get_env("TF_VAR_private_subnet_ids", ""))

  # Instancia Free Tier
  instance_class    = "db.t3.micro"
  allocated_storage = 20

  # Credenciales — inyectadas desde GitHub Secrets
  db_password = get_env("TF_VAR_db_password")
}
