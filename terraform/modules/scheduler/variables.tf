variable "project"     { type = string }
variable "environment" { type = string }
variable "db_host"     { type = string }
variable "db_name"     { type = string; default = "odontoval" }
variable "db_username" { type = string; default = "odontoval" }
variable "db_password" { type = string; sensitive = true }
variable "twilio_account_sid" { type = string; sensitive = true; default = "" }
variable "twilio_auth_token"  { type = string; sensitive = true; default = "" }
variable "lambda_backend_role_arn"  { type = string }
variable "lambda_reminders_arn"     { type = string; default = "" }
variable "lambda_profilaxis_arn"    { type = string; default = "" }
variable "deployment_package_path"  { type = string }
variable "tags" { type = map(string); default = {} }
