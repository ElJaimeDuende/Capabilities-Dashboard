import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'
import { useSummary, useCriticalFindings, useBenchmarks } from '../hooks/useData'
import { pct, score, apegoBadge } from '../utils/format'
import type { Filters } from '../types'
import { NIVEL_ORDER, NIVEL_COLORS } from '../types'

interface Props { filters: Filters; filterBuSummary: (rows: any[]) => any[] }

export default function Summary({ filterBuSummary }: Props) {
  const { data: summary, loading: ls } = useSummary()
  const { data: findings } = useCriticalFindings()
  const { data: benchmarks } = useBenchmarks()

  if (ls || !summary) return <Loader />

  const buData = filterBuSummary(summary.bu_summary)
  const badge = apegoBadge(summary.apego_promedio_global)

  // Distribution chart data vs benchmark
  const distData = NIVEL_ORDER.map(n => ({
    nivel: n.replace('Advanced Beginner', 'Adv. Beginner'),
    actual: Math.round((summary.nivel_distribution[n] ?? 0) * 100),
    madura: benchmarks ? Math.round((benchmarks.nivel_distribution.mature_org[n] ?? 0) * 100) : 0,
  }))

  // BU puntaje chart
  const buChart = [...buData].sort((a, b) => (b.puntaje_promedio ?? 0) - (a.puntaje_promedio ?? 0))

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[#1E293B]">Executive Summary</h2>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Participantes" value={String(summary.total_participantes)} />
        <KpiCard label="Assessments finalizados" value={String(summary.assessments_finalizados)}
          sub={`${summary.assessments_en_curso} en curso`} />
        <KpiCard label="Puntaje promedio" value={score(summary.puntaje_promedio_global)}
          sub="Escala 0–3" />
        <KpiCard label="Apego al perfil"
          value={pct(summary.apego_promedio_global)}
          valueColor={badge.color}
          sub={`${badge.label} · Benchmark good: 75-80%`} />
      </div>

      {/* Critical findings */}
      {findings && findings.findings.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#1E293B] mb-3">
            Hallazgos críticos
            <span className="ml-2 bg-[#FFEBEE] text-[#C62828] text-xs px-2 py-0.5 rounded-full">
              {findings.alta_severidad} alta · {findings.media_severidad} media
            </span>
          </h3>
          <div className="space-y-2">
            {findings.findings.slice(0, 6).map((f, i) => (
              <div key={i} className={`rounded-xl p-3.5 border-l-4 bg-white
                ${f.severity === 'alta' ? 'border-[#C62828]' : f.severity === 'positivo' ? 'border-[#2E7D32]' : 'border-[#F9A825]'}`}>
                <div className="flex items-start gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 mt-0.5
                    ${f.severity === 'alta' ? 'bg-[#FFEBEE] text-[#C62828]' : f.severity === 'positivo' ? 'bg-[#E8F5E9] text-[#2E7D32]' : 'bg-[#FFFDE7] text-[#F57F17]'}`}>
                    {f.severity === 'positivo' ? 'Positivo' : f.severity.charAt(0).toUpperCase() + f.severity.slice(1)}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-[#1E293B]">{f.title}</p>
                    <p className="text-xs text-[#64748B] mt-0.5">{f.detail}</p>
                    <p className="text-xs text-[#94A3B8] mt-1 italic">{f.benchmark}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribution vs benchmark */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <h3 className="text-sm font-semibold text-[#1E293B] mb-1">Distribución de niveles vs benchmark</h3>
          <p className="text-xs text-[#64748B] mb-4">Actual vs organización madura (Gartner/Dreyfus)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={distData} barGap={4} barCategoryGap="30%">
              <XAxis dataKey="nivel" tick={{ fontSize: 10, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748B' }} unit="%" domain={[0, 50]} />
              <Tooltip formatter={(v: any) => `${v}%`} />
              <Bar dataKey="actual" name="Actual" radius={[4,4,0,0]}>
                {distData.map((d) => (
                  <Cell key={d.nivel} fill={NIVEL_COLORS[d.nivel.replace('Adv. Beginner', 'Advanced Beginner') as keyof typeof NIVEL_COLORS] ?? '#1E3A5F'} />
                ))}
              </Bar>
              <Bar dataKey="madura" name="Org. madura" fill="#CBD5E1" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 justify-center">
            <Legend color="#1E3A5F" label="Actual" />
            <Legend color="#CBD5E1" label="Org. madura" />
          </div>
        </div>

        {/* BU puntaje */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <h3 className="text-sm font-semibold text-[#1E293B] mb-1">Puntaje promedio por BU</h3>
          <p className="text-xs text-[#64748B] mb-4">Escala 0–3. Assessments finalizados</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={buChart} layout="vertical" barCategoryGap="25%">
              <XAxis type="number" domain={[0, 3]} tick={{ fontSize: 10, fill: '#64748B' }} />
              <YAxis type="category" dataKey="bu" width={110} tick={{ fontSize: 10, fill: '#64748B' }} />
              <Tooltip formatter={(v: any) => v.toFixed(2)} />
              <ReferenceLine x={2.0} stroke="#F9A825" strokeDasharray="4 2" label={{ value: 'Competent', fill: '#F9A825', fontSize: 10 }} />
              <Bar dataKey="puntaje_promedio" name="Puntaje" radius={[0,4,4,0]}>
                {buChart.map((d) => (
                  <Cell key={d.bu} fill={d.puntaje_promedio >= 2.2 ? '#2E7D32' : d.puntaje_promedio >= 1.8 ? '#F9A825' : '#C62828'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* BU nivel breakdown */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <h3 className="text-sm font-semibold text-[#1E293B] mb-3">Distribución de niveles por BU</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0]">
                <th className="text-left py-2 pr-4 text-[#64748B] font-medium">BU</th>
                <th className="text-right py-2 px-2 text-[#64748B] font-medium">N</th>
                <th className="text-right py-2 px-2 text-[#64748B] font-medium">Apego</th>
                {NIVEL_ORDER.map(n => (
                  <th key={n} className="text-right py-2 px-2 font-medium" style={{ color: NIVEL_COLORS[n] }}>
                    {n.replace('Advanced Beginner', 'Adv.Beg')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {buData.map(bu => {
                const badge = apegoBadge(bu.apego_promedio)
                return (
                  <tr key={bu.bu} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                    <td className="py-2 pr-4 font-medium text-[#1E293B]">{bu.bu}</td>
                    <td className="py-2 px-2 text-right text-[#64748B]">{bu.n}</td>
                    <td className="py-2 px-2 text-right font-medium" style={{ color: badge.color }}>
                      {pct(bu.apego_promedio)}
                    </td>
                    {NIVEL_ORDER.map(n => (
                      <td key={n} className="py-2 px-2 text-right" style={{ color: bu.niveles[n] > 0 ? NIVEL_COLORS[n] : '#CBD5E1' }}>
                        {bu.niveles[n] ?? 0}
                      </td>
                    ))}
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

function KpiCard({ label, value, sub, valueColor }: { label: string; value: string; sub?: string; valueColor?: string }) {
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
      <p className="text-xs text-[#64748B] font-medium">{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: valueColor ?? '#1E293B' }}>{value}</p>
      {sub && <p className="text-xs text-[#94A3B8] mt-1">{sub}</p>}
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
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[#1E3A5F] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
