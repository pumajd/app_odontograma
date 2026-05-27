import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  HomeIcon,
  UsersIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  PhotoIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline'
import { useAppUser } from '../../context/UserContext'

const LOCAL_DEV = import.meta.env.VITE_LOCAL_DEV === 'true'

const NAV_ITEMS = [
  { to: '/',             label: 'Dashboard',    icon: HomeIcon },
  { to: '/pacientes',    label: 'Pacientes',    icon: UsersIcon },
  { to: '/citas',        label: 'Citas',        icon: CalendarIcon },
  { to: '/facturacion',  label: 'Facturación',  icon: CurrencyDollarIcon },
  { to: '/radiografias', label: 'Radiografías', icon: PhotoIcon },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const { userEmail, signOut } = useAppUser()

  async function handleSignOut() {
    await signOut()
    if (!LOCAL_DEV) navigate('/login')
  }

  return (
    <div className="flex h-screen bg-crema overflow-hidden">

      {/* Overlay movil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-brand-500 transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-brand-400">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🦷</span>
            <span className="font-heading text-lg font-bold text-white tracking-wide">ODONTOVAL</span>
          </div>
          <button
            className="lg:hidden text-brand-200 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Eslogan */}
        <div className="px-5 py-2 border-b border-brand-400">
          <p className="text-xs text-brand-200 italic font-heading">Cultivando Sonrisas</p>
        </div>

        {/* Badge modo local */}
        {LOCAL_DEV && (
          <div className="mx-3 mt-2 rounded-md bg-amber-400/20 border border-amber-400/40 px-3 py-1.5">
            <p className="text-xs font-medium text-amber-200 text-center">Modo desarrollo local</p>
          </div>
        )}

        {/* Navegacion */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-white/20 text-white shadow-sm'
                  : 'text-brand-100 hover:bg-white/10 hover:text-white'}`
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Usuario y logout */}
        <div className="border-t border-brand-400 p-4">
          <div className="flex items-center gap-3 mb-3">
            <UserCircleIcon className="h-8 w-8 text-brand-200 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{userEmail}</p>
              <p className="text-xs text-brand-200">Odontólogo</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-brand-200
                       hover:bg-white/10 hover:text-white transition-colors"
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4" />
            Cerrar sesion
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

        {/* Topbar movil */}
        <header className="flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 hover:text-brand-500"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl">🦷</span>
            <span className="font-heading text-lg font-bold text-brand-500">ODONTOVAL</span>
          </div>
        </header>

        {/* Pagina activa */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
