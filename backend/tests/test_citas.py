"""
Tests unitarios — handler de citas
"""
import json
import uuid
import pytest
from tests.conftest import make_event, CLINIC_ID
from handlers.citas import lambda_handler


FECHA_HORA = '2024-06-15T10:00:00'


class TestListarCitas:
    def test_lista_vacia(self, mock_auth, mock_db):
        mock_db.description = [('id',), ('fecha_hora',), ('duracion_min',), ('motivo',),
                                ('estado',), ('recordatorio_enviado',), ('notas',),
                                ('nombres',), ('apellidos',), ('cedula',), ('telefono',),
                                ('odontologo_nombre',)]
        mock_db.fetchall.return_value = []

        event = make_event('GET', '/citas')
        res = lambda_handler(event, {})

        assert res['statusCode'] == 200
        body = json.loads(res['body'])
        assert body['citas'] == []
        assert body['total'] == 0

    def test_filtra_por_fecha(self, mock_auth, mock_db):
        mock_db.description = [('id',), ('fecha_hora',), ('duracion_min',), ('motivo',),
                                ('estado',), ('recordatorio_enviado',), ('notas',),
                                ('nombres',), ('apellidos',), ('cedula',), ('telefono',),
                                ('odontologo_nombre',)]
        mock_db.fetchall.return_value = []

        event = make_event('GET', '/citas', query_params={'fecha': '2024-06-15'})
        res = lambda_handler(event, {})

        assert res['statusCode'] == 200
        # Verificar que la query incluye filtro por DATE
        call_args = mock_db.execute.call_args_list[-1]
        assert 'DATE' in call_args[0][0]

    def test_filtra_por_rango(self, mock_auth, mock_db):
        mock_db.description = [('id',), ('fecha_hora',), ('duracion_min',), ('motivo',),
                                ('estado',), ('recordatorio_enviado',), ('notas',),
                                ('nombres',), ('apellidos',), ('cedula',), ('telefono',),
                                ('odontologo_nombre',)]
        mock_db.fetchall.return_value = []

        event = make_event('GET', '/citas',
                           query_params={'desde': '2024-06-01', 'hasta': '2024-06-30'})
        res = lambda_handler(event, {})

        assert res['statusCode'] == 200
        call_args = mock_db.execute.call_args_list[-1]
        assert 'BETWEEN' in call_args[0][0]


class TestObtenerCita:
    def test_cita_existe(self, mock_auth, mock_db):
        cita_id = str(uuid.uuid4())
        pac_id  = str(uuid.uuid4())
        mock_db.description = [('id',), ('paciente_id',), ('fecha_hora',), ('duracion_min',),
                                ('motivo',), ('estado',), ('notas',),
                                ('nombres',), ('apellidos',), ('cedula',),
                                ('telefono',), ('email',)]
        mock_db.fetchone.return_value = (
            cita_id, pac_id, '2024-06-15 10:00:00', 30,
            'Revisión', 'programada', '',
            'María', 'García', '0912345678', '099', 'm@test.com'
        )

        event = make_event('GET', f'/citas/{cita_id}', path_params={'id': cita_id})
        res = lambda_handler(event, {})

        assert res['statusCode'] == 200
        body = json.loads(res['body'])
        assert body['estado'] == 'programada'

    def test_cita_no_encontrada(self, mock_auth, mock_db):
        mock_db.fetchone.return_value = None

        event = make_event('GET', '/citas/no-existe', path_params={'id': 'no-existe'})
        res = lambda_handler(event, {})

        assert res['statusCode'] == 404


