# ─────────────────────────────────────────────────────────────────────────────
# live/prod/email/terragrunt.hcl
# Paso 3 (junto con static-site): Crea SES + S3 + Lambda y los registros DNS.
# Requiere que live/prod/dns ya esté aplicado y los nameservers en NIC.EC propagados.
# ─────────────────────────────────────────────────────────────────────────────

terraform {
  source = "../../../modules//email"
}

locals {
  env_vars    = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  project     = local.env_vars.locals.project
  environment = local.env_vars.locals.environment
  aws_region  = local.env_vars.locals.aws_region
}

# ── Dependencia: la zona Route 53 debe existir primero ───────────────────────
dependency "dns" {
  config_path = "../dns"

  mock_outputs = {
    zone_id = "MOCK_ZONE_ID"
    domain  = "odontoval.com.ec"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

# ── Backend remoto ────────────────────────────────────────────────────────────
remote_state {
  backend = "s3"

  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }

  config = {
    bucket       = "${local.project}-tfstate-${local.environment}"
    key          = "email/terraform.tfstate"
    region       = local.aws_region
    encrypt      = true
    use_lockfile = true
  }
}

# ── Provider AWS ──────────────────────────────────────────────────────────────
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

# archive provider — para empaquetar la Lambda en zip
provider "archive" {}
EOF
}

# ── Inputs ────────────────────────────────────────────────────────────────────
inputs = {
  project     = local.project
  environment = local.env_vars.locals.environment

  # Dominio verificado en SES
  domain = "odontoval.com.ec"

  # Correos que SES debe recibir (añade los que necesites)
  receive_emails = ["info@odontoval.com.ec", "contacto@odontoval.com.ec"]

  # Gmail personal al que se reenvían los correos entrantes
  forward_to_email = "veritoamorita@hotmail.com"

  # Remitente verificado en SES usado al reenviar (debe ser del dominio)
  from_email = "noreply@odontoval.com.ec"

  # Route 53: crea los registros DNS de SES automáticamente
  route53_zone_id = dependency.dns.outputs.zone_id
}
