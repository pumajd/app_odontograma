"""
Tests unitarios — handler de facturas
"""
import json
import uuid
import pytest
from tests.conftest import make_event, CLINIC_ID
from handlers.facturas import lambda_handler

ITEMS_VALIDOS = [
    {'descripcion': 'Consulta general', 'cantidad': 1, 'precio_unitario': 30.00},
    {'descripcion': 'Limpieza dental',  'cantidad': 1, 'precio_unitario': 45.00},
]


class TestListarFacturas:
    def test_lista_vacia(self, mock_auth, mock_db):
        mock_db.description = [('id',), ('numero',), ('subtotal',), ('iva',), ('total',),
                                ('estado',), ('metodo_pago',), ('fecha_emision',),
                                ('nombres',), ('apellidos',), ('cedula',)]
        mock_db.fetchall.return_value = []

        event = make_event('GET', '/facturas')
        res = lambda_handler(event, {})

        assert res['statusCode'] == 200
        body = json.loads(res['body'])
        assert body['facturas'] == []
        assert body['total'] == 0

    def test_filtra_por_paciente(self, mock_auth, mock_db):
        pac_id = str(uuid.uuid4())
        mock_db.description = [('id',), ('numero',), ('subtotal',), ('iva',), ('total',),
                                ('estado',), ('metodo_pago',), ('fecha_emision',),
                                ('nombres',), ('apellidos',), ('cedula',)]
        mock_db.fetchall.return_value = []

        event = make_event('GET', '/facturas', query_params={'paciente_id': pac_id})
        res = lambda_handler(event, {})

        assert res['statusCode'] == 200
        # Verificar que la query incluye filtro por paciente_id
        call_args = mock_db.execute.call_args_list[-1]
        assert 'paciente_id' in call_args[0][0]

    def test_filtra_por_estado(self, mock_auth, mock_db):
        mock_db.description = [('id',), ('numero',), ('subtotal',), ('iva',), ('total',),
                                ('estado',), ('metodo_pago',), ('fecha_emision',),
                                ('nombres',), ('apellidos',), ('cedula',)]
        mock_db.fetchall.return_value = []

        event = make_event('GET', '/facturas', query_params={'estado': 'emitida'})
        res = lambda_handler(event, {})

        assert res['statusCode'] == 200


class TestObtenerFactura:
    def test_factura_existe(self, mock_auth, mock_db):
        fac_id = str(uuid.uuid4())
        pac_id = str(uuid.uuid4())
        mock_db.description = [('id',), ('clinic_id',), ('paciente_id',), ('numero',),
                                ('subtotal',), ('iva',), ('total',), ('estado',),
                                ('metodo_pago',), ('observaciones',), ('fecha_emision',),
                                ('nombres',), ('apellidos',), ('cedula',), ('email',), ('telefono',)]
        items_description = [('id',), ('descripcion',), ('cantidad',),
                              ('precio_unitario',), ('subtotal',)]

        # fetchone para cabecera, description+fetchall para items
        mock_db.fetchone.return_value = (
            fac_id, CLINIC_ID, pac_id, 'REC-0001',
            75.00, 11.25, 86.25, 'emitida',
            'efectivo', '', '2024-06-01',
            'María', 'García', '0912345678', 'm@test.com', '099'
        )

        # description cambia entre consulta de cabecera e items
        mock_db.description = items_description
        mock_db.fetchall.return_value = [
            (1, 'Consulta general', 1, 30.00, 30.00),
            (2, 'Limpieza dental', 1, 45.00, 45.00),
        ]

        event = make_event('GET', f'/facturas/{fac_id}', path_params={'id': fac_id})
        res = lambda_handler(event, {})

        assert res['statusCode'] == 200

    def test_factura_no_encontrada(self, mock_auth, mock_db):
        mock_db.fetchone.return_value = None

        event = make_event('GET', '/facturas/no-existe', path_params={'id': 'no-existe'})
        res = lambda_handler(event, {})

        assert res['statusCode'] == 404


