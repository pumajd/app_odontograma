# live/prod/api/terragrunt.hcl
# Paso 7: API Gateway + Lambdas backend

terraform {
  source = "../../../modules//api"
}

locals {
  env_vars    = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  project     = local.env_vars.locals.project
  environment = local.env_vars.locals.environment
  aws_region  = local.env_vars.locals.aws_region
}

dependency "auth" {
  config_path = "../auth"
  mock_outputs = {
    user_pool_id  = "us-east-1_MOCK"
    user_pool_arn = "arn:aws:cognito-idp:us-east-1:123456789012:userpool/us-east-1_MOCK"
    client_id     = "MOCKCLIENTID"
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

dependency "storage" {
  config_path = "../storage"
  mock_outputs = {
    bucket_name = "odontoval-prod-radiografias"
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
    key          = "api/terraform.tfstate"
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
  aws_region  = local.aws_region
  domain_name = "odontoval.com.ec"

  cognito_user_pool_id  = dependency.auth.outputs.user_pool_id
  cognito_user_pool_arn = dependency.auth.outputs.user_pool_arn
  cognito_client_id     = dependency.auth.outputs.client_id

  db_host     = split(":", dependency.database.outputs.endpoint)[0]
  db_name     = dependency.database.outputs.db_name
  db_password = get_env("TF_VAR_db_password")

  radiografias_bucket = dependency.storage.outputs.bucket_name
}
