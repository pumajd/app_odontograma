/**
 * Callback — página intermedia tras el login con Google (Hosted UI Cognito)
 * Amplify maneja el intercambio de código automáticamente; solo redirigimos al inicio.
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Callback() {
  const navigate = useNavigate()
  useEffect(() => {
    const t = setTimeout(() => navigate('/', { replace: true }), 1500)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <p className="text-2xl mb-2">🦷</p>
        <p className="text-gray-500 text-sm">Iniciando sesión...</p>
      </div>
    </div>
  )
}
