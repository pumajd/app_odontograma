/**
 * Cliente HTTP para la API REST de ODONTOVAL
 * Adjunta automáticamente el JWT de Cognito en cada request
 */
import axios from 'axios'
import { fetchAuthSession } from 'aws-amplify/auth'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 15000,
})

// Interceptor: añadir Authorization header con token Cognito
api.interceptors.request.use(async (config) => {
  const session = await fetchAuthSession()
  const token = session.tokens?.idToken?.toString()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptor: manejo global de errores
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

// ── Pacientes ──────────────────────────────────────────────────────────────
export const pacientesApi = {
  listar: (params) => api.get('/pacientes', { params }),
  obtener: (id) => api.get(`/pacientes/${id}`),
  crear: (data) => api.post('/pacientes', data),
  actualizar: (id, data) => api.put(`/pacientes/${id}`, data),
}

// ── Odontogramas ──────────────────────────────────────────────────────────
export const odontogramasApi = {
  listar: (pacienteId) => api.get(`/pacientes/${pacienteId}/odontogramas`),
  obtener: (id) => api.get(`/odontogramas/${id}`),
  crear: (data) => api.post('/odontogramas', data),
  actualizar: (id, data) => api.put(`/odontogramas/${id}`, data),
}

// ── Citas ─────────────────────────────────────────────────────────────────
export const citasApi = {
  listar: (params) => api.get('/citas', { params }),
  crear: (data) => api.post('/citas', data),
  actualizar: (id, data) => api.put(`/citas/${id}`, data),
  cancelar: (id) => api.patch(`/citas/${id}/cancelar`),
}

// ── Facturas ──────────────────────────────────────────────────────────────
export const facturasApi = {
  listar: (params) => api.get('/facturas', { params }),
  obtener: (id) => api.get(`/facturas/${id}`),
  crear: (data) => api.post('/facturas', data),
}

// ── Radiografías ──────────────────────────────────────────────────────────
export const radiografiasApi = {
  listar: (pacienteId) => api.get(`/pacientes/${pacienteId}/radiografias`),
  urlSubida: (pacienteId, filename) =>
    api.post(`/pacientes/${pacienteId}/radiografias/presigned-url`, { filename }),
}

export default api
