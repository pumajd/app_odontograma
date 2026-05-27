variable "project"     { type = string }
variable "environment" { type = string }
variable "vpc_id"      { type = string }
variable "private_subnet_ids"        { type = list(string) }
variable "lambda_security_group_ids" { type = list(string); default = [] }
variable "instance_class"    { type = string; default = "db.t3.micro" }
variable "allocated_storage" { type = number; default = 20 }
variable "db_name"     { type = string; default = "odontoval" }
variable "db_username" { type = string; default = "odontoval" }
variable "db_password" { type = string; sensitive = true }
variable "tags"        { type = map(string); default = {} }
