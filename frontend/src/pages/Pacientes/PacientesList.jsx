import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { pacientesApi } from '../../services/api'
import PageHeader from '../../components/Layout/PageHeader'
import Button from '../../components/UI/Button'
import Input from '../../components/UI/Input'
import { MagnifyingGlassIcon, PlusIcon, UserIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'

export default function PacientesList() {
  const [pacientes, setPacientes] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const cargar = useCallback(async (q = '') => {
    setLoading(true)
    try {
      const res = await pacientesApi.listar({ q })
      setPacientes(res.data.pacientes || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Búsqueda con debounce de 400ms
  useEffect(() => {
    const t = setTimeout(() => cargar(busqueda), 400)
    return () => clearTimeout(t)
  }, [busqueda, cargar])

  return (
    <div>
      <PageHeader
        title="Pacientes"
        subtitle="Registro y búsqueda de pacientes"
        actions={
          <Button onClick={() => navigate('/pacientes/nuevo')}>
            <PlusIcon className="h-4 w-4" />
            Nuevo paciente
          </Button>
        }
      />

      {/* Buscador */}
      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Buscar por nombre o cédula..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="pl-9"
        />
        <MagnifyingGlassIcon className="pointer-events-none absolute mt-[-30px] ml-2.5 h-4 w-4 text-gray-400" />
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="px-5 py-3">Paciente</th>
              <th className="px-5 py-3 hidden sm:table-cell">Cédula</th>
              <th className="px-5 py-3 hidden md:table-cell">Teléfono</th>
              <th className="px-5 py-3 hidden lg:table-cell">Registro</th>
              <th className="px-5 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-gray-400">
                  Cargando pacientes...
                </td>
              </tr>
            ) : pacientes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center">
                  <UserIcon className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                  <p className="text-gray-400">
                    {busqueda ? 'No se encontraron resultados' : 'Aún no hay pacientes registrados'}
                  </p>
                </td>
              </tr>
            ) : (
              pacientes.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 font-semibold text-sm">
                        {p.nombres?.[0]}{p.apellidos?.[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{p.apellidos}, {p.nombres}</p>
                        <p className="text-xs text-gray-500">{p.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-600 hidden sm:table-cell">{p.cedula}</td>
                  <td className="px-5 py-3 text-gray-600 hidden md:table-cell">{p.telefono || '—'}</td>
                  <td className="px-5 py-3 text-gray-400 hidden lg:table-cell">
                    {p.fecha_creacion ? format(new Date(p.fecha_creacion), 'dd/MM/yyyy') : '—'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      to={`/pacientes/${p.id}`}
                      className="text-brand-500 hover:underline text-sm font-medium"
                    >
                      Ver ficha
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
