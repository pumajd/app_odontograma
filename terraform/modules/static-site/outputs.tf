output "bucket_name" {
  description = "Nombre del bucket S3 creado."
  value       = aws_s3_bucket.site.bucket
}

output "bucket_arn" {
  description = "ARN del bucket S3."
  value       = aws_s3_bucket.site.arn
}

output "distribution_id" {
  description = "ID de la distribución CloudFront (necesario para invalidaciones)."
  value       = aws_cloudfront_distribution.site.id
}

output "distribution_arn" {
  description = "ARN de la distribución CloudFront."
  value       = aws_cloudfront_distribution.site.arn
}

output "distribution_domain_name" {
  description = "Dominio público asignado por CloudFront (*.cloudfront.net)."
  value       = aws_cloudfront_distribution.site.domain_name
}

output "distribution_status" {
  description = "Estado actual de la distribución (Deployed / InProgress)."
  value       = aws_cloudfront_distribution.site.status
}

output "log_bucket_name" {
  description = "Nombre del bucket S3 de logs."
  value       = var.enable_logging ? aws_s3_bucket.logs[0].bucket : null
}

output "custom_domain_url" {
  description = "URL del sitio con dominio personalizado (si fue configurado)."
  value       = local.has_domain ? "https://${var.domain_name}" : null
}

output "acm_certificate_arn" {
  description = "ARN del certificado ACM emitido para el dominio (null si no hay dominio personalizado)."
  value       = local.has_domain ? aws_acm_certificate_validation.site[0].certificate_arn : null
}
