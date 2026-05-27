"""
Handler Lambda — /facturas
Emisión de recibos de pago con items, IVA 15% y numeración secuencial por clínica.
"""
import json
from utils.auth import validate_token, get_clinic_id, response
from utils.db import get_conn, release_conn


def lambda_handler(event, context):
    try:
        payload = validate_token(event)
        clinic_id = get_clinic_id(payload)
    except PermissionError as e:
        return response(401, {'error': str(e)})

    method = event['httpMethod']
    path_params = event.get('pathParameters') or {}
    factura_id = path_params.get('id')

    if method == 'GET' and not factura_id:
        return listar_facturas(clinic_id, event)
    elif method == 'GET' and factura_id:
        return obtener_factura(clinic_id, factura_id)
    elif method == 'POST':
        return crear_factura(clinic_id, payload.get('sub'), event)
    else:
        return response(405, {'error': 'Método no permitido'})


def listar_facturas(clinic_id, event):
    params = event.get('queryStringParameters') or {}
    paciente_id = params.get('paciente_id')
    estado      = params.get('estado')
    limite      = min(int(params.get('limite', 50)), 200)

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            query = """
                SELECT f.id, f.numero, f.subtotal, f.iva, f.total,
                       f.estado, f.metodo_pago, f.fecha_emision,
                       p.nombres, p.apellidos, p.cedula
                FROM facturas f
                JOIN pacientes p ON p.id = f.paciente_id
                WHERE f.clinic_id = %s
            """
            valores = [clinic_id]

            if paciente_id:
                query += " AND f.paciente_id = %s"
                valores.append(paciente_id)
            if estado:
                query += " AND f.estado = %s"
                valores.append(estado)

            query += " ORDER BY f.fecha_emision DESC LIMIT %s"
            valores.append(limite)

            cur.execute(query, valores)
            cols = [d[0] for d in cur.description]
            facturas = [dict(zip(cols, row)) for row in cur.fetchall()]

        return response(200, {'facturas': facturas, 'total': len(facturas)})
    except Exception as e:
        return response(500, {'error': str(e)})
    finally:
        release_conn(conn)


def obtener_factura(clinic_id, factura_id):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # Cabecera de la factura
            cur.execute(
                """SELECT f.*, p.nombres, p.apellidos, p.cedula, p.email, p.telefono
                   FROM facturas f
                   JOIN pacientes p ON p.id = f.paciente_id
                   WHERE f.id = %s AND f.clinic_id = %s""",
                (factura_id, clinic_id),
            )
            row = cur.fetchone()
            if not row:
                return response(404, {'error': 'Factura no encontrada'})
            cols = [d[0] for d in cur.description]
            factura = dict(zip(cols, row))

            # Items de la factura
            cur.execute(
                """SELECT id, descripcion, cantidad, precio_unitario, subtotal
                   FROM factura_items WHERE factura_id = %s ORDER BY id""",
                (factura_id,),
            )
            cols_items = [d[0] for d in cur.description]
            factura['items'] = [dict(zip(cols_items, r)) for r in cur.fetchall()]

        return response(200, factura)
    except Exception as e:
        return response(500, {'error': str(e)})
    finally:
        release_conn(conn)


def _siguiente_numero(cur, clinic_id):
    """Genera el número secuencial de recibo para la clínica (REC-0001, REC-0002, ...)."""
    cur.execute(
        "SELECT COUNT(*) FROM facturas WHERE clinic_id = %s",
        (clinic_id,),
    )
    total = cur.fetchone()[0]
    return f"REC-{total + 1:04d}"


def crear_factura(clinic_id, odontologo_sub, event):
    try:
        body = json.loads(event.get('body') or '{}')
    except json.JSONDecodeError:
        return response(400, {'error': 'JSON inválido'})

    paciente_id = body.get('paciente_id')
    items       = body.get('items', [])
    metodo_pago = body.get('metodo_pago', 'efectivo')
    observaciones = body.get('observaciones', '')

    if not paciente_id:
        return response(400, {'error': 'Falta campo: paciente_id'})
    if not items:
        return response(400, {'error': 'La factura debe tener al menos un item'})

    # Validar y calcular totales
    items_validos = []
    for it in items:
        desc  = str(it.get('descripcion', '')).strip()
        cant  = int(it.get('cantidad', 1))
        precio = float(it.get('precio_unitario', 0))
        if not desc or precio <= 0:
            continue
        items_validos.append({
            'descripcion':    desc,
            'cantidad':       cant,
            'precio_unitario': precio,
            'subtotal':       round(cant * precio, 2),
        })

    if not items_validos:
        return response(400, {'error': 'Ningún item válido (descripción y precio requeridos)'})

    subtotal = round(sum(it['subtotal'] for it in items_validos), 2)
    iva      = round(subtotal * 0.15, 2)   # IVA Ecuador 15%
    total    = round(subtotal + iva, 2)

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # Verificar paciente
            cur.execute('SELECT id FROM pacientes WHERE id = %s AND clinic_id = %s',
                        (paciente_id, clinic_id))
            if not cur.fetchone():
                return response(404, {'error': 'Paciente no encontrado'})

            # Obtener odontologo_id
            cur.execute('SELECT id FROM usuarios_clinica WHERE cognito_sub = %s AND clinic_id = %s',
                        (odontologo_sub, clinic_id))
            odontologo_row = cur.fetchone()
            odontologo_id = odontologo_row[0] if odontologo_row else None

            # Número secuencial (con bloqueo para evitar duplicados en concurrencia)
            cur.execute('SELECT pg_advisory_xact_lock(hashtext(%s))', (clinic_id,))
            numero = _siguiente_numero(cur, clinic_id)

            # Insertar factura
            cur.execute(
                """INSERT INTO facturas
                   (clinic_id, paciente_id, odontologo_id, numero,
                    subtotal, iva, total, estado, metodo_pago, observaciones)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, 'emitida', %s, %s)
                   RETURNING id""",
                (clinic_id, paciente_id, odontologo_id, numero,
                 subtotal, iva, total, metodo_pago, observaciones),
            )
            factura_id = cur.fetchone()[0]

            # Insertar items
            for it in items_validos:
                cur.execute(
                    """INSERT INTO factura_items
                       (factura_id, descripcion, cantidad, precio_unitario, subtotal)
                       VALUES (%s, %s, %s, %s, %s)""",
                    (factura_id, it['descripcion'], it['cantidad'],
                     it['precio_unitario'], it['subtotal']),
                )

        conn.commit()
        return response(201, {
            'id':      factura_id,
            'numero':  numero,
            'total':   total,
            'mensaje': 'Factura emitida',
        })
    except Exception as e:
        conn.rollback()
        return response(500, {'error': str(e)})
    finally:
        release_conn(conn)
