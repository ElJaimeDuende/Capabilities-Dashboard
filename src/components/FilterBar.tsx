import { useState } from 'react'
import type { Filters, Granularidad, Summary } from '../types'

interface Props {
  filters: Filters
  summary: Summary
  toggle: (key: keyof Pick<Filters, 'bus' | 'work_locations' | 'areas' | 'roles'>, value: string) => void
  toggleAño: (año: number) => void
  setPeriodo: (label: string | null) => void
  setGranularidad: (g: Granularidad) => void
  reset: () => void
  activeCount: number
}

type GroupId = 'vista' | 'tiempo' | 'bu' | 'work_location' | 'area'

export default function FilterBar({
  filters, summary, toggle, toggleAño, setPeriodo, setGranularidad, reset, activeCount,
}: Props) {
  const [open, setOpen] = useState<GroupId | null>(null)

  const toggleGroup = (id: GroupId) => setOpen(prev => prev === id ? null : id)

  const tiempoCount = filters.granularidad === 'año' ? filters.años.length : (filters.periodo ? 1 : 0)

  return (
    <div className="bg-white border-b border-[#E2E8F0]">
      {/* ── Header row — always visible ─────────────────── */}
      <div className="flex items-stretch overflow-x-auto">

        <GroupHeader
          id="vista"
          label="Vista"
          count={0}
          badge={filters.granularidad === 'año' ? 'Anual' : 'Por período'}
          open={open === 'vista'}
          onToggle={toggleGroup}
        />

        <Divider />

        <GroupHeader
          id="tiempo"
          label={filters.granularidad === 'año' ? 'Año' : 'Período'}
          count={tiempoCount}
          open={open === 'tiempo'}
          onToggle={toggleGroup}
        />

        <Divider />

        <GroupHeader
          id="bu"
          label="BU"
          count={filters.bus.length}
          open={open === 'bu'}
          onToggle={toggleGroup}
        />

        <Divider />

        <GroupHeader
          id="work_location"
          label="Work Location"
          count={filters.work_locations.length}
          open={open === 'work_location'}
          onToggle={toggleGroup}
        />

        <Divider />

        <GroupHeader
          id="area"
          label="Área"
          count={filters.areas.length}
          open={open === 'area'}
          onToggle={toggleGroup}
        />

        {activeCount > 0 && (
          <>
            <Divider />
            <button
              onClick={reset}
              className="px-4 text-xs text-[#C62828] hover:text-[#B71C1C] font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Limpiar ({activeCount})
            </button>
          </>
        )}
      </div>

      {/* ── Expanded panel ───────────────────────────────── */}
      {open && (
        <div className="border-t border-[#E2E8F0] px-4 py-3 bg-[#F8FAFC]">

          {open === 'vista' && (
            <div className="flex gap-1 rounded-lg overflow-hidden border border-[#E2E8F0] w-fit">
              <SwitchBtn active={filters.granularidad === 'año'} onClick={() => { setGranularidad('año'); setOpen(null) }}>
                Anual
              </SwitchBtn>
              <SwitchBtn active={filters.granularidad === 'periodo'} onClick={() => { setGranularidad('periodo'); setOpen(null) }}>
                Por período
              </SwitchBtn>
            </div>
          )}

          {open === 'tiempo' && (
            <div className="flex flex-wrap gap-2">
              {filters.granularidad === 'año'
                ? summary.años.map(año => (
                    <Pill key={año} active={filters.años.includes(año)} onClick={() => toggleAño(año)}>
                      {año}
                    </Pill>
                  ))
                : summary.period_labels.map(label => (
                    <Pill key={label} active={filters.periodo === label} onClick={() => setPeriodo(label)}>
                      {label}
                    </Pill>
                  ))
              }
            </div>
          )}

          {open === 'bu' && (
            <div className="flex flex-wrap gap-2">
              {summary.bus.map(bu => (
                <Pill key={bu} active={filters.bus.includes(bu)} onClick={() => toggle('bus', bu)}>
                  {bu}
                </Pill>
              ))}
            </div>
          )}

          {open === 'work_location' && (
            <div className="flex flex-wrap gap-2">
              {summary.work_locations.map(wl => (
                <Pill key={wl} active={filters.work_locations.includes(wl)} onClick={() => toggle('work_locations', wl)}>
                  {wl}
                </Pill>
              ))}
            </div>
          )}

          {open === 'area' && (
            <div className="flex flex-wrap gap-2">
              {summary.areas.map(area => (
                <Pill key={area} active={filters.areas.includes(area)} onClick={() => toggle('areas', area)}>
                  {area}
                </Pill>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  )
}

function GroupHeader({
  id, label, count, badge, open, onToggle,
}: {
  id: GroupId
  label: string
  count: number
  badge?: string
  open: boolean
  onToggle: (id: GroupId) => void
}) {
  return (
    <button
      onClick={() => onToggle(id)}
      className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors shrink-0 whitespace-nowrap
        ${open ? 'bg-[#EFF6FF] text-[#1E3A5F]' : 'text-[#475569] hover:text-[#1E3A5F] hover:bg-[#F8FAFC]'}`}
    >
      <span className={`font-semibold text-[10px] uppercase tracking-wider ${open ? 'text-[#1E3A5F]' : 'text-[#94A3B8]'}`}>
        {label}
      </span>

      {badge && (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold
          ${open ? 'bg-[#1E3A5F] text-white' : 'bg-[#E2E8F0] text-[#475569]'}`}>
          {badge}
        </span>
      )}

      {count > 0 && (
        <span className="w-4 h-4 rounded-full bg-[#1E3A5F] text-white text-[9px] font-bold flex items-center justify-center">
          {count}
        </span>
      )}

      <svg
        className={`w-3 h-3 transition-transform ${open ? 'rotate-180 text-[#1E3A5F]' : 'text-[#CBD5E1]'}`}
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  )
}

function Divider() {
  return <div className="self-stretch w-px bg-[#E2E8F0] my-1.5" />
}

function SwitchBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-xs font-semibold transition-colors
        ${active ? 'bg-[#1E3A5F] text-white' : 'bg-white text-[#64748B] hover:text-[#1E3A5F]'}`}
    >
      {children}
    </button>
  )
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border whitespace-nowrap
        ${active
          ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
          : 'bg-white text-[#475569] border-[#E2E8F0] hover:border-[#1E3A5F] hover:text-[#1E3A5F]'}`}
    >
      {children}
    </button>
  )
}
