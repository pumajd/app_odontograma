locals {
  name_prefix = "${var.project}-${var.environment}"

  common_tags = merge(
    {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
      Module      = "api"
    },
    var.tags
  )

  # Variables de entorno comunes a todas las Lambdas backend
  lambda_env = {
    DB_HOST              = var.db_host
    DB_PORT              = "5432"
    DB_NAME              = var.db_name
    DB_USER              = var.db_username
    DB_PASSWORD          = var.db_password
    COGNITO_USER_POOL_ID = var.cognito_user_pool_id
    COGNITO_CLIENT_ID    = var.cognito_client_id
    RADIOGRAFIAS_BUCKET  = var.radiografias_bucket
    AWS_REGION           = var.aws_region
  }

  # Parámetros comunes del sub-módulo method
  method_defaults = {
    rest_api_id    = aws_api_gateway_rest_api.main.id
    authorizer_id  = aws_api_gateway_authorizer.cognito.id
    aws_region     = var.aws_region
    aws_account_id = var.aws_account_id
  }
}

# ─────────────────────────────────────────────
# IAM: Rol base para todas las Lambdas backend
# ─────────────────────────────────────────────
resource "aws_iam_role" "lambda_backend" {
  name = "${local.name_prefix}-lambda-backend"
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

resource "aws_iam_role_policy" "lambda_backend" {
  name = "backend-policy"
  role = aws_iam_role.lambda_backend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "Logs"
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/lambda/${local.name_prefix}-*:*"
      },
      {
        Sid    = "VPCNetworking"
        Effect = "Allow"
        Action = ["ec2:CreateNetworkInterface", "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"]
        Resource = "*"
      },
      {
        # s3:GeneratePresignedUrl NO es una acción IAM válida.
        # Los permisos necesarios son los de la operación que realizará la URL.
        Sid    = "S3Radiografias"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "arn:aws:s3:::${var.radiografias_bucket}/*"
      },
      {
        Sid      = "SESEnvio"
        Effect   = "Allow"
        Action   = ["ses:SendEmail", "ses:SendRawEmail"]
        Resource = "*"
        Condition = {
          StringEquals = {
            "ses:FromAddress" = "noreply@${var.domain_name}"
          }
        }
      }
    ]
  })
}

# ─────────────────────────────────────────────
# Lambda: Pacientes
# ─────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "pacientes" {
  name              = "/aws/lambda/${local.name_prefix}-pacientes"
  retention_in_days = 30
  tags              = local.common_tags
}

resource "aws_lambda_function" "pacientes" {
  function_name = "${local.name_prefix}-pacientes"
  role          = aws_iam_role.lambda_backend.arn
  handler       = "handlers.pacientes.lambda_handler"
  runtime       = "python3.12"
  filename      = var.deployment_package_path
  timeout       = 30
  memory_size   = 256
  tags          = local.common_tags

  environment { variables = local.lambda_env }
  depends_on  = [aws_iam_role_policy.lambda_backend, aws_cloudwatch_log_group.pacientes]
}

# ─────────────────────────────────────────────
# Lambda: Odontogramas
# ─────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "odontogramas" {
  name              = "/aws/lambda/${local.name_prefix}-odontogramas"
  retention_in_days = 30
  tags              = local.common_tags
}

resource "aws_lambda_function" "odontogramas" {
  function_name = "${local.name_prefix}-odontogramas"
  role          = aws_iam_role.lambda_backend.arn
  handler       = "handlers.odontogramas.lambda_handler"
  runtime       = "python3.12"
  filename      = var.deployment_package_path
  timeout       = 30
  memory_size   = 256
  tags          = local.common_tags

  environment { variables = local.lambda_env }
  depends_on  = [aws_iam_role_policy.lambda_backend, aws_cloudwatch_log_group.odontogramas]
}

# ─────────────────────────────────────────────
# Lambda: Citas
# ─────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "citas" {
  name              = "/aws/lambda/${local.name_prefix}-citas"
  retention_in_days = 30
  tags              = local.common_tags
}

