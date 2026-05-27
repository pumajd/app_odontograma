import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { citasApi, pacientesApi } from '../services/api'
import Card from '../components/UI/Card'
import PageHeader from '../components/Layout/PageHeader'
import {
  CalendarIcon,
  UsersIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'

export default function Dashboard() {
  const [citas, setCitas] = useState([])
  const [stats, setStats] = useState({ totalPacientes: 0, citasHoy: 0, citasPendientes: 0, citasCompletadas: 0 })
  const [loading, setLoading] = useState(true)
  const hoy = format(new Date(), "yyyy-MM-dd")

  useEffect(() => {
    async function cargar() {
      try {
        const [resCitas, resPacientes] = await Promise.all([
          citasApi.listar({ fecha: hoy, limite: 10 }),
          pacientesApi.listar({ limite: 1 }),
        ])
        const listaCitas = resCitas.data.citas || []
        setCitas(listaCitas)
        setStats({
          totalPacientes: resPacientes.data.total || 0,
          citasHoy: listaCitas.length,
          citasPendientes: listaCitas.filter(c => c.estado === 'programada').length,
          citasCompletadas: listaCitas.filter(c => c.estado === 'completada').length,
        })
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  const STAT_CARDS = [
    { label: 'Pacientes registrados', value: stats.totalPacientes, icon: UsersIcon, color: 'text-brand-500 bg-brand-50' },
    { label: 'Citas hoy', value: stats.citasHoy, icon: CalendarIcon, color: 'text-violet-600 bg-violet-50' },
    { label: 'Pendientes', value: stats.citasPendientes, icon: ClockIcon, color: 'text-amber-600 bg-amber-50' },
    { label: 'Completadas hoy', value: stats.citasCompletadas, icon: CheckCircleIcon, color: 'text-green-600 bg-green-50' },
  ]

  return (
    <div>
      <PageHeader
        title={`Buenos días 👋`}
        subtitle={format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es })}
      />

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        {STAT_CARDS.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="flex items-center gap-4">
            <div className={`rounded-lg p-2.5 ${color}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '—' : value}
              </p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Citas del día */}
      <Card
        title="Citas de hoy"
        subtitle={format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
        actions={
          <Link to="/citas" className="text-sm text-brand-500 hover:underline">
            Ver todas →
          </Link>
        }
      >
        {loading ? (
          <p className="text-sm text-gray-400 py-4 text-center">Cargando...</p>
        ) : citas.length === 0 ? (
          <div className="py-8 text-center">
            <CalendarIcon className="mx-auto h-10 w-10 text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">No hay citas programadas para hoy</p>
            <Link to="/citas" className="mt-2 inline-block text-sm text-brand-500 hover:underline">
              Agendar una cita
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {citas.map((cita) => (
              <div key={cita.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 text-center">
                    <p className="text-sm font-semibold text-brand-500">
                      {format(new Date(cita.fecha_hora), 'HH:mm')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {cita.nombres} {cita.apellidos}
                    </p>
                    <p className="text-xs text-gray-500">{cita.motivo || 'Consulta general'}</p>
                  </div>
                </div>
                <EstadoBadge estado={cita.estado} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function EstadoBadge({ estado }) {
  const estilos = {
    programada:  'bg-amber-100 text-amber-700',
    confirmada:  'bg-brand-100 text-brand-600',
    completada:  'bg-green-100 text-green-700',
    cancelada:   'bg-red-100 text-red-700',
  }
  const labels = {
    programada: 'Programada',
    confirmada: 'Confirmada',
    completada: 'Completada',
    cancelada:  'Cancelada',
  }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${estilos[estado] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[estado] ?? estado}
    </span>
  )
}
