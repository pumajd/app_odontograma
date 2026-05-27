import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { pacientesApi, odontogramasApi } from '../../services/api'
import OdontogramaAdulto from '../../components/Odontograma/OdontogramaAdulto'
import OdontogramaNino from '../../components/Odontograma/OdontogramaNino'
import PageHeader from '../../components/Layout/PageHeader'
import Button from '../../components/UI/Button'
import Card from '../../components/UI/Card'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline'

export default function OdontogramaPage() {
  const { id: pacienteId } = useParams()
  const [paciente, setPaciente] = useState(null)
  const [tipo, setTipo] = useState('adulto')          // 'adulto' | 'niño'
  const [datosDientes, setDatosDientes] = useState(null)
  const [observaciones, setObservaciones] = useState('')
  const [historial, setHistorial] = useState([])
  const [historialSeleccionado, setHistorialSeleccionado] = useState(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)

  useEffect(() => {
    async function cargar() {
      try {
        const [resPac, resOdont] = await Promise.all([
          pacientesApi.obtener(pacienteId),
          odontogramasApi.listar(pacienteId),
        ])
        setPaciente(resPac.data)
        setHistorial(resOdont.data.odontogramas || [])
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [pacienteId])

  async function cargarOdontograma(odontogramaId) {
    try {
      const res = await odontogramasApi.obtener(odontogramaId)
      setDatosDientes(res.data.datos_json)
      setTipo(res.data.tipo)
      setObservaciones(res.data.observaciones || '')
      setHistorialSeleccionado(odontogramaId)
    } catch (e) {
      console.error(e)
    }
  }

  function nuevoOdontograma() {
    setDatosDientes(null)
    setObservaciones('')
    setHistorialSeleccionado(null)
  }

  async function guardar() {
    if (!datosDientes) return
    setGuardando(true)
    try {
      if (historialSeleccionado) {
        await odontogramasApi.actualizar(historialSeleccionado, {
          datos: datosDientes,
          observaciones,
        })
      } else {
        const res = await odontogramasApi.crear({
          paciente_id: pacienteId,
          tipo,
          datos: datosDientes,
          observaciones,
        })
        setHistorialSeleccionado(res.data.id)
        const resHist = await odontogramasApi.listar(pacienteId)
        setHistorial(resHist.data.odontogramas || [])
      }
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2500)
    } catch (e) {
      console.error(e)
    } finally {
      setGuardando(false)
    }
  }

  if (loading) return <p className="mt-10 text-center text-gray-400">Cargando...</p>

  return (
    <div>
      <PageHeader
        title="Odontograma"
        subtitle={paciente ? `${paciente.apellidos}, ${paciente.nombres}` : ''}
        actions={
          <div className="flex gap-2 items-center">
            {guardado && (
              <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                <ClipboardDocumentCheckIcon className="h-4 w-4" /> Guardado
              </span>
            )}
            <Button variant="secondary" onClick={nuevoOdontograma}>
              + Nuevo
            </Button>
            <Button onClick={guardar} loading={guardando} disabled={!datosDientes}>
              Guardar
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">

        {/* Panel lateral: tipo + historial */}
        <div className="lg:col-span-1 space-y-4">

          {/* Selector de tipo */}
          <Card title="Tipo de dentición">
            <div className="flex flex-col gap-2">
              {[
                { value: 'adulto', label: '🦷 Adulto', sub: 'FDI 11-48 · 32 dientes' },
                { value: 'niño',   label: '👶 Niño',   sub: 'FDI 51-85 · 20 dientes' },
              ].map(opt => (
                <button
                  key={opt.value}
                  disabled={!!historialSeleccionado}
                  onClick={() => { setTipo(opt.value); setDatosDientes(null) }}
                  className={`text-left rounded-lg border px-3 py-2.5 text-sm transition-colors
                    ${tipo === opt.value
                      ? 'border-brand-500 bg-brand-50 text-brand-600'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'}
                    disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <p className="font-medium">{opt.label}</p>
                  <p className="text-xs opacity-70">{opt.sub}</p>
                </button>
              ))}
            </div>
          </Card>

          {/* Historial */}
          <Card title="Historial" subtitle={`${historial.length} registro(s)`}>
            {historial.length === 0 ? (
              <p className="text-sm text-gray-400">Sin registros previos</p>
            ) : (
              <div className="space-y-1">
                {historial.map(h => (
                  <button
                    key={h.id}
                    onClick={() => cargarOdontograma(h.id)}
                    className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors
                      ${historialSeleccionado === h.id
                        ? 'bg-brand-100 text-brand-600 font-medium'
                        : 'hover:bg-gray-100 text-gray-700'}`}
                  >
                    <p>{format(new Date(h.fecha_registro), "dd/MM/yyyy", { locale: es })}</p>
                    <p className="text-xs opacity-60 capitalize">{h.tipo}</p>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Odontograma y observaciones */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            {tipo === 'adulto' ? (
              <OdontogramaAdulto
                key={historialSeleccionado ?? 'nuevo-adulto'}
                valorInicial={datosDientes}
                onChange={setDatosDientes}
              />
            ) : (
              <OdontogramaNino
                key={historialSeleccionado ?? 'nuevo-nino'}
                valorInicial={datosDientes}
                onChange={setDatosDientes}
              />
            )}
          </Card>

          <Card title="Observaciones clínicas">
            <textarea
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              rows={3}
              placeholder="Hallazgos, plan de tratamiento, notas del odontólogo..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </Card>
        </div>
      </div>
    </div>
  )
}
