import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts'
import { useGaps } from '../hooks/useData'
import { pct, apegoBadge } from '../utils/format'
import type { Filters } from '../types'

interface Props { filters: Filters }

export default function Gaps({ filters }: Props) {
  const { data: gaps, loading } = useGaps()
  const [selectedBu, setSelectedBu] = useState<string>('')
  const [capSearch, setCapSearch] = useState('')

  if (loading || !gaps) return <Loader />

  const buList = Object.keys(gaps.by_bu_radar)
  const activeBu = selectedBu || (filters.bus.length === 1 ? filters.bus[0] : buList[0])

  const capGaps = gaps.by_capability
    .filter(c => !capSearch || c.capability.toLowerCase().includes(capSearch.toLowerCase()))
    .slice(0, 30)

  const radarData = (gaps.by_bu_radar[activeBu] ?? []).slice(0, 8).map(d => ({
    capability: d.capability.length > 20 ? d.capability.slice(0, 18) + '…' : d.capability,
    Actual: Math.round((d.apego ?? 0) * 100),
    Perfil: Math.round((d.perfil ?? 0) * 100),
  }))

  const rolData = [...gaps.by_rol]
    .filter(r => !filters.roles.length || filters.roles.includes(r.rol))
    .sort((a, b) => (a.apego_promedio ?? 0) - (b.apego_promedio ?? 0))

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[#1E293B]">Gap Analysis</h2>

      {/* Capability gaps bar chart */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[#1E293B]">Gap por capability</h3>
            <p className="text-xs text-[#64748B]">Perfil requerido vs apego actual · Top 30 por brecha</p>
          </div>
          <input value={capSearch} onChange={e => setCapSearch(e.target.value)}
            placeholder="Buscar capability..."
            className="sm:ml-auto border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#1E3A5F] w-full sm:w-48" />
        </div>
        <ResponsiveContainer width="100%" height={Math.max(300, capGaps.length * 22)}>
          <BarChart data={capGaps.map(c => ({
            name: c.capability.length > 28 ? c.capability.slice(0, 26) + '…' : c.capability,
            Perfil: Math.round((c.perfil_requerido ?? 0) * 100),
            Actual: Math.round((c.apego_actual ?? 0) * 100),
            gap: c.gap,
          }))} layout="vertical" barGap={2} barCategoryGap="18%">
            <XAxis type="number" domain={[0, 200]} tick={{ fontSize: 10, fill: '#64748B' }} unit="%" />
            <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 10, fill: '#475569' }} />
            <Tooltip formatter={(v: any) => `${v}%`} />
            <Bar dataKey="Perfil" name="Perfil requerido" fill="#CBD5E1" radius={[0,4,4,0]} />
            <Bar dataKey="Actual" name="Apego actual" fill="#1E3A5F" radius={[0,4,4,0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 justify-center">
          <Legend color="#CBD5E1" label="Perfil requerido" />
          <Legend color="#1E3A5F" label="Apego actual" />
        </div>
      </div>

      {/* Radar by BU */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[#1E293B]">Radar por BU</h3>
            <p className="text-xs text-[#64748B]">Top 8 capabilities con mayor brecha</p>
          </div>
          <select value={activeBu} onChange={e => setSelectedBu(e.target.value)}
            className="sm:ml-auto border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#1E3A5F]">
            {buList.map(bu => <option key={bu} value={bu}>{bu}</option>)}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#E2E8F0" />
            <PolarAngleAxis dataKey="capability" tick={{ fontSize: 10, fill: '#475569' }} />
            <PolarRadiusAxis angle={30} domain={[0, 200]} tick={{ fontSize: 9, fill: '#94A3B8' }} unit="%" />
            <Radar name="Perfil" dataKey="Perfil" stroke="#CBD5E1" fill="#CBD5E1" fillOpacity={0.3} />
            <Radar name="Actual" dataKey="Actual" stroke="#1E3A5F" fill="#1E3A5F" fillOpacity={0.4} />
            <Tooltip formatter={(v: any) => `${v}%`} />
          </RadarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 justify-center">
          <Legend color="#CBD5E1" label="Perfil requerido" />
          <Legend color="#1E3A5F" label="Apego actual" />
        </div>
      </div>

      {/* Gap por rol table */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <h3 className="text-sm font-semibold text-[#1E293B] mb-1">Gap por rol</h3>
        <p className="text-xs text-[#64748B] mb-3">Ordenado por menor apego · Benchmark good: ≥70%</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0]">
                {['Rol', 'N', 'Puntaje prom.', 'Apego prom.', 'Semáforo', 'Nivel predo.'].map(h => (
                  <th key={h} className="text-left py-2 pr-4 text-[#64748B] font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rolData.map(r => {
                const badge = apegoBadge(r.apego_promedio)
                return (
                  <tr key={r.rol} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                    <td className="py-2 pr-4 font-medium text-[#1E293B] max-w-[200px]">{r.rol}</td>
                    <td className="py-2 pr-4 text-[#64748B]">{r.n}</td>
                    <td className="py-2 pr-4 text-[#64748B]">{r.puntaje_promedio?.toFixed(2) ?? '—'}</td>
                    <td className="py-2 pr-4 font-medium" style={{ color: badge.color }}>{pct(r.apego_promedio)}</td>
                    <td className="py-2 pr-4">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: badge.bg, color: badge.color }}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-[#64748B]">{r.nivel_predominante ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
      <span className="text-xs text-[#64748B]">{label}</span>
    </div>
  )
}

function Loader() {
  return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-[#1E3A5F] border-t-transparent rounded-full animate-spin" /></div>
}
