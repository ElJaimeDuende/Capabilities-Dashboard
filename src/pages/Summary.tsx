import { useState, type ReactNode } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'
import { useSummary, useCriticalFindings, useBenchmarks } from '../hooks/useData'
import { pct, score, apegoBadge } from '../utils/format'
import { downloadCsv } from '../utils/csv'
import InfoTooltip from '../components/InfoTooltip'
import type { Filters, BuSummary } from '../types'
import { NIVEL_ORDER, NIVEL_COLORS } from '../types'

interface Props { filters: Filters; filterBuSummary: (rows: BuSummary[]) => BuSummary[] }

type SortCol = 'bu' | 'n' | 'apego_promedio' | 'Novice' | 'Advanced Beginner' | 'Competent' | 'Proficient' | 'Expert'
type SortDir = 'asc' | 'desc'

const KPI_TIPS = {
  participantes: 'Total de personas con al menos un assessment registrado en el período seleccionado.',
  finalizados: 'Assessments con estatus "Finalizado". Excluye los que están En Curso.\nFórmula: COUNT(assessments WHERE estatus = "Finalizado")',
  puntaje: 'Promedio aritmético del Puntaje assessment (escala 0–3, modelo Dreyfus).\n0 = sin conocimiento, 1 = Competent, 2 = Proficient, 3 = Expert.',
  apego: 'Promedio del % Apego al perfil.\nFórmula: Puntaje obtenido / Puntaje requerido perfil.\n100% = cumple exactamente el perfil del rol.\n>100% = supera el perfil requerido.',
}

const COL_TIPS = {
  apego: 'Promedio del % Apego al perfil para la BU.\nFórmula: Puntaje assessment / Puntaje requerido perfil.\nMeta: ≥100%.',
}