resource "aws_lambda_function" "citas" {
  function_name = "${local.name_prefix}-citas"
  role          = aws_iam_role.lambda_backend.arn
  handler       = "handlers.citas.lambda_handler"
  runtime       = "python3.12"
  filename      = var.deployment_package_path
  timeout       = 30
  memory_size   = 256
  tags          = local.common_tags

  environment { variables = local.lambda_env }
  depends_on  = [aws_iam_role_policy.lambda_backend, aws_cloudwatch_log_group.citas]
}

# ─────────────────────────────────────────────
# Lambda: Facturas
# ─────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "facturas" {
  name              = "/aws/lambda/${local.name_prefix}-facturas"
  retention_in_days = 30
  tags              = local.common_tags
}

resource "aws_lambda_function" "facturas" {
  function_name = "${local.name_prefix}-facturas"
  role          = aws_iam_role.lambda_backend.arn
  handler       = "handlers.facturas.lambda_handler"
  runtime       = "python3.12"
  filename      = var.deployment_package_path
  timeout       = 30
  memory_size   = 256
  tags          = local.common_tags

  environment { variables = local.lambda_env }
  depends_on  = [aws_iam_role_policy.lambda_backend, aws_cloudwatch_log_group.facturas]
}

# ─────────────────────────────────────────────
# Lambda: Radiografías  ← NUEVO
# ─────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "radiografias" {
  name              = "/aws/lambda/${local.name_prefix}-radiografias"
  retention_in_days = 30
  tags              = local.common_tags
}

resource "aws_lambda_function" "radiografias" {
  function_name = "${local.name_prefix}-radiografias"
  role          = aws_iam_role.lambda_backend.arn
  handler       = "handlers.radiografias.lambda_handler"
  runtime       = "python3.12"
  filename      = var.deployment_package_path
  timeout       = 30
  memory_size   = 256
  tags          = local.common_tags

  environment { variables = local.lambda_env }
  depends_on  = [aws_iam_role_policy.lambda_backend, aws_cloudwatch_log_group.radiografias]
}

# ─────────────────────────────────────────────
# API Gateway REST
# ─────────────────────────────────────────────
resource "aws_api_gateway_rest_api" "main" {
  name        = "${local.name_prefix}-api"
  description = "API REST ODONTOVAL"
  tags        = local.common_tags

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

# Authorizer Cognito — valida el JWT en cada request
resource "aws_api_gateway_authorizer" "cognito" {
  name          = "cognito-authorizer"
  rest_api_id   = aws_api_gateway_rest_api.main.id
  type          = "COGNITO_USER_POOLS"
  provider_arns = [var.cognito_user_pool_arn]
  identity_source = "method.request.header.Authorization"
}

# ── /pacientes ──────────────────────────────────────────────────
resource "aws_api_gateway_resource" "pacientes" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "pacientes"
}

module "pacientes_any" {
  source         = "./method"
  rest_api_id    = local.method_defaults.rest_api_id
  resource_id    = aws_api_gateway_resource.pacientes.id
  http_method    = "ANY"
  authorizer_id  = local.method_defaults.authorizer_id
  lambda_arn     = aws_lambda_function.pacientes.invoke_arn
  lambda_name    = aws_lambda_function.pacientes.function_name
  aws_region     = local.method_defaults.aws_region
  aws_account_id = local.method_defaults.aws_account_id
}

resource "aws_api_gateway_resource" "paciente_id" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.pacientes.id
  path_part   = "{id}"
}

module "paciente_id_any" {
  source         = "./method"
  rest_api_id    = local.method_defaults.rest_api_id
  resource_id    = aws_api_gateway_resource.paciente_id.id
  http_method    = "ANY"
  authorizer_id  = local.method_defaults.authorizer_id
  lambda_arn     = aws_lambda_function.pacientes.invoke_arn
  lambda_name    = aws_lambda_function.pacientes.function_name
  aws_region     = local.method_defaults.aws_region
  aws_account_id = local.method_defaults.aws_account_id
}

# ── /odontogramas ───────────────────────────────────────────────
resource "aws_api_gateway_resource" "odontogramas" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "odontogramas"
}

