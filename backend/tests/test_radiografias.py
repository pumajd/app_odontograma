"""
Tests unitarios — handler de radiografías
"""
import json
import uuid
import pytest
from unittest.mock import patch, MagicMock
from tests.conftest import make_event, CLINIC_ID
from handlers.radiografias import lambda_handler


PAC_ID   = str(uuid.uuid4())
RADIO_ID = str(uuid.uuid4())
S3_KEY   = f"{CLINIC_ID}/{PAC_ID}/{RADIO_ID}.jpg"
PRESIGNED_PUT = 'https://s3.amazonaws.com/bucket/key?AWSAccessKeyId=FAKE&Expires=123&Signature=abc'
PRESIGNED_GET = 'https://s3.amazonaws.com/bucket/key?AWSAccessKeyId=FAKE&Expires=456&Signature=xyz'


@pytest.fixture
def mock_s3(monkeypatch):
    """Mockea el cliente S3 en el módulo radiografias."""
    s3_mock = MagicMock()
    monkeypatch.setattr('handlers.radiografias.s3', s3_mock)
    return s3_mock


class TestListarRadiografias:
    def test_lista_radiografias_de_paciente(self, mock_auth, mock_db, mock_s3):
        mock_db.description = [('id',), ('tipo',), ('descripcion',), ('fecha_toma',),
                                ('s3_key',), ('confirmada',), ('fecha_creacion',)]
        mock_db.fetchone.return_value = (PAC_ID,)
        mock_db.fetchall.return_value = [
            (RADIO_ID, 'periapical', 'Diente 21', '2024-06-01', S3_KEY, True, '2024-06-01'),
        ]

        event = make_event('GET', '/radiografias', query_params={'paciente_id': PAC_ID})
        res = lambda_handler(event, {})

        assert res['statusCode'] == 200
        body = json.loads(res['body'])
        assert len(body['radiografias']) == 1
        assert body['radiografias'][0]['tipo'] == 'periapical'

    def test_falla_sin_paciente_id(self, mock_auth, mock_db, mock_s3):
        event = make_event('GET', '/radiografias')
        res = lambda_handler(event, {})

        assert res['statusCode'] == 400
        body = json.loads(res['body'])
        assert 'paciente_id' in body['error']

    def test_paciente_no_encontrado(self, mock_auth, mock_db, mock_s3):
        mock_db.fetchone.return_value = None

        event = make_event('GET', '/radiografias', query_params={'paciente_id': PAC_ID})
        res = lambda_handler(event, {})

        assert res['statusCode'] == 404


class TestSolicitarUrlSubida:
    def test_genera_presigned_url(self, mock_auth, mock_db, mock_s3):
        mock_s3.generate_presigned_url.return_value = PRESIGNED_PUT
        mock_db.fetchone.side_effect = [
            (PAC_ID,),  # paciente existe
            None,       # odontologo no encontrado (ok)
        ]

        event = make_event('POST', '/radiografias', body={
            'paciente_id':  PAC_ID,
            'tipo':         'periapical',
            'descripcion':  'Diente 21 post-tratamiento',
            'content_type': 'image/jpeg',
            'fecha_toma':   '2024-06-15',
        })
        res = lambda_handler(event, {})

        assert res['statusCode'] == 200
        body = json.loads(res['body'])
        assert 'upload_url' in body
        assert body['upload_url'] == PRESIGNED_PUT
        assert 'id' in body
        # Verificar que se llamó a generate_presigned_url con put_object
        mock_s3.generate_presigned_url.assert_called_once()
        call_args = mock_s3.generate_presigned_url.call_args
        assert call_args[0][0] == 'put_object'

    def test_tipo_invalido(self, mock_auth, mock_db, mock_s3):
        event = make_event('POST', '/radiografias', body={
            'paciente_id':  PAC_ID,
            'tipo':         'mri',   # tipo no válido
            'content_type': 'image/jpeg',
        })
        res = lambda_handler(event, {})

        assert res['statusCode'] == 400
        body = json.loads(res['body'])
        assert 'tipo' in body['error']

    def test_content_type_no_permitido(self, mock_auth, mock_db, mock_s3):
        event = make_event('POST', '/radiografias', body={
            'paciente_id':  PAC_ID,
            'tipo':         'periapical',
            'content_type': 'application/pdf',   # no permitido
        })
        res = lambda_handler(event, {})

        assert res['statusCode'] == 400
        body = json.loads(res['body'])
        assert 'content_type' in body['error']

    def test_falla_sin_paciente_id(self, mock_auth, mock_db, mock_s3):
        event = make_event('POST', '/radiografias', body={
            'tipo': 'panoramica',
        })
        res = lambda_handler(event, {})

        assert res['statusCode'] == 400

    def test_paciente_no_encontrado(self, mock_auth, mock_db, mock_s3):
        mock_db.fetchone.return_value = None

        event = make_event('POST', '/radiografias', body={
            'paciente_id':  PAC_ID,
            'tipo':         'periapical',
            'content_type': 'image/jpeg',
        })
        res = lambda_handler(event, {})

        assert res['statusCode'] == 404


