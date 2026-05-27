variable "bucket_name" {
  description = "Nombre único del bucket S3 que alojará los archivos estáticos."
  type        = string
}

variable "environment" {
  description = "Entorno de despliegue (prod, staging, dev)."
  type        = string
}

variable "project" {
  description = "Nombre del proyecto, usado para etiquetar recursos."
  type        = string
}

variable "default_root_object" {
  description = "Objeto raíz de la distribución CloudFront."
  type        = string
  default     = "index.html"
}

variable "price_class" {
  description = "Clase de precio de CloudFront (PriceClass_100 = solo NA+EU, más barato)."
  type        = string
  default     = "PriceClass_100"
}

variable "custom_error_responses" {
  description = "Respuestas de error personalizadas para SPAs (redirige 403/404 a index.html)."
  type = list(object({
    error_code            = number
    response_code         = number
    response_page_path    = string
    error_caching_min_ttl = number
  }))
  default = [
    {
      error_code            = 403
      response_code         = 200
      response_page_path    = "/index.html"
      error_caching_min_ttl = 10
    },
    {
      error_code            = 404
      response_code         = 200
      response_page_path    = "/index.html"
      error_caching_min_ttl = 10
    }
  ]
}

variable "tags" {
  description = "Mapa de etiquetas adicionales para todos los recursos."
  type        = map(string)
  default     = {}
}

variable "enable_logging" {
  description = "Habilita o deshabilita los logs de acceso de CloudFront."
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "Número de días para retener los logs de acceso en S3."
  type        = number
  default     = 90
}

# ─────────────────────────────────────────────
# Dominio personalizado (opcional)
# ─────────────────────────────────────────────

variable "domain_name" {
  description = <<-EOT
    Dominio raíz para la distribución CloudFront (ej: odontoval.com.ec).
    Si se deja vacío, CloudFront usa su dominio *.cloudfront.net sin certificado propio.
    Requiere route53_zone_id cuando se configura.
  EOT
  type    = string
  default = ""
}

variable "create_www_record" {
  description = "Si es true, añade www.<domain_name> al certificado ACM y crea el alias Route 53 correspondiente."
  type        = bool
  default     = true
}

variable "route53_zone_id" {
  description = "ID de la zona Route 53 del dominio. Requerido cuando domain_name está configurado."
  type        = string
  default     = ""
}
