import { useState } from 'react'
import { useRankings } from '../hooks/useData'
import { pct, score, apegoBadge, nivelBadgeColor } from '../utils/format'
import { downloadCsv } from '../utils/csv'
import InfoTooltip from '../components/InfoTooltip'
import type { RankingRow } from '../types'
import type { Filters } from '../types'

interface Props { filters: Filters; filterRows: (rows: RankingRow[]) => RankingRow[] }

type Tab = 'top' | 'dev' | 'concentration'

const TAB_META: Record<Tab, { label: string; description: string; criteria: string }> = {
  top: {
    label: 'Top Performers',
    description: 'Personas ordenadas de mayor a menor puntaje de assessment (escala 0–3, modelo Dreyfus). Incluye todos los assessments finalizados del período seleccionado.',
    criteria: 'Cómo interpretar: un puntaje ≥2.2 (Proficient) indica dominio sólido del rol. Puntaje ≥2.6 (Expert) es referencia de persona clave.',
  },
  dev: {
    label: 'Necesitan desarrollo',
    description: 'Personas cuyo apego al perfil requerido es menor al 75%. El apego mide qué tan cerca está el puntaje obtenido del puntaje exigido por el perfil del rol (meta = 100%).',
    criteria: 'Cómo interpretar: priorizar a quienes están por debajo del 60% — representan brechas críticas que requieren plan de desarrollo inmediato.',
  },
  concentration: {
    label: 'Riesgo de expertise',
    description: 'Capabilities donde el número de personas que cumplen o superan el perfil requerido (apego ≥100%) es reducido, generando dependencia de personas clave.',
    criteria: 'Cómo interpretar: si una capability tiene solo 1–2 expertos y es crítica para la operación, cualquier ausentismo o rotación representa un riesgo operacional alto.',
  },
}

const RISK_LEGEND = [
  {
    level: 'alto',
    color: '#C62828',
    bg: '#FFEBEE',
    threshold: '≤2 personas con apego ≥100%',
    meaning: 'Dependencia crítica. La ausencia de una persona puede paralizar capacidades clave del área.',
  },
  {
    level: 'medio',
    color: '#F57F17',
    bg: '#FFFDE7',
    threshold: '3–5 personas con apego ≥100%',
    meaning: 'Riesgo moderado. Hay redundancia mínima pero cualquier movimiento de 2+ personas genera vulnerabilidad.',
  },
  {
    level: 'bajo',
    color: '#2E7D32',
    bg: '#E8F5E9',
    threshold: '≥6 personas con apego ≥100%',
    meaning: 'Riesgo aceptable. La capability tiene suficiente cobertura para absorber rotación normal.',
  },
]

const TIPS = {
  puntaje: 'Puntaje Dreyfus (escala 0–3).\n0–0.5 = Novice\n0.5–1.0 = Advanced Beginner\n1.0–1.5 = Competent\n1.5–2.5 = Proficient\n2.5–3.0 = Expert',
  apego: '% Apego = Puntaje assessment / Puntaje requerido perfil.\n100% = iguala exactamente el perfil del rol.\n>100% = supera el perfil requerido.',
}

