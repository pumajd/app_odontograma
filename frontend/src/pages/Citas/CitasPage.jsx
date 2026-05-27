import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { citasApi, pacientesApi } from '../../services/api'
import PageHeader from '../../components/Layout/PageHeader'
import Button from '../../components/UI/Button'
import Card from '../../components/UI/Card'
import Input from '../../components/UI/Input'
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { PlusIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

const ESTADOS = ['programada', 'confirmada', 'completada', 'cancelada']
const ESTADO_COLORS = {
  programada: 'bg-amber-100 text-amber-700 border-amber-200',
  confirmada:  'bg-brand-100 text-brand-600 border-brand-200',
  completada:  'bg-green-100 text-green-700 border-green-200',
  cancelada:   'bg-red-100 text-red-700 border-red-200',
}

export default function CitasPage() {
  const [searchParams] = useSearchParams()
  const pacienteIdParam = searchParams.get('paciente')
  const [semanaBase, setSemanaBase] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [citas, setCitas] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(!!pacienteIdParam)

  const diasSemana = Array.from({ length: 7 }, (_, i) => addDays(semanaBase, i))

  async function cargar() {
    setLoading(true)
    try {
      const desde = format(semanaBase, 'yyyy-MM-dd')
      const hasta = format(addDays(semanaBase, 6), 'yyyy-MM-dd')
      const res = await citasApi.listar({ desde, hasta })
      setCitas(res.data.citas || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [semanaBase])

  function citasDelDia(dia) {
    return citas.filter(c => isSameDay(parseISO(c.fecha_hora), dia))
  }

  return (
    <div>
      <PageHeader
        title="Agenda de citas"
        subtitle="Vista semanal"
        actions={
          <Button onClick={() => setMostrarForm(true)}>
            <PlusIcon className="h-4 w-4" />
            Nueva cita
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">

        {/* Vista semanal */}
        <div className="lg:col-span-2">
          <Card>
            {/* Navegación de semana */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setSemanaBase(d => addDays(d, -7))}
                className="p-1.5 rounded-lg hover:bg-gray-100">
                <ChevronLeftIcon className="h-5 w-5 text-gray-500" />
              </button>
              <p className="text-sm font-semibold text-gray-700">
                {format(semanaBase, "d 'de' MMMM", { locale: es })} —{' '}
                {format(addDays(semanaBase, 6), "d 'de' MMMM yyyy", { locale: es })}
              </p>
              <button onClick={() => setSemanaBase(d => addDays(d, 7))}
                className="p-1.5 rounded-lg hover:bg-gray-100">
                <ChevronRightIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Columnas de días */}
            <div className="grid grid-cols-7 gap-1">
              {diasSemana.map(dia => {
                const esHoy = isSameDay(dia, new Date())
                const citasDia = citasDelDia(dia)
                return (
                  <div key={dia.toISOString()} className="min-h-[120px]">
                    {/* Header del día */}
                    <div className={`mb-1 rounded-lg py-1 text-center text-xs font-medium
                      ${esHoy ? 'bg-brand-500 text-white' : 'text-gray-500'}`}>
                      <p>{format(dia, 'EEE', { locale: es })}</p>
                      <p className="text-base font-bold">{format(dia, 'd')}</p>
                    </div>
                    {/* Citas del día */}
                    <div className="space-y-1">
                      {loading ? null : citasDia.map(c => (
                        <CitaChip key={c.id} cita={c} onCambioEstado={cargar} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        {/* Panel lateral: form o listado */}
        <div>
          {mostrarForm
            ? <NuevaCitaForm
                pacienteIdInicial={pacienteIdParam}
                onGuardar={() => { setMostrarForm(false); cargar() }}
                onCancelar={() => setMostrarForm(false)}
              />
            : <CitasHoyList citas={citas.filter(c => isSameDay(parseISO(c.fecha_hora), new Date()))} />
          }
        </div>
      </div>
    </div>
  )
}

function CitaChip({ cita, onCambioEstado }) {
  const [cambiando, setCambiando] = useState(false)

  async function avanzarEstado() {
    const orden = ['programada', 'confirmada', 'completada']
    const idx = orden.indexOf(cita.estado)
    if (idx < 0 || idx >= orden.length - 1) return
    setCambiando(true)
    try {
      await citasApi.actualizar(cita.id, { estado: orden[idx + 1] })
      onCambioEstado()
    } finally {
      setCambiando(false)
    }
  }

  return (
    <button
      onClick={avanzarEstado}
      disabled={cambiando || cita.estado === 'completada' || cita.estado === 'cancelada'}
      title={`${cita.nombres} ${cita.apellidos} — ${format(parseISO(cita.fecha_hora), 'HH:mm')} · Click para avanzar estado`}
      className={`w-full text-left rounded border px-1.5 py-1 text-xs truncate transition-opacity
        ${ESTADO_COLORS[cita.estado]} disabled:cursor-default`}
    >
      <p className="font-medium truncate">{format(parseISO(cita.fecha_hora), 'HH:mm')}</p>
      <p className="truncate opacity-80">{cita.apellidos}</p>
    </button>
  )
}

function CitasHoyList({ citas }) {
  return (
    <Card title="Citas de hoy" subtitle={format(new Date(), "EEEE d/MM", { locale: es })}>
      {citas.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">Sin citas hoy</p>
      ) : (
        <div className="space-y-3">
          {citas.map(c => (
            <div key={c.id} className="flex items-start gap-3">
              <p className="text-sm font-semibold text-brand-600 w-12 shrink-0 mt-0.5">
                {format(parseISO(c.fecha_hora), 'HH:mm')}
              </p>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {c.nombres} {c.apellidos}
                </p>
                <p className="text-xs text-gray-500">{c.motivo || 'Consulta'}</p>
                <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-xs border ${ESTADO_COLORS[c.estado]}`}>
                  {c.estado}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function NuevaCitaForm({ pacienteIdInicial, onGuardar, onCancelar }) {
  const [form, setForm] = useState({
    paciente_id: pacienteIdInicial || '',
    fecha_hora: '',
    duracion_min: 30,
    motivo: '',
  })
  const [busqueda, setBusqueda] = useState('')
  const [pacientes, setPacientes] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (busqueda.length < 2) { setPacientes([]); return }
    const t = setTimeout(async () => {
      try {
        const res = await pacientesApi.listar({ q: busqueda })
        setPacientes(res.data.pacientes?.slice(0, 5) || [])
      } catch {}
    }, 400)
    return () => clearTimeout(t)
  }, [busqueda])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.paciente_id || !form.fecha_hora) return
    setLoading(true)
    try {
      await citasApi.crear(form)
      onGuardar()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="Nueva cita">
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Búsqueda de paciente */}
        <div>
          <Input label="Paciente" placeholder="Buscar por nombre..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          {pacientes.length > 0 && (
            <div className="mt-1 rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
              {pacientes.map(p => (
                <button key={p.id} type="button"
                  onClick={() => { setForm(f => ({ ...f, paciente_id: p.id })); setBusqueda(`${p.apellidos}, ${p.nombres}`); setPacientes([]) }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-brand-50">
                  {p.apellidos}, {p.nombres} · {p.cedula}
                </button>
              ))}
            </div>
          )}
        </div>

        <Input type="datetime-local" label="Fecha y hora"
          value={form.fecha_hora} onChange={e => setForm(f => ({ ...f, fecha_hora: e.target.value }))} required />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Duración</label>
          <select value={form.duracion_min}
            onChange={e => setForm(f => ({ ...f, duracion_min: +e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
            {[15,30,45,60,90].map(m => <option key={m} value={m}>{m} min</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Motivo</label>
          <textarea value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))}
            rows={2} placeholder="Consulta, limpieza, extracción..."
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onCancelar}>Cancelar</Button>
          <Button type="submit" className="flex-1" loading={loading}>Guardar</Button>
        </div>
      </form>
    </Card>
  )
}
