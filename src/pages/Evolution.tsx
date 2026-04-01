import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend, ReferenceLine } from 'recharts'
import { useEvolution } from '../hooks/useData'
import { pct, score, delta } from '../utils/format'
import { downloadCsv } from '../utils/csv'
import TendenciasScatter from '../components/TendenciasScatter'
import { NIVEL_ORDER, NIVEL_COLORS } from '../types'
import type { Filters, RankingRow, PersonEvolution } from '../types'

interface Props {
  filters: Filters
  filterRows: (rows: RankingRow[]) => RankingRow[]
}

export default function Evolution({ filters }: Props) {
  const { data: evolution, loading } = useEvolution()
  const [selectedPerson, setSelectedPerson] = useState<string>('')

  if (loading || !evolution) return <Loader />

  const isAnual = filters.granularidad === 'año'

  // Distribution chart data
  const distData = isAnual
    ? evolution.by_year.map(y => ({
        label: y.label,
        ...Object.fromEntries(NIVEL_ORDER.map(n => [n, Math.round((y.nivel_pct[n] ?? 0) * 100)])),
      }))
    : evolution.by_period.map(p => ({
        label: p.label,
        ...Object.fromEntries(NIVEL_ORDER.map(n => [n, Math.round((p.nivel_pct[n] ?? 0) * 100)])),
      }))

  // BU trend
  const buTrend = isAnual
    ? evolution.by_bu_annual.filter(b => !filters.bus.length || filters.bus.includes(b.bu))
    : evolution.by_bu.filter(b => !filters.bus.length || filters.bus.includes(b.bu))

  const buHasMultiple = isAnual
    ? (buTrend as typeof evolution.by_bu_annual).some(b => b.years.length > 1)
    : (buTrend as typeof evolution.by_bu).some(b => b.periods.length > 1)

  const mejoras = evolution.top_mejoras.slice(0, 8)
  const retrocesos = evolution.top_retrocesos.slice(0, 8)

  // Per-person: filter by active filters
  const filteredPersons: PersonEvolution[] = (evolution.by_person ?? []).filter(p =>
    (!filters.bus.length || filters.bus.includes(p.bu)) &&
    (!filters.roles.length || filters.roles.includes(p.rol)) &&
    (!filters.areas.length || filters.areas.includes(p.area))
  )

  const activePerson = selectedPerson && filteredPersons.find(p => p.nombre === selectedPerson)
    ? selectedPerson
    : (filteredPersons[0]?.nombre ?? '')

  const personData = filteredPersons.find(p => p.nombre === activePerson)

  function exportPersonTable() {
    if (!personData) return
    downloadCsv(`evolucion_${personData.nombre}.csv`, personData.periods.map(p => ({
      Período: p.label,
      Puntaje: p.puntaje,
      'Apego %': pct(p.apego),
      Nivel: p.nivel,
    })))
  }

  function exportMovers(type: 'mejoras' | 'retrocesos') {
    const data = type === 'mejoras' ? mejoras : retrocesos
    downloadCsv(`movers_${type}.csv`, data.map(m => ({
      Nombre: m.nombre,
      BU: m.bu,
      Rol: m.rol,
      'Puntaje P1': m.puntaje_p1,
      'Puntaje P2': m.puntaje_p2,
      'Delta puntaje': m.delta_puntaje,
      'Nivel P1': m.nivel_p1,
      'Nivel P2': m.nivel_p2,
    })))
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[#1E293B]">Evolución Temporal</h2>

      {/* Tendencias scatter — first section */}
      {evolution.scatter?.length > 0 && (
        <TendenciasScatter
          data={evolution.scatter}
          thresholds={evolution.scatter_thresholds}
          filters={filters}
        />
      )}

      {/* Distribution over time */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <h3 className="text-sm font-semibold text-[#1E293B] mb-1">
          Distribución de niveles {isAnual ? 'por año' : 'por periodo'}
        </h3>
        <p className="text-xs text-[#64748B] mb-4">Evolución hacia benchmark de organización madura</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={distData} barCategoryGap="30%">
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
            <YAxis unit="%" tick={{ fontSize: 10, fill: '#64748B' }} />
            <Tooltip formatter={(v: unknown) => `${v}%`} />
            {NIVEL_ORDER.map(n => (
              <Bar key={n} dataKey={n} stackId="a" fill={NIVEL_COLORS[n]} name={n} />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2 justify-center">
          {NIVEL_ORDER.map(n => (
            <div key={n} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: NIVEL_COLORS[n] }} />
              <span className="text-xs text-[#64748B]">{n}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Movers — only meaningful in period mode */}
      {!isAnual && (
        evolution.movers.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-8 text-center">
            <p className="text-[#64748B] text-sm">No hay participantes con datos en ambos periodos para comparar evolución.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MoverTable title="Top mejoras" data={mejoras} positive onExport={() => exportMovers('mejoras')} />
            <MoverTable title="Top retrocesos" data={retrocesos} positive={false} onExport={() => exportMovers('retrocesos')} />
          </div>
        )
      )}

      {/* BU trend */}
      {buHasMultiple && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <h3 className="text-sm font-semibold text-[#1E293B] mb-1">
            Tendencia de puntaje por BU {isAnual ? '(anual)' : '(por periodo)'}
          </h3>
          <p className="text-xs text-[#64748B] mb-4">
            {isAnual ? 'Cambio entre años para BUs con datos en ambos' : 'Cambio entre periodos para BUs con datos en ambos'}
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart>
              <XAxis dataKey="label" type="category" allowDuplicatedCategory={false} tick={{ fontSize: 10, fill: '#64748B' }} />
              <YAxis domain={[1, 3]} tick={{ fontSize: 10, fill: '#64748B' }} />
              <Tooltip formatter={(v: unknown) => (typeof v === 'number' ? v.toFixed(2) : String(v ?? ''))} />
              <Legend />
              {isAnual
                ? (buTrend as typeof evolution.by_bu_annual)
                    .filter(b => b.years.length > 1)
                    .map((b, i) => (
                      <Line key={b.bu} data={b.years} dataKey="puntaje_promedio" name={b.bu}
                        stroke={`hsl(${i * 37}, 60%, 45%)`} strokeWidth={2} dot={{ r: 4 }} connectNulls />
                    ))
                : (buTrend as typeof evolution.by_bu)
                    .filter(b => b.periods.length > 1)
                    .map((b, i) => (
                      <Line key={b.bu} data={b.periods} dataKey="puntaje_promedio" name={b.bu}
                        stroke={`hsl(${i * 37}, 60%, 45%)`} strokeWidth={2} dot={{ r: 4 }} connectNulls />
                    ))
              }
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-person evolution */}
      {filteredPersons.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[#1E293B]">Evolución por persona</h3>
              <p className="text-xs text-[#64748B]">Puntaje y apego al perfil a lo largo del tiempo</p>
            </div>
            <div className="sm:ml-auto flex items-center gap-2">
              <select value={activePerson} onChange={e => setSelectedPerson(e.target.value)}
                className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#1E3A5F] max-w-[200px]">
                {filteredPersons.map(p => (
                  <option key={p.nombre} value={p.nombre}>{p.nombre}</option>
                ))}
              </select>
              {personData && (
                <button onClick={exportPersonTable}
                  className="text-xs text-[#64748B] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 hover:bg-[#F8FAFC] transition-colors shrink-0">
                  ↓ CSV
                </button>
              )}
            </div>
          </div>

          {personData && (
            <>
              {/* Person metadata */}
              <div className="flex flex-wrap gap-3 text-xs text-[#64748B]">
                <span className="bg-[#F1F5F9] px-2.5 py-1 rounded-full">{personData.bu}</span>
                <span className="bg-[#F1F5F9] px-2.5 py-1 rounded-full">{personData.rol}</span>
                {personData.area && <span className="bg-[#F1F5F9] px-2.5 py-1 rounded-full">{personData.area}</span>}
              </div>

              {personData.periods.length < 2 ? (
                <p className="text-xs text-[#94A3B8] italic">Solo hay datos de un período para esta persona.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={personData.periods}>
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748B' }} />
                    <YAxis yAxisId="puntaje" domain={[0, 3]} tick={{ fontSize: 10, fill: '#64748B' }} />
                    <YAxis yAxisId="apego" orientation="right" domain={[0, 1.5]}
                      tick={{ fontSize: 10, fill: '#64748B' }}
                      tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
                    <Tooltip formatter={(v: unknown, name: unknown) =>
                      name === 'Apego' ? pct(v as number) : score(v as number)
                    } />
                    <Legend />
                    <ReferenceLine yAxisId="apego" y={1} stroke="#1E3A5F" strokeDasharray="4 2"
                      label={{ value: '100%', fill: '#1E3A5F', fontSize: 9, position: 'insideTopRight' }} />
                    <Line yAxisId="puntaje" dataKey="puntaje" name="Puntaje"
                      stroke="#1E3A5F" strokeWidth={2} dot={{ r: 5 }} connectNulls />
                    <Line yAxisId="apego" dataKey="apego" name="Apego"
                      stroke="#2E7D32" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 5 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              )}

              {/* Period table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0]">
                      {['Período', 'Puntaje', 'Apego', 'Nivel'].map(h => (
                        <th key={h} className="text-left py-2 pr-4 text-[#64748B] font-medium">{h}</th>
                      ))}
                      {personData.periods.length > 1 && <th className="text-left py-2 pr-4 text-[#64748B] font-medium">Δ Puntaje</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {personData.periods.map((p, i) => {
                      const prev = personData.periods[i - 1]
                      const d = prev != null ? (p.puntaje ?? 0) - (prev.puntaje ?? 0) : null
                      return (
                        <tr key={p.label} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                          <td className="py-2 pr-4 font-medium text-[#1E293B]">{p.label}</td>
                          <td className="py-2 pr-4 text-[#1E293B]">{score(p.puntaje)}</td>
                          <td className="py-2 pr-4 font-medium" style={{
                            color: (p.apego ?? 0) >= 1 ? '#2E7D32' : (p.apego ?? 0) >= 0.75 ? '#F57F17' : '#C62828'
                          }}>{pct(p.apego)}</td>
                          <td className="py-2 pr-4 text-[#64748B]">{p.nivel}</td>
                          {personData.periods.length > 1 && (
                            <td className="py-2 pr-4 font-medium" style={{
                              color: d == null ? '#94A3B8' : d > 0 ? '#2E7D32' : d < 0 ? '#C62828' : '#64748B'
                            }}>
                              {d == null ? '—' : delta(d)}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function MoverTable({ title, data, positive, onExport }: {
  title: string; data: any[]; positive: boolean; onExport: () => void
}) {
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#1E293B]">{title}</h3>
        {data.length > 0 && (
          <button onClick={onExport}
            className="text-xs text-[#64748B] border border-[#E2E8F0] rounded-lg px-2.5 py-1 hover:bg-[#F8FAFC] transition-colors">
            ↓ CSV
          </button>
        )}
      </div>
      {data.length === 0 ? (
        <p className="text-xs text-[#94A3B8]">Sin datos suficientes</p>
      ) : (
        <div className="space-y-2">
          {data.map((m, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-[#F1F5F9] last:border-0">
              <span className="text-lg font-bold shrink-0" style={{ color: positive ? '#2E7D32' : '#C62828' }}>
                {positive ? '▲' : '▼'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[#1E293B] truncate">{m.nombre}</p>
                <p className="text-xs text-[#64748B]">{m.bu} · {m.rol}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold" style={{ color: positive ? '#2E7D32' : '#C62828' }}>
                  {delta(m.delta_puntaje)}
                </p>
                <p className="text-xs text-[#94A3B8]">{m.nivel_p2} → {m.nivel_p1}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Loader() {
  return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-[#1E3A5F] border-t-transparent rounded-full animate-spin" /></div>
}
