"""
Conexión a RDS PostgreSQL con pool de conexiones.
Las credenciales se leen desde variables de entorno (inyectadas por Lambda).
"""
import os
import psycopg2
from psycopg2 import pool

_pool = None


def get_pool():
    global _pool
    if _pool is None:
        _pool = psycopg2.pool.SimpleConnectionPool(
            minconn=1,
            maxconn=5,
            host=os.environ['DB_HOST'],
            port=int(os.environ.get('DB_PORT', 5432)),
            dbname=os.environ['DB_NAME'],
            user=os.environ['DB_USER'],
            password=os.environ['DB_PASSWORD'],
            connect_timeout=5,
            sslmode='require',
        )
    return _pool


def get_conn():
    """Obtiene una conexión del pool. Usar con context manager."""
    return get_pool().getconn()


def release_conn(conn):
    """Devuelve la conexión al pool."""
    get_pool().putconn(conn)
