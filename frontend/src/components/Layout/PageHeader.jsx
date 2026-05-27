/**
 * PageHeader — encabezado reutilizable para cada página
 * Props:
 *   title: string
 *   subtitle?: string
 *   actions?: ReactNode   (botones en la esquina derecha)
 */
export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-suelo font-heading">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
