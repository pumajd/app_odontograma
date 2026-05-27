# live/prod/storage/terragrunt.hcl
# Paso 6: S3 bucket para radiografías

terraform {
  source = "../../../modules//storage"
}

locals {
  env_vars    = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  project     = local.env_vars.locals.project
  environment = local.env_vars.locals.environment
  aws_region  = local.env_vars.locals.aws_region
}

dependency "api" {
  config_path = "../api"
  mock_outputs = {
    lambda_backend_role_arn = "arn:aws:iam::123456789012:role/mock-role"
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
    key          = "storage/terraform.tfstate"
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
  project                  = local.project
  environment              = local.environment
  domain_name              = "odontoval.com.ec"
  lambda_backend_role_arn  = dependency.api.outputs.lambda_backend_role_arn
}
