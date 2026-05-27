import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthenticator, Authenticator } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'

import Layout from './components/Layout/Layout'
import Dashboard from './pages/Dashboard'
import PacientesList from './pages/Pacientes/PacientesList'
import PacienteDetalle from './pages/Pacientes/PacienteDetalle'
import OdontogramaPage from './pages/Odontograma/OdontogramaPage'
import CitasPage from './pages/Citas/CitasPage'
import FacturacionPage from './pages/Facturacion/FacturacionPage'
import ConsentimientoPage from './pages/Documentos/ConsentimientoPage'
import Callback from './pages/Auth/Callback'

// Componente protegido: redirige al login si no hay sesión
function ProtectedRoute({ children }) {
  const { authStatus } = useAuthenticator()
  if (authStatus !== 'authenticated') {
    return <Navigate to="/login" replace />
  }
  return children
}

export default function App() {
  return (
    <Authenticator.Provider>
      <Routes>
        {/* Ruta de callback OAuth */}
        <Route path="/callback" element={<Callback />} />

        {/* Login con Google (Hosted UI de Cognito) */}
        <Route
          path="/login"
          element={
            <Authenticator
              hideSignUp={true}
              socialProviders={['google']}
            />
          }
        />

        {/* Rutas protegidas */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="pacientes" element={<PacientesList />} />
          <Route path="pacientes/:id" element={<PacienteDetalle />} />
          <Route path="pacientes/:id/odontograma" element={<OdontogramaPage />} />
          <Route path="citas" element={<CitasPage />} />
          <Route path="facturacion" element={<FacturacionPage />} />
          <Route path="consentimiento/:pacienteId" element={<ConsentimientoPage />} />
        </Route>
      </Routes>
    </Authenticator.Provider>
  )
}