class TestCrearFactura:
    def test_crea_factura_con_iva_15(self, mock_auth, mock_db):
        """IVA Ecuador: 15% sobre subtotal."""
        fac_id = str(uuid.uuid4())
        pac_id = str(uuid.uuid4())

        # fetchone: 1) paciente, 2) odontologo, 3) advisory_lock (None ok),
        #           4) COUNT para numero, 5) RETURNING factura_id
        mock_db.fetchone.side_effect = [
            (pac_id,),  # paciente encontrado
            None,       # odontologo no encontrado (ok)
            None,       # pg_advisory_xact_lock
            (0,),       # COUNT(*) → primer recibo: REC-0001
            (fac_id,),  # RETURNING id
        ]

        event = make_event('POST', '/facturas', body={
            'paciente_id': pac_id,
            'items':       ITEMS_VALIDOS,
            'metodo_pago': 'efectivo',
        })
        res = lambda_handler(event, {})

        assert res['statusCode'] == 201
        body = json.loads(res['body'])
        assert body['numero'] == 'REC-0001'

        # Verificar cálculo IVA: subtotal=75, iva=11.25, total=86.25
        assert body['total'] == 86.25

    def test_numeracion_secuencial(self, mock_auth, mock_db):
        """El número de recibo incrementa con cada factura."""
        pac_id = str(uuid.uuid4())
        fac_id = str(uuid.uuid4())

        mock_db.fetchone.side_effect = [
            (pac_id,),
            None,
            None,
            (5,),       # ya hay 5 facturas → próxima es REC-0006
            (fac_id,),
        ]

        event = make_event('POST', '/facturas', body={
            'paciente_id': pac_id,
            'items':       ITEMS_VALIDOS,
        })
        res = lambda_handler(event, {})

        assert res['statusCode'] == 201
        body = json.loads(res['body'])
        assert body['numero'] == 'REC-0006'

    def test_falla_sin_paciente_id(self, mock_auth, mock_db):
        event = make_event('POST', '/facturas', body={'items': ITEMS_VALIDOS})
        res = lambda_handler(event, {})

        assert res['statusCode'] == 400
        body = json.loads(res['body'])
        assert 'paciente_id' in body['error']

    def test_falla_sin_items(self, mock_auth, mock_db):
        event = make_event('POST', '/facturas', body={
            'paciente_id': str(uuid.uuid4()),
            'items': [],
        })
        res = lambda_handler(event, {})

        assert res['statusCode'] == 400
        body = json.loads(res['body'])
        assert 'item' in body['error'].lower()

    def test_falla_items_invalidos(self, mock_auth, mock_db):
        """Items sin descripción o precio ≤ 0 se descartan; si todos son inválidos → 400."""
        event = make_event('POST', '/facturas', body={
            'paciente_id': str(uuid.uuid4()),
            'items': [
                {'descripcion': '', 'cantidad': 1, 'precio_unitario': 10},   # sin descripción
                {'descripcion': 'Algo', 'cantidad': 1, 'precio_unitario': 0},  # precio 0
            ],
        })
        res = lambda_handler(event, {})

        assert res['statusCode'] == 400

    def test_falla_paciente_no_encontrado(self, mock_auth, mock_db):
        mock_db.fetchone.return_value = None  # paciente no existe

        event = make_event('POST', '/facturas', body={
            'paciente_id': str(uuid.uuid4()),
            'items': ITEMS_VALIDOS,
        })
        res = lambda_handler(event, {})

        assert res['statusCode'] == 404

    def test_falla_json_invalido(self, mock_auth, mock_db):
        event = make_event('GET', '/facturas')
        event['httpMethod'] = 'POST'
        event['body'] = 'not-json{'

        res = lambda_handler(event, {})
        assert res['statusCode'] == 400

    def test_metodo_pago_por_defecto(self, mock_auth, mock_db):
        """Si no se envía metodo_pago debe usarse 'efectivo'."""
        pac_id = str(uuid.uuid4())
        fac_id = str(uuid.uuid4())

        mock_db.fetchone.side_effect = [
            (pac_id,),
            None,
            None,
            (0,),
            (fac_id,),
        ]

        event = make_event('POST', '/facturas', body={
            'paciente_id': pac_id,
            'items':       ITEMS_VALIDOS,
            # sin metodo_pago
        })
        res = lambda_handler(event, {})

        assert res['statusCode'] == 201
        # Verificar que en el INSERT se usó 'efectivo'
        insert_call = next(
            c for c in mock_db.execute.call_args_list
            if 'INSERT INTO facturas' in c[0][0]
        )
        assert 'efectivo' in insert_call[0][1]


class TestSinAutenticacion:
    def test_sin_token_retorna_401(self, monkeypatch):
        monkeypatch.setattr('utils.auth.validate_token',
                            lambda e: (_ for _ in ()).throw(PermissionError('Token requerido')))

        event = make_event('GET', '/facturas')
        res = lambda_handler(event, {})

        assert res['statusCode'] == 401
