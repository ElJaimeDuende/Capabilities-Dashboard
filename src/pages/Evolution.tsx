import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts'
import { useEvolution } from '../hooks/useData'
import { delta } from '../utils/format'
import { NIVEL_ORDER, NIVEL_COLORS } from '../types'
import type { Filters } from '../types'

interface Props { filters: Filters }

export default function Evolution({ filters }: Props) {
  const { data: evolution, loading } = useEvolution()

  if (loading || !evolution) return <Loader />

  // Period distribution stacked bar
  const distData = evolution.by_period.map(p => ({
    label: p.label,
    ...Object.fromEntries(NIVEL_ORDER.map(n => [n, Math.round((p.nivel_pct[n] ?? 0) * 100)])),
  }))

  // BU trend
  const buData = evolution.by_bu
    .filter(b => !filters.bus.length || filters.bus.includes(b.bu))

  // Movers
  const mejoras = evolution.top_mejoras.slice(0, 8)
  const retrocesos = evolution.top_retrocesos.slice(0, 8)

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[#1E293B]">Evolución Temporal</h2>

      {evolution.movers.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-8 text-center">
          <p className="text-[#64748B] text-sm">No hay participantes con datos en ambos periodos para comparar evolución.</p>
        </div>
      ) : (
        <>
          {/* Nivel distribution over time */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <h3 className="text-sm font-semibold text-[#1E293B] mb-1">Distribución de niveles por periodo</h3>
            <p className="text-xs text-[#64748B] mb-4">Evolución hacia benchmark de organización madura</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={distData} barCategoryGap="30%">
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis unit="%" tick={{ fontSize: 10, fill: '#64748B' }} />
                <Tooltip formatter={(v: any) => `${v}%`} />
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

          {/* Movers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MoverTable title="Top mejoras" data={mejoras} positive />
            <MoverTable title="Top retrocesos" data={retrocesos} positive={false} />
          </div>
        </>
      )}

      {/* BU trend */}
      {buData.length > 0 && buData.some(b => b.periods.length > 1) && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <h3 className="text-sm font-semibold text-[#1E293B] mb-1">Tendencia de puntaje por BU</h3>
          <p className="text-xs text-[#64748B] mb-4">Cambio entre periodos para BUs con datos en ambos</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart>
              <XAxis dataKey="label" type="category" allowDuplicatedCategory={false} tick={{ fontSize: 10, fill: '#64748B' }} />
              <YAxis domain={[1, 3]} tick={{ fontSize: 10, fill: '#64748B' }} />
              <Tooltip formatter={(v: any) => v.toFixed(2)} />
              <Legend />
              {buData.filter(b => b.periods.length > 1).map((b, i) => (
                <Line key={b.bu} data={b.periods} dataKey="puntaje_promedio" name={b.bu}
                  stroke={`hsl(${i * 37}, 60%, 45%)`} strokeWidth={2} dot={{ r: 4 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function MoverTable({ title, data, positive }: { title: string; data: any[]; positive: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
      <h3 className="text-sm font-semibold text-[#1E293B] mb-3">{title}</h3>
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
                <p className="text-xs text-[#94A3B8]">
                  {m.nivel_p2} → {m.nivel_p1}
                </p>
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
