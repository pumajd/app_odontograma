"""
Tests unitarios — handler de odontogramas
"""
import json
import uuid
import pytest
from tests.conftest import make_event, CLINIC_ID
from handlers.odontogramas import lambda_handler

DATOS_ADULTO = {str(n): {'estado': '', 'superficies': ['', '', '', '', '']}
                for n in list(range(11, 19)) + list(range(21, 29)) +
                          list(range(31, 39)) + list(range(41, 49))}


class TestListarOdontogramas:
    def test_lista_odontogramas_de_paciente(self, mock_auth, mock_db):
        pac_id = str(uuid.uuid4())
        odo_id = str(uuid.uuid4())

        # fetchone para verificar paciente, fetchall para los odontogramas
        mock_db.fetchone.return_value = (pac_id,)
        mock_db.description = [('id',), ('tipo',), ('fecha_registro',),
                                ('odontologo_id',), ('observaciones',)]
        mock_db.fetchall.return_value = [
            (odo_id, 'adulto', '2024-03-01', None, 'Primera revisión'),
        ]

        event = make_event('GET', f'/pacientes/{pac_id}/odontogramas',
                           path_params={'pacienteId': pac_id})
        res = lambda_handler(event, {})

        assert res['statusCode'] == 200
        body = json.loads(res['body'])
        assert len(body['odontogramas']) == 1
        assert body['odontogramas'][0]['tipo'] == 'adulto'

    def test_paciente_no_encontrado(self, mock_auth, mock_db):
        mock_db.fetchone.return_value = None

        event = make_event('GET', '/pacientes/no-existe/odontogramas',
                           path_params={'pacienteId': 'no-existe'})
        res = lambda_handler(event, {})

        assert res['statusCode'] == 404


class TestObtenerOdontograma:
    def test_obtiene_odontograma_existente(self, mock_auth, mock_db):
        odo_id = str(uuid.uuid4())
        pac_id = str(uuid.uuid4())
        mock_db.description = [('id',), ('paciente_id',), ('tipo',), ('datos_json',),
                                ('odontologo_id',), ('observaciones',), ('fecha_registro',),
                                ('nombres',), ('apellidos',)]
        mock_db.fetchone.return_value = (
            odo_id, pac_id, 'adulto', json.dumps(DATOS_ADULTO),
            None, '', '2024-03-01', 'Ana', 'Torres'
        )

        event = make_event('GET', f'/odontogramas/{odo_id}',
                           path_params={'id': odo_id})
        res = lambda_handler(event, {})

        assert res['statusCode'] == 200
        body = json.loads(res['body'])
        assert body['tipo'] == 'adulto'
        assert body['nombres'] == 'Ana'

    def test_odontograma_no_encontrado(self, mock_auth, mock_db):
        mock_db.fetchone.return_value = None

        event = make_event('GET', '/odontogramas/no-existe',
                           path_params={'id': 'no-existe'})
        res = lambda_handler(event, {})

        assert res['statusCode'] == 404


class TestCrearOdontograma:
    def test_crea_odontograma_adulto(self, mock_auth, mock_db):
        nuevo_id = str(uuid.uuid4())
        pac_id   = str(uuid.uuid4())

        # fetchone se llama 3 veces: 1) verifica paciente, 2) odontologo, 3) RETURNING id
        mock_db.fetchone.side_effect = [
            (pac_id,),   # paciente existe
            None,        # odontologo no encontrado (ok, odontologo_id quedará None)
            (nuevo_id,), # RETURNING id
        ]

        event = make_event('POST', '/odontogramas', body={
            'paciente_id':  pac_id,
            'tipo':         'adulto',
            'datos':        DATOS_ADULTO,
            'observaciones': 'Revisión inicial',
        })
        res = lambda_handler(event, {})

        assert res['statusCode'] == 201
        body = json.loads(res['body'])
        assert body['id'] == nuevo_id

    def test_crea_odontograma_nino(self, mock_auth, mock_db):
        nuevo_id = str(uuid.uuid4())
        pac_id   = str(uuid.uuid4())
        datos_nino = {str(n): {'estado': '', 'superficies': ['', '', '', '', '']}
                      for n in list(range(51, 56)) + list(range(61, 66)) +
                                list(range(71, 76)) + list(range(81, 86))}

        mock_db.fetchone.side_effect = [
            (pac_id,),
            None,
            (nuevo_id,),
        ]

        event = make_event('POST', '/odontogramas', body={
            'paciente_id': pac_id,
            'tipo':        'niño',
            'datos':       datos_nino,
        })
        res = lambda_handler(event, {})

        assert res['statusCode'] == 201

    def test_falla_tipo_invalido(self, mock_auth, mock_db):
        event = make_event('POST', '/odontogramas', body={
            'paciente_id': str(uuid.uuid4()),
            'tipo':        'permanente',   # tipo inválido
            'datos':       DATOS_ADULTO,
        })
        res = lambda_handler(event, {})

        assert res['statusCode'] == 400
        body = json.loads(res['body'])
        assert 'tipo' in body['error']

    def test_falla_sin_campos_requeridos(self, mock_auth, mock_db):
        event = make_event('POST', '/odontogramas', body={
            'tipo': 'adulto',
            # falta paciente_id y datos
        })
        res = lambda_handler(event, {})

        assert res['statusCode'] == 400

    def test_falla_paciente_no_encontrado(self, mock_auth, mock_db):
        mock_db.fetchone.return_value = None  # paciente no existe

        event = make_event('POST', '/odontogramas', body={
            'paciente_id': str(uuid.uuid4()),
            'tipo':        'adulto',
            'datos':       DATOS_ADULTO,
        })
        res = lambda_handler(event, {})

        assert res['statusCode'] == 404


class TestActualizarOdontograma:
    def test_actualiza_odontograma(self, mock_auth, mock_db):
        odo_id = str(uuid.uuid4())
        mock_db.rowcount = 1

        event = make_event('PUT', f'/odontogramas/{odo_id}',
                           path_params={'id': odo_id},
                           body={'datos': DATOS_ADULTO, 'observaciones': 'Actualizado'})
        res = lambda_handler(event, {})

        assert res['statusCode'] == 200

    def test_odontograma_no_encontrado_al_actualizar(self, mock_auth, mock_db):
        odo_id = str(uuid.uuid4())
        mock_db.rowcount = 0

        event = make_event('PUT', f'/odontogramas/{odo_id}',
                           path_params={'id': odo_id},
                           body={'observaciones': 'Nueva nota'})
        res = lambda_handler(event, {})

        assert res['statusCode'] == 404
