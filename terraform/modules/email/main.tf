locals {
  name_prefix    = "${var.project}-${var.environment}"
  has_route53    = var.route53_zone_id != ""

  common_tags = merge(
    {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
      Module      = "email"
    },
    var.tags
  )
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ─────────────────────────────────────────────
# SES: Verificación del dominio
# ─────────────────────────────────────────────
resource "aws_ses_domain_identity" "main" {
  domain = var.domain
}

resource "aws_ses_domain_dkim" "main" {
  domain = aws_ses_domain_identity.main.domain
}

# ─────────────────────────────────────────────
# Route 53: Registros DNS para SES (solo si route53_zone_id está configurado)
# ─────────────────────────────────────────────

# TXT: verifica que somos dueños del dominio ante Amazon SES
resource "aws_route53_record" "ses_verification" {
  count   = local.has_route53 ? 1 : 0
  zone_id = var.route53_zone_id
  name    = "_amazonses.${var.domain}"
  type    = "TXT"
  ttl     = 600
  records = [aws_ses_domain_identity.main.verification_token]
}

# MX: dirige el correo entrante al servidor de recepción de SES
resource "aws_route53_record" "ses_mx" {
  count   = local.has_route53 ? 1 : 0
  zone_id = var.route53_zone_id
  name    = var.domain
  type    = "MX"
  ttl     = 600
  records = ["10 inbound-smtp.${data.aws_region.current.region}.amazonaws.com"]
}

# CNAME ×3: firmas DKIM para mejorar la entregabilidad del correo
resource "aws_route53_record" "ses_dkim" {
  count   = local.has_route53 ? 3 : 0
  zone_id = var.route53_zone_id
  name    = "${aws_ses_domain_dkim.main.dkim_tokens[count.index]}._domainkey.${var.domain}"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_ses_domain_dkim.main.dkim_tokens[count.index]}.dkim.amazonses.com"]
}

# ─────────────────────────────────────────────
# S3: Bucket privado para correos entrantes crudos
# ─────────────────────────────────────────────
resource "aws_s3_bucket" "emails" {
  bucket = "${local.name_prefix}-emails"
  tags   = local.common_tags
}

resource "aws_s3_bucket_public_access_block" "emails" {
  bucket                  = aws_s3_bucket.emails.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

# SES necesita que el versionado esté desactivado para poder escribir directamente
resource "aws_s3_bucket_versioning" "emails" {
  bucket = aws_s3_bucket.emails.id
  versioning_configuration {
    status = "Disabled"
  }
}

# Eliminar automáticamente correos crudos después de N días
resource "aws_s3_bucket_lifecycle_configuration" "emails" {
  bucket = aws_s3_bucket.emails.id

  rule {
    id     = "email-retention"
    status = "Enabled"

    filter {
      prefix = var.s3_prefix
    }

    expiration {
      days = var.email_retention_days
    }
  }
}

# Política que permite a SES (del mismo account) escribir objetos
resource "aws_s3_bucket_policy" "emails" {
  bucket = aws_s3_bucket.emails.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowSESPut"
        Effect = "Allow"
        Principal = {
          Service = "ses.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.emails.arn}/${var.s3_prefix}*"
        Condition = {
          StringEquals = {
            "AWS:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.emails]
}

# ─────────────────────────────────────────────
# Lambda: Empaquetar código Python
# ─────────────────────────────────────────────
data "archive_file" "forwarder" {
  type        = "zip"
  source_file = "${path.module}/lambda/forward.py"
  output_path = "${path.module}/lambda/forward.zip"
}

# ─────────────────────────────────────────────
# IAM: Rol de ejecución para la Lambda
# ─────────────────────────────────────────────
resource "aws_iam_role" "lambda_forwarder" {
  name = "${local.name_prefix}-email-forwarder"
  tags = local.common_tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "lambda_forwarder" {
  name = "email-forwarder-policy"
  role = aws_iam_role.lambda_forwarder.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # Logs de ejecución en CloudWatch
      {
        Sid      = "AllowLogs"
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.name_prefix}-email-forwarder:*"
      },
      # Leer correos crudos del bucket S3
      {
        Sid      = "AllowS3Read"
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "${aws_s3_bucket.emails.arn}/${var.s3_prefix}*"
      },
      # Enviar correos a través de SES
      {
        Sid      = "AllowSESSend"
        Effect   = "Allow"
        Action   = ["ses:SendRawEmail"]
        Resource = "*"
        Condition = {
          StringEquals = {
            "ses:FromAddress" = var.from_email
          }
        }
      }
    ]
  })
}

# ─────────────────────────────────────────────
# Lambda: Función de reenvío
# ─────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "forwarder" {
  name              = "/aws/lambda/${local.name_prefix}-email-forwarder"
  retention_in_days = 14
  tags              = local.common_tags
}

resource "aws_lambda_function" "forwarder" {
  function_name    = "${local.name_prefix}-email-forwarder"
  role             = aws_iam_role.lambda_forwarder.arn
  handler          = "forward.lambda_handler"
  runtime          = "python3.12"
  filename         = data.archive_file.forwarder.output_path
  source_code_hash = data.archive_file.forwarder.output_base64sha256
  timeout          = var.lambda_timeout
  memory_size      = var.lambda_memory
  tags             = local.common_tags

  environment {
    variables = {
      FORWARD_TO = var.forward_to_email
      FROM_EMAIL = var.from_email
      S3_BUCKET  = aws_s3_bucket.emails.bucket
      S3_PREFIX  = var.s3_prefix
    }
  }

  depends_on = [
    aws_iam_role_policy.lambda_forwarder,
    aws_cloudwatch_log_group.forwarder,
  ]
}

# SES necesita permiso explícito para invocar la Lambda
resource "aws_lambda_permission" "ses_invoke" {
  statement_id   = "AllowSESInvoke"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.forwarder.function_name
  principal      = "ses.amazonaws.com"
  source_account = data.aws_caller_identity.current.account_id
}

# ─────────────────────────────────────────────
# SES: Conjunto de reglas de recepción
# ─────────────────────────────────────────────
resource "aws_ses_receipt_rule_set" "main" {
  rule_set_name = "${local.name_prefix}-rules"
}

# Activar el rule set (solo puede haber uno activo por cuenta/región)
resource "aws_ses_active_receipt_rule_set" "main" {
  rule_set_name = aws_ses_receipt_rule_set.main.rule_set_name
}

# Regla: para cada correo entrante → guardar en S3 → invocar Lambda
resource "aws_ses_receipt_rule" "forward" {
  name          = "forward-to-lambda"
  rule_set_name = aws_ses_receipt_rule_set.main.rule_set_name
  recipients    = var.receive_emails
  enabled       = true
  scan_enabled  = true   # Activa filtro anti-spam de SES

  # Paso 1: guardar correo crudo en S3
  s3_action {
    bucket_name       = aws_s3_bucket.emails.bucket
    object_key_prefix = var.s3_prefix
    position          = 1
  }

  # Paso 2: invocar Lambda para reenviar
  lambda_action {
    function_arn    = aws_lambda_function.forwarder.arn
    invocation_type = "Event"   # asíncrono — no bloquea la recepción
    position        = 2
  }

  depends_on = [
    aws_s3_bucket_policy.emails,
    aws_lambda_permission.ses_invoke,
    aws_ses_active_receipt_rule_set.main,
  ]
}
