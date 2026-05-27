"""
Handler Lambda — /pacientes
Operaciones CRUD sobre pacientes. Aisladas por clinic_id (multi-tenancy).
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

    if method == 'GET' and not path_params.get('id'):
        return listar_pacientes(clinic_id, event)
    elif method == 'GET' and path_params.get('id'):
        return obtener_paciente(clinic_id, path_params['id'])
    elif method == 'POST':
        return crear_paciente(clinic_id, event)
    elif method == 'PUT' and path_params.get('id'):
        return actualizar_paciente(clinic_id, path_params['id'], event)
    else:
        return response(405, {'error': 'Método no permitido'})


def listar_pacientes(clinic_id, event):
    params = event.get('queryStringParameters') or {}
    busqueda = params.get('q', '').strip()

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            if busqueda:
                cur.execute(
                    """SELECT id, cedula, nombres, apellidos, fecha_nacimiento,
                              telefono, email, fecha_creacion
                       FROM pacientes
                       WHERE clinic_id = %s
                         AND (nombres ILIKE %s OR apellidos ILIKE %s OR cedula ILIKE %s)
                       ORDER BY apellidos, nombres
                       LIMIT 100""",
                    (clinic_id, f'%{busqueda}%', f'%{busqueda}%', f'%{busqueda}%'),
                )
            else:
                cur.execute(
                    """SELECT id, cedula, nombres, apellidos, fecha_nacimiento,
                              telefono, email, fecha_creacion
                       FROM pacientes
                       WHERE clinic_id = %s
                       ORDER BY apellidos, nombres
                       LIMIT 100""",
                    (clinic_id,),
                )
            cols = [d[0] for d in cur.description]
            rows = [dict(zip(cols, row)) for row in cur.fetchall()]
        return response(200, {'pacientes': rows, 'total': len(rows)})
    except Exception as e:
        return response(500, {'error': str(e)})
    finally:
        release_conn(conn)


def obtener_paciente(clinic_id, paciente_id):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT p.*, h.grupo_sanguineo, h.alergias, h.enfermedades_base
                   FROM pacientes p
                   LEFT JOIN historia_medica h ON h.paciente_id = p.id
                   WHERE p.id = %s AND p.clinic_id = %s""",
                (paciente_id, clinic_id),
            )
            row = cur.fetchone()
            if not row:
                return response(404, {'error': 'Paciente no encontrado'})
            cols = [d[0] for d in cur.description]
            return response(200, dict(zip(cols, row)))
    except Exception as e:
        return response(500, {'error': str(e)})
    finally:
        release_conn(conn)


def crear_paciente(clinic_id, event):
    try:
        body = json.loads(event.get('body') or '{}')
    except json.JSONDecodeError:
        return response(400, {'error': 'JSON inválido'})

    campos_requeridos = ['cedula', 'nombres', 'apellidos', 'fecha_nacimiento']
    for campo in campos_requeridos:
        if not body.get(campo):
            return response(400, {'error': f'Campo requerido: {campo}'})

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO pacientes
                   (clinic_id, cedula, nombres, apellidos, fecha_nacimiento,
                    genero, telefono, email, direccion)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                   RETURNING id""",
                (
                    clinic_id,
                    body['cedula'],
                    body['nombres'],
                    body['apellidos'],
                    body['fecha_nacimiento'],
                    body.get('genero', ''),
                    body.get('telefono', ''),
                    body.get('email', ''),
                    body.get('direccion', ''),
                ),
            )
            nuevo_id = cur.fetchone()[0]
        conn.commit()
        return response(201, {'id': nuevo_id, 'mensaje': 'Paciente creado'})
    except Exception as e:
        conn.rollback()
        return response(500, {'error': str(e)})
    finally:
        release_conn(conn)


def actualizar_paciente(clinic_id, paciente_id, event):
    try:
        body = json.loads(event.get('body') or '{}')
    except json.JSONDecodeError:
        return response(400, {'error': 'JSON inválido'})

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE pacientes
                   SET telefono = COALESCE(%s, telefono),
                       email    = COALESCE(%s, email),
                       direccion = COALESCE(%s, direccion)
                   WHERE id = %s AND clinic_id = %s""",
                (
                    body.get('telefono'),
                    body.get('email'),
                    body.get('direccion'),
                    paciente_id,
                    clinic_id,
                ),
            )
            if cur.rowcount == 0:
                return response(404, {'error': 'Paciente no encontrado'})
        conn.commit()
        return response(200, {'mensaje': 'Paciente actualizado'})
    except Exception as e:
        conn.rollback()
        return response(500, {'error': str(e)})
    finally:
        release_conn(conn)
