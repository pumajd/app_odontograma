import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { facturasApi, pacientesApi } from '../../services/api'
import PageHeader from '../../components/Layout/PageHeader'
import Button from '../../components/UI/Button'
import Card from '../../components/UI/Card'
import Input from '../../components/UI/Input'
import { PDFDownloadLink } from '@react-pdf/renderer'
import ReciboPDF from './ReciboPDF'
import { PlusIcon, TrashIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'

const ITEM_VACIO = { descripcion: '', cantidad: 1, precio_unitario: '' }

export default function FacturacionPage() {
  const [searchParams] = useSearchParams()
  const pacienteIdParam = searchParams.get('paciente')

  const [busqueda, setBusqueda] = useState('')
  const [pacientes, setPacientes] = useState([])
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null)
  const [items, setItems] = useState([{ ...ITEM_VACIO }])
  const [metodo, setMetodo] = useState('efectivo')
  const [observaciones, setObservaciones] = useState('')
  const [factura, setFactura] = useState(null)   // factura guardada (para PDF)
  const [loading, setLoading] = useState(false)

  // Pre-cargar paciente si viene por URL
  useEffect(() => {
    if (pacienteIdParam) {
      pacientesApi.obtener(pacienteIdParam).then(res => setPacienteSeleccionado(res.data))
    }
  }, [pacienteIdParam])

  // Búsqueda de pacientes
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

  function setItem(i, campo, valor) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [campo]: valor } : it))
  }

  function agregarItem() { setItems(prev => [...prev, { ...ITEM_VACIO }]) }
  function eliminarItem(i) { setItems(prev => prev.filter((_, idx) => idx !== i)) }

  const subtotal = items.reduce((acc, it) => {
    const precio = parseFloat(it.precio_unitario) || 0
    return acc + it.cantidad * precio
  }, 0)
  const iva = subtotal * 0.15  // IVA Ecuador 15%
  const total = subtotal + iva

  async function guardar() {
    if (!pacienteSeleccionado) return
    setLoading(true)
    try {
      const res = await facturasApi.crear({
        paciente_id: pacienteSeleccionado.id,
        items: items.filter(it => it.descripcion && it.precio_unitario),
        subtotal,
        iva,
        total,
        metodo_pago: metodo,
        observaciones,
      })
      setFactura({
        ...res.data,
        paciente: pacienteSeleccionado,
        items,
        subtotal,
        iva,
        total,
        metodo_pago: metodo,
        fecha_emision: new Date().toISOString(),
      })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader title="Facturación" subtitle="Emisión de recibos de pago" />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">

          {/* Selección de paciente */}
          <Card title="Paciente">
            {pacienteSeleccionado ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {pacienteSeleccionado.apellidos}, {pacienteSeleccionado.nombres}
                  </p>
                  <p className="text-sm text-gray-500">Cédula: {pacienteSeleccionado.cedula}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setPacienteSeleccionado(null); setBusqueda('') }}>
                  Cambiar
                </Button>
              </div>
            ) : (
              <div>
                <Input placeholder="Buscar paciente..." value={busqueda}
                  onChange={e => setBusqueda(e.target.value)} />
                {pacientes.length > 0 && (
                  <div className="mt-1 rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    {pacientes.map(p => (
                      <button key={p.id} type="button"
                        onClick={() => { setPacienteSeleccionado(p); setBusqueda(''); setPacientes([]) }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-brand-50">
                        {p.apellidos}, {p.nombres} · {p.cedula}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Items */}
          <Card title="Servicios / Tratamientos"
            actions={
              <Button size="sm" variant="secondary" onClick={agregarItem}>
                <PlusIcon className="h-4 w-4" /> Agregar
              </Button>
            }
          >
            <div className="space-y-2">
              {/* Encabezado */}
              <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-400 uppercase px-1">
                <span className="col-span-5">Descripción</span>
                <span className="col-span-2 text-center">Cant.</span>
                <span className="col-span-3 text-right">Precio</span>
                <span className="col-span-2 text-right">Total</span>
              </div>

              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input value={it.descripcion} onChange={e => setItem(i, 'descripcion', e.target.value)}
                    placeholder="Descripción del servicio"
                    className="col-span-5 rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
                  <input type="number" min={1} value={it.cantidad} onChange={e => setItem(i, 'cantidad', +e.target.value)}
                    className="col-span-2 rounded border border-gray-300 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-brand-500" />
                  <input type="number" step="0.01" min={0} value={it.precio_unitario}
                    onChange={e => setItem(i, 'precio_unitario', e.target.value)}
                    placeholder="0.00"
                    className="col-span-3 rounded border border-gray-300 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-brand-500" />
                  <div className="col-span-1 text-right text-sm font-medium text-gray-700">
                    ${((parseFloat(it.precio_unitario) || 0) * it.cantidad).toFixed(2)}
                  </div>
                  <button onClick={() => eliminarItem(i)} className="col-span-1 text-red-400 hover:text-red-600 flex justify-center">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Resumen y acciones */}
        <div className="space-y-4">
          <Card title="Resumen">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Subtotal</dt>
                <dd className="font-medium">${subtotal.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">IVA (15%)</dt>
                <dd className="font-medium">${iva.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-2">
                <dt className="text-base font-semibold text-gray-900">Total</dt>
                <dd className="text-base font-bold text-brand-600">${total.toFixed(2)}</dd>
              </div>
            </dl>

            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700 block mb-1">Método de pago</label>
              <select value={metodo} onChange={e => setMetodo(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>

            <div className="mt-3">
              <label className="text-sm font-medium text-gray-700 block mb-1">Observaciones</label>
              <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>

            <div className="mt-4 space-y-2">
              <Button className="w-full" onClick={guardar}
                loading={loading} disabled={!pacienteSeleccionado || total === 0}>
                Emitir recibo
              </Button>

              {factura && (
                <PDFDownloadLink
                  document={<ReciboPDF factura={factura} />}
                  fileName={`recibo-${factura.numero || 'odontoval'}.pdf`}
                >
                  {({ loading: pdfLoading }) => (
                    <Button variant="secondary" className="w-full" loading={pdfLoading}>
                      <ArrowDownTrayIcon className="h-4 w-4" />
                      Descargar PDF
                    </Button>
                  )}
                </PDFDownloadLink>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
