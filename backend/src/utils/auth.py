"""
Validación del JWT de Cognito.
Extrae clinic_id del token para aislar datos por clínica (multi-tenancy).
"""
import os
import json
import urllib.request
import jwt  # PyJWT


def _get_jwks():
    """Descarga las claves públicas de Cognito (se cachean en el módulo)."""
    region = os.environ['AWS_REGION']
    pool_id = os.environ['COGNITO_USER_POOL_ID']
    url = f'https://cognito-idp.{region}.amazonaws.com/{pool_id}/.well-known/jwks.json'
    with urllib.request.urlopen(url) as resp:
        return json.loads(resp.read())


_JWKS = None


def validate_token(event):
    """
    Valida el Bearer token del header Authorization.
    Retorna el payload decodificado o lanza Exception.
    """
    global _JWKS
    auth_header = event.get('headers', {}).get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        raise PermissionError('Token no proporcionado')

    token = auth_header[7:]

    if _JWKS is None:
        _JWKS = _get_jwks()

    # Decodificar y validar
    decoded = jwt.decode(
        token,
        _JWKS,
        algorithms=['RS256'],
        audience=os.environ['COGNITO_CLIENT_ID'],
    )
    return decoded


def get_clinic_id(token_payload):
    """
    Extrae el clinic_id del token.
    Se almacena como atributo personalizado 'custom:clinic_id' en Cognito.
    """
    clinic_id = token_payload.get('custom:clinic_id')
    if not clinic_id:
        raise PermissionError('Usuario sin clínica asignada')
    return clinic_id


def response(status_code, body):
    """Helper para construir respuestas HTTP de Lambda."""
    import json
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'https://odontoval.com.ec',
            'Access-Control-Allow-Headers': 'Authorization,Content-Type',
        },
        'body': json.dumps(body, default=str, ensure_ascii=False),
    }
