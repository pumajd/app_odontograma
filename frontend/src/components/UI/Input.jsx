export default function Input({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}
      <input
        className={`rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors
          focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-500
          ${error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}
          disabled:bg-gray-100 disabled:cursor-not-allowed ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
