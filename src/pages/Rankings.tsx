import { useState } from 'react'
import { useRankings } from '../hooks/useData'
import { pct, score, apegoBadge, nivelBadgeColor } from '../utils/format'
import type { RankingRow } from '../types'
import type { Filters } from '../types'

interface Props { filters: Filters; filterRows: (rows: RankingRow[]) => RankingRow[] }

type Tab = 'top' | 'dev' | 'concentration'

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
    .filter(([, info]) => info.risk === 'alto')
    .sort((a, b) => a[1].n_experts - b[1].n_experts)

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[#1E293B]">Rankings e Insights</h2>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F1F5F9] rounded-xl p-1 w-fit">
        {([
          { id: 'top', label: 'Top performers' },
          { id: 'dev', label: `Necesitan desarrollo (${rankings.needs_development.length})` },
          { id: 'concentration', label: `Riesgo expertise (${concEntries.length})` },
        ] as { id: Tab; label: string }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors
              ${tab === t.id ? 'bg-white text-[#1E3A5F] shadow-sm' : 'text-[#64748B] hover:text-[#1E293B]'}`}>
            {t.label}
          </button>
        ))}
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
          </div>

          {tab === 'dev' && (
            <div className="mb-3 p-3 bg-[#FFEBEE] rounded-lg border border-[#FFCDD2]">
              <p className="text-xs text-[#C62828] font-medium">
                Personas con apego &lt;60% al perfil requerido. Benchmark org. madura: max 25-30% en niveles iniciales.
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0]">
                  {['#', 'Nombre', 'BU', 'Área', 'Periodo', 'Puntaje', 'Apego', 'Nivel', 'Reporte'].map(h => (
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
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <div className="mb-3 p-3 bg-[#FFF8E1] rounded-lg border border-[#FFE082]">
            <p className="text-xs text-[#F57F17] font-medium">
              Capabilities con ≤2 personas de alto dominio. Riesgo crítico de dependencia de persona clave.
            </p>
          </div>
          <div className="space-y-3">
            {concEntries.map(([cap, info]) => (
              <div key={cap} className="border border-[#E2E8F0] rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-[#1E293B]">{cap}</p>
                    <p className="text-xs text-[#94A3B8] mt-0.5">
                      {info.n_experts === 0 ? 'Sin expertos identificados' : `${info.n_experts} experto${info.n_experts !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FFEBEE] text-[#C62828] shrink-0">
                    Riesgo alto
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
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Loader() {
  return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-[#1E3A5F] border-t-transparent rounded-full animate-spin" /></div>
}
