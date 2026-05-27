locals {
  name_prefix = "${var.project}-${var.environment}"

  common_tags = merge(
    {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
      Module      = "storage"
    },
    var.tags
  )
}

# ─────────────────────────────────────────────
# S3: Bucket privado para radiografías
# ─────────────────────────────────────────────
resource "aws_s3_bucket" "radiografias" {
  bucket = "${local.name_prefix}-radiografias"
  tags   = local.common_tags
}

resource "aws_s3_bucket_versioning" "radiografias" {
  bucket = aws_s3_bucket.radiografias.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_public_access_block" "radiografias" {
  bucket                  = aws_s3_bucket.radiografias.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

# Cifrado en reposo con clave administrada por AWS
resource "aws_s3_bucket_server_side_encryption_configuration" "radiografias" {
  bucket = aws_s3_bucket.radiografias.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Lifecycle: mover a Glacier después de 365 días (reducción de costo)
resource "aws_s3_bucket_lifecycle_configuration" "radiografias" {
  bucket = aws_s3_bucket.radiografias.id

  rule {
    id     = "archivado-radiografias"
    status = "Enabled"

    transition {
      days          = 365
      storage_class = "GLACIER"
    }
  }
}

# CORS: permite que el frontend suba directamente con presigned URL
resource "aws_s3_bucket_cors_configuration" "radiografias" {
  bucket = aws_s3_bucket.radiografias.id

  cors_rule {
    allowed_headers = ["Content-Type", "Content-Length", "Authorization"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = [
      "https://${var.domain_name}",
      var.environment != "prod" ? "http://localhost:5173" : ""
    ]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# Política: solo permite acceso desde el rol de Lambda backend
resource "aws_s3_bucket_policy" "radiografias" {
  bucket = aws_s3_bucket.radiografias.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowLambdaBackend"
        Effect = "Allow"
        Principal = {
          AWS = var.lambda_backend_role_arn
        }
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.radiografias.arn}/*"
      }
    ]
  })
}
