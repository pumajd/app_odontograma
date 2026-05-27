# ─────────────────────────────────────────────
# Outputs del módulo email
# ─────────────────────────────────────────────

output "ses_verification_token" {
  description = "Token TXT para verificar el dominio en SES. Agrégalo en tu DNS como registro TXT en _amazonses.<dominio>."
  value       = aws_ses_domain_identity.main.verification_token
  sensitive   = false
}

output "dkim_tokens" {
  description = <<-EOT
    3 tokens CNAME para configurar DKIM. Por cada token, crea un registro CNAME:
      <token>._domainkey.<dominio>  →  <token>.dkim.amazonses.com
  EOT
  value = aws_ses_domain_dkim.main.dkim_tokens
}

output "email_bucket_name" {
  description = "Nombre del bucket S3 donde se almacenan los correos crudos entrantes."
  value       = aws_s3_bucket.emails.bucket
}

output "email_bucket_arn" {
  description = "ARN del bucket S3 de correos."
  value       = aws_s3_bucket.emails.arn
}

output "lambda_function_name" {
  description = "Nombre de la función Lambda que reenvía los correos."
  value       = aws_lambda_function.forwarder.function_name
}

output "lambda_function_arn" {
  description = "ARN de la función Lambda."
  value       = aws_lambda_function.forwarder.arn
}

output "dns_records_required" {
  description = <<-EOT
    Registros DNS que debes agregar en tu proveedor de dominio para que SES funcione.
    Aplica TODOS antes de considerar el correo operativo.
  EOT
  value = {
    "1_verificacion_dominio" = {
      tipo   = "TXT"
      nombre = "_amazonses.${var.domain}"
      valor  = aws_ses_domain_identity.main.verification_token
      nota   = "Verifica la propiedad del dominio ante Amazon SES"
    }
    "2_mx_recepcion" = {
      tipo     = "MX"
      nombre   = var.domain
      valor    = "10 inbound-smtp.${data.aws_region.current.name}.amazonaws.com"
      nota     = "Dirige los correos entrantes a SES. IMPORTANTE: reemplaza cualquier MX existente."
    }
    "3_dkim_1" = {
      tipo   = "CNAME"
      nombre = "${tolist(aws_ses_domain_dkim.main.dkim_tokens)[0]}._domainkey.${var.domain}"
      valor  = "${tolist(aws_ses_domain_dkim.main.dkim_tokens)[0]}.dkim.amazonses.com"
      nota   = "Firma DKIM — mejora entregabilidad del correo"
    }
    "4_dkim_2" = {
      tipo   = "CNAME"
      nombre = "${tolist(aws_ses_domain_dkim.main.dkim_tokens)[1]}._domainkey.${var.domain}"
      valor  = "${tolist(aws_ses_domain_dkim.main.dkim_tokens)[1]}.dkim.amazonses.com"
      nota   = "Firma DKIM — mejora entregabilidad del correo"
    }
    "5_dkim_3" = {
      tipo   = "CNAME"
      nombre = "${tolist(aws_ses_domain_dkim.main.dkim_tokens)[2]}._domainkey.${var.domain}"
      valor  = "${tolist(aws_ses_domain_dkim.main.dkim_tokens)[2]}.dkim.amazonses.com"
      nota   = "Firma DKIM — mejora entregabilidad del correo"
    }
  }
}

output "sandbox_warning" {
  description = "Aviso sobre el modo sandbox de SES."
  value       = "ATENCIÓN: Las cuentas AWS nuevas operan en modo sandbox de SES. Solo puedes enviar correos a direcciones verificadas. Para enviar a Gmail real, solicita salida del sandbox en la consola de SES > Account dashboard > Request production access."
}

output "dns_managed_by_terraform" {
  description = "Indica si los registros DNS de SES fueron creados automáticamente en Route 53."
  value       = local.has_route53 ? "SÍ — registros TXT, MX y CNAME creados en Route 53 automáticamente." : "NO — crea los registros del output 'dns_records_required' manualmente en tu proveedor DNS."
}