export default function Rankings({ filterRows }: Props) {
  const { data: rankings, loading } = useRankings()
  const [tab, setTab] = useState<Tab>('top')
  const [search, setSearch] = useState('')

  if (loading || !rankings) return <Loader />

  const topRows = filterRows(rankings.all)
    .filter(r => !search || r.nombre.toLowerCase().includes(search.toLowerCase()) || r.bu.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 50)

  const devRows = filterRows(rankings.needs_development)
    .filter(r => !search || r.nombre.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 50)

  const concEntries = Object.entries(rankings.expertise_concentration)
    .sort((a, b) => {
      const riskOrder = { alto: 0, medio: 1, bajo: 2 }
      return riskOrder[a[1].risk] - riskOrder[b[1].risk]
    })

  const meta = TAB_META[tab]

  function exportRows() {
    const rows = tab === 'top' ? topRows : devRows
    downloadCsv(`rankings_${tab}.csv`, rows.map((r, i) => ({
      '#': i + 1,
      Nombre: r.nombre,
      BU: r.bu,
      Área: r.area,
      Período: `${r.año}-P${r.periodo}`,
      Puntaje: r.puntaje,
      'Apego %': pct(r.apego),
      Nivel: r.nivel,
      'Revisó reporte': r.reviso_reporte,
    })))
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[#1E293B]">Rankings e Insights</h2>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F1F5F9] rounded-xl p-1 w-fit flex-wrap">
        {(Object.entries(TAB_META) as [Tab, typeof TAB_META[Tab]][]).map(([id, m]) => (
          <button key={id} onClick={() => { setTab(id); setSearch('') }}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors
              ${tab === id ? 'bg-white text-[#1E3A5F] shadow-sm' : 'text-[#64748B] hover:text-[#1E293B]'}`}>
            {m.label}
            {id === 'dev' && ` (${rankings.needs_development.length})`}
            {id === 'concentration' && ` (${concEntries.filter(([,i]) => i.risk === 'alto').length} alto)`}
          </button>
        ))}
      </div>

      {/* Tab description */}
      <div className="bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] p-4 space-y-1">
        <p className="text-xs text-[#475569]"><span className="font-semibold text-[#1E293B]">Cómo se construye: </span>{meta.description}</p>
        <p className="text-xs text-[#475569]"><span className="font-semibold text-[#1E293B]">Cómo interpretar: </span>{meta.criteria}</p>
      </div>

      {(tab === 'top' || tab === 'dev') && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <div className="flex gap-3 mb-4">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar nombre o BU..."
              className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#1E3A5F] w-full sm:w-64" />
            <span className="text-xs text-[#94A3B8] self-center shrink-0">
              {tab === 'top' ? topRows.length : devRows.length} resultados
            </span>
            <button onClick={exportRows}
              className="text-xs text-[#64748B] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 hover:bg-[#F8FAFC] transition-colors shrink-0">
              ↓ CSV
            </button>
          </div>

          {tab === 'dev' && (
            <div className="mb-3 p-3 bg-[#FFEBEE] rounded-lg border border-[#FFCDD2]">
              <p className="text-xs text-[#C62828] font-medium">
                Personas con apego &lt;75% al perfil requerido. Requieren plan de desarrollo prioritario.
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0]">
                  {(['#', 'Nombre', 'BU', 'Área', 'Período'] as const).map(h => (
                    <th key={h} className="text-left py-2 pr-4 text-[#64748B] font-medium">{h}</th>
                  ))}
                  <th className="text-left py-2 pr-4 text-[#64748B] font-medium">
                    Puntaje<InfoTooltip text={TIPS.puntaje} />
                  </th>
                  <th className="text-left py-2 pr-4 text-[#64748B] font-medium">
                    Apego<InfoTooltip text={TIPS.apego} />
                  </th>
                  {(['Nivel', 'Reporte'] as const).map(h => (
                    <th key={h} className="text-left py-2 pr-4 text-[#64748B] font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(tab === 'top' ? topRows : devRows).map((r, i) => {
                  const badge = apegoBadge(r.apego)
                  return (
                    <tr key={`${r.nombre}-${r.año}-${r.periodo}`} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                      <td className="py-2 pr-4 text-[#94A3B8]">{i + 1}</td>
                      <td className="py-2 pr-4 font-medium text-[#1E293B] max-w-[160px]">{r.nombre}</td>
                      <td className="py-2 pr-4 text-[#64748B]">{r.bu}</td>
                      <td className="py-2 pr-4 text-[#64748B]">{r.area}</td>
                      <td className="py-2 pr-4 text-[#64748B]">{r.año}-P{r.periodo}</td>
                      <td className="py-2 pr-4 font-medium text-[#1E293B]">{score(r.puntaje)}</td>
                      <td className="py-2 pr-4 font-medium" style={{ color: badge.color }}>{pct(r.apego)}</td>
                      <td className="py-2 pr-4">
                        <span className="px-2 py-0.5 rounded-full text-white text-xs font-medium" style={{ background: nivelBadgeColor(r.nivel) }}>
                          {r.nivel}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <span className={`text-xs ${r.reviso_reporte === 'Sí' ? 'text-[#2E7D32]' : 'text-[#94A3B8]'}`}>
                          {r.reviso_reporte === 'Sí' ? '✓' : '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'concentration' && (
        <>
          {/* Risk level legend */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {RISK_LEGEND.map(r => (
              <div key={r.level} className="rounded-xl border p-3" style={{ borderColor: r.color + '40', background: r.bg }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize"
                    style={{ background: r.bg, color: r.color, border: `1px solid ${r.color}` }}>
                    Riesgo {r.level}
                  </span>
                  <span className="text-xs font-medium" style={{ color: r.color }}>{r.threshold}</span>
                </div>
                <p className="text-xs" style={{ color: r.color + 'CC' }}>{r.meaning}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <div className="space-y-3">
              {concEntries.map(([cap, info]) => {
                const risk = RISK_LEGEND.find(r => r.level === info.risk)!
                return (
                  <div key={cap} className="border border-[#E2E8F0] rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-[#1E293B]">{cap}</p>
                        <p className="text-xs text-[#94A3B8] mt-0.5">
                          {info.n_experts === 0
                            ? 'Sin personas que cumplan el perfil'
                            : `${info.n_experts} persona${info.n_experts !== 1 ? 's' : ''} con apego ≥100%`}
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold capitalize shrink-0"
                        style={{ background: risk.bg, color: risk.color }}>
                        Riesgo {info.risk}
                      </span>
                    </div>
                    {info.experts.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {info.experts.map(e => (
                          <span key={e} className="px-2 py-0.5 bg-[#F1F5F9] text-[#475569] rounded-full text-xs">{e}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Loader() {
  return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-[#1E3A5F] border-t-transparent rounded-full animate-spin" /></div>
}
