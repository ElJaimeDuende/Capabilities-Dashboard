import { useState, useMemo, useRef, type ReactNode } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell, LabelList } from 'recharts'
import { useSummary, useCriticalFindings, useBenchmarks, useRankings, useGaps } from '../hooks/useData'
import { pct, score, apegoBadge } from '../utils/format'
import { downloadCsv } from '../utils/csv'
import InfoTooltip from '../components/InfoTooltip'
import CopyChartBtn from '../components/CopyChartBtn'
import type { Filters, BuSummary, RankingRow, Finding, CriticalFindings } from '../types'
import { NIVEL_ORDER, NIVEL_COLORS } from '../types'

interface Props {
  filters: Filters
  filterBuSummary: (rows: BuSummary[]) => BuSummary[]
  filterRows: (rows: RankingRow[]) => RankingRow[]
}

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

export default function Summary({ filters, filterBuSummary, filterRows }: Props) {
  const { data: summary, loading: ls } = useSummary()
  const { data: rankings } = useRankings()
  const { data: findings } = useCriticalFindings()
  const { data: benchmarks } = useBenchmarks()
  const { data: gaps } = useGaps()
  const [sortCol, setSortCol] = useState<SortCol>('apego_promedio')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const distChartRef = useRef<HTMLDivElement>(null)
  const buChartRef = useRef<HTMLDivElement>(null)

  const hasFilter = filters.bus.length > 0 || filters.work_locations.length > 0 ||
    filters.areas.length > 0 || filters.roles.length > 0 || filters.años.length > 0

  // Dynamic findings computed from gaps.json by_year when a single year is selected
  const dynamicFindings = useMemo<CriticalFindings | null>(() => {
    if (!gaps || filters.años.length !== 1) return null
    const year = filters.años[0]

    type CapEntry = { capability: string; apego: number; n: number; perfil: number; gap: number }
    const capData: CapEntry[] = gaps.by_capability
      .map(cap => {
        const yd = cap.by_year[year]
        if (!yd || yd.n === 0) return null
        return {
          capability: cap.capability,
          apego: yd.apego,
          n: yd.n,
          perfil: cap.perfil_requerido,
          gap: cap.perfil_requerido - yd.apego,
        }
      })
      .filter(Boolean) as CapEntry[]

    capData.sort((a, b) => b.gap - a.gap)

    const result: Finding[] = []

    // Alta: apego < 60%
    capData.filter(c => c.apego < 0.60).slice(0, 3).forEach(c => result.push({
      severity: 'alta',
      category: 'Gap crítico de capability',
      title: `Brecha crítica: ${c.capability}`,
      detail: `Apego de ${Math.round(c.apego * 100)}% vs perfil requerido ${Math.round(c.perfil * 100)}%. Gap de ${Math.round(c.gap * 100)} puntos en ${year}.`,
      benchmark: 'Umbral acción: apego < 60%',
      capability: c.capability,
    }))

    // Media: 60% ≤ apego < 80%
    capData.filter(c => c.apego >= 0.60 && c.apego < 0.80).slice(0, 3).forEach(c => result.push({
      severity: 'media',
      category: 'Gap moderado de capability',
      title: `Gap moderado: ${c.capability}`,
      detail: `Apego de ${Math.round(c.apego * 100)}% en ${year}. Gap de ${Math.round(c.gap * 100)} puntos al perfil requerido.`,
      benchmark: 'Umbral acción: apego < 80%',
      capability: c.capability,
    }))

    // Positivo: apego ≥ 100%
    capData.filter(c => c.apego >= 1.0).slice(0, 2).forEach(c => result.push({
      severity: 'positivo',
      category: 'Fortaleza',
      title: `Fortaleza: ${c.capability}`,
      detail: `Apego de ${Math.round(c.apego * 100)}% en ${year}, superando o cumpliendo el perfil requerido.`,
      benchmark: 'Meta: ≥100% apego al perfil',
      capability: c.capability,
    }))

    return {
      total: result.length,
      alta_severidad: result.filter(f => f.severity === 'alta').length,
      media_severidad: result.filter(f => f.severity === 'media').length,
      positivos: result.filter(f => f.severity === 'positivo').length,
      findings: result,
    }
  }, [gaps, filters.años])

  // Use dynamic findings when a single year is selected, otherwise use static JSON
  const activeFindingsData = dynamicFindings ?? findings
  const findingsLabel = filters.años.length === 1 ? `${filters.años[0]}` : 'Global'

  // When a filter is active, recompute KPIs and bu_summary from raw rankings rows
  const filteredRows = useMemo<RankingRow[] | null>(() => {
    if (!hasFilter || !rankings) return null
    return filterRows(rankings.all)
  }, [hasFilter, rankings, filterRows])

  const kpi = useMemo(() => {
    if (filteredRows) {
      const n = filteredRows.length
      return {
        total_participantes: new Set(filteredRows.map(r => r.nombre)).size,
        assessments_finalizados: n,
        assessments_en_curso: null as number | null,
        puntaje_promedio_global: n > 0 ? filteredRows.reduce((s, r) => s + (r.puntaje || 0), 0) / n : 0,
        apego_promedio_global: n > 0 ? filteredRows.reduce((s, r) => s + (r.apego || 0), 0) / n : 0,
      }
    }
    if (!summary) return null
    return {
      total_participantes: summary.total_participantes,
      assessments_finalizados: summary.assessments_finalizados,
      assessments_en_curso: summary.assessments_en_curso,
      puntaje_promedio_global: summary.puntaje_promedio_global,
      apego_promedio_global: summary.apego_promedio_global,
    }
  }, [filteredRows, summary])

  const buData: BuSummary[] = useMemo(() => {
    if (filteredRows) {
      const buMap: Record<string, { n: number; puntaje: number; apego: number; niveles: Record<string, number> }> = {}
      for (const r of filteredRows) {
        if (!buMap[r.bu]) buMap[r.bu] = { n: 0, puntaje: 0, apego: 0, niveles: {} }
        buMap[r.bu].n++
        buMap[r.bu].puntaje += r.puntaje || 0
        buMap[r.bu].apego += r.apego || 0
        buMap[r.bu].niveles[r.nivel] = (buMap[r.bu].niveles[r.nivel] || 0) + 1
      }
      return Object.entries(buMap).map(([bu, d]) => ({
        bu,
        n: d.n,
        puntaje_promedio: d.n > 0 ? d.puntaje / d.n : 0,
        apego_promedio: d.n > 0 ? d.apego / d.n : 0,
        niveles: Object.fromEntries(NIVEL_ORDER.map(n => [n, d.niveles[n] || 0])) as Record<string, number>,
      })) as BuSummary[]
    }
    return filterBuSummary(summary?.bu_summary ?? [])
  }, [filteredRows, summary, filterBuSummary])

  const nivelDist = useMemo(() => {
    if (filteredRows) {
      const total = filteredRows.length
      return Object.fromEntries(NIVEL_ORDER.map(n => [n, total > 0 ? filteredRows.filter(r => r.nivel === n).length / total : 0]))
    }
    return summary?.nivel_distribution ?? {}
  }, [filteredRows, summary])

  const nivelCounts = useMemo(() => {
    if (filteredRows) {
      return Object.fromEntries(NIVEL_ORDER.map(n => [n, new Set(filteredRows.filter(r => r.nivel === n).map(r => r.nombre)).size]))
    }
    return summary?.nivel_counts ?? {}
  }, [filteredRows, summary])

  if (ls || !kpi) return <Loader />

  const badge = apegoBadge(kpi.apego_promedio_global)

  const totalPersons = filteredRows
    ? new Set(filteredRows.map(r => r.nombre)).size
    : (summary?.total_participantes ?? 0)

  const distData = NIVEL_ORDER.map(n => ({
    nivel: n.replace('Advanced Beginner', 'Adv. Beginner'),
    actual: Math.round((nivelDist[n] ?? 0) * 100),
    madura: benchmarks ? Math.round((benchmarks.nivel_distribution.mature_org[n] ?? 0) * 100) : 0,
    count: nivelCounts[n] ?? Math.round((nivelDist[n] ?? 0) * totalPersons),
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
        <KpiCard label="Participantes" value={String(kpi.total_participantes)} tip={KPI_TIPS.participantes} />
        <KpiCard label="Assessments finalizados" value={String(kpi.assessments_finalizados)}
          sub={kpi.assessments_en_curso != null ? `${kpi.assessments_en_curso} en curso` : undefined} tip={KPI_TIPS.finalizados} />
        <KpiCard label="Puntaje promedio" value={score(kpi.puntaje_promedio_global)}
          sub="Escala 0–3 (Dreyfus)" tip={KPI_TIPS.puntaje} />
        <KpiCard label="Apego al perfil"
          value={pct(kpi.apego_promedio_global)}
          valueColor={badge.color}
          sub={`${badge.label} · Meta: ≥100%`}
          tip={KPI_TIPS.apego} />
      </div>

      {/* Critical findings */}
      {activeFindingsData && activeFindingsData.findings.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#1E293B] mb-3 flex items-center gap-2 flex-wrap">
            Hallazgos críticos
            <span className="bg-[#FFEBEE] text-[#C62828] text-xs px-2 py-0.5 rounded-full">
              {activeFindingsData.alta_severidad} alta · {activeFindingsData.media_severidad} media
            </span>
            <span className="bg-[#EFF6FF] text-[#1E3A5F] text-xs px-2 py-0.5 rounded-full">
              {findingsLabel}
            </span>
            {dynamicFindings && (
              <span className="text-xs text-[#94A3B8] font-normal italic">Calculado desde datos reales del año</span>
            )}
          </h3>
          <div className="space-y-2">
            {activeFindingsData.findings.slice(0, 6).map((f, i) => (
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
          <div className="flex items-start justify-between mb-1">
            <h3 className="text-sm font-semibold text-[#1E293B]">Distribución de niveles vs benchmark</h3>
            <CopyChartBtn chartRef={distChartRef} />
          </div>
          <p className="text-xs text-[#64748B] mb-4">ABI vs organización madura (Gartner/Dreyfus)</p>
          <div ref={distChartRef}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={distData} barGap={4} barCategoryGap="30%">
                <XAxis dataKey="nivel" tick={{ fontSize: 10, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} unit="%" domain={[0, 60]} />
                <Tooltip formatter={(v: unknown, name: unknown) => name === 'ABI' ? `${v}%` : `${v}%`}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const d = distData.find(x => x.nivel === label)
                    return (
                      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow p-2 text-xs">
                        <p className="font-semibold text-[#1E293B] mb-1">{label}</p>
                        {payload.map((p: any) => (
                          <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}%{p.name === 'ABI' && d ? ` (${d.count} personas)` : ''}</p>
                        ))}
                      </div>
                    )
                  }}
                />
                <Bar dataKey="actual" name="ABI" radius={[4,4,0,0]}>
                  {distData.map((d) => (
                    <Cell key={d.nivel} fill={NIVEL_COLORS[d.nivel.replace('Adv. Beginner', 'Advanced Beginner') as keyof typeof NIVEL_COLORS] ?? '#1E3A5F'} />
                  ))}
                  <LabelList dataKey="count" position="top" style={{ fontSize: 10, fill: '#475569' }} formatter={(v: any) => v > 0 ? v : ''} />
                </Bar>
                <Bar dataKey="madura" name="Org. madura" fill="#CBD5E1" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-2 justify-center">
            <ChartLegend color="#1E3A5F" label="ABI" />
            <ChartLegend color="#CBD5E1" label="Org. madura" />
          </div>
        </div>

        {/* BU apego % chart */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <div className="flex items-start justify-between mb-1">
            <h3 className="text-sm font-semibold text-[#1E293B]">Apego al perfil por BU</h3>
            <CopyChartBtn chartRef={buChartRef} />
          </div>
          <p className="text-xs text-[#64748B] mb-4">% de cumplimiento del perfil requerido · Meta: 100%</p>
          <div ref={buChartRef}>
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
