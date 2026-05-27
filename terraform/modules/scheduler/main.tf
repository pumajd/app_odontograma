locals {
  name_prefix = "${var.project}-${var.environment}"

  common_tags = merge(
    {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
      Module      = "scheduler"
    },
    var.tags
  )
}

# ─────────────────────────────────────────────
# IAM: Rol para que EventBridge invoque las Lambdas
# ─────────────────────────────────────────────
resource "aws_iam_role" "scheduler" {
  name = "${local.name_prefix}-scheduler"
  tags = local.common_tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "scheduler.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "scheduler" {
  name = "invoke-lambdas"
  role = aws_iam_role.scheduler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "lambda:InvokeFunction"
      Resource = [
        var.lambda_reminders_arn,
        var.lambda_profilaxis_arn,
      ]
    }]
  })
}

# ─────────────────────────────────────────────
# Lambda: Recordatorios de citas (24h antes)
# ─────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "reminders" {
  name              = "/aws/lambda/${local.name_prefix}-reminders"
  retention_in_days = 14
  tags              = local.common_tags
}

resource "aws_lambda_function" "reminders" {
  function_name = "${local.name_prefix}-reminders"
  role          = var.lambda_backend_role_arn
  handler       = "handlers.reminders.lambda_handler"
  runtime       = "python3.12"
  filename      = var.deployment_package_path
  timeout       = 120
  memory_size   = 256
  tags          = local.common_tags

  environment {
    variables = {
      DB_HOST            = var.db_host
      DB_NAME            = var.db_name
      DB_USER            = var.db_username
      DB_PASSWORD        = var.db_password
      TWILIO_ACCOUNT_SID = var.twilio_account_sid
      TWILIO_AUTH_TOKEN  = var.twilio_auth_token
    }
  }

  depends_on = [aws_cloudwatch_log_group.reminders]
}

# ─────────────────────────────────────────────
# Lambda: Generador de citas de profilaxis
# ─────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "profilaxis" {
  name              = "/aws/lambda/${local.name_prefix}-profilaxis"
  retention_in_days = 14
  tags              = local.common_tags
}

resource "aws_lambda_function" "profilaxis" {
  function_name = "${local.name_prefix}-profilaxis"
  role          = var.lambda_backend_role_arn
  handler       = "handlers.profilaxis.lambda_handler"
  runtime       = "python3.12"
  filename      = var.deployment_package_path
  timeout       = 120
  memory_size   = 256
  tags          = local.common_tags

  environment {
    variables = {
      DB_HOST            = var.db_host
      DB_NAME            = var.db_name
      DB_USER            = var.db_username
      DB_PASSWORD        = var.db_password
      TWILIO_ACCOUNT_SID = var.twilio_account_sid
      TWILIO_AUTH_TOKEN  = var.twilio_auth_token
    }
  }

  depends_on = [aws_cloudwatch_log_group.profilaxis]
}

# ─────────────────────────────────────────────
# EventBridge Scheduler: recordatorios cada hora
# ─────────────────────────────────────────────
resource "aws_scheduler_schedule" "reminders" {
  name       = "${local.name_prefix}-recordatorios-citas"
  group_name = "default"

  # Cada hora en punto
  schedule_expression          = "cron(0 * * * ? *)"
  schedule_expression_timezone = "America/Guayaquil"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.reminders.arn
    role_arn = aws_iam_role.scheduler.arn
    input    = jsonencode({ source = "eventbridge-scheduler" })
  }
}

# ─────────────────────────────────────────────
# EventBridge Scheduler: profilaxis — primer día del mes, 8:00 AM
# ─────────────────────────────────────────────
resource "aws_scheduler_schedule" "profilaxis" {
  name       = "${local.name_prefix}-profilaxis-mensual"
  group_name = "default"

  schedule_expression          = "cron(0 8 1 * ? *)"
  schedule_expression_timezone = "America/Guayaquil"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.profilaxis.arn
    role_arn = aws_iam_role.scheduler.arn
    input    = jsonencode({ source = "eventbridge-scheduler" })
  }
}
