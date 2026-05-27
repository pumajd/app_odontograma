"""
Handler Lambda — /citas
Gestión de citas: creación, consulta, cambio de estado.
Valida conflictos de horario por odontólogo.
"""
import json
from datetime import datetime, timedelta, timezone
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
    cita_id = path_params.get('id')

    if method == 'GET' and not cita_id:
        return listar_citas(clinic_id, event)
    elif method == 'GET' and cita_id:
        return obtener_cita(clinic_id, cita_id)
    elif method == 'POST':
        return crear_cita(clinic_id, payload.get('sub'), event)
    elif method == 'PUT' and cita_id:
        return actualizar_cita(clinic_id, cita_id, event)
    elif method == 'PATCH' and cita_id and event.get('path', '').endswith('/cancelar'):
        return cancelar_cita(clinic_id, cita_id)
    else:
        return response(405, {'error': 'Método no permitido'})


def listar_citas(clinic_id, event):
    params = event.get('queryStringParameters') or {}
    desde = params.get('desde')
    hasta = params.get('hasta')
    fecha = params.get('fecha')         # filtro por día exacto
    paciente_id = params.get('paciente_id')
    limite = min(int(params.get('limite', 50)), 200)

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            filtros = ['c.clinic_id_from_paciente = %s']
            valores = [clinic_id]

            # Subconsulta para obtener clinic_id desde pacientes
            base_query = """
                SELECT c.id, c.fecha_hora, c.duracion_min, c.motivo, c.estado,
                       c.recordatorio_enviado, c.notas,
                       p.nombres, p.apellidos, p.cedula, p.telefono,
                       u.nombre AS odontologo_nombre
                FROM citas c
                JOIN pacientes p   ON p.id = c.paciente_id AND p.clinic_id = %s
                LEFT JOIN usuarios_clinica u ON u.id = c.odontologo_id
                WHERE 1=1
            """
            valores = [clinic_id]

            if fecha:
                base_query += " AND DATE(c.fecha_hora AT TIME ZONE 'America/Guayaquil') = %s"
                valores.append(fecha)
            elif desde and hasta:
                base_query += " AND c.fecha_hora BETWEEN %s AND %s"
                valores.extend([desde + ' 00:00:00', hasta + ' 23:59:59'])

            if paciente_id:
                base_query += " AND c.paciente_id = %s"
                valores.append(paciente_id)

            base_query += " ORDER BY c.fecha_hora ASC LIMIT %s"
            valores.append(limite)

            cur.execute(base_query, valores)
            cols = [d[0] for d in cur.description]
            citas = [dict(zip(cols, row)) for row in cur.fetchall()]

        return response(200, {'citas': citas, 'total': len(citas)})
    except Exception as e:
        return response(500, {'error': str(e)})
    finally:
        release_conn(conn)


def obtener_cita(clinic_id, cita_id):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT c.*, p.nombres, p.apellidos, p.cedula, p.telefono, p.email
                   FROM citas c
                   JOIN pacientes p ON p.id = c.paciente_id AND p.clinic_id = %s
                   WHERE c.id = %s""",
                (clinic_id, cita_id),
            )
            row = cur.fetchone()
            if not row:
                return response(404, {'error': 'Cita no encontrada'})
            cols = [d[0] for d in cur.description]
        return response(200, dict(zip(cols, row)))
    except Exception as e:
        return response(500, {'error': str(e)})
    finally:
        release_conn(conn)


def crear_cita(clinic_id, odontologo_sub, event):
    try:
        body = json.loads(event.get('body') or '{}')
    except json.JSONDecodeError:
        return response(400, {'error': 'JSON inválido'})

    paciente_id = body.get('paciente_id')
    fecha_hora  = body.get('fecha_hora')
    duracion    = int(body.get('duracion_min', 30))

    if not paciente_id or not fecha_hora:
        return response(400, {'error': 'Faltan campos: paciente_id, fecha_hora'})

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # Verificar que el paciente pertenece a la clínica
            cur.execute('SELECT id FROM pacientes WHERE id = %s AND clinic_id = %s',
                        (paciente_id, clinic_id))
            if not cur.fetchone():
                return response(404, {'error': 'Paciente no encontrado'})

            # Obtener odontologo_id
            cur.execute('SELECT id FROM usuarios_clinica WHERE cognito_sub = %s AND clinic_id = %s',
                        (odontologo_sub, clinic_id))
            odontologo_row = cur.fetchone()
            odontologo_id = odontologo_row[0] if odontologo_row else None

            # Verificar conflicto de horario (mismo odontólogo, mismo tramo horario)
            if odontologo_id:
                fin_nueva = f"({fecha_hora!r}::timestamptz + INTERVAL '{duracion} minutes')"
                cur.execute(
                    """SELECT id FROM citas
                       WHERE odontologo_id = %s
                         AND estado NOT IN ('cancelada', 'completada')
                         AND fecha_hora < %s::timestamptz + INTERVAL %s
                         AND fecha_hora + (duracion_min * INTERVAL '1 minute') > %s::timestamptz""",
                    (odontologo_id, fecha_hora, f'{duracion} minutes', fecha_hora),
                )
                if cur.fetchone():
                    return response(409, {'error': 'Conflicto de horario: ya existe una cita en ese tramo'})

            cur.execute(
                """INSERT INTO citas
                   (paciente_id, odontologo_id, fecha_hora, duracion_min, motivo, notas)
                   VALUES (%s, %s, %s, %s, %s, %s)
                   RETURNING id""",
                (paciente_id, odontologo_id, fecha_hora, duracion,
                 body.get('motivo', ''), body.get('notas', '')),
            )
            nuevo_id = cur.fetchone()[0]
        conn.commit()
        return response(201, {'id': nuevo_id, 'mensaje': 'Cita creada'})
    except Exception as e:
        conn.rollback()
        return response(500, {'error': str(e)})
    finally:
        release_conn(conn)


def actualizar_cita(clinic_id, cita_id, event):
    try:
        body = json.loads(event.get('body') or '{}')
    except json.JSONDecodeError:
        return response(400, {'error': 'JSON inválido'})

    campos_validos = {'estado', 'motivo', 'notas', 'fecha_hora', 'duracion_min'}
    actualizaciones = {k: v for k, v in body.items() if k in campos_validos}

    if not actualizaciones:
        return response(400, {'error': 'Sin campos para actualizar'})

    estados_validos = {'programada', 'confirmada', 'completada', 'cancelada'}
    if 'estado' in actualizaciones and actualizaciones['estado'] not in estados_validos:
        return response(400, {'error': f"Estado inválido. Valores válidos: {estados_validos}"})

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # Construir UPDATE dinámico
            sets = ', '.join(f'{k} = %s' for k in actualizaciones)
            vals = list(actualizaciones.values()) + [cita_id, clinic_id]

            cur.execute(
                f"""UPDATE citas c
                    SET {sets}
                    FROM pacientes p
                    WHERE c.id = %s
                      AND c.paciente_id = p.id
                      AND p.clinic_id = %s""",
                vals,
            )
            if cur.rowcount == 0:
                return response(404, {'error': 'Cita no encontrada'})
        conn.commit()
        return response(200, {'mensaje': 'Cita actualizada'})
    except Exception as e:
        conn.rollback()
        return response(500, {'error': str(e)})
    finally:
        release_conn(conn)


def cancelar_cita(clinic_id, cita_id):
    """Atajo para cancelar una cita directamente."""
    return actualizar_cita(clinic_id, cita_id, type('E', (), {
        'get': lambda self, k, d='{}': '{"estado":"cancelada"}' if k == 'body' else d
    })())
