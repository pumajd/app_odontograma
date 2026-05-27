# live/prod/scheduler/terragrunt.hcl
# Paso 8: EventBridge Scheduler — recordatorios y profilaxis

terraform {
  source = "../../../modules//scheduler"
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

dependency "database" {
  config_path = "../database"
  mock_outputs = {
    endpoint = "mock.rds.amazonaws.com:5432"
    db_name  = "odontoval"
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
    key          = "scheduler/terraform.tfstate"
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

  lambda_backend_role_arn = dependency.api.outputs.lambda_backend_role_arn
  db_host                 = split(":", dependency.database.outputs.endpoint)[0]
  db_name                 = dependency.database.outputs.db_name
  db_password             = get_env("TF_VAR_db_password")

  twilio_account_sid = get_env("TF_VAR_twilio_account_sid", "")
  twilio_auth_token  = get_env("TF_VAR_twilio_auth_token", "")

  deployment_package_path = "../../../backend/backend.zip"
}
