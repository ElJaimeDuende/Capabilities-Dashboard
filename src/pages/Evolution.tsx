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
  const [selectedPerson, setSelectedPerson] = useState<string>('__todos__')

  if (loading || !evolution) return <Loader />

  const isAnual = filters.granularidad === 'año'

  // Distribution chart data — recompute from scatter when filters are active
  const hasActiveFilter = filters.bus.length > 0 || filters.work_locations.length > 0 ||
    filters.areas.length > 0 || filters.roles.length > 0 || filters.años.length > 0 ||
    (filters.granularidad === 'periodo' && !!filters.periodo)

  const distData = (() => {
    if (!hasActiveFilter) {
      return isAnual
        ? evolution.by_year.map(y => ({
            label: y.label,
            ...Object.fromEntries(NIVEL_ORDER.map(n => [n, Math.round((y.nivel_pct[n] ?? 0) * 100)])),
          }))
        : evolution.by_period.map(p => ({
            label: p.label,
            ...Object.fromEntries(NIVEL_ORDER.map(n => [n, Math.round((p.nivel_pct[n] ?? 0) * 100)])),
          }))
    }

    // Filter scatter points by active filters
    const pts = (evolution.scatter ?? []).filter(p => {
      if (filters.bus.length && !filters.bus.includes(p.bu)) return false
      if (filters.work_locations.length && !filters.work_locations.includes(p.funcion)) return false
      if (filters.areas.length && !filters.areas.includes(p.area)) return false
      if (filters.roles.length && !filters.roles.includes(p.rol)) return false
      if (filters.granularidad === 'periodo') {
        if (filters.periodo && p.label !== filters.periodo) return false
      } else {
        if (filters.años.length && !filters.años.includes(p.año)) return false
      }
      return true
    })

    // Group by label and compute nivel distribution
    const groups: Record<string, Record<string, number>> = {}
    for (const p of pts) {
      const key = isAnual ? String(p.año) : p.label
      if (!groups[key]) groups[key] = {}
      groups[key][p.nivel] = (groups[key][p.nivel] ?? 0) + 1
    }

    // Order labels same as pre-aggregated data
    const orderedLabels = isAnual
      ? evolution.by_year.map(y => y.label).filter(l => groups[l])
      : evolution.by_period.map(p => p.label).filter(l => groups[l])

    return orderedLabels.map(label => {
      const counts = groups[label] ?? {}
      const total = Object.values(counts).reduce((s, c) => s + c, 0)
      return {
        label,
        ...Object.fromEntries(NIVEL_ORDER.map(n => [n, total > 0 ? Math.round((counts[n] ?? 0) / total * 100) : 0])),
      }
    })
  })()

  // BU trend — recompute from scatter when area or work_location filter is active
  const buTrend = (() => {
    const hasAreaFilter = filters.areas.length > 0
    const hasWlFilter = filters.work_locations.length > 0
    const buFilter = filters.bus

    if (!hasAreaFilter && !hasWlFilter) {
      return isAnual
        ? evolution.by_bu_annual.filter(b => !buFilter.length || buFilter.includes(b.bu))
        : evolution.by_bu.filter(b => !buFilter.length || buFilter.includes(b.bu))
    }

    // Recompute from scatter filtered by area/wl (and BU if set)
    const pts = (evolution.scatter ?? []).filter(p =>
      (!buFilter.length || buFilter.includes(p.bu)) &&
      (!filters.areas.length || filters.areas.includes(p.area)) &&
      (!filters.work_locations.length || filters.work_locations.includes(p.funcion))
    )

    if (isAnual) {
      const byBuYear: Record<string, Record<number, { sum: number; n: number }>> = {}
      for (const p of pts) {
        if (!byBuYear[p.bu]) byBuYear[p.bu] = {}
        if (!byBuYear[p.bu][p.año]) byBuYear[p.bu][p.año] = { sum: 0, n: 0 }
        byBuYear[p.bu][p.año].sum += p.puntaje ?? 0
        byBuYear[p.bu][p.año].n++
      }
      return Object.entries(byBuYear).map(([bu, yearMap]) => ({
        bu,
        years: Object.entries(yearMap)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([año, d]) => ({
            label: String(año), año: Number(año), n: d.n,
            puntaje_promedio: d.n > 0 ? Math.round(d.sum / d.n * 100) / 100 : 0,
            apego_promedio: 0,
          })),
      }))
    } else {
      const byBuPeriod: Record<string, Record<string, { sum: number; n: number; año: number; periodo: number }>> = {}
      for (const p of pts) {
        if (!byBuPeriod[p.bu]) byBuPeriod[p.bu] = {}
        if (!byBuPeriod[p.bu][p.label]) byBuPeriod[p.bu][p.label] = { sum: 0, n: 0, año: p.año, periodo: p.periodo }
        byBuPeriod[p.bu][p.label].sum += p.puntaje ?? 0
        byBuPeriod[p.bu][p.label].n++
      }
      return Object.entries(byBuPeriod).map(([bu, periodMap]) => ({
        bu,
        periods: Object.entries(periodMap)
          .sort(([, a], [, b]) => a.año !== b.año ? a.año - b.año : a.periodo - b.periodo)
          .map(([label, d]) => ({
            label, año: d.año, periodo: d.periodo, n: d.n,
            puntaje_promedio: d.n > 0 ? Math.round(d.sum / d.n * 100) / 100 : 0,
            apego_promedio: 0,
          })),
      }))
    }
  })()

  const buHasMultiple = isAnual
    ? (buTrend as typeof evolution.by_bu_annual).some(b => b.years.length > 1)
    : (buTrend as typeof evolution.by_bu).some(b => b.periods.length > 1)

  const mejoras = evolution.top_mejoras.slice(0, 8)
  const retrocesos = evolution.top_retrocesos.slice(0, 8)

  // Per-person: filter by active filters including year
  const filteredPersons: PersonEvolution[] = (evolution.by_person ?? []).filter(p => {
    if (filters.bus.length && !filters.bus.includes(p.bu)) return false
    if (filters.work_locations.length && p.work_location && !filters.work_locations.includes(p.work_location)) return false
    if (filters.roles.length && !filters.roles.includes(p.rol)) return false
    if (filters.areas.length && !filters.areas.includes(p.area)) return false
    if (filters.años.length && !p.periods.some(per => filters.años.includes(per.año))) return false
    return true
  })

  // activePerson: '__todos__' = aggregate view, '' = none, or a specific name
  const activePerson = selectedPerson === '__todos__'
    ? '__todos__'
    : (selectedPerson && filteredPersons.find(p => p.nombre === selectedPerson) ? selectedPerson : '__todos__')

  const rawPersonData = activePerson && activePerson !== '__todos__'
    ? filteredPersons.find(p => p.nombre === activePerson)
    : undefined
  // Filter periods by year if year filter is active
  const personData = rawPersonData && filters.años.length > 0
    ? { ...rawPersonData, periods: rawPersonData.periods.filter(per => filters.años.includes(per.año)) }
    : rawPersonData

  // "Todos" aggregate: avg puntaje and apego per period across all filteredPersons
  const todosData = (() => {
    if (activePerson !== '__todos__') return null
    const byLabel: Record<string, { sumPuntaje: number; sumApego: number; n: number; año: number; periodo: number }> = {}
    for (const p of filteredPersons) {
      const periods = filters.años.length > 0
        ? p.periods.filter(per => filters.años.includes(per.año))
        : p.periods
      for (const per of periods) {
        const key = per.label
        if (!byLabel[key]) byLabel[key] = { sumPuntaje: 0, sumApego: 0, n: 0, año: per.año, periodo: per.periodo }
        byLabel[key].sumPuntaje += per.puntaje ?? 0
        byLabel[key].sumApego  += per.apego  ?? 0
        byLabel[key].n++
      }
    }
    return Object.entries(byLabel)
      .sort(([, a], [, b]) => a.año !== b.año ? a.año - b.año : a.periodo - b.periodo)
      .map(([label, d]) => ({
        label,
        año: d.año,
        periodo: d.periodo,
        puntaje: d.n > 0 ? Math.round(d.sumPuntaje / d.n * 100) / 100 : 0,
        apego:   d.n > 0 ? Math.round(d.sumApego   / d.n * 10000) / 10000 : 0,
        n: d.n,
      }))
  })()

  function exportPersonTable() {
    if (activePerson === '__todos__' && todosData) {
      downloadCsv('evolucion_todos.csv', todosData.map(p => ({
        Período: p.label,
        N: p.n,
        'Puntaje promedio': p.puntaje,
        'Apego promedio %': pct(p.apego),
      })))
    } else if (personData) {
      downloadCsv(`evolucion_${personData.nombre}.csv`, personData.periods.map(p => ({
        Período: p.label,
        Puntaje: p.puntaje,
        'Apego %': pct(p.apego),
        Nivel: p.nivel,
      })))
    }
  }

  function exportAllFiltered() {
    const rows: Record<string, unknown>[] = []
    for (const p of filteredPersons) {
      const periods = filters.años.length > 0
        ? p.periods.filter(per => filters.años.includes(per.año))
        : p.periods
      for (const per of periods) {
        rows.push({
          Nombre: p.nombre,
          BU: p.bu,
          Área: p.area,
          Rol: p.rol,
          [isAnual ? 'Año' : 'Período']: isAnual ? per.año : per.label,
          Puntaje: per.puntaje,
          'Apego %': pct(per.apego),
          Nivel: per.nivel,
        })
      }
    }
    downloadCsv('evolucion_personas_filtradas.csv', rows)
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
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h3 className="text-sm font-semibold text-[#1E293B]">
            Distribución de niveles {isAnual ? 'por año' : 'por periodo'}
          </h3>
          {[
            ...filters.bus.map(v => ({ label: v, key: 'bu-' + v })),
            ...filters.work_locations.map(v => ({ label: v, key: 'wl-' + v })),
            ...filters.areas.map(v => ({ label: v, key: 'area-' + v })),
            ...filters.años.map(v => ({ label: String(v), key: 'año-' + v })),
            ...(filters.periodo ? [{ label: filters.periodo, key: 'periodo' }] : []),
          ].map(f => (
            <span key={f.key} className="px-2 py-0.5 bg-[#EFF6FF] text-[#1E3A5F] rounded-full text-[10px] font-medium border border-[#BFDBFE]">
              {f.label}
            </span>
          ))}
        </div>
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
        <BuTrendPanel
          buTrend={buTrend}
          isAnual={isAnual}
          scatter={evolution.scatter ?? []}
          filters={filters}
        />
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
                className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#1E3A5F] max-w-[220px]">
                <option value="__todos__">Todos ({filteredPersons.length})</option>
                {filteredPersons.map(p => (
                  <option key={p.nombre} value={p.nombre}>{p.nombre}</option>
                ))}
              </select>
              {activePerson !== '__todos__' && (
                <button onClick={() => setSelectedPerson('__todos__')} title="Volver a Todos"
                  className="text-xs text-[#64748B] border border-[#E2E8F0] rounded-lg px-2 py-1.5 hover:bg-[#F8FAFC] transition-colors shrink-0">
                  ⌫
                </button>
              )}
              {(activePerson === '__todos__' ? todosData && todosData.length > 0 : !!personData) && (
                <button onClick={exportPersonTable} title={activePerson === '__todos__' ? 'Exportar promedio agregado' : 'Exportar persona seleccionada'}
                  className="text-xs text-[#64748B] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 hover:bg-[#F8FAFC] transition-colors shrink-0">
                  ↓ CSV
                </button>
              )}
              <button onClick={exportAllFiltered} title="Exportar todos los registros filtrados"
                className="text-xs text-[#64748B] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 hover:bg-[#F8FAFC] transition-colors shrink-0 whitespace-nowrap">
                ↓ CSV completo
              </button>
            </div>
          </div>

          {/* Todos: aggregate chart + table */}
          {activePerson === '__todos__' && todosData && todosData.length > 0 && (
            <>
              {todosData.length < 2 ? (
                <p className="text-xs text-[#94A3B8] italic">Solo hay datos de un período.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={todosData}>
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748B' }} />
                    <YAxis yAxisId="puntaje" domain={[0, 3]} tick={{ fontSize: 10, fill: '#64748B' }} />
                    <YAxis yAxisId="apego" orientation="right" domain={[0, 1.5]}
                      tick={{ fontSize: 10, fill: '#64748B' }}
                      tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
                    <Tooltip formatter={(v: unknown, name: unknown) =>
                      name === 'Apego prom.' ? pct(v as number) : score(v as number)
                    } />
                    <Legend />
                    <ReferenceLine yAxisId="apego" y={1} stroke="#1E3A5F" strokeDasharray="4 2"
                      label={{ value: '100%', fill: '#1E3A5F', fontSize: 9, position: 'insideTopRight' }} />
                    <Line yAxisId="puntaje" dataKey="puntaje" name="Puntaje prom."
                      stroke="#1E3A5F" strokeWidth={2} dot={{ r: 5 }} connectNulls />
                    <Line yAxisId="apego" dataKey="apego" name="Apego prom."
                      stroke="#2E7D32" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 5 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0]">
                      {[isAnual ? 'Año' : 'Período', 'N', 'Puntaje prom.', 'Apego prom.', 'Δ Puntaje'].map(h => (
                        <th key={h} className="text-left py-2 pr-4 text-[#64748B] font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {todosData.map((p, i) => {
                      const prev = todosData[i - 1]
                      const d = prev != null ? p.puntaje - prev.puntaje : null
                      return (
                        <tr key={p.label} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                          <td className="py-2 pr-4 font-medium text-[#1E293B]">{isAnual ? p.año : p.label}</td>
                          <td className="py-2 pr-4 text-[#64748B]">{p.n}</td>
                          <td className="py-2 pr-4 text-[#1E293B]">{score(p.puntaje)}</td>
                          <td className="py-2 pr-4 font-medium" style={{
                            color: p.apego >= 1 ? '#2E7D32' : p.apego >= 0.75 ? '#F57F17' : '#C62828'
                          }}>{pct(p.apego)}</td>
                          <td className="py-2 pr-4 font-medium" style={{
                            color: d == null ? '#94A3B8' : d > 0 ? '#2E7D32' : d < 0 ? '#C62828' : '#64748B'
                          }}>{d == null ? '—' : delta(d)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Single person view */}
          {personData && activePerson !== '__todos__' && (
            <>
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

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0]">
                      {[isAnual ? 'Año' : 'Período', 'Puntaje', 'Apego', 'Nivel'].map(h => (
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
                          <td className="py-2 pr-4 font-medium text-[#1E293B]">{isAnual ? p.año : p.label}</td>
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

function BuTrendPanel({ buTrend, isAnual, scatter, filters }: {
  buTrend: any[]
  isAnual: boolean
  scatter: any[]
  filters: Filters
}) {
  // Compute KPIs from scatter filtered by current BU + area + wl filters
  const pts = scatter.filter(p =>
    (!filters.bus.length || filters.bus.includes(p.bu)) &&
    (!filters.areas.length || filters.areas.includes(p.area)) &&
    (!filters.work_locations.length || filters.work_locations.includes(p.funcion))
  )

  // Get sorted unique years/periods
  const años = [...new Set(pts.map(p => p.año))].sort()
  const prevYear = años[años.length - 2]
  const lastYear = años[años.length - 1]

  // Overall delta
  const byYear = (yr: number) => pts.filter(p => p.año === yr)
  const avgPuntaje = (arr: any[]) => arr.length ? arr.reduce((s, p) => s + (p.puntaje ?? 0), 0) / arr.length : null
  const prevAvg = prevYear != null ? avgPuntaje(byYear(prevYear)) : null
  const lastAvg = lastYear != null ? avgPuntaje(byYear(lastYear)) : null
  const overallDelta = prevAvg != null && lastAvg != null ? lastAvg - prevAvg : null
  const deltaRelPct = overallDelta != null && prevAvg ? (overallDelta / prevAvg) * 100 : null
  const trend = deltaRelPct == null ? null : deltaRelPct > 10 ? 'up' : deltaRelPct < -10 ? 'down' : 'equal'

  // BU deltas
  const buDeltas = buTrend
    .map(b => {
      const years = isAnual ? b.years : b.periods
      if (years.length < 2) return null
      const last = years[years.length - 1]
      const prev = years[years.length - 2]
      const delta = last.puntaje_promedio - prev.puntaje_promedio
      return { bu: b.bu, delta, n: last.n ?? 0 }
    })
    .filter(Boolean) as { bu: string; delta: number; n: number }[]

  buDeltas.sort((a, b) => b.delta - a.delta)
  const topBu = buDeltas[0]
  const bottomBu = buDeltas[buDeltas.length - 1]

  // Area deltas (from scatter, filtered BUs)
  const areaMap: Record<string, Record<number, { sum: number; n: number }>> = {}
  for (const p of pts) {
    if (!p.area) continue
    if (!areaMap[p.area]) areaMap[p.area] = {}
    if (!areaMap[p.area][p.año]) areaMap[p.area][p.año] = { sum: 0, n: 0 }
    areaMap[p.area][p.año].sum += p.puntaje ?? 0
    areaMap[p.area][p.año].n++
  }
  const areaDeltas = Object.entries(areaMap)
    .map(([area, byYr]) => {
      const prev = byYr[prevYear]
      const last = byYr[lastYear]
      if (!prev || !last) return null
      const delta = (last.sum / last.n) - (prev.sum / prev.n)
      return { area, delta }
    })
    .filter(Boolean) as { area: string; delta: number }[]
  areaDeltas.sort((a, b) => b.delta - a.delta)
  const topArea = areaDeltas[0]
  const bottomArea = areaDeltas[areaDeltas.length - 1]

  // BU mayor participación (last year)
  const buParticipacion: Record<string, number> = {}
  for (const p of pts.filter(p => p.año === lastYear)) {
    buParticipacion[p.bu] = (buParticipacion[p.bu] ?? 0) + 1
  }
  const topParticipacion = Object.entries(buParticipacion).sort((a, b) => b[1] - a[1])[0]

  const totalRecords = pts.length

  const TREND_ICON: Record<string, string> = { up: '▲', equal: '→', down: '▼' }

  function KpiRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
      <div className="flex flex-col py-2 border-b border-[#F1F5F9] last:border-0">
        <span className="text-[10px] text-[#94A3B8] uppercase tracking-wide leading-tight">{label}</span>
        <span className="text-sm font-semibold text-[#1E293B] mt-0.5">{value}</span>
        {sub && <span className="text-[10px] text-[#64748B]">{sub}</span>}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
      <h3 className="text-sm font-semibold text-[#1E293B] mb-1">
        Tendencia de puntaje por BU {isAnual ? '(anual)' : '(por periodo)'}
      </h3>
      <p className="text-xs text-[#64748B] mb-4">
        {isAnual ? 'Cambio entre años para BUs con datos en ambos' : 'Cambio entre periodos para BUs con datos en ambos'}
      </p>
      {años.length < 2 && (
        <div className="mb-3 p-3 bg-[#FFF9C4] rounded-lg border border-[#FDD835] text-xs text-[#856404]">
          El filtro activo solo incluye datos de <span className="font-semibold">{años[0] ?? 'un período'}</span>.
          Para ver líneas de tendencia se necesitan datos de al menos dos {isAnual ? 'años' : 'períodos'}.
        </div>
      )}
      <div className="flex gap-4">
        {/* Chart — 50% */}
        <div className="w-1/2 min-w-0">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart>
              <XAxis dataKey="label" type="category" allowDuplicatedCategory={false} tick={{ fontSize: 10, fill: '#64748B' }} />
              <YAxis domain={[1, 3]} tick={{ fontSize: 10, fill: '#64748B' }} />
              <Tooltip formatter={(v: unknown) => (typeof v === 'number' ? v.toFixed(2) : String(v ?? ''))} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {isAnual
                ? buTrend.filter(b => b.years.length > 1).map((b: any, i: number) => (
                    <Line key={b.bu} data={b.years} dataKey="puntaje_promedio" name={b.bu}
                      stroke={`hsl(${i * 37}, 60%, 45%)`} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  ))
                : buTrend.filter(b => b.periods.length > 1).map((b: any, i: number) => (
                    <Line key={b.bu} data={b.periods} dataKey="puntaje_promedio" name={b.bu}
                      stroke={`hsl(${i * 37}, 60%, 45%)`} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  ))
              }
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* KPIs — 50% */}
        <div className="w-1/2 min-w-0 border-l border-[#F1F5F9] pl-4">
          <p className="text-xs font-semibold text-[#1E293B] mb-2">Indicadores</p>
          <div className="space-y-0">
            <KpiRow label="Total registros" value={String(totalRecords)} />
            {overallDelta != null && (
              <KpiRow
                label={`Delta ${prevYear} → ${lastYear}`}
                value={`${trend ? TREND_ICON[trend] : ''} ${overallDelta > 0 ? '+' : ''}${overallDelta.toFixed(2)} pts`}
                sub={`${deltaRelPct! > 0 ? '+' : ''}${deltaRelPct!.toFixed(1)}% — ${trend === 'up' ? 'Mejoró' : trend === 'down' ? 'Empeoró' : 'Sin cambio significativo'}`}
              />
            )}
            {topBu && (
              <KpiRow
                label="BU con más mejora"
                value={topBu.bu}
                sub={`+${topBu.delta.toFixed(2)} pts`}
              />
            )}
            {bottomBu && bottomBu.bu !== topBu?.bu && (
              <KpiRow
                label="BU con menos mejora"
                value={bottomBu.bu}
                sub={`${bottomBu.delta > 0 ? '+' : ''}${bottomBu.delta.toFixed(2)} pts`}
              />
            )}
            {topArea && (
              <KpiRow
                label="Área con más mejora"
                value={topArea.area}
                sub={`+${topArea.delta.toFixed(2)} pts`}
              />
            )}
            {bottomArea && bottomArea.area !== topArea?.area && (
              <KpiRow
                label="Área con menos mejora"
                value={bottomArea.area}
                sub={`${bottomArea.delta > 0 ? '+' : ''}${bottomArea.delta.toFixed(2)} pts`}
              />
            )}
            {topParticipacion && (
              <KpiRow
                label={`BU mayor participación (${lastYear})`}
                value={topParticipacion[0]}
                sub={`${topParticipacion[1]} assessments`}
              />
            )}
          </div>
        </div>
      </div>
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
