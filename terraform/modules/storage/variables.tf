variable "project"     { type = string }
variable "environment" { type = string }
variable "domain_name" { type = string }
variable "lambda_backend_role_arn" { type = string }
variable "tags" { type = map(string); default = {} }