export default function Summary({ filterBuSummary }: Props) {
  const { data: summary, loading: ls } = useSummary()
  const { data: findings } = useCriticalFindings()
  const { data: benchmarks } = useBenchmarks()
  const [sortCol, setSortCol] = useState<SortCol>('apego_promedio')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  if (ls || !summary) return <Loader />

  const buData = filterBuSummary(summary.bu_summary)
  const badge = apegoBadge(summary.apego_promedio_global)

  const distData = NIVEL_ORDER.map(n => ({
    nivel: n.replace('Advanced Beginner', 'Adv. Beginner'),
    actual: Math.round((summary.nivel_distribution[n] ?? 0) * 100),
    madura: benchmarks ? Math.round((benchmarks.nivel_distribution.mature_org[n] ?? 0) * 100) : 0,
  }))

  const buChart = [...buData]
    .sort((a, b) => (b.apego_promedio ?? 0) - (a.apego_promedio ?? 0))
    .map(b => ({ ...b, apego_pct: Math.round((b.apego_promedio ?? 0) * 100) }))

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const sortedBu = [...buData].sort((a, b) => {
    let av: number, bv: number
    if (sortCol === 'bu') return sortDir === 'asc'
      ? a.bu.localeCompare(b.bu) : b.bu.localeCompare(a.bu)
    if (sortCol === 'n') { av = a.n; bv = b.n }
    else if (sortCol === 'apego_promedio') { av = a.apego_promedio ?? 0; bv = b.apego_promedio ?? 0 }
    else { av = a.niveles[sortCol] ?? 0; bv = b.niveles[sortCol] ?? 0 }
    return sortDir === 'asc' ? av - bv : bv - av
  })

  const chartHeight = Math.max(280, buChart.length * 32)

  function exportBuTable() {
    downloadCsv('bu_niveles.csv', sortedBu.map(bu => ({
      BU: bu.bu,
      N: bu.n,
      'Apego %': pct(bu.apego_promedio),
      ...Object.fromEntries(NIVEL_ORDER.map(n => [n, bu.niveles[n] ?? 0])),
    })))
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[#1E293B]">Executive Summary</h2>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Participantes" value={String(summary.total_participantes)} tip={KPI_TIPS.participantes} />
        <KpiCard label="Assessments finalizados" value={String(summary.assessments_finalizados)}
          sub={`${summary.assessments_en_curso} en curso`} tip={KPI_TIPS.finalizados} />
        <KpiCard label="Puntaje promedio" value={score(summary.puntaje_promedio_global)}
          sub="Escala 0–3 (Dreyfus)" tip={KPI_TIPS.puntaje} />
        <KpiCard label="Apego al perfil"
          value={pct(summary.apego_promedio_global)}
          valueColor={badge.color}
          sub={`${badge.label} · Meta: ≥100%`}
          tip={KPI_TIPS.apego} />
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
              <YAxis tick={{ fontSize: 10, fill: '#64748B' }} unit="%" domain={[0, 60]} />
              <Tooltip formatter={(v: unknown) => `${v}%`} />
              <Bar dataKey="actual" name="Actual" radius={[4,4,0,0]}>
                {distData.map((d) => (
                  <Cell key={d.nivel} fill={NIVEL_COLORS[d.nivel.replace('Adv. Beginner', 'Advanced Beginner') as keyof typeof NIVEL_COLORS] ?? '#1E3A5F'} />
                ))}
              </Bar>
              <Bar dataKey="madura" name="Org. madura" fill="#CBD5E1" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 justify-center">
            <ChartLegend color="#1E3A5F" label="Actual" />
            <ChartLegend color="#CBD5E1" label="Org. madura" />
          </div>
        </div>

        {/* BU apego % chart */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <h3 className="text-sm font-semibold text-[#1E293B] mb-1">Apego al perfil por BU</h3>
          <p className="text-xs text-[#64748B] mb-4">% de cumplimiento del perfil requerido · Meta: 100%</p>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={buChart} layout="vertical" barCategoryGap="25%">
              <XAxis type="number" domain={[0, 140]} tick={{ fontSize: 10, fill: '#64748B' }} unit="%" />
              <YAxis type="category" dataKey="bu" width={120} tick={{ fontSize: 10, fill: '#64748B' }} />
              <Tooltip formatter={(v: unknown) => `${v}%`} />
              <ReferenceLine x={100} stroke="#1E3A5F" strokeDasharray="4 2"
                label={{ value: '100% Meta', fill: '#1E3A5F', fontSize: 10, position: 'top' }} />
              <Bar dataKey="apego_pct" name="Apego %" radius={[0,4,4,0]}>
                {buChart.map((d) => (
                  <Cell key={d.bu}
                    fill={d.apego_promedio >= 1.0 ? '#2E7D32' : d.apego_promedio >= 0.75 ? '#F9A825' : '#C62828'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-3 mt-2 justify-center flex-wrap">
            <ChartLegend color="#2E7D32" label="≥100% (cumple perfil)" />
            <ChartLegend color="#F9A825" label="75–99%" />
            <ChartLegend color="#C62828" label="<75%" />
          </div>
        </div>
      </div>

      {/* BU nivel breakdown — sortable */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[#1E293B]">Distribución de niveles por BU</h3>
          <button onClick={exportBuTable}
            className="text-xs text-[#64748B] border border-[#E2E8F0] rounded-lg px-2.5 py-1 hover:bg-[#F8FAFC] transition-colors">
            ↓ CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0]">
                <SortTh col="bu" label="BU" current={sortCol} dir={sortDir} onSort={handleSort} align="left" />
                <SortTh col="n" label="N" current={sortCol} dir={sortDir} onSort={handleSort} />
                <SortTh col="apego_promedio" label={<>Apego<InfoTooltip text={COL_TIPS.apego} /></>}
                  current={sortCol} dir={sortDir} onSort={handleSort} />
                {NIVEL_ORDER.map(n => (
                  <SortTh key={n} col={n as SortCol} label={n.replace('Advanced Beginner', 'Adv.Beg')}
                    current={sortCol} dir={sortDir} onSort={handleSort}
                    color={NIVEL_COLORS[n]} />
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedBu.map(bu => {
                const b = apegoBadge(bu.apego_promedio)
                return (
                  <tr key={bu.bu} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                    <td className="py-2 pr-4 font-medium text-[#1E293B]">{bu.bu}</td>
                    <td className="py-2 px-2 text-right text-[#64748B]">{bu.n}</td>
                    <td className="py-2 px-2 text-right font-medium" style={{ color: b.color }}>
                      {pct(bu.apego_promedio)}
                    </td>
                    {NIVEL_ORDER.map(n => (
                      <td key={n} className="py-2 px-2 text-right"
                        style={{ color: bu.niveles[n] > 0 ? NIVEL_COLORS[n] : '#CBD5E1' }}>
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

function SortTh({ col, label, current, dir, onSort, align, color }: {
  col: SortCol; label: ReactNode; current: SortCol; dir: SortDir
  onSort: (c: SortCol) => void; align?: 'left'; color?: string
}) {
  const active = current === col
  return (
    <th
      onClick={() => onSort(col)}
      className={`py-2 px-2 font-medium cursor-pointer select-none hover:text-[#1E3A5F] transition-colors
        ${align === 'left' ? 'text-left pr-4' : 'text-right'}
        ${active ? 'text-[#1E3A5F]' : 'text-[#64748B]'}`}
      style={color ? { color: active ? color : undefined } : undefined}
    >
      {label}
      {active && <span className="ml-1 opacity-60">{dir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  )
}

function KpiCard({ label, value, sub, valueColor, tip }: {
  label: string; value: string; sub?: string; valueColor?: string; tip?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
      <p className="text-xs text-[#64748B] font-medium flex items-center">
        {label}
        {tip && <InfoTooltip text={tip} />}
      </p>
      <p className="text-2xl font-bold mt-1" style={{ color: valueColor ?? '#1E293B' }}>{value}</p>
      {sub && <p className="text-xs text-[#94A3B8] mt-1">{sub}</p>}
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
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[#1E3A5F] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
