"""
Handler Lambda — /radiografias
Gestión de radiografías dentales mediante presigned URLs de S3.

Flujo de subida (PUT):
  1. Frontend llama POST /radiografias  → Lambda genera presigned URL (PUT a S3)
  2. Frontend sube el archivo directamente a S3 con la URL
  3. Frontend llama PATCH /radiografias/{id}/confirmar → Lambda registra en BD

Flujo de descarga (GET):
  1. Frontend llama GET /radiografias/{id}  → Lambda genera presigned URL (GET desde S3)
  2. Frontend abre la URL para visualizar/descargar
"""
import os
import json
import uuid
import boto3
from utils.auth import validate_token, get_clinic_id, response
from utils.db import get_conn, release_conn

BUCKET       = os.environ.get('RADIOGRAFIAS_BUCKET', 'odontoval-prod-radiografias')
URL_TTL_PUT  = 300   # segundos para subir (5 min)
URL_TTL_GET  = 3600  # segundos para ver (1 hora)
MAX_SIZE_MB  = 20

s3 = boto3.client('s3', region_name='us-east-1')

TIPOS_VALIDOS = {
    'periapical', 'panoramica', 'bitewing', 'cefalometrica', 'occlusal', 'otra'
}


def lambda_handler(event, context):
    try:
        payload   = validate_token(event)
        clinic_id = get_clinic_id(payload)
    except PermissionError as e:
        return response(401, {'error': str(e)})

    method      = event['httpMethod']
    path        = event.get('path', '')
    path_params = event.get('pathParameters') or {}
    radio_id    = path_params.get('id')

    if method == 'GET' and not radio_id:
        return listar_radiografias(clinic_id, event)
    elif method == 'GET' and radio_id:
        return obtener_url_descarga(clinic_id, radio_id)
    elif method == 'POST':
        return solicitar_url_subida(clinic_id, payload.get('sub'), event)
    elif method == 'PATCH' and radio_id and path.endswith('/confirmar'):
        return confirmar_subida(clinic_id, radio_id)
    elif method == 'DELETE' and radio_id:
        return eliminar_radiografia(clinic_id, radio_id)
    else:
        return response(405, {'error': 'Método no permitido'})


# ─── Listar ────────────────────────────────────────────────────────────────────

def listar_radiografias(clinic_id, event):
    params      = event.get('queryStringParameters') or {}
    paciente_id = params.get('paciente_id')
    limite      = min(int(params.get('limite', 50)), 200)

    if not paciente_id:
        return response(400, {'error': 'Falta parámetro: paciente_id'})

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
                """SELECT id, tipo, descripcion, fecha_toma, s3_key, confirmada, fecha_creacion
                   FROM radiografias
                   WHERE paciente_id = %s AND confirmada = TRUE
                   ORDER BY fecha_toma DESC NULLS LAST, fecha_creacion DESC
                   LIMIT %s""",
                (paciente_id, limite),
            )
            cols  = [d[0] for d in cur.description]
            filas = [dict(zip(cols, row)) for row in cur.fetchall()]

        return response(200, {'radiografias': filas, 'total': len(filas)})
    except Exception as e:
        return response(500, {'error': str(e)})
    finally:
        release_conn(conn)


# ─── Generar URL de subida ──────────────────────────────────────────────────────

def solicitar_url_subida(clinic_id, odontologo_sub, event):
    try:
        body = json.loads(event.get('body') or '{}')
    except json.JSONDecodeError:
        return response(400, {'error': 'JSON inválido'})

    paciente_id  = body.get('paciente_id')
    tipo         = body.get('tipo', 'otra')
    descripcion  = body.get('descripcion', '')
    content_type = body.get('content_type', 'image/jpeg')
    fecha_toma   = body.get('fecha_toma')   # YYYY-MM-DD, opcional

    if not paciente_id:
        return response(400, {'error': 'Falta campo: paciente_id'})

    if tipo not in TIPOS_VALIDOS:
        return response(400, {'error': f"tipo inválido. Válidos: {sorted(TIPOS_VALIDOS)}"})

    tipos_mime_permitidos = {'image/jpeg', 'image/png', 'image/webp', 'image/tiff',
                              'application/dicom', 'application/octet-stream'}
    if content_type not in tipos_mime_permitidos:
        return response(400, {'error': f'content_type no permitido: {content_type}'})

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # Verificar paciente
            cur.execute(
                'SELECT id FROM pacientes WHERE id = %s AND clinic_id = %s',
                (paciente_id, clinic_id),
            )
            if not cur.fetchone():
                return response(404, {'error': 'Paciente no encontrado'})

            # Obtener odontologo_id
            cur.execute(
                'SELECT id FROM usuarios_clinica WHERE cognito_sub = %s AND clinic_id = %s',
                (odontologo_sub, clinic_id),
            )
            odo_row      = cur.fetchone()
            odontologo_id = odo_row[0] if odo_row else None

            # Construir clave S3: clinica/paciente/uuid.ext
            ext      = _ext_para_mime(content_type)
            radio_id = str(uuid.uuid4())
            s3_key   = f"{clinic_id}/{paciente_id}/{radio_id}{ext}"

            # Crear registro provisional (confirmada = FALSE)
            cur.execute(
                """INSERT INTO radiografias
                   (id, paciente_id, odontologo_id, tipo, descripcion,
                    fecha_toma, s3_key, confirmada)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, FALSE)""",
                (radio_id, paciente_id, odontologo_id, tipo,
                 descripcion, fecha_toma, s3_key),
            )
        conn.commit()

        # Generar presigned URL para PUT
        presigned_url = s3.generate_presigned_url(
            'put_object',
            Params={
                'Bucket':      BUCKET,
                'Key':         s3_key,
                'ContentType': content_type,
            },
            ExpiresIn=URL_TTL_PUT,
        )

        return response(200, {
            'id':           radio_id,
            'upload_url':   presigned_url,
            'expires_in':   URL_TTL_PUT,
            's3_key':       s3_key,
            'instrucciones': (
                f'Sube el archivo con PUT a upload_url (Content-Type: {content_type}). '
                f'Luego llama PATCH /radiografias/{radio_id}/confirmar para registrarlo.'
            ),
        })
    except Exception as e:
        conn.rollback()
        return response(500, {'error': str(e)})
    finally:
        release_conn(conn)


