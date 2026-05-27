"""
Handler Lambda — /odontogramas
Guarda y recupera odontogramas (adulto o niño) en JSON.
"""
import json
from utils.auth import validate_token, get_clinic_id, response
from utils.db import get_conn, release_conn


def lambda_handler(event, context):
    try:
        payload = validate_token(event)
        clinic_id = get_clinic_id(payload)
    except PermissionError as e:
        return response(401, {'error': str(e)})

    method = event['httpMethod']
    path_params = event.get('pathParameters') or {}

    if method == 'GET' and path_params.get('pacienteId'):
        return listar_odontogramas(clinic_id, path_params['pacienteId'])
    elif method == 'GET' and path_params.get('id'):
        return obtener_odontograma(clinic_id, path_params['id'])
    elif method == 'POST':
        return crear_odontograma(clinic_id, payload.get('sub'), event)
    elif method == 'PUT' and path_params.get('id'):
        return actualizar_odontograma(clinic_id, path_params['id'], event)
    else:
        return response(405, {'error': 'Método no permitido'})


def listar_odontogramas(clinic_id, paciente_id):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # Verificar que el paciente pertenece a la clínica
            cur.execute(
                'SELECT id FROM pacientes WHERE id = %s AND clinic_id = %s',
                (paciente_id, clinic_id),
            )
            if not cur.fetchone():
                return response(404, {'error': 'Paciente no encontrado'})

            cur.execute(
                """SELECT id, tipo, fecha_registro, odontologo_id, observaciones
                   FROM odontogramas
                   WHERE paciente_id = %s
                   ORDER BY fecha_registro DESC""",
                (paciente_id,),
            )
            cols = [d[0] for d in cur.description]
            rows = [dict(zip(cols, row)) for row in cur.fetchall()]
        return response(200, {'odontogramas': rows})
    except Exception as e:
        return response(500, {'error': str(e)})
    finally:
        release_conn(conn)


def obtener_odontograma(clinic_id, odontograma_id):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT o.*, p.nombres, p.apellidos
                   FROM odontogramas o
                   JOIN pacientes p ON p.id = o.paciente_id
                   WHERE o.id = %s AND p.clinic_id = %s""",
                (odontograma_id, clinic_id),
            )
            row = cur.fetchone()
            if not row:
                return response(404, {'error': 'Odontograma no encontrado'})
            cols = [d[0] for d in cur.description]
        return response(200, dict(zip(cols, row)))
    except Exception as e:
        return response(500, {'error': str(e)})
    finally:
        release_conn(conn)


def crear_odontograma(clinic_id, odontologo_sub, event):
    try:
        body = json.loads(event.get('body') or '{}')
    except json.JSONDecodeError:
        return response(400, {'error': 'JSON inválido'})

    paciente_id = body.get('paciente_id')
    tipo = body.get('tipo')  # 'adulto' | 'niño'
    datos_json = body.get('datos')  # estado de los 32 o 20 dientes

    if not all([paciente_id, tipo, datos_json]):
        return response(400, {'error': 'Faltan campos: paciente_id, tipo, datos'})

    if tipo not in ('adulto', 'niño'):
        return response(400, {'error': "tipo debe ser 'adulto' o 'niño'"})

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # Verificar que el paciente pertenece a la clínica
            cur.execute(
                'SELECT id FROM pacientes WHERE id = %s AND clinic_id = %s',
                (paciente_id, clinic_id),
            )
            if not cur.fetchone():
                return response(404, {'error': 'Paciente no encontrado'})

            # Obtener ID del odontólogo desde Cognito sub
            cur.execute(
                'SELECT id FROM usuarios_clinica WHERE cognito_sub = %s AND clinic_id = %s',
                (odontologo_sub, clinic_id),
            )
            odontologo_row = cur.fetchone()
            odontologo_id = odontologo_row[0] if odontologo_row else None

            cur.execute(
                """INSERT INTO odontogramas
                   (paciente_id, tipo, datos_json, odontologo_id, observaciones)
                   VALUES (%s, %s, %s, %s, %s)
                   RETURNING id""",
                (
                    paciente_id,
                    tipo,
                    json.dumps(datos_json),
                    odontologo_id,
                    body.get('observaciones', ''),
                ),
            )
            nuevo_id = cur.fetchone()[0]
        conn.commit()
        return response(201, {'id': nuevo_id, 'mensaje': 'Odontograma guardado'})
    except Exception as e:
        conn.rollback()
        return response(500, {'error': str(e)})
    finally:
        release_conn(conn)


def actualizar_odontograma(clinic_id, odontograma_id, event):
    try:
        body = json.loads(event.get('body') or '{}')
    except json.JSONDecodeError:
        return response(400, {'error': 'JSON inválido'})

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE odontogramas o
                   SET datos_json   = COALESCE(%s, o.datos_json),
                       observaciones = COALESCE(%s, o.observaciones)
                   FROM pacientes p
                   WHERE o.id = %s
                     AND o.paciente_id = p.id
                     AND p.clinic_id = %s""",
                (
                    json.dumps(body['datos']) if 'datos' in body else None,
                    body.get('observaciones'),
                    odontograma_id,
                    clinic_id,
                ),
            )
            if cur.rowcount == 0:
                return response(404, {'error': 'Odontograma no encontrado'})
        conn.commit()
        return response(200, {'mensaje': 'Odontograma actualizado'})
    except Exception as e:
        conn.rollback()
        return response(500, {'error': str(e)})
    finally:
        release_conn(conn)
