/**
 * OdontogramaAdulto — dentición permanente adultos
 * Notación FDI: cuadrantes 1-4, dientes 11-18, 21-28, 31-38, 41-48
 *
 * Estructura de cada diente: 5 superficies
 *   [0] oclusal/incisal (centro)
 *   [1] vestibular (arriba)
 *   [2] lingual/palatino (abajo)
 *   [3] mesial (izquierda)
 *   [4] distal (derecha)
 *
 * Estados posibles por superficie:
 *   '' = sano | 'caries' | 'obturado' | 'fractura'
 *
 * Estado del diente completo:
 *   'ausente' | 'extraccion_indicada' | 'corona' | 'implante' | 'puente' | ''
 */
import { useState, useCallback } from 'react'
import Diente from './Diente'

// Distribución FDI: cuadrante superior derecho → izquierdo → inferior izquierdo → derecho
const CUADRANTES = [
  { q: 1, dientes: [18, 17, 16, 15, 14, 13, 12, 11] },  // Superior derecho (paciente)
  { q: 2, dientes: [21, 22, 23, 24, 25, 26, 27, 28] },  // Superior izquierdo (paciente)
  { q: 3, dientes: [31, 32, 33, 34, 35, 36, 37, 38] },  // Inferior izquierdo (paciente)
  { q: 4, dientes: [48, 47, 46, 45, 44, 43, 42, 41] },  // Inferior derecho (paciente)
]

// Estado inicial: todos los dientes sanos
function estadoInicial() {
  const estado = {}
  CUADRANTES.forEach(({ dientes }) => {
    dientes.forEach((num) => {
      estado[num] = {
        estado: '',           // estado global del diente
        superficies: ['', '', '', '', ''],  // 5 superficies
        nota: '',
      }
    })
  })
  return estado
}

export default function OdontogramaAdulto({ valorInicial = null, onChange }) {
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

      {/* Odontograma SVG */}
      <svg
        viewBox="0 0 660 280"
        className="w-full rounded border border-gray-200 bg-white"
        aria-label="Odontograma adulto FDI"
      >
        {/* Línea media vertical */}
        <line x1="330" y1="10" x2="330" y2="270" stroke="#d1d5db" strokeWidth="1" strokeDasharray="4 4" />
        {/* Línea horizontal separadora maxilar/mandíbula */}
        <line x1="10" y1="140" x2="650" y2="140" stroke="#d1d5db" strokeWidth="1" strokeDasharray="4 4" />

        {/* Etiquetas de cuadrantes */}
        <text x="160" y="25" textAnchor="middle" fontSize="11" fill="#6b7280">Cuadrante 1</text>
        <text x="490" y="25" textAnchor="middle" fontSize="11" fill="#6b7280">Cuadrante 2</text>
        <text x="490" y="270" textAnchor="middle" fontSize="11" fill="#6b7280">Cuadrante 3</text>
        <text x="160" y="270" textAnchor="middle" fontSize="11" fill="#6b7280">Cuadrante 4</text>

        {/* Superior: cuadrantes 1 y 2 */}
        {CUADRANTES.slice(0, 2).map(({ q, dientes: nums }) =>
          nums.map((num, i) => {
            const x = q === 1
              ? 320 - (i + 1) * 37 + 18   // cuadrante 1: de derecha a izquierda
              : 330 + i * 37 + 18          // cuadrante 2: de izquierda a derecha
            return (
              <Diente
                key={num}
                numero={num}
                x={x}
                y={75}
                data={dientes[num]}
                herramienta={herramienta}
                onUpdate={actualizarDiente}
              />
            )
          }),
        )}

        {/* Inferior: cuadrantes 3 y 4 */}
        {CUADRANTES.slice(2).map(({ q, dientes: nums }) =>
          nums.map((num, i) => {
            const x = q === 3
              ? 330 + i * 37 + 18          // cuadrante 3: de izquierda a derecha
              : 320 - (i + 1) * 37 + 18   // cuadrante 4: de derecha a izquierda
            return (
              <Diente
                key={num}
                numero={num}
                x={x}
                y={185}
                data={dientes[num]}
                herramienta={herramienta}
                onUpdate={actualizarDiente}
              />
            )
          }),
        )}
      </svg>

      {/* Leyenda */}
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-600">
        {[
          { color: '#ef4444', label: 'Caries' },
          { color: '#3b82f6', label: 'Obturado' },
          { color: '#eab308', label: 'Fractura' },
          { color: '#6b7280', label: 'Ausente' },
          { color: '#a855f7', label: 'Corona' },
          { color: '#f97316', label: 'Extracción indicada' },
        ].map((item) => (
          <span key={item.label} className="flex items-center gap-1">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  )
}
