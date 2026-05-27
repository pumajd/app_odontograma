import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { pacientesApi } from '../../services/api'
import PageHeader from '../../components/Layout/PageHeader'
import Button from '../../components/UI/Button'
import Card from '../../components/UI/Card'
import { format, differenceInYears } from 'date-fns'
import {
  ClipboardDocumentListIcon,
  PhotoIcon,
  CalendarIcon,
  BanknotesIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline'

export default function PacienteDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [paciente, setPaciente] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    pacientesApi.obtener(id)
      .then(res => setPaciente(res.data))
      .catch(() => navigate('/pacientes'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <p className="text-gray-400 mt-10 text-center">Cargando...</p>
  if (!paciente) return null

  const edad = paciente.fecha_nacimiento
    ? differenceInYears(new Date(), new Date(paciente.fecha_nacimiento))
    : null

  const ACCIONES_RAPIDAS = [
    { label: 'Odontograma',  icon: ClipboardDocumentListIcon, to: `/pacientes/${id}/odontograma`, color: 'bg-brand-50 text-brand-600 hover:bg-brand-100' },
    { label: 'Radiografías', icon: PhotoIcon,                 to: `/pacientes/${id}/radiografias`, color: 'bg-violet-50 text-violet-700 hover:bg-violet-100' },
    { label: 'Agendar cita', icon: CalendarIcon,              to: `/citas?paciente=${id}`,         color: 'bg-green-50 text-green-700 hover:bg-green-100' },
    { label: 'Facturar',     icon: BanknotesIcon,             to: `/facturacion?paciente=${id}`,   color: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
  ]

  return (
    <div>
      <PageHeader
        title={`${paciente.apellidos}, ${paciente.nombres}`}
        subtitle={`Cédula: ${paciente.cedula}${edad !== null ? ` · ${edad} años` : ''}`}
        actions={
          <Button variant="secondary" onClick={() => navigate(`/pacientes/${id}/editar`)}>
            <PencilSquareIcon className="h-4 w-4" />
            Editar
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">

        {/* Datos personales */}
        <Card title="Datos personales" className="lg:col-span-1">
          <dl className="space-y-3 text-sm">
            <Dato label="Fecha de nacimiento">
              {paciente.fecha_nacimiento
                ? format(new Date(paciente.fecha_nacimiento), 'dd/MM/yyyy')
                : '—'}
            </Dato>
            <Dato label="Género">{paciente.genero || '—'}</Dato>
            <Dato label="Teléfono">{paciente.telefono || '—'}</Dato>
            <Dato label="Email">{paciente.email || '—'}</Dato>
            <Dato label="Dirección">{paciente.direccion || '—'}</Dato>
          </dl>
        </Card>

        {/* Historia médica */}
        <Card title="Historia médica" className="lg:col-span-1">
          <dl className="space-y-3 text-sm">
            <Dato label="Grupo sanguíneo">{paciente.grupo_sanguineo || '—'}</Dato>
            <Dato label="Alergias">{paciente.alergias || 'Sin alergias conocidas'}</Dato>
            <Dato label="Enfermedades base">{paciente.enfermedades_base || 'Ninguna'}</Dato>
            <Dato label="Medicamentos">{paciente.medicamentos || 'Ninguno'}</Dato>
          </dl>
        </Card>

        {/* Acciones rápidas */}
        <Card title="Acciones rápidas" className="lg:col-span-1">
          <div className="grid grid-cols-2 gap-3">
            {ACCIONES_RAPIDAS.map(({ label, icon: Icon, to, color }) => (
              <Link
                key={label}
                to={to}
                className={`flex flex-col items-center gap-2 rounded-lg p-4 text-sm font-medium transition-colors ${color}`}
              >
                <Icon className="h-6 w-6" />
                {label}
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function Dato({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-gray-800">{children}</dd>
    </div>
  )
}
