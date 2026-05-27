/**
 * RadiografiasPage — gestión de imágenes radiográficas por paciente.
 *
 * Flujo de subida (sin pasar el archivo por Lambda):
 *  1. Usuario selecciona archivo → frontend solicita presigned PUT URL al backend
 *  2. Frontend sube el archivo directamente a S3 con PUT
 *  3. Frontend llama /confirmar para registrar la radiografía en BD
 *
 * Flujo de visualización:
 *  1. Click en miniatura → solicita presigned GET URL → abre en nueva pestaña
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { pacientesApi, radiografiasApi } from '../../services/api'

const TIPOS = [
  { value: 'periapical',    label: 'Periapical' },
  { value: 'panoramica',    label: 'Panorámica' },
  { value: 'bitewing',      label: 'Bitewing' },
  { value: 'cefalometrica', label: 'Cefalométrica' },
  { value: 'occlusal',      label: 'Oclusal' },
  { value: 'otra',          label: 'Otra' },
]

const MIME_PERMITIDOS = {
  'image/jpeg': '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
  'image/tiff': '.tiff',
}

// Icono radiografía SVG inline
function IconoRadio({ className = 'w-6 h-6' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2" />
      <circle cx="12" cy="10" r="3" strokeWidth="2" />
      <path d="M6 21v-1a6 6 0 0112 0v1" strokeWidth="2" />
    </svg>
  )
}

// ── Subcomponente: fila de radiografía ────────────────────────────────────────
function FilaRadiografia({ radio, onVer, onEliminar }) {
  const [abriendo, setAbriendo] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  async function handleVer() {
    setAbriendo(true)
    try {
      await onVer(radio.id)
    } finally {
      setAbriendo(false)
    }
  }

  async function handleEliminar() {
    if (!confirm(`¿Eliminar la radiografía "${radio.tipo}" del ${formatFecha(radio.fecha_toma)}?`)) return
    setEliminando(true)
    try {
      await onEliminar(radio.id)
    } finally {
      setEliminando(false)
    }
  }

  function formatFecha(f) {
    if (!f) return '—'
    return new Date(f + 'T00:00:00').toLocaleDateString('es-EC', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  }

  const tipoLabel = TIPOS.find(t => t.value === radio.tipo)?.label ?? radio.tipo

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
          <IconoRadio className="w-3 h-3" />
          {tipoLabel}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">{formatFecha(radio.fecha_toma)}</td>
      <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
        {radio.descripcion || <span className="italic text-gray-400">Sin descripción</span>}
      </td>
      <td className="px-4 py-3 text-right space-x-2">
        <button
          onClick={handleVer}
          disabled={abriendo}
          className="text-sm text-brand-500 hover:text-brand-700 font-medium disabled:opacity-50"
        >
          {abriendo ? 'Abriendo…' : 'Ver imagen'}
        </button>
        <button
          onClick={handleEliminar}
          disabled={eliminando}
          className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50"
        >
          {eliminando ? '…' : 'Eliminar'}
        </button>
      </td>
    </tr>
  )
}

// ── Subcomponente: formulario de subida ────────────────────────────────────────
function FormSubida({ pacienteId, onSubida }) {
  const [tipo,        setTipo]        = useState('periapical')
  const [descripcion, setDescripcion] = useState('')
  const [fechaToma,   setFechaToma]   = useState('')
  const [archivo,     setArchivo]     = useState(null)
  const [progreso,    setProgreso]    = useState(null)   // null | 'solicitando' | 0-100 | 'confirmando' | 'listo'
  const [error,       setError]       = useState('')
  const inputRef = useRef()

  function handleArchivo(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!MIME_PERMITIDOS[file.type]) {
      setError('Formato no soportado. Use JPEG, PNG, WebP o TIFF.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('El archivo supera los 20 MB permitidos.')
      return
    }
    setError('')
    setArchivo(file)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!archivo) { setError('Seleccione un archivo.'); return }

    setError('')
    setProgreso('solicitando')

    try {
      // 1. Obtener presigned URL
      const { data } = await radiografiasApi.solicitarSubida({
        paciente_id:  pacienteId,
        tipo,
        descripcion,
        fecha_toma:   fechaToma || undefined,
        content_type: archivo.type,
      })

      const { id: radioId, upload_url } = data

      // 2. Subir archivo directamente a S3 (sin pasar por Lambda)
      setProgreso(0)
      await subirConProgreso(upload_url, archivo, (pct) => setProgreso(pct))

      // 3. Confirmar en BD
      setProgreso('confirmando')
      await radiografiasApi.confirmar(radioId)

      setProgreso('listo')
      setArchivo(null)
      setDescripcion('')
      setFechaToma('')
      if (inputRef.current) inputRef.current.value = ''
      onSubida()

      setTimeout(() => setProgreso(null), 1500)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Error al subir la radiografía.')
      setProgreso(null)
    }
  }

  function subirConProgreso(url, file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', url)
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
      }
      xhr.onload  = () => (xhr.status === 200 ? resolve() : reject(new Error(`S3 ${xhr.status}`)))
      xhr.onerror = () => reject(new Error('Error de red al subir a S3'))
      xhr.send(file)
    })
  }

  const subiendo = progreso !== null && progreso !== 'listo'

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="font-semibold text-gray-800">Nueva radiografía</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Tipo */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
          <select
            value={tipo}
            onChange={e => setTipo(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          >
            {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        {/* Fecha de toma */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de toma</label>
          <input
            type="date"
            value={fechaToma}
            onChange={e => setFechaToma(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
        </div>

        {/* Descripción */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Descripción (opcional)</label>
          <input
            type="text"
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            placeholder="Ej: Diente 21 post-tratamiento de conducto"
            maxLength={200}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
        </div>

        {/* Archivo */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Archivo <span className="text-gray-400">(JPEG, PNG, WebP, TIFF · máx. 20 MB)</span>
          </label>
          <input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.tiff,.tif"
            onChange={handleArchivo}
            className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-600 hover:file:bg-brand-100"
          />
          {archivo && (
            <p className="mt-1 text-xs text-gray-500">
              {archivo.name} · {(archivo.size / 1024 / 1024).toFixed(2)} MB
            </p>
          )}
        </div>
      </div>

      {/* Barra de progreso */}
      {typeof progreso === 'number' && (
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="bg-brand-500 h-2 rounded-full transition-all duration-200"
            style={{ width: `${progreso}%` }}
          />
          <p className="text-xs text-gray-500 mt-1">Subiendo… {progreso}%</p>
        </div>
      )}
      {progreso === 'solicitando'  && <p className="text-xs text-brand-500">Preparando subida…</p>}
      {progreso === 'confirmando'  && <p className="text-xs text-brand-500">Registrando en el sistema…</p>}
      {progreso === 'listo'        && <p className="text-xs text-green-600 font-medium">¡Radiografía guardada!</p>}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={subiendo || !archivo}
          className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {subiendo ? 'Subiendo…' : 'Subir radiografía'}
        </button>
      </div>
    </form>
  )
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function RadiografiasPage() {
  const [searchParams] = useSearchParams()
  const pacienteId = searchParams.get('paciente')

  const [paciente,      setPaciente]      = useState(null)
  const [radiografias,  setRadiografias]  = useState([])
  const [cargando,      setCargando]      = useState(false)
  const [error,         setError]         = useState('')
  const [mostrarForm,   setMostrarForm]   = useState(false)

  // Si no viene paciente en la URL, mustramos buscador
  const [busqueda,      setBusqueda]      = useState('')
  const [resultados,    setResultados]    = useState([])
  const [buscando,      setBuscando]      = useState(false)
  const timerRef = useRef(null)

  // ── Cargar paciente y su lista de radiografías ──────────────────────────────
  useEffect(() => {
    if (!pacienteId) return
    cargarPaciente(pacienteId)
    cargarRadiografias(pacienteId)
  }, [pacienteId])

  async function cargarPaciente(id) {
    try {
      const { data } = await pacientesApi.obtener(id)
      setPaciente(data)
    } catch {
      setError('No se pudo cargar el paciente.')
    }
  }

  async function cargarRadiografias(id) {
    setCargando(true)
    setError('')
    try {
      const { data } = await radiografiasApi.listar(id)
      setRadiografias(data.radiografias ?? [])
    } catch (err) {
      setError(err.response?.data?.error ?? 'Error al cargar radiografías.')
    } finally {
      setCargando(false)
    }
  }

  // ── Búsqueda de paciente (si no viene en URL) ───────────────────────────────
  function handleBusqueda(e) {
    const q = e.target.value
    setBusqueda(q)
    clearTimeout(timerRef.current)
    if (q.length < 2) { setResultados([]); return }
    timerRef.current = setTimeout(async () => {
      setBuscando(true)
      try {
        const { data } = await pacientesApi.listar({ q })
        setResultados(data.pacientes ?? [])
      } finally {
        setBuscando(false)
      }
    }, 300)
  }

  // ── Ver imagen (presigned GET URL) ──────────────────────────────────────────
  async function handleVer(id) {
    try {
      const { data } = await radiografiasApi.urlDescarga(id)
      window.open(data.download_url, '_blank', 'noopener')
    } catch {
      alert('No se pudo obtener el enlace de descarga.')
    }
  }

  // ── Eliminar ────────────────────────────────────────────────────────────────
  async function handleEliminar(id) {
    try {
      await radiografiasApi.eliminar(id)
      setRadiografias(prev => prev.filter(r => r.id !== id))
    } catch {
      alert('No se pudo eliminar la radiografía.')
    }
  }

  // ── Sin paciente seleccionado: buscador ─────────────────────────────────────
  if (!pacienteId) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Radiografías</h1>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Buscar paciente por nombre o cédula
          </label>
          <input
            type="text"
            value={busqueda}
            onChange={handleBusqueda}
            placeholder="Ej: García o 0912345678"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
          {buscando && <p className="text-xs text-gray-400 mt-2">Buscando…</p>}
          {resultados.length > 0 && (
            <ul className="mt-3 divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
              {resultados.map(p => (
                <li key={p.id}>
                  <Link
                    to={`/radiografias?paciente=${p.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-brand-50 transition-colors"
                  >
                    <div>
                      <span className="font-medium text-gray-800">{p.nombres} {p.apellidos}</span>
                      <span className="ml-2 text-sm text-gray-500">{p.cedula}</span>
                    </div>
                    <span className="text-brand-500 text-sm">Ver →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {busqueda.length >= 2 && !buscando && resultados.length === 0 && (
            <p className="text-sm text-gray-500 mt-3">No se encontraron pacientes.</p>
          )}
        </div>
      </div>
    )
  }

  // ── Vista principal del paciente ─────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">

      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <Link to="/radiografias" className="text-sm text-brand-500 hover:underline">
            ← Cambiar paciente
          </Link>
          {paciente && (
            <h1 className="text-2xl font-bold text-gray-900 mt-1">
              {paciente.nombres} {paciente.apellidos}
              <span className="ml-2 text-base font-normal text-gray-500">{paciente.cedula}</span>
            </h1>
          )}
          <p className="text-sm text-gray-500 mt-0.5">Radiografías dentales</p>
        </div>
        <button
          onClick={() => setMostrarForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          {mostrarForm ? 'Cancelar' : 'Nueva radiografía'}
        </button>
      </div>

      {/* Formulario de subida */}
      {mostrarForm && (
        <FormSubida
          pacienteId={pacienteId}
          onSubida={() => {
            setMostrarForm(false)
            cargarRadiografias(pacienteId)
          }}
        />
      )}

      {/* Lista */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {cargando ? (
          <div className="py-16 text-center text-gray-400">
            <IconoRadio className="w-10 h-10 mx-auto mb-3 opacity-30 animate-pulse" />
            <p className="text-sm">Cargando radiografías…</p>
          </div>
        ) : error ? (
          <div className="py-12 text-center">
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={() => cargarRadiografias(pacienteId)}
              className="mt-3 text-brand-500 text-sm hover:underline"
            >
              Reintentar
            </button>
          </div>
        ) : radiografias.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <IconoRadio className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Sin radiografías registradas</p>
            <p className="text-xs mt-1">Usa el botón "Nueva radiografía" para subir la primera.</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Descripción</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {radiografias.map(r => (
                <FilaRadiografia
                  key={r.id}
                  radio={r}
                  onVer={handleVer}
                  onEliminar={handleEliminar}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Los enlaces de visualización expiran en 1 hora por seguridad.
      </p>
    </div>
  )
}
