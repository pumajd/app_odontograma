#!/bin/bash
# localstack-init.sh — Se ejecuta automáticamente cuando LocalStack está listo.
# Crea el bucket S3 y verifica la identidad SES para desarrollo local.

set -e

ENDPOINT="http://localhost:4566"
BUCKET="odontoval-local-radiografias"
SES_EMAIL="noreply@odontoval.com.ec"

echo "🚀 Inicializando recursos LocalStack..."

# ── S3: crear bucket de radiografías ──────────────────────────────────────────
echo "  → Creando bucket S3: $BUCKET"
awslocal s3 mb "s3://${BUCKET}" --region us-east-1 2>/dev/null || echo "    (ya existe)"

# Habilitar CORS en el bucket para que el frontend pueda subir con PUT directo
awslocal s3api put-bucket-cors \
  --bucket "$BUCKET" \
  --cors-configuration '{
    "CORSRules": [{
      "AllowedHeaders": ["Content-Type","Content-Length","Authorization"],
      "AllowedMethods": ["GET","PUT","POST","DELETE"],
      "AllowedOrigins": ["http://localhost:5173","http://localhost:3000"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }]
  }' 2>/dev/null || echo "    CORS ya configurado"

# ── SES: verificar remitente ───────────────────────────────────────────────────
echo "  → Verificando remitente SES: $SES_EMAIL"
awslocal ses verify-email-identity \
  --email-address "$SES_EMAIL" 2>/dev/null || echo "    (ya verificado)"

echo "✅ LocalStack listo."
echo "   Bucket: s3://${BUCKET}"
echo "   SES:    ${SES_EMAIL} verificado"
