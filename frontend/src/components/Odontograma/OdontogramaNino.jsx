/**
 * OdontogramaNino — dentición decidua (leche)
 * Notación FDI: cuadrantes 5-8, dientes 51-55, 61-65, 71-75, 81-85
 * Total: 20 dientes deciduos
 */
import { useState, useCallback } from 'react'
import Diente from './Diente'

const CUADRANTES_NINO = [
  { q: 5, dientes: [55, 54, 53, 52, 51] },  // Superior derecho
  { q: 6, dientes: [61, 62, 63, 64, 65] },  // Superior izquierdo
  { q: 7, dientes: [71, 72, 73, 74, 75] },  // Inferior izquierdo
  { q: 8, dientes: [85, 84, 83, 82, 81] },  // Inferior derecho
]

function estadoInicial() {
  const estado = {}
  CUADRANTES_NINO.forEach(({ dientes }) => {
    dientes.forEach((num) => {
      estado[num] = {
        estado: '',
        superficies: ['', '', '', '', ''],
        nota: '',
      }
    })
  })
  return estado
}

export default function OdontogramaNino({ valorInicial = null, onChange }) {
  const [dientes, setDientes] = useState(valorInicial ?? estadoInicial())
  const [herramienta, setHerramienta] = useState('caries')

  const actualizarDiente = useCallback(
    (numero, cambios) => {
      setDientes((prev) => {
        const nuevo = { ...prev, [numero]: { ...prev[numero], ...cambios } }
        onChange?.(nuevo)
        return nuevo
      })
    },
    [onChange],
  )

  return (
    <div className="select-none">
      {/* Indicador visual */}
      <div className="mb-2 rounded bg-brand-50 px-3 py-1 text-sm text-brand-600 font-medium">
        👶 Odontograma pediátrico — Dentición decidua (FDI 51-85)
      </div>

      {/* Barra de herramientas */}
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { id: 'caries', label: 'Caries', color: 'bg-red-500' },
          { id: 'obturado', label: 'Obturado', color: 'bg-blue-500' },
          { id: 'fractura', label: 'Fractura', color: 'bg-yellow-500' },
          { id: 'ausente', label: 'Ausente', color: 'bg-gray-500' },
          { id: 'corona', label: 'Corona', color: 'bg-purple-500' },
          { id: 'extraccion_indicada', label: 'Extracción', color: 'bg-orange-500' },
          { id: 'limpiar', label: 'Limpiar', color: 'bg-green-500' },
        ].map((h) => (
          <button
            key={h.id}
            onClick={() => setHerramienta(h.id)}
            className={`rounded px-3 py-1 text-sm font-medium text-white transition
              ${herramienta === h.id ? `${h.color} ring-2 ring-offset-1 ring-gray-800` : `${h.color} opacity-60`}`}
          >
            {h.label}
          </button>
        ))}
      </div>

      <svg
        viewBox="0 0 420 280"
        className="w-full max-w-lg rounded border border-gray-200 bg-white"
        aria-label="Odontograma pediátrico FDI"
      >
        {/* Línea media */}
        <line x1="210" y1="10" x2="210" y2="270" stroke="#d1d5db" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="10" y1="140" x2="410" y2="140" stroke="#d1d5db" strokeWidth="1" strokeDasharray="4 4" />

        {/* Etiquetas */}
        <text x="100" y="25" textAnchor="middle" fontSize="11" fill="#6b7280">Cuadrante 5</text>
        <text x="310" y="25" textAnchor="middle" fontSize="11" fill="#6b7280">Cuadrante 6</text>
        <text x="310" y="270" textAnchor="middle" fontSize="11" fill="#6b7280">Cuadrante 7</text>
        <text x="100" y="270" textAnchor="middle" fontSize="11" fill="#6b7280">Cuadrante 8</text>

        {/* Superior */}
        {CUADRANTES_NINO.slice(0, 2).map(({ q, dientes: nums }) =>
          nums.map((num, i) => {
            const x = q === 5
              ? 200 - (i + 1) * 37 + 18
              : 210 + i * 37 + 18
            return (
              <Diente key={num} numero={num} x={x} y={75}
                data={dientes[num]} herramienta={herramienta} onUpdate={actualizarDiente} />
            )
          }),
        )}

        {/* Inferior */}
        {CUADRANTES_NINO.slice(2).map(({ q, dientes: nums }) =>
          nums.map((num, i) => {
            const x = q === 7
              ? 210 + i * 37 + 18
              : 200 - (i + 1) * 37 + 18
            return (
              <Diente key={num} numero={num} x={x} y={185}
                data={dientes[num]} herramienta={herramienta} onUpdate={actualizarDiente} />
            )
          }),
        )}
      </svg>
    </div>
  )
}