# ─── Confirmar subida ──────────────────────────────────────────────────────────

def confirmar_subida(clinic_id, radio_id):
    """Verifica que el objeto existe en S3 y marca la radiografía como confirmada."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT r.s3_key FROM radiografias r
                   JOIN pacientes p ON p.id = r.paciente_id
                   WHERE r.id = %s AND p.clinic_id = %s AND r.confirmada = FALSE""",
                (radio_id, clinic_id),
            )
            row = cur.fetchone()
            if not row:
                return response(404, {'error': 'Radiografía no encontrada o ya confirmada'})

            s3_key = row[0]

            # Verificar que el objeto realmente existe en S3
            try:
                s3.head_object(Bucket=BUCKET, Key=s3_key)
            except s3.exceptions.ClientError:
                return response(422, {
                    'error': 'El archivo aún no está en S3. Sube el archivo antes de confirmar.'
                })

            cur.execute(
                "UPDATE radiografias SET confirmada = TRUE WHERE id = %s",
                (radio_id,),
            )
        conn.commit()
        return response(200, {'mensaje': 'Radiografía registrada correctamente', 'id': radio_id})
    except Exception as e:
        conn.rollback()
        return response(500, {'error': str(e)})
    finally:
        release_conn(conn)


# ─── Obtener URL de descarga ───────────────────────────────────────────────────

def obtener_url_descarga(clinic_id, radio_id):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT r.id, r.tipo, r.descripcion, r.fecha_toma, r.s3_key,
                          r.fecha_creacion, p.nombres, p.apellidos
                   FROM radiografias r
                   JOIN pacientes p ON p.id = r.paciente_id
                   WHERE r.id = %s AND p.clinic_id = %s AND r.confirmada = TRUE""",
                (radio_id, clinic_id),
            )
            row = cur.fetchone()
            if not row:
                return response(404, {'error': 'Radiografía no encontrada'})
            cols = [d[0] for d in cur.description]
            radio = dict(zip(cols, row))

        # Presigned URL para GET
        presigned_url = s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': BUCKET, 'Key': radio['s3_key']},
            ExpiresIn=URL_TTL_GET,
        )

        radio['download_url'] = presigned_url
        radio['expires_in']   = URL_TTL_GET
        return response(200, radio)
    except Exception as e:
        return response(500, {'error': str(e)})
    finally:
        release_conn(conn)


# ─── Eliminar ──────────────────────────────────────────────────────────────────

def eliminar_radiografia(clinic_id, radio_id):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT r.s3_key FROM radiografias r
                   JOIN pacientes p ON p.id = r.paciente_id
                   WHERE r.id = %s AND p.clinic_id = %s""",
                (radio_id, clinic_id),
            )
            row = cur.fetchone()
            if not row:
                return response(404, {'error': 'Radiografía no encontrada'})

            s3_key = row[0]

            # Eliminar objeto de S3
            try:
                s3.delete_object(Bucket=BUCKET, Key=s3_key)
            except Exception as e:
                print(f'Advertencia: no se pudo eliminar S3 key {s3_key}: {e}')

            cur.execute('DELETE FROM radiografias WHERE id = %s', (radio_id,))
        conn.commit()
        return response(200, {'mensaje': 'Radiografía eliminada'})
    except Exception as e:
        conn.rollback()
        return response(500, {'error': str(e)})
    finally:
        release_conn(conn)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _ext_para_mime(content_type: str) -> str:
    mapping = {
        'image/jpeg':             '.jpg',
        'image/png':              '.png',
        'image/webp':             '.webp',
        'image/tiff':             '.tiff',
        'application/dicom':      '.dcm',
        'application/octet-stream': '.bin',
    }
    return mapping.get(content_type, '.bin')
