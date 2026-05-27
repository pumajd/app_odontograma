locals {
  common_tags = merge(
    {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
    },
    var.tags
  )

  # Dominio personalizado: activa todo el bloque ACM + Route 53 cuando se provee
  has_domain  = var.domain_name != ""
  all_domains = local.has_domain ? (
    var.create_www_record
    ? [var.domain_name, "www.${var.domain_name}"]
    : [var.domain_name]
  ) : []
}

# ─────────────────────────────────────────────
# ACM: Certificado SSL para el dominio (solo si domain_name está configurado)
# NOTA: CloudFront exige que el certificado esté en us-east-1
# ─────────────────────────────────────────────
resource "aws_acm_certificate" "site" {
  count             = local.has_domain ? 1 : 0
  domain_name       = var.domain_name
  subject_alternative_names = var.create_www_record ? ["www.${var.domain_name}"] : []
  validation_method = "DNS"
  tags              = local.common_tags

  lifecycle {
    create_before_destroy = true
  }
}

# Registros CNAME en Route 53 para validar el certificado ACM
resource "aws_route53_record" "cert_validation" {
  for_each = local.has_domain ? {
    for dvo in aws_acm_certificate.site[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = var.route53_zone_id
}

# Esperar a que ACM valide el certificado antes de usarlo en CloudFront
resource "aws_acm_certificate_validation" "site" {
  count                   = local.has_domain ? 1 : 0
  certificate_arn         = aws_acm_certificate.site[0].arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

# Registros A (alias) en Route 53 que apuntan al dominio de CloudFront
resource "aws_route53_record" "site_alias" {
  for_each = toset(local.all_domains)

  zone_id = var.route53_zone_id
  name    = each.value
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}

# ─────────────────────────────────────────────
# S3: Bucket privado para archivos estáticos
# ─────────────────────────────────────────────
resource "aws_s3_bucket" "site" {
  bucket = var.bucket_name
  tags   = local.common_tags
}

resource "aws_s3_bucket_versioning" "site" {
  bucket = aws_s3_bucket.site.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Bloquear todo acceso público directo al bucket
resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

# Política que permite únicamente a CloudFront (vía OAC) leer objetos
resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontOAC"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.site.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.site.arn
          }
        }
      }
    ]
  })

  # La distribución debe existir antes de aplicar la política
  depends_on = [aws_cloudfront_distribution.site]
}

# ─────────────────────────────────────────────
# CloudFront: Origin Access Control (OAC)
# ─────────────────────────────────────────────
resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "${var.bucket_name}-oac"
  description                       = "OAC para ${var.bucket_name}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ─────────────────────────────────────────────
# S3: Bucket para Logs de Acceso (Cumplimiento A09)
# ─────────────────────────────────────────────
resource "aws_s3_bucket" "logs" {
  count  = var.enable_logging ? 1 : 0
  bucket = "${var.bucket_name}-logs"
  tags   = local.common_tags
}

# CloudFront Standard Logs requiere que las ACLs estén habilitadas en el bucket
resource "aws_s3_bucket_ownership_controls" "logs" {
  count  = var.enable_logging ? 1 : 0
  bucket = aws_s3_bucket.logs[0].id
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_acl" "logs" {
  count      = var.enable_logging ? 1 : 0
  depends_on = [aws_s3_bucket_ownership_controls.logs]
  bucket     = aws_s3_bucket.logs[0].id
  acl        = "private"
}

resource "aws_s3_bucket_public_access_block" "logs" {
  count                   = var.enable_logging ? 1 : 0
  bucket                  = aws_s3_bucket.logs[0].id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  count  = var.enable_logging ? 1 : 0
  bucket = aws_s3_bucket.logs[0].id

  rule {
    id     = "log-retention"
    status = "Enabled"

    expiration {
      days = var.log_retention_days
    }
  }
}

