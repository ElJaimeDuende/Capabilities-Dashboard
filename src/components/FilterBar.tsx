import type { Filters, Summary } from '../types'

interface Props {
  filters: Filters
  summary: Summary
  toggle: (key: keyof Omit<Filters, 'periodo'>, value: string) => void
  setPeriodo: (p: number | null) => void
  reset: () => void
  activeCount: number
}

export default function FilterBar({ filters, summary, toggle, setPeriodo, reset, activeCount }: Props) {
  return (
    <div className="px-4 lg:px-6 py-2.5 flex flex-wrap gap-2 items-center">
      <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wide shrink-0">Filtros</span>

      {/* BU pills */}
      <div className="flex flex-wrap gap-1.5">
        {summary.bus.map(bu => (
          <Pill key={bu} active={filters.bus.includes(bu)} onClick={() => toggle('bus', bu)}>{bu}</Pill>
        ))}
      </div>

      <div className="w-px h-5 bg-[#E2E8F0] mx-1 hidden sm:block" />

      {/* Periodo */}
      <div className="flex gap-1.5">
        {summary.años.flatMap(a => summary.periodos.map(p => {
          const label = `${a}-P${p}`
          const active = filters.periodo === p
          return <Pill key={label} active={active} onClick={() => setPeriodo(p)}>{label}</Pill>
        }))}
      </div>

      {activeCount > 0 && (
        <button onClick={reset}
          className="ml-auto text-xs text-[#C62828] hover:text-[#B71C1C] font-medium flex items-center gap-1 shrink-0">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Limpiar ({activeCount})
        </button>
      )}
    </div>
  )
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border
        ${active
          ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
          : 'bg-white text-[#475569] border-[#E2E8F0] hover:border-[#1E3A5F] hover:text-[#1E3A5F]'}`}>
      {children}
    </button>
  )
}
