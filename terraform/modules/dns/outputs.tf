# ─────────────────────────────────────────────
# Outputs del módulo dns
# ─────────────────────────────────────────────

output "zone_id" {
  description = "ID de la zona Route 53. Lo necesitan los módulos static-site y email para crear registros DNS."
  value       = aws_route53_zone.main.zone_id
}

output "zone_arn" {
  description = "ARN de la zona Route 53."
  value       = aws_route53_zone.main.arn
}

output "nameservers" {
  description = <<-EOT
    *** ACCIÓN REQUERIDA ***
    Copia estos 4 nameservers y configúralos en NIC.EC:
      https://www.nic.ec → Mis dominios → odontoval.com.ec → Servidores de nombre

    Una vez cambiados, espera entre 5 min y 48 h para que propague.
    Puedes verificar con: nslookup -type=NS odontoval.com.ec 8.8.8.8
  EOT
  value = aws_route53_zone.main.name_servers
}

output "domain" {
  description = "Dominio raíz gestionado por esta zona."
  value       = var.domain
}
