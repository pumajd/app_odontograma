import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { pacientesApi } from '../../services/api'
import PageHeader from '../../components/Layout/PageHeader'
import Button from '../../components/UI/Button'
import Card from '../../components/UI/Card'
import { PDFDownloadLink } from '@react-pdf/renderer'
import ConsentimientoPDF from './ConsentimientoPDF'
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'

const TRATAMIENTOS = [
  'Exodoncia simple',
  'Exodoncia de tercer molar',
  'Endodoncia',
  'Implante dental',
  'Cirugía periodontal',
  'Blanqueamiento dental',
  'Ortodoncia',
  'Rehabilitación oral',
  'Otro',
]

export default function ConsentimientoPage() {
  const { pacienteId } = useParams()
  const [paciente, setPaciente] = useState(null)
  const [tratamiento, setTratamiento] = useState('')
  const [tratamientoCustom, setTratamientoCustom] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [listo, setListo] = useState(false)

  useEffect(() => {
    pacientesApi.obtener(pacienteId).then(res => setPaciente(res.data))
  }, [pacienteId])

  const tratamientoFinal = tratamiento === 'Otro' ? tratamientoCustom : tratamiento

  const datosConsentimiento = {
    paciente,
    tratamiento: tratamientoFinal,
    descripcion,
    fecha: new Date().toISOString(),
  }

  return (
    <div>
      <PageHeader
        title="Consentimiento Informado"
        subtitle={paciente ? `${paciente.apellidos}, ${paciente.nombres}` : ''}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Datos del tratamiento">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Tipo de tratamiento <span className="text-red-500">*</span>
              </label>
              <select
                value={tratamiento}
                onChange={e => { setTratamiento(e.target.value); setListo(false) }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Seleccionar...</option>
                {TRATAMIENTOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {tratamiento === 'Otro' && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Especificar tratamiento <span className="text-red-500">*</span>
                </label>
                <input
                  value={tratamientoCustom}
                  onChange={e => setTratamientoCustom(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Describe el tratamiento..."
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Descripción del procedimiento y riesgos
              </label>
              <textarea
                value={descripcion}
                onChange={e => { setDescripcion(e.target.value); setListo(false) }}
                rows={5}
                placeholder="El paciente ha sido informado sobre el procedimiento, sus beneficios, riesgos y alternativas..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <Button
              className="w-full"
              disabled={!tratamientoFinal || !paciente}
              onClick={() => setListo(true)}
            >
              Generar consentimiento
            </Button>
          </div>
        </Card>

        {/* Vista previa y descarga */}
        <Card title="Documento">
          {!listo ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-gray-400 text-sm">
                Completa los datos y haz clic en "Generar consentimiento"
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Resumen del documento */}
              <div className="rounded-lg bg-gray-50 p-4 text-sm space-y-2">
                <p><span className="font-medium">Paciente:</span> {paciente?.apellidos}, {paciente?.nombres}</p>
                <p><span className="font-medium">C.I.:</span> {paciente?.cedula}</p>
                <p><span className="font-medium">Tratamiento:</span> {tratamientoFinal}</p>
                <p><span className="font-medium">Fecha:</span> {new Date().toLocaleDateString('es-EC')}</p>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                ⚠️ Imprima el documento, obtenga la firma del paciente y archívelo en la historia clínica.
              </div>

              <PDFDownloadLink
                document={<ConsentimientoPDF datos={datosConsentimiento} />}
                fileName={`consentimiento-${paciente?.cedula}-${tratamientoFinal.replace(/\s+/g, '-')}.pdf`}
              >
                {({ loading: pdfLoading }) => (
                  <Button className="w-full" loading={pdfLoading}>
                    <ArrowDownTrayIcon className="h-4 w-4" />
                    Descargar PDF para imprimir
                  </Button>
                )}
              </PDFDownloadLink>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
