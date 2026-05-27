variable "project"     { type = string }
variable "environment" { type = string }
variable "domain_name" { type = string }
variable "google_client_id"     { type = string; sensitive = true }
variable "google_client_secret" { type = string; sensitive = true }
variable "acm_certificate_arn"  { type = string; default = "" }
variable "tags" { type = map(string); default = {} }
