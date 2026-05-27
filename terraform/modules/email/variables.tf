# ─────────────────────────────────────────────
# Módulo: email
# Variables de configuración
# ─────────────────────────────────────────────

variable "domain" {
  description = "Dominio a verificar en SES para envío y recepción (ej: odontoval.com.ec)."
  type        = string
}

variable "receive_emails" {
  description = "Lista de direcciones de correo que SES debe recibir y reenviar (ej: [\"info@odontoval.com.ec\"])."
  type        = list(string)
}

variable "forward_to_email" {
  description = "Dirección personal (Gmail u otro) a la que se reenviarán los correos entrantes."
  type        = string
}

variable "from_email" {
  description = <<-EOT
    Dirección verificada en SES usada como remitente al reenviar.
    Debe pertenecer al dominio verificado (ej: noreply@odontoval.com.ec).
    El correo original aparecerá en el campo Reply-To para poder responder directamente.
  EOT
  type        = string
}

variable "s3_prefix" {
  description = "Prefijo (carpeta) dentro del bucket de correos donde SES guardará los mensajes crudos."
  type        = string
  default     = "emails/"
}

variable "email_retention_days" {
  description = "Días que se conservan los correos crudos en S3 antes de eliminarse automáticamente."
  type        = number
  default     = 30
}

variable "lambda_timeout" {
  description = "Tiempo máximo de ejecución de la Lambda en segundos."
  type        = number
  default     = 30
}

variable "lambda_memory" {
  description = "Memoria asignada a la Lambda en MB."
  type        = number
  default     = 128
}

variable "project" {
  description = "Nombre del proyecto, usado para nombrar y etiquetar recursos."
  type        = string
}

variable "environment" {
  description = "Entorno de despliegue (prod, staging, dev)."
  type        = string
}

variable "tags" {
  description = "Mapa de etiquetas adicionales para todos los recursos del módulo."
  type        = map(string)
  default     = {}
}

# ─────────────────────────────────────────────
# Route 53 (opcional)
# ─────────────────────────────────────────────

variable "route53_zone_id" {
  description = <<-EOT
    ID de la zona Route 53 del dominio.
    Si se provee, Terraform crea automáticamente todos los registros DNS que SES necesita:
      • TXT  _amazonses.<dominio>       → token de verificación
      • MX   <dominio>                 → inbound-smtp.<región>.amazonaws.com
      • CNAME <token>._domainkey.<dom> → <token>.dkim.amazonses.com  (×3)
    Si se deja vacío, los registros deben crearse manualmente en el DNS del dominio.
  EOT
  type    = string
  default = ""
}
