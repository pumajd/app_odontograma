locals {
  name_prefix = "${var.project}-${var.environment}"

  common_tags = merge(
    {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
      Module      = "auth"
    },
    var.tags
  )
}

# ─────────────────────────────────────────────
# Cognito User Pool
# ─────────────────────────────────────────────
resource "aws_cognito_user_pool" "main" {
  name = "${local.name_prefix}-users"
  tags = local.common_tags

  # Solo se permite login con email (Google provee el email verificado)
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Atributos personalizados — clinic_id para multi-tenancy
  schema {
    name                = "clinic_id"
    attribute_data_type = "String"
    mutable             = true
    string_attribute_constraints {
      min_length = 1
      max_length = 36
    }
  }

  schema {
    name                = "role"
    attribute_data_type = "String"
    mutable             = true
    string_attribute_constraints {
      min_length = 1
      max_length = 20
    }
  }

  # Política de contraseñas (no aplica para Google, pero requerida por Cognito)
  password_policy {
    minimum_length    = 8
    require_uppercase = true
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
  }

  # MFA desactivado (usamos Google como segundo factor implícito)
  mfa_configuration = "OFF"

  # Tokens
  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }
}

# ─────────────────────────────────────────────
# Google como Identity Provider
# ─────────────────────────────────────────────
resource "aws_cognito_identity_provider" "google" {
  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    client_id        = var.google_client_id
    client_secret    = var.google_client_secret
    authorize_scopes = "email profile openid"
  }

  # Mapear atributos de Google → Cognito
  attribute_mapping = {
    email    = "email"
    name     = "name"
    username = "sub"
    picture  = "picture"
  }
}

# ─────────────────────────────────────────────
# App Client (usado por el frontend React)
# ─────────────────────────────────────────────
resource "aws_cognito_user_pool_client" "frontend" {
  name         = "${local.name_prefix}-frontend"
  user_pool_id = aws_cognito_user_pool.main.id

  # Flujo OAuth PKCE — seguro para SPAs (sin client_secret en el browser)
  generate_secret                      = false
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]

  # URLs de callback (añadir localhost para desarrollo)
  callback_urls = concat(
    ["https://${var.domain_name}/callback"],
    var.environment == "prod" ? [] : ["http://localhost:5173/callback"]
  )
  logout_urls = concat(
    ["https://${var.domain_name}/"],
    var.environment == "prod" ? [] : ["http://localhost:5173/"]
  )

  supported_identity_providers = ["Google"]

  # Validez de tokens
  access_token_validity  = 8   # horas
  id_token_validity      = 8
  refresh_token_validity = 30  # días

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  # Evitar que flujos legacy de contraseña funcionen
  explicit_auth_flows = ["ALLOW_REFRESH_TOKEN_AUTH"]
}

# ─────────────────────────────────────────────
# Hosted UI — dominio personalizado
# ─────────────────────────────────────────────
resource "aws_cognito_user_pool_domain" "main" {
  domain       = "auth.${var.domain_name}"
  user_pool_id = aws_cognito_user_pool.main.id

  # Dominio personalizado requiere certificado ACM en us-east-1
  certificate_arn = var.acm_certificate_arn
}
