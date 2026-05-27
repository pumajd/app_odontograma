# ─────────────────────────────────────────────────────────────────────────────
# live/prod/dns/terragrunt.hcl
# Paso 1: Crea la zona Route 53.
# Después de aplicar → copia los nameservers del output y cámbialos en NIC.EC
# ─────────────────────────────────────────────────────────────────────────────

terraform {
  source = "../../../modules//dns"
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
    key          = "dns/terraform.tfstate"
    region       = local.aws_region
    encrypt      = true
    use_lockfile = true
  }
}

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

inputs = {
  project     = local.project
  environment = local.env_vars.locals.environment
  domain      = "odontoval.com.ec"
}
