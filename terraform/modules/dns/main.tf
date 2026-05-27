locals {
  common_tags = merge(
    {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
      Module      = "dns"
    },
    var.tags
  )
}

# ─────────────────────────────────────────────
# Route 53: Zona DNS pública para el dominio
# ─────────────────────────────────────────────
# Después de aplicar:
#   1. Copia los 4 nameservers del output "nameservers"
#   2. Entra a https://www.nic.ec → gestión de dominio → servidores de nombre
#   3. Reemplaza los nameservers actuales por los 4 de Route 53
#   4. Espera propagación DNS (5–30 min para .ec, puede tardar hasta 48 h)

resource "aws_route53_zone" "main" {
  name    = var.domain
  comment = "Zona gestionada por Terraform — ${var.project} ${var.environment}"
  tags    = local.common_tags
}
