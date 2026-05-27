"""
conftest.py — Fixtures compartidos para todos los tests
"""
import json
import uuid
import pytest
import psycopg2
from unittest.mock import patch, MagicMock


# ── Fixture: token JWT mockeado ──────────────────────────────────────────────
CLINIC_ID  = str(uuid.uuid4())
USER_SUB   = str(uuid.uuid4())
MOCK_TOKEN = "Bearer mock.jwt.token"

MOCK_PAYLOAD = {
    'sub': USER_SUB,
    'email': 'odontologo@odontoval.com.ec',
    'custom:clinic_id': CLINIC_ID,
    'custom:role': 'odontologo',
}


@pytest.fixture
def mock_auth(monkeypatch):
    """Parchea validate_token y get_clinic_id para no necesitar Cognito real."""
    monkeypatch.setattr('utils.auth.validate_token', lambda event: MOCK_PAYLOAD)
    monkeypatch.setattr('utils.auth.get_clinic_id', lambda payload: CLINIC_ID)


# ── Fixture: conexión a BD mockeada ─────────────────────────────────────────
@pytest.fixture
def mock_db(monkeypatch):
    """
    Devuelve un mock de psycopg2 connection + cursor para no necesitar RDS real.
    Uso: mock_db.cursor().__enter__().fetchone.return_value = (...)
    """
    mock_conn   = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.__enter__ = lambda s: s
    mock_conn.__exit__ = MagicMock(return_value=False)
    mock_conn.cursor.return_value.__enter__ = lambda s: mock_cursor
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

    monkeypatch.setattr('utils.db.get_conn', lambda: mock_conn)
    monkeypatch.setattr('utils.db.release_conn', lambda conn: None)

    return mock_cursor


# ── Helper para construir eventos Lambda ────────────────────────────────────
def make_event(method='GET', path='/', body=None, path_params=None, query_params=None):
    return {
        'httpMethod': method,
        'path': path,
        'headers': {'Authorization': MOCK_TOKEN},
        'pathParameters': path_params or {},
        'queryStringParameters': query_params or {},
        'body': json.dumps(body) if body else None,
    }
