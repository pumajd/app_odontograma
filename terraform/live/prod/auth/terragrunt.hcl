# live/prod/auth/terragrunt.hcl
# Paso 4: Cognito User Pool + Google OAuth
# Requiere: static-site (para el ACM cert del dominio auth.odontoval.com.ec)

terraform {
  source = "../../../modules//auth"
}

locals {
  env_vars    = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  project     = local.env_vars.locals.project
  environment = local.env_vars.locals.environment
  aws_region  = local.env_vars.locals.aws_region
}

dependency "static_site" {
  config_path = "../static-site"
  mock_outputs = {
    cloudfront_distribution_arn = "arn:aws:cloudfront::123456789012:distribution/MOCK"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  config = {
    bucket       = "${local.project}-tfstate-${local.environment}"
    key          = "auth/terraform.tfstate"
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
  domain_name = "odontoval.com.ec"

  # Credenciales de Google OAuth — inyectadas como secretos en CI/CD
  google_client_id     = get_env("TF_VAR_google_client_id")
  google_client_secret = get_env("TF_VAR_google_client_secret")
}
