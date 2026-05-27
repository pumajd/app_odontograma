variable "rest_api_id"   { type = string }
variable "resource_id"   { type = string }
variable "http_method"   { type = string; default = "ANY" }
variable "authorizer_id" { type = string }
variable "lambda_arn"    { type = string }
variable "lambda_name"   { type = string }
variable "aws_region"    { type = string; default = "us-east-1" }
variable "aws_account_id"{ type = string }
