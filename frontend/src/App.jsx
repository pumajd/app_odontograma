import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthenticator, Authenticator } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'

import { UserContext } from './context/UserContext'
import Layout from './components/Layout/Layout'
import Dashboard from './pages/Dashboard'
import PacientesList from './pages/Pacientes/PacientesList'
import PacienteDetalle from './pages/Pacientes/PacienteDetalle'
import OdontogramaPage from './pages/Odontograma/OdontogramaPage'
import CitasPage from './pages/Citas/CitasPage'
import FacturacionPage from './pages/Facturacion/FacturacionPage'
import ConsentimientoPage from './pages/Documentos/ConsentimientoPage'
import RadiografiasPage from './pages/Radiografias/RadiografiasPage'
import Callback from './pages/Auth/Callback'

const LOCAL_DEV = import.meta.env.VITE_LOCAL_DEV === 'true'

// ── Rutas compartidas ────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <Routes>
      <Route path="/callback" element={<Callback />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="pacientes" element={<PacientesList />} />
        <Route path="pacientes/:id" element={<PacienteDetalle />} />
        <Route path="pacientes/:id/odontograma" element={<OdontogramaPage />} />
        <Route path="citas" element={<CitasPage />} />
        <Route path="facturacion" element={<FacturacionPage />} />
        <Route path="consentimiento/:pacienteId" element={<ConsentimientoPage />} />
        <Route path="radiografias" element={<RadiografiasPage />} />
      </Route>
    </Routes>
  )
}

// ── Versión LOCAL: sin Cognito ────────────────────────────────────────────────
function LocalApp() {
  const mockUser = {
    userEmail: import.meta.env.VITE_LOCAL_USER_EMAIL || 'dev@odontoval.local',
    signOut: () => alert('Sign out no disponible en modo local'),
  }
  return (
    <UserContext.Provider value={mockUser}>
      <AppRoutes />
    </UserContext.Provider>
  )
}

// ── Versión PRODUCCIÓN: con Cognito ──────────────────────────────────────────
// Este componente se monta DENTRO de Authenticator.Provider, por eso
// puede llamar useAuthenticator sin problemas.
function CognitoApp() {
  const { user, signOut, authStatus } = useAuthenticator()

  if (authStatus !== 'authenticated') {
    return (
      <Routes>
        <Route path="/callback" element={<Callback />} />
        <Route
          path="*"
          element={<Authenticator hideSignUp={true} socialProviders={['google']} />}
        />
      </Routes>
    )
  }

  const cognitoUser = {
    userEmail: user?.signInDetails?.loginId || 'Usuario',
    signOut,
  }

  return (
    <UserContext.Provider value={cognitoUser}>
      <AppRoutes />
    </UserContext.Provider>
  )
}

// ── App raíz ─────────────────────────────────────────────────────────────────
export default function App() {
  if (LOCAL_DEV) {
    return <LocalApp />
  }
  return (
    <Authenticator.Provider>
      <CognitoApp />
    </Authenticator.Provider>
  )
}
