/**
 * Diente — componente SVG de un diente individual
 * Renderiza 5 superficies clicables (oclusal, vestibular, lingual, mesial, distal)
 * y el número FDI encima.
 */

const COLORES = {
  '': '#f9fafb',            // sano (fondo gris claro)
  caries: '#ef4444',        // rojo
  obturado: '#3b82f6',      // azul
  fractura: '#eab308',      // amarillo
}

const COLORES_ESTADO = {
  ausente: '#6b7280',
  corona: '#a855f7',
  implante: '#06b6d4',
  puente: '#10b981',
  extraccion_indicada: '#f97316',
}

export default function Diente({ numero, x, y, data, herramienta, onUpdate }) {
  const { estado, superficies } = data
  const ausente = estado === 'ausente'
  const tamaño = 32
  const mitad = tamaño / 2
  const innerSize = tamaño * 0.36   // tamaño de la superficie oclusal central

  function handleSuperficie(indice) {
    if (herramienta === 'ausente' || herramienta === 'corona' ||
        herramienta === 'extraccion_indicada' || herramienta === 'implante') {
      // Herramientas de estado global
      onUpdate(numero, {
        estado: data.estado === herramienta ? '' : herramienta,
      })
    } else if (herramienta === 'limpiar') {
      const nuevas = [...superficies]
      nuevas[indice] = ''
      onUpdate(numero, { superficies: nuevas, estado: '' })
    } else {
      // Herramientas de superficie: caries, obturado, fractura
      const nuevas = [...superficies]
      nuevas[indice] = nuevas[indice] === herramienta ? '' : herramienta
      onUpdate(numero, { superficies: nuevas })
    }
  }

  // Color de fondo cuando el diente tiene un estado global
  const colorEstado = COLORES_ESTADO[estado] ?? null

  return (
    <g transform={`translate(${x - mitad}, ${y - mitad})`} style={{ cursor: 'pointer' }}>
      {/* Número FDI */}
      <text
        x={mitad}
        y={-4}
        textAnchor="middle"
        fontSize="9"
        fill={colorEstado ?? '#374151'}
        fontWeight={estado ? '700' : '400'}
      >
        {numero}
      </text>

      {ausente ? (
        // Diente ausente: X gris
        <g onClick={() => onUpdate(numero, { estado: '' })}>
          <rect x={0} y={0} width={tamaño} height={tamaño} fill="#f3f4f6" stroke="#9ca3af" strokeWidth="1" rx="2" />
          <line x1={4} y1={4} x2={tamaño - 4} y2={tamaño - 4} stroke="#6b7280" strokeWidth="2" />
          <line x1={tamaño - 4} y1={4} x2={4} y2={tamaño - 4} stroke="#6b7280" strokeWidth="2" />
        </g>
      ) : (
        <>
          {/* Borde exterior del diente */}
          <rect
            x={0} y={0}
            width={tamaño} height={tamaño}
            fill={colorEstado ?? '#ffffff'}
            stroke={colorEstado ?? '#9ca3af'}
            strokeWidth="1"
            rx="2"
            fillOpacity={colorEstado ? 0.15 : 1}
          />

          {/* Superficie vestibular (arriba) */}
          <polygon
            points={`0,0 ${tamaño},0 ${mitad - innerSize / 2},${mitad - innerSize / 2}`}
            fill={COLORES[superficies[1]]}
            stroke="#d1d5db" strokeWidth="0.5"
            onClick={() => handleSuperficie(1)}
          />

          {/* Superficie lingual (abajo) */}
          <polygon
            points={`0,${tamaño} ${tamaño},${tamaño} ${mitad + innerSize / 2},${mitad + innerSize / 2} ${mitad - innerSize / 2},${mitad + innerSize / 2}`}
            fill={COLORES[superficies[2]]}
            stroke="#d1d5db" strokeWidth="0.5"
            onClick={() => handleSuperficie(2)}
          />

          {/* Superficie mesial (izquierda) */}
          <polygon
            points={`0,0 0,${tamaño} ${mitad - innerSize / 2},${mitad + innerSize / 2} ${mitad - innerSize / 2},${mitad - innerSize / 2}`}
            fill={COLORES[superficies[3]]}
            stroke="#d1d5db" strokeWidth="0.5"
            onClick={() => handleSuperficie(3)}
          />

          {/* Superficie distal (derecha) */}
          <polygon
            points={`${tamaño},0 ${tamaño},${tamaño} ${mitad + innerSize / 2},${mitad + innerSize / 2} ${mitad + innerSize / 2},${mitad - innerSize / 2}`}
            fill={COLORES[superficies[4]]}
            stroke="#d1d5db" strokeWidth="0.5"
            onClick={() => handleSuperficie(4)}
          />

          {/* Superficie oclusal / incisal (centro) */}
          <rect
            x={mitad - innerSize / 2}
            y={mitad - innerSize / 2}
            width={innerSize}
            height={innerSize}
            fill={COLORES[superficies[0]]}
            stroke="#d1d5db" strokeWidth="0.5"
            onClick={() => handleSuperficie(0)}
          />
        </>
      )}
    </g>
  )
}
