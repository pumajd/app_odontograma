variable "project"     { type = string }
variable "environment" { type = string }
variable "aws_region"  { type = string; default = "us-east-1" }
variable "domain_name" { type = string }

variable "db_host"     { type = string }
variable "db_name"     { type = string; default = "odontoval" }
variable "db_username" { type = string; default = "odontoval" }
variable "db_password" { type = string; sensitive = true }

variable "cognito_user_pool_id"  { type = string }
variable "cognito_user_pool_arn" { type = string }
variable "cognito_client_id"     { type = string }

variable "radiografias_bucket"      { type = string }
variable "deployment_package_path"  { type = string; default = "../../../backend/backend.zip" }

variable "aws_account_id" { type = string }

variable "tags" { type = map(string); default = {} }
