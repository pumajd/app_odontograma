import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pacientesApi } from '../../services/api'
import PageHeader from '../../components/Layout/PageHeader'
import Button from '../../components/UI/Button'
import Input from '../../components/UI/Input'
import Card from '../../components/UI/Card'

const INITIAL = {
  cedula: '', nombres: '', apellidos: '', fecha_nacimiento: '',
  genero: '', telefono: '', email: '', direccion: '',
  grupo_sanguineo: '', alergias: '', enfermedades_base: '', medicamentos: '',
}

export default function PacienteForm({ pacienteInicial = null }) {
  const navigate = useNavigate()
  const [form, setForm] = useState(pacienteInicial ?? INITIAL)
  const [errores, setErrores] = useState({})
  const [loading, setLoading] = useState(false)
  const esEdicion = !!pacienteInicial

  function set(campo, valor) {
    setForm(prev => ({ ...prev, [campo]: valor }))
    setErrores(prev => ({ ...prev, [campo]: '' }))
  }

  function validar() {
    const e = {}
    if (!form.cedula.trim())    e.cedula    = 'La cédula es obligatoria'
    if (!form.nombres.trim())   e.nombres   = 'El nombre es obligatorio'
    if (!form.apellidos.trim()) e.apellidos = 'El apellido es obligatorio'
    if (!form.fecha_nacimiento) e.fecha_nacimiento = 'La fecha de nacimiento es obligatoria'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validar()) return
    setLoading(true)
    try {
      if (esEdicion) {
        await pacientesApi.actualizar(pacienteInicial.id, form)
        navigate(`/pacientes/${pacienteInicial.id}`)
      } else {
        const res = await pacientesApi.crear(form)
        navigate(`/pacientes/${res.data.id}`)
      }
    } catch (err) {
      setErrores({ general: err.response?.data?.error || 'Error al guardar' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={esEdicion ? 'Editar paciente' : 'Nuevo paciente'}
        subtitle="Complete los datos del paciente"
      />

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid gap-4 lg:grid-cols-2">

          {/* Datos personales */}
          <Card title="Datos personales">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Cédula" value={form.cedula} onChange={e => set('cedula', e.target.value)}
                error={errores.cedula} required placeholder="0912345678" />
              <div className="sm:col-span-2" />
              <Input label="Nombres" value={form.nombres} onChange={e => set('nombres', e.target.value)}
                error={errores.nombres} required placeholder="María José" />
              <Input label="Apellidos" value={form.apellidos} onChange={e => set('apellidos', e.target.value)}
                error={errores.apellidos} required placeholder="García López" />
              <Input type="date" label="Fecha de nacimiento" value={form.fecha_nacimiento}
                onChange={e => set('fecha_nacimiento', e.target.value)}
                error={errores.fecha_nacimiento} required />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Género</label>
                <select
                  value={form.genero}
                  onChange={e => set('genero', e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Seleccionar</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <Input label="Teléfono" value={form.telefono} onChange={e => set('telefono', e.target.value)}
                placeholder="0991234567" />
              <Input type="email" label="Email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="correo@ejemplo.com" />
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-gray-700 block mb-1">Dirección</label>
                <textarea
                  value={form.direccion}
                  onChange={e => set('direccion', e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </Card>

          {/* Historia médica */}
          <Card title="Historia médica">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Grupo sanguíneo</label>
                <select
                  value={form.grupo_sanguineo}
                  onChange={e => set('grupo_sanguineo', e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Desconocido</option>
                  {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div />
              {[
                { campo: 'alergias', label: 'Alergias', placeholder: 'Penicilina, látex...' },
                { campo: 'enfermedades_base', label: 'Enfermedades base', placeholder: 'Diabetes, hipertensión...' },
                { campo: 'medicamentos', label: 'Medicamentos actuales', placeholder: 'Metformina 500mg...' },
              ].map(({ campo, label, placeholder }) => (
                <div key={campo} className="sm:col-span-2 flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">{label}</label>
                  <textarea
                    value={form[campo]}
                    onChange={e => set(campo, e.target.value)}
                    placeholder={placeholder}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Error general */}
        {errores.general && (
          <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{errores.general}</p>
        )}

        {/* Botones */}
        <div className="mt-6 flex gap-3 justify-end">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            {esEdicion ? 'Guardar cambios' : 'Registrar paciente'}
          </Button>
        </div>
      </form>
    </div>
  )
}