# ─────────────────────────────────────────────
# CloudFront: Response Headers Policy
# ─────────────────────────────────────────────
resource "aws_cloudfront_response_headers_policy" "security_headers" {
  name    = "${var.project}-${var.environment}-security-headers"
  comment = "Cabeceras de seguridad HTTP para ${var.project}"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }

    # Evita MIME-type sniffing (A05 OWASP)
    content_type_options {
      override = true
    }

    # Bloquea que esta página sea embebida en iframes externos (clickjacking)
    frame_options {
      frame_option = "DENY"
      override     = true
    }

    # Controla cuánto referrer se envía al navegar a otros dominios
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }

    # CSP como HTTP header real — añade frame-ancestors 'none' que el meta tag no puede proveer
    content_security_policy {
      content_security_policy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; frame-src https://www.google.com; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests; base-uri 'self'; form-action 'self';"
      override                = true
    }
  }

  # Permissions-Policy no tiene bloque nativo en security_headers_config
  custom_headers_config {
    items {
      header   = "Permissions-Policy"
      value    = "camera=(), microphone=(), geolocation=()"
      override = true
    }
  }
}

# ─────────────────────────────────────────────
# CloudFront Function: redirigir dominio *.cloudfront.net al canónico
# Solo se crea cuando hay dominio personalizado configurado
# ─────────────────────────────────────────────
resource "aws_cloudfront_function" "redirect_canonical" {
  count   = local.has_domain ? 1 : 0
  name    = "${var.project}-${var.environment}-redirect-canonical"
  runtime = "cloudfront-js-2.0"
  comment = "Redirige *.cloudfront.net a ${var.domain_name}"
  publish = true

  code = templatefile("${path.module}/functions/redirect_canonical.js.tftpl", {
    canonical_domain = var.domain_name
  })
}

# ─────────────────────────────────────────────
# CloudFront: Distribución
# ─────────────────────────────────────────────
resource "aws_cloudfront_distribution" "site" {
  # Esperar logs, ACL y (cuando aplica) validación del certificado ACM
  depends_on = [
    aws_s3_bucket_ownership_controls.logs,
    aws_s3_bucket_acl.logs,
    aws_acm_certificate_validation.site,   # lista vacía cuando has_domain=false → sin efecto
  ]

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = var.default_root_object
  price_class         = var.price_class
  comment             = "${var.project}-${var.environment}"
  tags                = local.common_tags

  # Dominios personalizados (vacío = solo el *.cloudfront.net)
  aliases = local.all_domains

  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = "s3-${var.bucket_name}"
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  dynamic "logging_config" {
    for_each = var.enable_logging ? [1] : []
    content {
      include_cookies = false
      bucket          = aws_s3_bucket.logs[0].bucket_domain_name
      prefix          = "cloudfront/"
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-${var.bucket_name}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    # CloudFront Function: redirigir *.cloudfront.net → dominio canónico
    dynamic "function_association" {
      for_each = local.has_domain ? [1] : []
      content {
        event_type   = "viewer-request"
        function_arn = aws_cloudfront_function.redirect_canonical[0].arn
      }
    }

    # Archivos estáticos: caché agresivo (1 año con cache-busting por hash)
    min_ttl     = 0
    default_ttl = 86400    # 1 día
    max_ttl     = 31536000 # 1 año
  }

  # Redirigir errores al index.html (necesario para SPAs)
  dynamic "custom_error_response" {
    for_each = var.custom_error_responses
    content {
      error_code            = custom_error_response.value.error_code
      response_code         = custom_error_response.value.response_code
      response_page_path    = custom_error_response.value.response_page_path
      error_caching_min_ttl = custom_error_response.value.error_caching_min_ttl
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    # Sin dominio → usa el certificado wildcard gratuito de CloudFront (*.cloudfront.net)
    # Con dominio → usa el certificado ACM validado, fuerza TLS 1.2+
    cloudfront_default_certificate = !local.has_domain
    acm_certificate_arn            = local.has_domain ? aws_acm_certificate_validation.site[0].certificate_arn : null
    ssl_support_method             = local.has_domain ? "sni-only" : null
    minimum_protocol_version       = local.has_domain ? "TLSv1.2_2021" : null
  }
}
