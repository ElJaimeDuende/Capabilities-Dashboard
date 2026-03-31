import { useState } from 'react'
import { useHeatmap } from '../hooks/useData'
import { pct } from '../utils/format'
import { heatColor, heatTextColor } from '../utils/format'
import type { Filters } from '../types'

interface Props { filters: Filters }

export default function HeatmapPage({ filters }: Props) {
  const { data: heatmap, loading } = useHeatmap()
  const [view, setView] = useState<'bu' | 'area'>('bu')
  const [selectedCap, setSelectedCap] = useState<string | null>(null)

  if (loading || !heatmap) return <Loader />

  const rows = view === 'bu'
    ? heatmap.by_bu.filter(r => !filters.bus.length || filters.bus.includes(r.label))
    : heatmap.by_area.filter(r => !filters.areas.length || filters.areas.includes(r.label))

  const caps = heatmap.capabilities

  // Selected capability column summary
  const capSummary = selectedCap ? rows.map(r => ({
    label: r.label,
    apego: r.cells[selectedCap]?.apego ?? null,
    n: r.cells[selectedCap]?.n ?? 0,
  })).sort((a, b) => (b.apego ?? 0) - (a.apego ?? 0)) : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-[#1E293B]">Heat Maps</h2>
        <div className="flex rounded-xl overflow-hidden border border-[#E2E8F0]">
          {(['bu', 'area'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-2 text-xs font-medium transition-colors
                ${view === v ? 'bg-[#1E3A5F] text-white' : 'bg-white text-[#64748B] hover:bg-[#F1F5F9]'}`}>
              {v === 'bu' ? 'Por BU' : 'Por Área'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <div className="flex items-center gap-4 mb-3 flex-wrap">
          <div>
            <p className="text-xs text-[#64748B]">
              {view === 'bu' ? `${rows.length} BUs` : `${rows.length} Áreas`} × {caps.length} capabilities
              {selectedCap && <span className="ml-2 font-medium text-[#1E3A5F]">· {selectedCap}</span>}
            </p>
          </div>
          {selectedCap && (
            <button onClick={() => setSelectedCap(null)} className="ml-auto text-xs text-[#C62828] hover:underline">
              Limpiar selección
            </button>
          )}
        </div>

        {/* Color legend */}
        <div className="flex gap-1 items-center mb-3 flex-wrap">
          <span className="text-xs text-[#64748B] mr-1">Apego:</span>
          {[
            { label: '<45%', color: '#C62828' },
            { label: '45-55%', color: '#FF9800' },
            { label: '55-65%', color: '#FDD835' },
            { label: '65-75%', color: '#66BB6A' },
            { label: '75-85%', color: '#2E7D32' },
            { label: '>85%', color: '#1B5E20' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1">
              <div className="w-4 h-4 rounded" style={{ background: l.color }} />
              <span className="text-xs text-[#64748B]">{l.label}</span>
            </div>
          ))}
        </div>

        {/* Heat map table */}
        <div className="overflow-auto max-h-[60vh]">
          <table className="text-xs border-collapse">
            <thead className="sticky top-0 bg-white z-10">
              <tr>
                <th className="sticky left-0 bg-white z-20 text-left py-1.5 pr-3 pl-1 text-[#64748B] font-medium min-w-[110px] border-b border-r border-[#E2E8F0]">
                  {view === 'bu' ? 'BU' : 'Área'}
                </th>
                {caps.map(cap => (
                  <th key={cap} onClick={() => setSelectedCap(cap === selectedCap ? null : cap)}
                    className={`py-1.5 px-1 font-medium cursor-pointer min-w-[52px] border-b border-[#E2E8F0] transition-colors
                      ${selectedCap === cap ? 'text-[#1E3A5F] bg-[#EFF6FF]' : 'text-[#64748B] hover:text-[#1E3A5F]'}`}
                    title={cap}>
                    <div className="writing-mode-vertical" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', maxHeight: 90, overflow: 'hidden' }}>
                      {cap.length > 18 ? cap.slice(0, 16) + '…' : cap}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.label} className="hover:bg-[#F8FAFC]">
                  <td className="sticky left-0 bg-white font-medium text-[#1E293B] py-1.5 pr-3 pl-1 border-b border-r border-[#E2E8F0] whitespace-nowrap z-10">
                    {row.label}
                  </td>
                  {caps.map(cap => {
                    const cell = row.cells[cap]
                    const apego = cell?.apego ?? null
                    const bg = heatColor(apego)
                    const fg = heatTextColor(apego)
                    const isSelected = selectedCap === cap
                    return (
                      <td key={cap}
                        className={`py-1.5 px-1 text-center border-b border-[#E2E8F0] transition-opacity ${isSelected ? 'opacity-100 ring-1 ring-inset ring-[#1E3A5F]' : selectedCap ? 'opacity-60' : 'opacity-100'}`}
                        style={{ background: bg, color: fg }}
                        title={`${row.label} · ${cap}: ${pct(apego)} (n=${cell?.n ?? 0})`}>
                        {apego != null ? pct(apego, 0) : '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected capability detail */}
      {selectedCap && capSummary.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <h3 className="text-sm font-semibold text-[#1E293B] mb-3">
            Detalle: <span className="text-[#1E3A5F]">{selectedCap}</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {capSummary.map(item => {
              const badge = { bg: heatColor(item.apego), fg: heatTextColor(item.apego) }
              return (
                <div key={item.label} className="rounded-lg p-3 text-center" style={{ background: badge.bg }}>
                  <p className="text-xs font-medium mb-1" style={{ color: badge.fg }}>{item.label}</p>
                  <p className="text-lg font-bold" style={{ color: badge.fg }}>{pct(item.apego, 0)}</p>
                  <p className="text-xs opacity-75" style={{ color: badge.fg }}>n={item.n}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function Loader() {
  return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-[#1E3A5F] border-t-transparent rounded-full animate-spin" /></div>
}
