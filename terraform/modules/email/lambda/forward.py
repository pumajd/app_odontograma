"""
Email Forwarder — SES → Gmail
================================
Se activa cuando SES recibe un correo y lo guarda en S3.
Este handler lo lee, lo reconstruye como reenvío y lo envía
a la dirección personal configurada en FORWARD_TO.

Flujo:
  SES recepción → S3 (raw) → Lambda (este script) → SES envío → Gmail

Variables de entorno requeridas:
  FORWARD_TO  — Gmail destino (ej: miusuario@gmail.com)
  FROM_EMAIL  — Remitente verificado en SES (ej: noreply@midominio.com)
  S3_BUCKET   — Bucket donde SES guardó el correo crudo
  S3_PREFIX   — Prefijo de carpeta (default: "emails/")
"""

import os
import json
import boto3
import email
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text      import MIMEText
from email.mime.application import MIMEApplication

logger = logging.getLogger()
logger.setLevel(logging.INFO)

FORWARD_TO = os.environ["FORWARD_TO"]
FROM_EMAIL = os.environ["FROM_EMAIL"]
S3_BUCKET  = os.environ["S3_BUCKET"]
S3_PREFIX  = os.environ.get("S3_PREFIX", "emails/")

s3_client  = boto3.client("s3")
ses_client = boto3.client("ses")


def lambda_handler(event, context):
    logger.info("Evento recibido: %s", json.dumps(event, default=str))

    for record in event.get("Records", []):
        ses_data    = record["ses"]
        msg_id      = ses_data["mail"]["messageId"]
        source      = ses_data["mail"]["source"]
        recipients  = ses_data["receipt"]["recipients"]
        headers     = ses_data["mail"].get("commonHeaders", {})
        subject     = headers.get("subject", "(sin asunto)")
        original_to = recipients[0] if recipients else FROM_EMAIL

        logger.info("Procesando mensaje %s de %s", msg_id, source)

        # ── 1. Leer correo crudo desde S3 ──────────────────────────────
        s3_key = f"{S3_PREFIX}{msg_id}"
        try:
            raw_email = s3_client.get_object(
                Bucket=S3_BUCKET, Key=s3_key
            )["Body"].read()
        except Exception as e:
            logger.error("No se pudo leer %s/%s: %s", S3_BUCKET, s3_key, e)
            raise

        original = email.message_from_bytes(raw_email)

        # ── 2. Construir mensaje de reenvío ────────────────────────────
        fwd = MIMEMultipart("mixed")
        fwd["Subject"]  = f"[{original_to}] {subject}"
        fwd["From"]     = FROM_EMAIL
        fwd["To"]       = FORWARD_TO
        fwd["Reply-To"] = source           # responder al remitente original

        # Copiar partes del mensaje original
        for part in original.walk():
            content_type = part.get_content_type()
            disposition  = str(part.get("Content-Disposition", ""))

            # Saltar contenedores multipart
            if part.get_content_maintype() == "multipart":
                continue

            payload = part.get_payload(decode=True)
            if payload is None:
                continue

            charset = part.get_content_charset() or "utf-8"

            if content_type == "text/plain" and "attachment" not in disposition:
                fwd.attach(MIMEText(
                    payload.decode(charset, errors="replace"), "plain", "utf-8"
                ))
            elif content_type == "text/html" and "attachment" not in disposition:
                fwd.attach(MIMEText(
                    payload.decode(charset, errors="replace"), "html", "utf-8"
                ))
            else:
                # Adjuntos y otros tipos
                filename = part.get_filename() or "adjunto"
                att = MIMEApplication(payload)
                att.add_header("Content-Disposition", "attachment", filename=filename)
                fwd.attach(att)

        # ── 3. Enviar por SES ──────────────────────────────────────────
        try:
            response = ses_client.send_raw_email(
                Source=FROM_EMAIL,
                Destinations=[FORWARD_TO],
                RawMessage={"Data": fwd.as_string()},
            )
            logger.info("Correo reenviado. MessageId SES: %s", response["MessageId"])
        except Exception as e:
            logger.error("Error al enviar correo: %s", e)
            raise

    return {"statusCode": 200, "body": "OK"}