module "odontogramas_any" {
  source         = "./method"
  rest_api_id    = local.method_defaults.rest_api_id
  resource_id    = aws_api_gateway_resource.odontogramas.id
  http_method    = "ANY"
  authorizer_id  = local.method_defaults.authorizer_id
  lambda_arn     = aws_lambda_function.odontogramas.invoke_arn
  lambda_name    = aws_lambda_function.odontogramas.function_name
  aws_region     = local.method_defaults.aws_region
  aws_account_id = local.method_defaults.aws_account_id
}

resource "aws_api_gateway_resource" "odontograma_id" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.odontogramas.id
  path_part   = "{id}"
}

module "odontograma_id_any" {
  source         = "./method"
  rest_api_id    = local.method_defaults.rest_api_id
  resource_id    = aws_api_gateway_resource.odontograma_id.id
  http_method    = "ANY"
  authorizer_id  = local.method_defaults.authorizer_id
  lambda_arn     = aws_lambda_function.odontogramas.invoke_arn
  lambda_name    = aws_lambda_function.odontogramas.function_name
  aws_region     = local.method_defaults.aws_region
  aws_account_id = local.method_defaults.aws_account_id
}

# /pacientes/{pacienteId}/odontogramas — lista odontogramas por paciente
resource "aws_api_gateway_resource" "paciente_id_odontogramas" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.paciente_id.id
  path_part   = "odontogramas"
}

module "paciente_odontogramas_any" {
  source         = "./method"
  rest_api_id    = local.method_defaults.rest_api_id
  resource_id    = aws_api_gateway_resource.paciente_id_odontogramas.id
  http_method    = "ANY"
  authorizer_id  = local.method_defaults.authorizer_id
  lambda_arn     = aws_lambda_function.odontogramas.invoke_arn
  lambda_name    = aws_lambda_function.odontogramas.function_name
  aws_region     = local.method_defaults.aws_region
  aws_account_id = local.method_defaults.aws_account_id
}

# ── /citas ──────────────────────────────────────────────────────
resource "aws_api_gateway_resource" "citas" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "citas"
}

module "citas_any" {
  source         = "./method"
  rest_api_id    = local.method_defaults.rest_api_id
  resource_id    = aws_api_gateway_resource.citas.id
  http_method    = "ANY"
  authorizer_id  = local.method_defaults.authorizer_id
  lambda_arn     = aws_lambda_function.citas.invoke_arn
  lambda_name    = aws_lambda_function.citas.function_name
  aws_region     = local.method_defaults.aws_region
  aws_account_id = local.method_defaults.aws_account_id
}

resource "aws_api_gateway_resource" "cita_id" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.citas.id
  path_part   = "{id}"
}

module "cita_id_any" {
  source         = "./method"
  rest_api_id    = local.method_defaults.rest_api_id
  resource_id    = aws_api_gateway_resource.cita_id.id
  http_method    = "ANY"
  authorizer_id  = local.method_defaults.authorizer_id
  lambda_arn     = aws_lambda_function.citas.invoke_arn
  lambda_name    = aws_lambda_function.citas.function_name
  aws_region     = local.method_defaults.aws_region
  aws_account_id = local.method_defaults.aws_account_id
}

resource "aws_api_gateway_resource" "cita_cancelar" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.cita_id.id
  path_part   = "cancelar"
}

module "cita_cancelar_any" {
  source         = "./method"
  rest_api_id    = local.method_defaults.rest_api_id
  resource_id    = aws_api_gateway_resource.cita_cancelar.id
  http_method    = "ANY"
  authorizer_id  = local.method_defaults.authorizer_id
  lambda_arn     = aws_lambda_function.citas.invoke_arn
  lambda_name    = aws_lambda_function.citas.function_name
  aws_region     = local.method_defaults.aws_region
  aws_account_id = local.method_defaults.aws_account_id
}

# ── /facturas ───────────────────────────────────────────────────
resource "aws_api_gateway_resource" "facturas" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "facturas"
}

