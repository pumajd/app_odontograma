"""
Validación del JWT de Cognito.
Extrae clinic_id del token para aislar datos por clínica (multi-tenancy).

En modo LOCAL_DEV=true se omite la validación real y se devuelve
un payload de prueba configurable mediante variables de entorno.
"""
import os
import json
import urllib.request
import jwt  # PyJWT


# ── Modo desarrollo local ──────────────────────────────────────────────────────

def _is_local() -> bool:
    return os.environ.get('LOCAL_DEV', '').lower() == 'true'


def _local_payload() -> dict:
    """Payload falso para desarrollo local. No llega a AWS."""
    return {
        'sub':               os.environ.get('LOCAL_USER_SUB',   '00000000-0000-0000-0000-000000000099'),
        'email':             os.environ.get('LOCAL_USER_EMAIL',  'dev@odontoval.local'),
        'custom:clinic_id':  os.environ.get('LOCAL_CLINIC_ID',  '00000000-0000-0000-0000-000000000001'),
        'custom:role':       'odontologo',
    }


# ── JWKS cache ─────────────────────────────────────────────────────────────────

_JWKS = None


def _get_jwks() -> dict:
    """Descarga las claves públicas de Cognito (se cachean en el módulo)."""
    global _JWKS
    if _JWKS is None:
        region  = os.environ['AWS_REGION']
        pool_id = os.environ['COGNITO_USER_POOL_ID']
        url = f'https://cognito-idp.{region}.amazonaws.com/{pool_id}/.well-known/jwks.json'
        with urllib.request.urlopen(url) as resp:
            _JWKS = json.loads(resp.read())
    return _JWKS


# ── API pública ────────────────────────────────────────────────────────────────

def validate_token(event: dict) -> dict:
    """
    Valida el Bearer token del header Authorization.
    En LOCAL_DEV omite la validación y devuelve el payload local.
    Retorna el payload decodificado o lanza PermissionError.
    """
    if _is_local():
        # En local aceptamos cualquier token (o ninguno)
        return _local_payload()

    auth_header = (event.get('headers') or {}).get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        raise PermissionError('Token no proporcionado')

    token = auth_header[7:]

    try:
        decoded = jwt.decode(
            token,
            _get_jwks(),
            algorithms=['RS256'],
            audience=os.environ['COGNITO_CLIENT_ID'],
        )
    except jwt.ExpiredSignatureError:
        raise PermissionError('Token expirado')
    except jwt.InvalidTokenError as e:
        raise PermissionError(f'Token inválido: {e}')

    return decoded


def get_clinic_id(token_payload: dict) -> str:
    """
    Extrae el clinic_id del token.
    Se almacena como atributo personalizado 'custom:clinic_id' en Cognito.
    """
    clinic_id = token_payload.get('custom:clinic_id')
    if not clinic_id:
        raise PermissionError('Usuario sin clínica asignada')
    return clinic_id


def response(status_code: int, body: dict) -> dict:
    """Helper para construir respuestas HTTP de Lambda."""
    origin = 'http://localhost:5173' if _is_local() else 'https://odontoval.com.ec'
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin':  origin,
            'Access-Control-Allow-Headers': 'Authorization,Content-Type',
        },
        'body': json.dumps(body, default=str, ensure_ascii=False),
    }
