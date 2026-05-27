"""
Handler Lambda — Generador de citas de profilaxis
Invocado por EventBridge Scheduler el primer día de cada mes.

Lógica:
  1. Busca pacientes cuya próxima profilaxis sea en los próximos 30 días
  2. Envía recordatorio por email (SES) y WhatsApp (Twilio)
  3. Si la fecha ya venció (> 0 días pasados), programa la nueva cita directamente
  4. Actualiza profilaxis_programadas
"""
import os
import json
import boto3
import urllib.request
import urllib.parse
import base64
from datetime import date, timedelta
from utils.db import get_conn, release_conn

ses = boto3.client('ses', region_name='us-east-1')


def lambda_handler(event, context):
    hoy = date.today()
    en_30_dias = hoy + timedelta(days=30)

    conn = get_conn()
    procesados = 0
    errores = 0

    try:
        with conn.cursor() as cur:
            # Pacientes con profilaxis próxima (en los próximos 30 días o vencida)
            cur.execute(
                """SELECT pp.id, pp.paciente_id, pp.proxima_fecha,
                          p.nombres, p.apellidos, p.email, p.telefono,
                          cl.nombre AS nombre_clinica
                   FROM profilaxis_programadas pp
                   JOIN pacientes p   ON p.id = pp.paciente_id
                   JOIN clinicas cl   ON cl.id = p.clinic_id
                   WHERE pp.proxima_fecha <= %s
                     AND pp.notificado = FALSE""",
                (en_30_dias,),
            )
            cols = [d[0] for d in cur.description]
            pendientes = [dict(zip(cols, row)) for row in cur.fetchall()]

        print(f'Profilaxis pendientes de notificación: {len(pendientes)}')

        for pp in pendientes:
            dias_restantes = (pp['proxima_fecha'] - hoy).days
            ok = False

            # Email
            if pp.get('email'):
                ok = _enviar_email_profilaxis(pp, dias_restantes) or ok

            # WhatsApp
            if pp.get('telefono'):
                ok = _enviar_whatsapp_profilaxis(pp, dias_restantes) or ok

            if ok:
                with conn.cursor() as cur:
                    # Marcar como notificado y calcular próxima cita (6 meses)
                    proxima = pp['proxima_fecha'] + timedelta(days=182)
                    cur.execute(
                        """UPDATE profilaxis_programadas
                           SET notificado   = TRUE,
                               ultima_fecha = proxima_fecha,
                               proxima_fecha = %s
                           WHERE id = %s""",
                        (proxima, pp['id']),
                    )
                conn.commit()
                procesados += 1
            else:
                errores += 1

        print(f'Procesados: {procesados} | Errores: {errores}')
        return {'statusCode': 200, 'procesados': procesados, 'errores': errores}

    except Exception as e:
        print(f'Error general en profilaxis: {e}')
        raise
    finally:
        release_conn(conn)


def _enviar_email_profilaxis(pp, dias_restantes):
    if dias_restantes > 0:
        when = f"en <strong>{dias_restantes} días</strong> ({pp['proxima_fecha'].strftime('%d/%m/%Y')})"
        asunto = f"Recordatorio: profilaxis dental próxima - {pp['nombre_clinica']}"
    else:
        when = f"<strong>el {pp['proxima_fecha'].strftime('%d/%m/%Y')}</strong> (ya venció)"
        asunto = f"¡Su cita de profilaxis está pendiente! - {pp['nombre_clinica']}"

    html = f"""
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
      <h2 style="color:#0369a1">🦷 {pp['nombre_clinica']}</h2>
      <p>Estimado/a <strong>{pp['nombres']} {pp['apellidos']}</strong>,</p>
      <p>Le recordamos que su <strong>cita de profilaxis dental</strong> está programada {when}.</p>
      <p>La limpieza dental cada 6 meses es fundamental para mantener una buena salud bucal.</p>
      <p>Para agendar su cita, contáctenos:</p>
      <p>📧 <a href="mailto:info@odontoval.com.ec">info@odontoval.com.ec</a></p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
      <p style="color:#6b7280;font-size:12px">ODONTOVAL · odontoval.com.ec</p>
    </div>
    """

    try:
        ses.send_email(
            Source='ODONTOVAL <noreply@odontoval.com.ec>',
            Destination={'ToAddresses': [pp['email']]},
            Message={
                'Subject': {'Data': asunto},
                'Body': {'Html': {'Data': html}},
            },
        )
        return True
    except Exception as e:
        print(f'Error email profilaxis a {pp["email"]}: {e}')
        return False


def _enviar_whatsapp_profilaxis(pp, dias_restantes):
    account_sid = os.environ.get('TWILIO_ACCOUNT_SID')
    auth_token  = os.environ.get('TWILIO_AUTH_TOKEN')
    from_number = os.environ.get('TWILIO_WHATSAPP_FROM', 'whatsapp:+14155238886')

    if not all([account_sid, auth_token]):
        return False

    if dias_restantes > 0:
        when = f"en {dias_restantes} días ({pp['proxima_fecha'].strftime('%d/%m/%Y')})"
    else:
        when = f"el {pp['proxima_fecha'].strftime('%d/%m/%Y')} (pendiente)"

    mensaje = (
        f"👋 Hola {pp['nombres']}, le recordamos que su cita de profilaxis dental "
        f"en {pp['nombre_clinica']} está programada {when}. "
        f"Contáctenos en info@odontoval.com.ec para confirmar. 🦷"
    )

    telefono = pp['telefono'].replace(' ', '').replace('-', '')
    if not telefono.startswith('+'):
        telefono = f'+593{telefono.lstrip("0")}'

    data = urllib.parse.urlencode({
        'From': from_number,
        'To': f'whatsapp:{telefono}',
        'Body': mensaje,
    }).encode()

    url = f'https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json'
    credentials = base64.b64encode(f'{account_sid}:{auth_token}'.encode()).decode()
    req = urllib.request.Request(
        url, data=data,
        headers={'Authorization': f'Basic {credentials}'},
    )

    try:
        urllib.request.urlopen(req)
        return True
    except Exception as e:
        print(f'Error WhatsApp profilaxis a {telefono}: {e}')
        return False
