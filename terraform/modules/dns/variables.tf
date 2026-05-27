# ─────────────────────────────────────────────
# Módulo: dns
# Crea la zona Route 53 para el dominio.
# ─────────────────────────────────────────────

variable "domain" {
  description = "Nombre de dominio raíz a gestionar en Route 53 (ej: odontoval.com.ec)."
  type        = string
}

variable "project" {
  description = "Nombre del proyecto, usado para etiquetar recursos."
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