class TestCrearCita:
    def test_crea_cita_exitosamente(self, mock_auth, mock_db):
        nuevo_id = str(uuid.uuid4())
        pac_id   = str(uuid.uuid4())

        # fetchone: 1) paciente existe, 2) odontologo, 3) conflicto (None), 4) RETURNING id
        mock_db.fetchone.side_effect = [
            (pac_id,),    # paciente encontrado
            None,         # odontologo no encontrado (ok)
            None,         # sin conflicto de horario
            (nuevo_id,),  # RETURNING id
        ]

        event = make_event('POST', '/citas', body={
            'paciente_id': pac_id,
            'fecha_hora':  FECHA_HORA,
            'duracion_min': 30,
            'motivo': 'Limpieza dental',
        })
        res = lambda_handler(event, {})

        assert res['statusCode'] == 201
        body = json.loads(res['body'])
        assert body['id'] == nuevo_id

    def test_falla_sin_paciente_id(self, mock_auth, mock_db):
        event = make_event('POST', '/citas', body={
            'fecha_hora': FECHA_HORA,
        })
        res = lambda_handler(event, {})

        assert res['statusCode'] == 400
        body = json.loads(res['body'])
        assert 'paciente_id' in body['error']

    def test_falla_sin_fecha_hora(self, mock_auth, mock_db):
        event = make_event('POST', '/citas', body={
            'paciente_id': str(uuid.uuid4()),
        })
        res = lambda_handler(event, {})

        assert res['statusCode'] == 400

    def test_falla_paciente_no_encontrado(self, mock_auth, mock_db):
        mock_db.fetchone.return_value = None

        event = make_event('POST', '/citas', body={
            'paciente_id': str(uuid.uuid4()),
            'fecha_hora':  FECHA_HORA,
        })
        res = lambda_handler(event, {})

        assert res['statusCode'] == 404

    def test_conflicto_de_horario(self, mock_auth, mock_db):
        pac_id = str(uuid.uuid4())
        odo_id = str(uuid.uuid4())
        cita_conflicto_id = str(uuid.uuid4())

        # fetchone: 1) paciente existe, 2) odontologo existe, 3) conflicto encontrado
        mock_db.fetchone.side_effect = [
            (pac_id,),             # paciente encontrado
            (odo_id,),             # odontologo encontrado
            (cita_conflicto_id,),  # HAY conflicto de horario
        ]

        event = make_event('POST', '/citas', body={
            'paciente_id': pac_id,
            'fecha_hora':  FECHA_HORA,
            'duracion_min': 60,
        })
        res = lambda_handler(event, {})

        assert res['statusCode'] == 409
        body = json.loads(res['body'])
        assert 'conflicto' in body['error'].lower()


class TestActualizarCita:
    def test_actualiza_estado(self, mock_auth, mock_db):
        cita_id = str(uuid.uuid4())
        mock_db.rowcount = 1

        event = make_event('PUT', f'/citas/{cita_id}',
                           path_params={'id': cita_id},
                           body={'estado': 'confirmada'})
        res = lambda_handler(event, {})

        assert res['statusCode'] == 200

    def test_estado_invalido(self, mock_auth, mock_db):
        cita_id = str(uuid.uuid4())

        event = make_event('PUT', f'/citas/{cita_id}',
                           path_params={'id': cita_id},
                           body={'estado': 'inventado'})
        res = lambda_handler(event, {})

        assert res['statusCode'] == 400
        body = json.loads(res['body'])
        assert 'estado' in body['error'].lower()

    def test_sin_campos_para_actualizar(self, mock_auth, mock_db):
        cita_id = str(uuid.uuid4())

        event = make_event('PUT', f'/citas/{cita_id}',
                           path_params={'id': cita_id},
                           body={'campo_desconocido': 'valor'})
        res = lambda_handler(event, {})

        assert res['statusCode'] == 400

    def test_cita_no_encontrada_al_actualizar(self, mock_auth, mock_db):
        cita_id = str(uuid.uuid4())
        mock_db.rowcount = 0

        event = make_event('PUT', f'/citas/{cita_id}',
                           path_params={'id': cita_id},
                           body={'estado': 'completada'})
        res = lambda_handler(event, {})

        assert res['statusCode'] == 404


class TestSinAutenticacion:
    def test_sin_token_retorna_401(self, monkeypatch):
        monkeypatch.setattr('utils.auth.validate_token',
                            lambda e: (_ for _ in ()).throw(PermissionError('Token requerido')))

        event = make_event('GET', '/citas')
        res = lambda_handler(event, {})

        assert res['statusCode'] == 401
