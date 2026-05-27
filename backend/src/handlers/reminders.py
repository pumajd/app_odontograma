"""
Handler Lambda — Recordatorios de citas
Invocado por EventBridge Scheduler cada hora.
Envía recordatorios por email (SES) y WhatsApp (Twilio) 24h antes de cada cita.
"""
import os
import json
import boto3
from datetime import datetime, timedelta, timezone
from utils.db import get_conn, release_conn

ses = boto3.client('ses', region_name='us-east-1')


def lambda_handler(event, context):
    """
    Busca citas que ocurren en las próximas 24-25 horas y envía recordatorios.
    """
    ahora = datetime.now(timezone.utc)
    desde = ahora + timedelta(hours=24)
    hasta = ahora + timedelta(hours=25)

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT c.id, c.fecha_hora, c.motivo,
                          p.nombres, p.apellidos, p.telefono, p.email,
                          cl.nombre AS nombre_clinica
                   FROM citas c
                   JOIN pacientes p   ON p.id = c.paciente_id
                   JOIN clinicas cl   ON cl.id = p.clinic_id
                   WHERE c.fecha_hora BETWEEN %s AND %s
                     AND c.estado = 'programada'
                     AND c.recordatorio_enviado = FALSE""",
                (desde, hasta),
            )
            cols = [d[0] for d in cur.description]
            citas = [dict(zip(cols, row)) for row in cur.fetchall()]

        enviados = 0
        for cita in citas:
            ok = False

            # 1. Recordatorio por email
            if cita.get('email'):
                ok = _enviar_email(cita)

            # 2. Recordatorio por WhatsApp (Twilio) — si tiene teléfono
            if cita.get('telefono'):
                _enviar_whatsapp(cita)
                ok = True

            # Marcar como enviado
            if ok:
                with conn.cursor() as cur:
                    cur.execute(
                        'UPDATE citas SET recordatorio_enviado = TRUE WHERE id = %s',
                        (cita['id'],),
                    )
                conn.commit()
                enviados += 1

        print(f'Recordatorios enviados: {enviados}/{len(citas)}')
        return {'statusCode': 200, 'enviados': enviados}

    except Exception as e:
        print(f'Error en recordatorios: {e}')
        raise
    finally:
        release_conn(conn)


def _enviar_email(cita):
    fecha = cita['fecha_hora'].strftime('%d/%m/%Y a las %H:%M')
    try:
        ses.send_email(
            Source=f"ODONTOVAL <noreply@odontoval.com.ec>",
            Destination={'ToAddresses': [cita['email']]},
            Message={
                'Subject': {'Data': f"Recordatorio: cita en {cita['nombre_clinica']}"},
                'Body': {
                    'Html': {
                        'Data': f"""
                        <p>Estimado/a {cita['nombres']} {cita['apellidos']},</p>
                        <p>Le recordamos que tiene una cita el <strong>{fecha}</strong>
                           en <strong>{cita['nombre_clinica']}</strong>.</p>
                        <p>Motivo: {cita['motivo'] or 'Consulta odontológica'}</p>
                        <p>Si necesita reagendar, por favor contáctenos.</p>
                        """
                    }
                },
            },
        )
        return True
    except Exception as e:
        print(f'Error enviando email a {cita["email"]}: {e}')
        return False


def _enviar_whatsapp(cita):
    """Envía recordatorio por Twilio WhatsApp."""
    import urllib.request
    import base64

    account_sid = os.environ.get('TWILIO_ACCOUNT_SID')
    auth_token = os.environ.get('TWILIO_AUTH_TOKEN')
    from_number = os.environ.get('TWILIO_WHATSAPP_FROM', 'whatsapp:+14155238886')

    if not all([account_sid, auth_token]):
        return False

    fecha = cita['fecha_hora'].strftime('%d/%m/%Y a las %H:%M')
    mensaje = (
        f"👋 Hola {cita['nombres']}, le recordamos su cita en "
        f"{cita['nombre_clinica']} el {fecha}. "
        f"¿Necesita reagendar? Responda este mensaje."
    )

    telefono = cita['telefono'].replace(' ', '').replace('-', '')
    if not telefono.startswith('+'):
        telefono = f'+593{telefono.lstrip("0")}'  # formato Ecuador

    data = urllib.parse.urlencode({
        'From': from_number,
        'To': f'whatsapp:{telefono}',
        'Body': mensaje,
    }).encode()

    url = f'https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json'
    credentials = base64.b64encode(f'{account_sid}:{auth_token}'.encode()).decode()
    req = urllib.request.Request(url, data=data, headers={'Authorization': f'Basic {credentials}'})

    try:
        urllib.request.urlopen(req)
        return True
    except Exception as e:
        print(f'Error enviando WhatsApp a {telefono}: {e}')
        return False