module "facturas_any" {
  source         = "./method"
  rest_api_id    = local.method_defaults.rest_api_id
  resource_id    = aws_api_gateway_resource.facturas.id
  http_method    = "ANY"
  authorizer_id  = local.method_defaults.authorizer_id
  lambda_arn     = aws_lambda_function.facturas.invoke_arn
  lambda_name    = aws_lambda_function.facturas.function_name
  aws_region     = local.method_defaults.aws_region
  aws_account_id = local.method_defaults.aws_account_id
}

resource "aws_api_gateway_resource" "factura_id" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.facturas.id
  path_part   = "{id}"
}

module "factura_id_any" {
  source         = "./method"
  rest_api_id    = local.method_defaults.rest_api_id
  resource_id    = aws_api_gateway_resource.factura_id.id
  http_method    = "ANY"
  authorizer_id  = local.method_defaults.authorizer_id
  lambda_arn     = aws_lambda_function.facturas.invoke_arn
  lambda_name    = aws_lambda_function.facturas.function_name
  aws_region     = local.method_defaults.aws_region
  aws_account_id = local.method_defaults.aws_account_id
}

# ── /radiografias  ← NUEVO ──────────────────────────────────────
resource "aws_api_gateway_resource" "radiografias" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "radiografias"
}

module "radiografias_any" {
  source         = "./method"
  rest_api_id    = local.method_defaults.rest_api_id
  resource_id    = aws_api_gateway_resource.radiografias.id
  http_method    = "ANY"
  authorizer_id  = local.method_defaults.authorizer_id
  lambda_arn     = aws_lambda_function.radiografias.invoke_arn
  lambda_name    = aws_lambda_function.radiografias.function_name
  aws_region     = local.method_defaults.aws_region
  aws_account_id = local.method_defaults.aws_account_id
}

resource "aws_api_gateway_resource" "radiografia_id" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.radiografias.id
  path_part   = "{id}"
}

module "radiografia_id_any" {
  source         = "./method"
  rest_api_id    = local.method_defaults.rest_api_id
  resource_id    = aws_api_gateway_resource.radiografia_id.id
  http_method    = "ANY"
  authorizer_id  = local.method_defaults.authorizer_id
  lambda_arn     = aws_lambda_function.radiografias.invoke_arn
  lambda_name    = aws_lambda_function.radiografias.function_name
  aws_region     = local.method_defaults.aws_region
  aws_account_id = local.method_defaults.aws_account_id
}

# /radiografias/{id}/confirmar
resource "aws_api_gateway_resource" "radiografia_confirmar" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.radiografia_id.id
  path_part   = "confirmar"
}

module "radiografia_confirmar_any" {
  source         = "./method"
  rest_api_id    = local.method_defaults.rest_api_id
  resource_id    = aws_api_gateway_resource.radiografia_confirmar.id
  http_method    = "ANY"
  authorizer_id  = local.method_defaults.authorizer_id
  lambda_arn     = aws_lambda_function.radiografias.invoke_arn
  lambda_name    = aws_lambda_function.radiografias.function_name
  aws_region     = local.method_defaults.aws_region
  aws_account_id = local.method_defaults.aws_account_id
}

# ─────────────────────────────────────────────
# Deployment y Stage
# ─────────────────────────────────────────────
resource "aws_api_gateway_deployment" "main" {
  rest_api_id = aws_api_gateway_rest_api.main.id

  depends_on = [
    # Pacientes
    module.pacientes_any,
    module.paciente_id_any,
    # Odontogramas
    module.odontogramas_any,
    module.odontograma_id_any,
    module.paciente_odontogramas_any,
    # Citas
    module.citas_any,
    module.cita_id_any,
    module.cita_cancelar_any,
    # Facturas
    module.facturas_any,
    module.factura_id_any,
    # Radiografías
    module.radiografias_any,
    module.radiografia_id_any,
    module.radiografia_confirmar_any,
  ]

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_cloudwatch_log_group" "api_gw" {
  name              = "/aws/apigateway/${local.name_prefix}"
  retention_in_days = 30
  tags              = local.common_tags
}

resource "aws_api_gateway_stage" "prod" {
  deployment_id = aws_api_gateway_deployment.main.id
  rest_api_id   = aws_api_gateway_rest_api.main.id
  stage_name    = var.environment
  tags          = local.common_tags

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gw.arn
  }
}