class TestConfirmarSubida:
    def test_confirma_exitosamente(self, mock_auth, mock_db, mock_s3):
        mock_db.fetchone.return_value = (S3_KEY,)
        mock_s3.head_object.return_value = {'ContentLength': 512000}

        event = make_event('PATCH', f'/radiografias/{RADIO_ID}/confirmar',
                           path_params={'id': RADIO_ID})
        event['path'] = f'/radiografias/{RADIO_ID}/confirmar'
        res = lambda_handler(event, {})

        assert res['statusCode'] == 200
        body = json.loads(res['body'])
        assert body['id'] == RADIO_ID

    def test_falla_objeto_no_en_s3(self, mock_auth, mock_db, mock_s3):
        from botocore.exceptions import ClientError
        mock_db.fetchone.return_value = (S3_KEY,)
        # head_object lanza excepción (objeto no existe en S3)
        mock_s3.head_object.side_effect = ClientError(
            {'Error': {'Code': '404', 'Message': 'Not Found'}}, 'HeadObject'
        )
        mock_s3.exceptions.ClientError = ClientError

        event = make_event('PATCH', f'/radiografias/{RADIO_ID}/confirmar',
                           path_params={'id': RADIO_ID})
        event['path'] = f'/radiografias/{RADIO_ID}/confirmar'
        res = lambda_handler(event, {})

        assert res['statusCode'] == 422

    def test_radiografia_no_encontrada(self, mock_auth, mock_db, mock_s3):
        mock_db.fetchone.return_value = None

        event = make_event('PATCH', f'/radiografias/{RADIO_ID}/confirmar',
                           path_params={'id': RADIO_ID})
        event['path'] = f'/radiografias/{RADIO_ID}/confirmar'
        res = lambda_handler(event, {})

        assert res['statusCode'] == 404


class TestObtenerUrlDescarga:
    def test_genera_url_descarga(self, mock_auth, mock_db, mock_s3):
        mock_s3.generate_presigned_url.return_value = PRESIGNED_GET
        mock_db.description = [('id',), ('tipo',), ('descripcion',), ('fecha_toma',),
                                ('s3_key',), ('fecha_creacion',), ('nombres',), ('apellidos',)]
        mock_db.fetchone.return_value = (
            RADIO_ID, 'periapical', 'Diente 21', '2024-06-01',
            S3_KEY, '2024-06-01', 'María', 'García'
        )

        event = make_event('GET', f'/radiografias/{RADIO_ID}',
                           path_params={'id': RADIO_ID})
        res = lambda_handler(event, {})

        assert res['statusCode'] == 200
        body = json.loads(res['body'])
        assert body['download_url'] == PRESIGNED_GET
        assert body['expires_in'] == 3600
        # Verificar que se llamó con get_object
        call_args = mock_s3.generate_presigned_url.call_args
        assert call_args[0][0] == 'get_object'

    def test_radiografia_no_encontrada(self, mock_auth, mock_db, mock_s3):
        mock_db.fetchone.return_value = None

        event = make_event('GET', f'/radiografias/{RADIO_ID}',
                           path_params={'id': RADIO_ID})
        res = lambda_handler(event, {})

        assert res['statusCode'] == 404


class TestEliminarRadiografia:
    def test_elimina_radiografia(self, mock_auth, mock_db, mock_s3):
        mock_db.fetchone.return_value = (S3_KEY,)

        event = make_event('DELETE', f'/radiografias/{RADIO_ID}',
                           path_params={'id': RADIO_ID})
        res = lambda_handler(event, {})

        assert res['statusCode'] == 200
        # Verificar que se eliminó el objeto de S3
        mock_s3.delete_object.assert_called_once_with(Bucket=mock_s3.delete_object.call_args[1]['Bucket'],
                                                       Key=S3_KEY)

    def test_radiografia_no_encontrada_al_eliminar(self, mock_auth, mock_db, mock_s3):
        mock_db.fetchone.return_value = None

        event = make_event('DELETE', f'/radiografias/{RADIO_ID}',
                           path_params={'id': RADIO_ID})
        res = lambda_handler(event, {})

        assert res['statusCode'] == 404


class TestSinAutenticacion:
    def test_sin_token_retorna_401(self, monkeypatch):
        monkeypatch.setattr('utils.auth.validate_token',
                            lambda e: (_ for _ in ()).throw(PermissionError('Token requerido')))

        event = make_event('GET', '/radiografias', query_params={'paciente_id': PAC_ID})
        res = lambda_handler(event, {})

        assert res['statusCode'] == 401
