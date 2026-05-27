"""
Tests unitarios — handler de pacientes
"""
import json
import uuid
import pytest
from unittest.mock import MagicMock
from tests.conftest import make_event, CLINIC_ID
from handlers.pacientes import lambda_handler


class TestListarPacientes:
    def test_lista_vacia(self, mock_auth, mock_db):
        mock_db.description = [('id',), ('cedula',), ('nombres',), ('apellidos',),
                                ('fecha_nacimiento',), ('telefono',), ('email',), ('fecha_creacion',)]
        mock_db.fetchall.return_value = []

        event = make_event('GET', '/pacientes')
        res = lambda_handler(event, {})

        assert res['statusCode'] == 200
        body = json.loads(res['body'])
        assert body['pacientes'] == []
        assert body['total'] == 0

    def test_lista_con_pacientes(self, mock_auth, mock_db):
        pac_id = str(uuid.uuid4())
        mock_db.description = [('id',), ('cedula',), ('nombres',), ('apellidos',),
                                ('fecha_nacimiento',), ('telefono',), ('email',), ('fecha_creacion',)]
        mock_db.fetchall.return_value = [
            (pac_id, '0912345678', 'María', 'García', '1990-01-15', '0991234567', 'm@test.com', '2024-01-01'),
        ]

        event = make_event('GET', '/pacientes')
        res = lambda_handler(event, {})

        assert res['statusCode'] == 200
        body = json.loads(res['body'])
        assert len(body['pacientes']) == 1
        assert body['pacientes'][0]['cedula'] == '0912345678'

    def test_busqueda_por_nombre(self, mock_auth, mock_db):
        mock_db.description = [('id',), ('cedula',), ('nombres',), ('apellidos',),
                                ('fecha_nacimiento',), ('telefono',), ('email',), ('fecha_creacion',)]
        mock_db.fetchall.return_value = []

        event = make_event('GET', '/pacientes', query_params={'q': 'García'})
        res = lambda_handler(event, {})

        assert res['statusCode'] == 200
        # Verificar que se ejecutó la query con ILIKE
        call_args = mock_db.execute.call_args_list[-1]
        assert 'ILIKE' in call_args[0][0]


class TestCrearPaciente:
    def test_crea_paciente_exitosamente(self, mock_auth, mock_db):
        nuevo_id = str(uuid.uuid4())
        mock_db.fetchone.return_value = (nuevo_id,)

        event = make_event('POST', '/pacientes', body={
            'cedula': '0987654321',
            'nombres': 'Juan Carlos',
            'apellidos': 'López Pérez',
            'fecha_nacimiento': '1985-06-20',
            'telefono': '0997654321',
            'email': 'juan@test.com',
        })
        res = lambda_handler(event, {})

        assert res['statusCode'] == 201
        body = json.loads(res['body'])
        assert body['id'] == nuevo_id

    def test_falla_sin_cedula(self, mock_auth, mock_db):
        event = make_event('POST', '/pacientes', body={
            'nombres': 'Juan',
            'apellidos': 'López',
            'fecha_nacimiento': '1985-06-20',
        })
        res = lambda_handler(event, {})

        assert res['statusCode'] == 400
        body = json.loads(res['body'])
        assert 'cedula' in body['error'].lower()

    def test_falla_sin_nombre(self, mock_auth, mock_db):
        event = make_event('POST', '/pacientes', body={
            'cedula': '0987654321',
            'apellidos': 'López',
            'fecha_nacimiento': '1985-06-20',
        })
        res = lambda_handler(event, {})

        assert res['statusCode'] == 400

    def test_falla_json_invalido(self, mock_auth, mock_db):
        event = make_event('GET', '/pacientes')
        event['httpMethod'] = 'POST'
        event['body'] = 'not-json{'

        res = lambda_handler(event, {})
        assert res['statusCode'] == 400


class TestObtenerPaciente:
    def test_paciente_existe(self, mock_auth, mock_db):
        pac_id = str(uuid.uuid4())
        mock_db.description = [('id',), ('cedula',), ('nombres',), ('apellidos',),
                                ('fecha_nacimiento',), ('telefono',), ('email',),
                                ('fecha_creacion',), ('grupo_sanguineo',), ('alergias',), ('enfermedades_base',)]
        mock_db.fetchone.return_value = (
            pac_id, '0912345678', 'María', 'García', '1990-01-15',
            '099', 'm@test.com', '2024-01-01', 'O+', None, None
        )

        event = make_event('GET', f'/pacientes/{pac_id}', path_params={'id': pac_id})
        res = lambda_handler(event, {})

        assert res['statusCode'] == 200
        body = json.loads(res['body'])
        assert body['cedula'] == '0912345678'

    def test_paciente_no_encontrado(self, mock_auth, mock_db):
        mock_db.fetchone.return_value = None

        event = make_event('GET', '/pacientes/no-existe', path_params={'id': 'no-existe'})
        res = lambda_handler(event, {})

        assert res['statusCode'] == 404


class TestSinAutenticacion:
    def test_sin_token_retorna_401(self, monkeypatch):
        monkeypatch.setattr('utils.auth.validate_token',
                            lambda e: (_ for _ in ()).throw(PermissionError('Token no proporcionado')))

        event = make_event('GET', '/pacientes')
        res = lambda_handler(event, {})

        assert res['statusCode'] == 401
