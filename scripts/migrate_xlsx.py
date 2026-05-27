"""
migrate_xlsx.py — Migración idempotente desde ODONTOVAL.xlsx a RDS PostgreSQL

Uso:
  python scripts/migrate_xlsx.py --xlsx ruta/al/ODONTOVAL.xlsx \
    --host <RDS_HOST> --db odontoval --user odontoval --clinic-id <UUID>

Idempotente: usa la cédula como clave única. Si el paciente ya existe, lo omite.
"""
import argparse
import sys
import uuid
import psycopg2
from datetime import datetime

try:
    import openpyxl
except ImportError:
    print('Instala openpyxl: pip install openpyxl')
    sys.exit(1)


def parse_args():
    p = argparse.ArgumentParser(description='Migración ODONTOVAL.xlsx → RDS')
    p.add_argument('--xlsx', required=True, help='Ruta al archivo Excel')
    p.add_argument('--host', required=True, help='Host RDS PostgreSQL')
    p.add_argument('--port', default=5432, type=int)
    p.add_argument('--db', default='odontoval')
    p.add_argument('--user', default='odontoval')
    p.add_argument('--password', required=True)
    p.add_argument('--clinic-id', required=True, help='UUID de la clínica destino')
    return p.parse_args()


def conectar(args):
    return psycopg2.connect(
        host=args.host,
        port=args.port,
        dbname=args.db,
        user=args.user,
        password=args.password,
        sslmode='require',
    )


def leer_excel(path):
    """Lee el Excel y retorna filas como lista de dicts."""
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    filas = list(ws.iter_rows(values_only=True))

    if not filas:
        print('El archivo Excel está vacío.')
        sys.exit(1)

    # Primera fila = encabezados
    encabezados = [str(h).strip().lower().replace(' ', '_') if h else f'col_{i}'
                   for i, h in enumerate(filas[0])]
    datos = []
    for fila in filas[1:]:
        if not any(fila):  # fila vacía
            continue
        datos.append(dict(zip(encabezados, fila)))

    print(f'Filas leídas del Excel: {len(datos)}')
    return datos


def normalizar_fecha(valor):
    """Intenta convertir varios formatos de fecha a date."""
    if not valor:
        return None
    if isinstance(valor, (datetime,)):
        return valor.date()
    try:
        return datetime.strptime(str(valor), '%d/%m/%Y').date()
    except ValueError:
        pass
    try:
        return datetime.strptime(str(valor), '%Y-%m-%d').date()
    except ValueError:
        return None


def migrar(conn, datos, clinic_id):
    insertados = 0
    omitidos = 0
    errores = 0

    with conn.cursor() as cur:
        for fila in datos:
            cedula = str(fila.get('cedula') or fila.get('ci') or '').strip()
            if not cedula:
                omitidos += 1
                continue

            # Idempotencia: verificar si ya existe
            cur.execute(
                'SELECT id FROM pacientes WHERE cedula = %s AND clinic_id = %s',
                (cedula, clinic_id),
            )
            if cur.fetchone():
                omitidos += 1
                continue

            nombres = str(fila.get('nombres') or fila.get('nombre') or '').strip()
            apellidos = str(fila.get('apellidos') or fila.get('apellido') or '').strip()
            fecha_nac = normalizar_fecha(fila.get('fecha_nacimiento') or fila.get('fecha_nac'))
            telefono = str(fila.get('telefono') or fila.get('celular') or '').strip()
            email = str(fila.get('email') or fila.get('correo') or '').strip()

            try:
                cur.execute(
                    """INSERT INTO pacientes
                       (id, clinic_id, cedula, nombres, apellidos, fecha_nacimiento,
                        telefono, email)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                    (
                        str(uuid.uuid4()),
                        clinic_id,
                        cedula,
                        nombres,
                        apellidos,
                        fecha_nac,
                        telefono,
                        email.lower() if email else '',
                    ),
                )
                insertados += 1
            except Exception as e:
                print(f'  Error en cédula {cedula}: {e}')
                conn.rollback()
                errores += 1
                continue

        conn.commit()

    print(f'\n✅ Migración completada:')
    print(f'   Insertados : {insertados}')
    print(f'   Omitidos   : {omitidos} (ya existían o sin cédula)')
    print(f'   Errores    : {errores}')


def main():
    args = parse_args()
    print(f'Leyendo {args.xlsx}...')
    datos = leer_excel(args.xlsx)

    print(f'Conectando a {args.host}/{args.db}...')
    conn = conectar(args)

    print(f'Migrando a clinic_id={args.clinic_id}...')
    migrar(conn, datos, args.clinic_id)
    conn.close()


if __name__ == '__main__':
    main()
