"""
local_server.py — Servidor de desarrollo local para ODONTOVAL.

Simula API Gateway convirtiendo requests HTTP de Flask en eventos Lambda
y devolviendo la respuesta en formato HTTP.

Solo activo cuando LOCAL_DEV=true. Nunca usar en producción.

Rutas expuestas:
  GET/POST        /pacientes
  GET/PUT         /pacientes/{id}
  GET             /pacientes/{id}/odontogramas
  GET/POST        /odontogramas
  GET/PUT         /odontogramas/{id}
  GET/POST        /citas
  GET/PUT/PATCH   /citas/{id}
  PATCH           /citas/{id}/cancelar
  GET/POST        /facturas
  GET             /facturas/{id}
  GET/POST/DELETE /radiografias
  GET/DELETE      /radiografias/{id}
  PATCH           /radiografias/{id}/confirmar
"""
import os
import json
import sys

# Asegura que src/ esté en el path
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from flask import Flask, request, Response

# Importar handlers
from handlers.pacientes    import lambda_handler as pacientes_handler
from handlers.odontogramas import lambda_handler as odontogramas_handler
from handlers.citas        import lambda_handler as citas_handler
from handlers.facturas     import lambda_handler as facturas_handler
from handlers.radiografias import lambda_handler as radiografias_handler

app = Flask(__name__)


# ── Helper: convierte request Flask → evento Lambda ───────────────────────────

def make_lambda_event(path_params: dict | None = None) -> dict:
    """Construye un evento Lambda compatible con los handlers desde el request Flask."""
    body = None
    if request.data:
        body = request.data.decode('utf-8')

    return {
        'httpMethod':            request.method,
        'path':                  request.path,
        'headers':               dict(request.headers),
        'pathParameters':        path_params or {},
        'queryStringParameters': dict(request.args) or {},
        'body':                  body,
    }


def lambda_response(result: dict) -> Response:
    """Convierte la respuesta del handler Lambda en una Response de Flask."""
    status  = result.get('statusCode', 200)
    headers = result.get('headers', {})
    body    = result.get('body', '{}')
    return Response(body, status=status, headers=headers, mimetype='application/json')


# ── CORS preflight ─────────────────────────────────────────────────────────────

@app.before_request
def handle_options():
    if request.method == 'OPTIONS':
        return Response('', 204, {
            'Access-Control-Allow-Origin':  'http://localhost:5173',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Authorization,Content-Type',
        })


@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin']  = 'http://localhost:5173'
    response.headers['Access-Control-Allow-Headers'] = 'Authorization,Content-Type'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
    return response


# ── /pacientes ─────────────────────────────────────────────────────────────────

@app.route('/pacientes', methods=['GET', 'POST'])
def pacientes():
    return lambda_response(pacientes_handler(make_lambda_event(), {}))


@app.route('/pacientes/<pid>', methods=['GET', 'PUT'])
def paciente_id(pid):
    return lambda_response(pacientes_handler(make_lambda_event({'id': pid}), {}))


# ── /odontogramas ──────────────────────────────────────────────────────────────

@app.route('/pacientes/<pid>/odontogramas', methods=['GET'])
def paciente_odontogramas(pid):
    return lambda_response(odontogramas_handler(make_lambda_event({'pacienteId': pid}), {}))


@app.route('/odontogramas', methods=['GET', 'POST'])
def odontogramas():
    return lambda_response(odontogramas_handler(make_lambda_event(), {}))


@app.route('/odontogramas/<oid>', methods=['GET', 'PUT'])
def odontograma_id(oid):
    return lambda_response(odontogramas_handler(make_lambda_event({'id': oid}), {}))


# ── /citas ─────────────────────────────────────────────────────────────────────

@app.route('/citas', methods=['GET', 'POST'])
def citas():
    return lambda_response(citas_handler(make_lambda_event(), {}))


@app.route('/citas/<cid>', methods=['GET', 'PUT'])
def cita_id(cid):
    return lambda_response(citas_handler(make_lambda_event({'id': cid}), {}))


@app.route('/citas/<cid>/cancelar', methods=['PATCH'])
def cita_cancelar(cid):
    return lambda_response(citas_handler(make_lambda_event({'id': cid}), {}))


# ── /facturas ──────────────────────────────────────────────────────────────────

@app.route('/facturas', methods=['GET', 'POST'])
def facturas():
    return lambda_response(facturas_handler(make_lambda_event(), {}))


@app.route('/facturas/<fid>', methods=['GET'])
def factura_id(fid):
    return lambda_response(facturas_handler(make_lambda_event({'id': fid}), {}))


# ── /radiografias ──────────────────────────────────────────────────────────────

@app.route('/radiografias', methods=['GET', 'POST'])
def radiografias():
    return lambda_response(radiografias_handler(make_lambda_event(), {}))


@app.route('/radiografias/<rid>', methods=['GET', 'DELETE'])
def radiografia_id(rid):
    return lambda_response(radiografias_handler(make_lambda_event({'id': rid}), {}))


@app.route('/radiografias/<rid>/confirmar', methods=['PATCH'])
def radiografia_confirmar(rid):
    return lambda_response(radiografias_handler(make_lambda_event({'id': rid}), {}))


# ── Health check ───────────────────────────────────────────────────────────────

@app.route('/health')
def health():
    return {'status': 'ok', 'mode': 'LOCAL_DEV'}


# ── Inicio ─────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    if os.environ.get('LOCAL_DEV') != 'true':
        print('ERROR: local_server.py solo debe ejecutarse con LOCAL_DEV=true')
        sys.exit(1)

    print('🦷 ODONTOVAL — Servidor de desarrollo local')
    print('   API:      http://localhost:8000')
    print('   Frontend: http://localhost:5173')
    print('   BD:       postgresql://odontoval@localhost:5432/odontoval')
    print('   S3/SES:   http://localhost:4566 (LocalStack)')
    print()

    app.run(host='0.0.0.0', port=8000, debug=True)
