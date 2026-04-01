import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ReferenceLine } from 'recharts'
import { useGaps } from '../hooks/useData'
import { pct, apegoBadge } from '../utils/format'
import { downloadCsv } from '../utils/csv'
import InfoTooltip from '../components/InfoTooltip'
import type { Filters } from '../types'

interface Props { filters: Filters }

const TIPS = {
  gapCap: 'Apego actual = promedio del % Apego al perfil de todas las personas en esa capability.\nFórmula: Puntaje capability / Puntaje requerido perfil.\nMeta = 100% (apego ≥ 1.0).',
  gapRol: 'Apego promedio = promedio del % Apego al perfil de todas las personas en ese rol.\nFórmula: Puntaje assessment / Puntaje requerido perfil.',
  radar: 'Muestra el apego promedio de las 8 capabilities con mayor brecha para la BU seleccionada.\nLa circunferencia exterior representa el 100% (cumple perfil). El área sombreada es el apego actual.',
}

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
    Apego: Math.round((d.apego ?? 0) * 100),
  }))

  const rolData = [...gaps.by_rol]
    .filter(r => !filters.roles.length || filters.roles.includes(r.rol))
    .sort((a, b) => (a.apego_promedio ?? 0) - (b.apego_promedio ?? 0))

  const chartHeight = Math.max(400, capGaps.length * 26)

  function exportCapGaps() {
    downloadCsv('gap_capabilities.csv', capGaps.map(c => ({
      Capability: c.capability,
      'Apego actual %': pct(c.apego_actual),
      'Gap %': pct(c.gap),
    })))
  }

  function exportRolGaps() {
    downloadCsv('gap_roles.csv', rolData.map(r => ({
      Rol: r.rol,
      N: r.n,
      'Puntaje promedio': r.puntaje_promedio?.toFixed(2) ?? '',
      'Apego promedio %': pct(r.apego_promedio),
      'Nivel predominante': r.nivel_predominante ?? '',
    })))
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[#1E293B]">Gap Analysis</h2>

      {/* Capability gaps bar chart */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[#1E293B] flex items-center">
              Gap por capability
              <InfoTooltip text={TIPS.gapCap} />
            </h3>
            <p className="text-xs text-[#64748B]">Apego actual vs meta 100% · Ordenado por mayor brecha</p>
          </div>
          <div className="sm:ml-auto flex items-center gap-2">
            <input value={capSearch} onChange={e => setCapSearch(e.target.value)}
              placeholder="Buscar capability..."
              className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#1E3A5F] w-full sm:w-48" />
            <button onClick={exportCapGaps}
              className="text-xs text-[#64748B] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 hover:bg-[#F8FAFC] transition-colors shrink-0">
              ↓ CSV
            </button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={capGaps.map(c => ({
              name: c.capability.length > 30 ? c.capability.slice(0, 28) + '…' : c.capability,
              Apego: Math.round((c.apego_actual ?? 0) * 100),
            }))}
            layout="vertical" barCategoryGap="20%"
          >
            <XAxis type="number" domain={[0, 150]} tick={{ fontSize: 10, fill: '#64748B' }} unit="%" />
            <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 10, fill: '#475569' }} />
            <Tooltip formatter={(v: unknown) => `${v}%`} />
            <ReferenceLine x={100} stroke="#1E3A5F" strokeDasharray="4 2"
              label={{ value: '100%', fill: '#1E3A5F', fontSize: 10, position: 'insideTopRight' }} />
            <Bar dataKey="Apego" name="Apego actual" radius={[0,4,4,0]}>
              {capGaps.map(c => (
                <rect key={c.capability} fill={
                  (c.apego_actual ?? 0) >= 1.0 ? '#2E7D32' :
                  (c.apego_actual ?? 0) >= 0.75 ? '#F9A825' : '#C62828'
                } />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-3 mt-2 justify-center flex-wrap">
          <ChartLegend color="#2E7D32" label="≥100% cumple perfil" />
          <ChartLegend color="#F9A825" label="75–99%" />
          <ChartLegend color="#C62828" label="<75% brecha crítica" />
        </div>
      </div>

      {/* Radar by BU */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[#1E293B] flex items-center">
              Radar por BU
              <InfoTooltip text={TIPS.radar} />
            </h3>
            <p className="text-xs text-[#64748B]">Top 8 capabilities con mayor brecha vs 100%</p>
          </div>
          <select value={activeBu} onChange={e => setSelectedBu(e.target.value)}
            className="sm:ml-auto border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#1E3A5F]">
            {buList.map(bu => <option key={bu} value={bu}>{bu}</option>)}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#E2E8F0" />
            <PolarAngleAxis dataKey="capability" tick={{ fontSize: 10, fill: '#475569' }} />
            <PolarRadiusAxis angle={30} domain={[0, 150]} tick={{ fontSize: 9, fill: '#94A3B8' }} unit="%" />
            <Radar name="Apego actual" dataKey="Apego" stroke="#1E3A5F" fill="#1E3A5F" fillOpacity={0.4} />
            <Tooltip formatter={(v: unknown) => `${v}%`} />
          </RadarChart>
        </ResponsiveContainer>
        <p className="text-xs text-center text-[#94A3B8] mt-1">
          Línea exterior = 100% (cumple perfil requerido). Área sombreada = apego actual.
        </p>
      </div>

      {/* Gap por rol table */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-[#1E293B] flex items-center">
            Gap por rol
            <InfoTooltip text={TIPS.gapRol} />
          </h3>
          <button onClick={exportRolGaps}
            className="text-xs text-[#64748B] border border-[#E2E8F0] rounded-lg px-2.5 py-1 hover:bg-[#F8FAFC] transition-colors">
            ↓ CSV
          </button>
        </div>
        <p className="text-xs text-[#64748B] mb-3">Ordenado por menor apego · Meta: ≥100% del perfil requerido</p>
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

function ChartLegend({ color, label }: { color: string; label: string }) {
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
