# ─────────────────────────────────────────────────────────────────────────────
# live/prod/static-site/terragrunt.hcl
# Paso 2: Crea S3 + CloudFront con dominio y certificado SSL.
# Requiere que live/prod/dns ya esté aplicado y los nameservers configurados en NIC.EC.
# ─────────────────────────────────────────────────────────────────────────────

terraform {
  source = "../../../modules//static-site"
}

locals {
  env_vars    = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  project     = local.env_vars.locals.project
  environment = local.env_vars.locals.environment
  aws_region  = local.env_vars.locals.aws_region
}

# ── Dependencia: la zona Route 53 debe existir antes de crear el certificado ──
dependency "dns" {
  config_path = "../dns"

  # Valores mock para que `terragrunt validate` funcione sin aplicar dns primero
  mock_outputs = {
    zone_id = "MOCK_ZONE_ID"
    domain  = "odontoval.com.ec"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

# ── Backend remoto: un estado por entorno ────────────────────────────────────
remote_state {
  backend = "s3"

  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }

  config = {
    bucket       = "${local.project}-tfstate-${local.environment}"
    key          = "static-site/terraform.tfstate"
    region       = local.aws_region
    encrypt      = true
    use_lockfile = true
  }
}

# ── Provider AWS generado automáticamente ────────────────────────────────────
generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"

  contents = <<EOF
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

# ── Inputs ────────────────────────────────────────────────────────────────────
inputs = {
  project     = local.project
  environment = local.environment
  bucket_name = "${local.project}-site-${local.environment}"

  # Dominio personalizado — conectado a la zona Route 53 del módulo dns
  domain_name       = "odontoval.com.ec"
  create_www_record = true
  route53_zone_id   = dependency.dns.outputs.zone_id
}
