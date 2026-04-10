import { useState, useMemo, useEffect, useRef } from 'react'
import {
  ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea, ReferenceLine, Cell, Legend,
} from 'recharts'
import { pct } from '../utils/format'
import { downloadCsv } from '../utils/csv'
import CopyChartBtn from './CopyChartBtn'
import type { ScatterPoint, ScatterThresholds, Filters } from '../types'

interface Props {
  data: ScatterPoint[]
  thresholds: ScatterThresholds
  filters: Filters
}

const TEND_COLOR: Record<string, string> = {
  mejora:   '#2E7D32',
  igual:    '#F57F17',
  empeora:  '#C62828',
  nuevo:    '#1E3A5F',
}

const TEND_LABEL: Record<string, string> = {
  mejora:   'Mejora',
  igual:    'Igual (±4%)',
  empeora:  'Empeora',
  nuevo:    'Primer assmt',
}

const ZONES = [
  {
    id: 'no_learning',
    label: 'No learning',
    fill: '#FFCDD2',
    opacity: 0.55,
    desc: 'Alta antigüedad + sin avance — riesgo de estancamiento',
  },
  {
    id: 'new_in_position',
    label: 'New in position',
    fill: '#FFF9C4',
    opacity: 0.65,
    desc: 'Poca antigüedad + aún sin mejora — normal en nuevos',
  },
  {
    id: 'growth_mindset',
    label: 'Growth mindset',
    fill: '#C8E6C9',
    opacity: 0.55,
    desc: 'Antigüedad media + creciendo — desarrollo activo',
  },
  {
    id: 'ready',
    label: 'Ready for next challenge',
    fill: '#BBDEFB',
    opacity: 0.55,
    desc: 'Alta antigüedad + alto apego — listos para más responsabilidad',
  },
  {
    id: 'high_potential',
    label: 'High potential',
    fill: '#E1BEE7',
    opacity: 0.65,
    desc: 'Poca antigüedad + ya alto apego — talento emergente',
  },
]

function getZone(pt: ScatterPoint, x: number, yLow: number, yHigh: number): string {
  const ax = pt.apego_pct
  const m  = pt.meses_rol ?? 0
  if (ax < x && m >= yLow)  return 'no_learning'
  if (ax < x && m < yLow)   return 'new_in_position'
  if (ax >= x && m >= yHigh) return 'ready'
  if (ax >= x && m < yLow)  return 'high_potential'
  return 'growth_mindset'
}


export default function TendenciasScatter({ data, thresholds, filters }: Props) {
  const { x_thresh: X, y_low: Y_LOW, y_high: Y_HIGH } = thresholds
  const [highlightZone, setHighlightZone] = useState<string | null>(null)
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null)
  const scatterChartRef = useRef<HTMLDivElement>(null)

  // Release selection on mouseup anywhere
  useEffect(() => {
    const handler = () => setSelectedPerson(null)
    window.addEventListener('mouseup', handler)
    return () => window.removeEventListener('mouseup', handler)
  }, [])

  // Fixed axis bounds from full dataset (never change with filters)
  const globalMaxY = useMemo(() => {
    const all = data.filter(p => p.meses_rol != null)
    return Math.max(...all.map(p => p.meses_rol!), Y_HIGH + 10) + 5
  }, [data, Y_HIGH])

  // Filter points — includes year and period filters
  const filtered = useMemo(() => data.filter(p => {
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
  }), [data, filters])

  const withMeses = filtered.filter(p => p.meses_rol != null)
  const maxY = globalMaxY

  // Zone counts for insights
  const zoneCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    ZONES.forEach(z => { counts[z.id] = 0 })
    withMeses.forEach(p => { counts[getZone(p, X, Y_LOW, Y_HIGH)]++ })
    return counts
  }, [withMeses, X, Y_LOW, Y_HIGH])

  // Insights
  const insights = useMemo(() => {
    const list: string[] = []
    const total = withMeses.length
    if (!total) return list

    const noLearning = withMeses.filter(p => getZone(p, X, Y_LOW, Y_HIGH) === 'no_learning')
    const highPot    = withMeses.filter(p => getZone(p, X, Y_LOW, Y_HIGH) === 'high_potential')
    const growth     = withMeses.filter(p => getZone(p, X, Y_LOW, Y_HIGH) === 'growth_mindset')
    const ready      = withMeses.filter(p => getZone(p, X, Y_LOW, Y_HIGH) === 'ready')

    if (noLearning.length) {
      // BU with most no-learning
      const byBu: Record<string, number> = {}
      noLearning.forEach(p => { byBu[p.bu] = (byBu[p.bu] ?? 0) + 1 })
      const topBu = Object.entries(byBu).sort((a,b) => b[1]-a[1])[0]
      list.push(`⚠️ ${noLearning.length} persona${noLearning.length > 1 ? 's' : ''} (${Math.round(noLearning.length/total*100)}%) en zona "No learning" — alta antigüedad sin mejora. Mayor concentración en ${topBu[0]} (${topBu[1]}).`)
    }

    if (highPot.length) {
      const byRol: Record<string, number> = {}
      highPot.forEach(p => { byRol[p.rol] = (byRol[p.rol] ?? 0) + 1 })
      const topRol = Object.entries(byRol).sort((a,b) => b[1]-a[1])[0]
      list.push(`🌟 ${highPot.length} persona${highPot.length > 1 ? 's' : ''} en "High potential" — nuevos con apego ≥${X}%. Rol más frecuente: ${topRol[0]}.`)
    }

    if (ready.length) {
      list.push(`🔵 ${ready.length} persona${ready.length > 1 ? 's' : ''} "Ready for next challenge" — alta experiencia y alto apego. Candidatos para promoción o nuevos retos.`)
    }

    if (growth.length) {
      list.push(`🟢 ${growth.length} persona${growth.length > 1 ? 's' : ''} en "Growth mindset" — en desarrollo activo con antigüedad media.`)
    }

    // Roles comparison
    const roleGroups: Record<string, { total: number; noLearn: number; highPotGrowth: number }> = {}
    withMeses.forEach(p => {
      if (!roleGroups[p.rol]) roleGroups[p.rol] = { total: 0, noLearn: 0, highPotGrowth: 0 }
      roleGroups[p.rol].total++
      const z = getZone(p, X, Y_LOW, Y_HIGH)
      if (z === 'no_learning') roleGroups[p.rol].noLearn++
      if (z === 'high_potential' || z === 'growth_mindset') roleGroups[p.rol].highPotGrowth++
    })
    const stagnantRoles = Object.entries(roleGroups)
      .filter(([,v]) => v.total >= 3 && v.noLearn / v.total >= 0.4)
      .map(([rol]) => rol)
    if (stagnantRoles.length) {
      list.push(`📌 Roles con mayor proporción estancada (≥40% en "No learning"): ${stagnantRoles.slice(0,3).join(', ')}.`)
    }

    const growthRoles = Object.entries(roleGroups)
      .filter(([,v]) => v.total >= 3 && v.highPotGrowth / v.total >= 0.5)
      .map(([rol]) => rol)
    if (growthRoles.length) {
      list.push(`📈 Roles con mayor concentración de talento en crecimiento (≥50% en High potential + Growth): ${growthRoles.slice(0,3).join(', ')}.`)
    }

    return list
  }, [withMeses, X, Y_LOW, Y_HIGH])

  function exportScatter() {
    downloadCsv('scatter_tendencias.csv', withMeses.map(p => ({
      Nombre: p.nombre,
      BU: p.bu,
      Rol: p.rol,
      Área: p.area,
      Función: p.funcion,
      Período: p.label,
      'Apego %': pct(p.apego),
      'Meses en rol': p.meses_rol,
      Tendencia: TEND_LABEL[p.tendencia],
      'Zona': ZONES.find(z => z.id === getZone(p, X, Y_LOW, Y_HIGH))?.label ?? '',
    })))
  }

  // Selected person: all their assessments sorted chronologically for the line
  const selectedPoints = useMemo(() => {
    if (!selectedPerson) return []
    return withMeses
      .filter(p => p.nombre === selectedPerson)
      .sort((a, b) => a.año !== b.año ? a.año - b.año : a.periodo - b.periodo)
  }, [selectedPerson, withMeses])

  // Color for each scatter point
  function pointColor(p: ScatterPoint): string {
    if (!selectedPerson) return TEND_COLOR[p.tendencia] ?? '#64748B'
    if (p.nombre === selectedPerson) return '#FF9800'
    return '#CBD5E1'
  }

  // Separate scatter series by tendencia for legend
  const TEND_KEYS = ['mejora', 'igual', 'empeora', 'nuevo'] as const
  const seriesByTend = TEND_KEYS.map(t => ({
    key: t,
    label: TEND_LABEL[t],
    color: TEND_COLOR[t],
    points: withMeses.filter(p => p.tendencia === t),
  }))

  function CustomTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null
    const d: ScatterPoint = payload[0]?.payload
    if (!d) return null
    const tend = TEND_LABEL[d.tendencia] ?? d.tendencia
    const tColor = TEND_COLOR[d.tendencia] ?? '#64748B'

    const prevYear = d.año - 1
    const prevPoint = data
      .filter(p => p.nombre === d.nombre && p.año === prevYear)
      .sort((a, b) => b.periodo - a.periodo)[0] ?? null

    return (
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-lg p-3 text-xs max-w-[230px]">
        <p className="font-semibold text-[#1E293B] mb-1">{d.nombre}</p>
        <p className="text-[#64748B]">{d.bu} · {d.rol}</p>
        {d.funcion && <p className="text-[#64748B]">{d.funcion}</p>}
        <div className="mt-2 space-y-0.5">
          <p>Antigüedad en rol: <span className="font-medium text-[#1E293B]">{d.meses_rol != null ? `${d.meses_rol} m` : '—'}</span></p>
          <p>Tendencia: <span className="font-semibold" style={{ color: tColor }}>{tend}</span>
            {d.delta_apego != null && d.tendencia !== 'nuevo' && (
              <span className="ml-1 text-[#94A3B8]">({d.delta_apego > 0 ? '+' : ''}{pct(d.delta_apego)})</span>
            )}
          </p>
          <p>Período {d.año}: <span className="font-medium text-[#1E293B]">{d.label}</span></p>
          <p>Apego {d.año}: <span className="font-medium text-[#1E293B]">{pct(d.apego)}</span></p>
          {prevPoint && (
            <>
              <p>Período {prevYear}: <span className="font-medium text-[#1E293B]">{prevPoint.label}</span></p>
              <p>Apego {prevYear}: <span className="font-medium text-[#1E293B]">{pct(prevPoint.apego)}</span></p>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#1E293B]">
            Tendencias vs antigüedad en el rol
          </h3>
          <p className="text-xs text-[#64748B] mt-0.5">
            Cada punto = una persona · Eje X = % apego al perfil · Eje Y = meses en el rol actual
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CopyChartBtn chartRef={scatterChartRef} />
          <button onClick={exportScatter}
            className="text-xs text-[#64748B] border border-[#E2E8F0] rounded-lg px-2.5 py-1 hover:bg-[#F8FAFC] transition-colors shrink-0">
            ↓ CSV
          </button>
        </div>
      </div>

      {/* Zone legend */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
        {ZONES.map(z => (
          <button key={z.id}
            onClick={() => setHighlightZone(h => h === z.id ? null : z.id)}
            className={`text-left rounded-lg p-2 border text-xs transition-all ${highlightZone === z.id ? 'ring-2 ring-[#1E3A5F]' : ''}`}
            style={{ background: z.fill + 'BB', borderColor: z.fill }}>
            <p className="font-semibold text-[#1E293B] text-[10px] leading-tight">{z.label}</p>
            <p className="text-[#475569] text-[10px] mt-0.5 hidden sm:block">{z.desc.split('—')[0]}</p>
            <p className="font-bold text-[#1E293B] mt-0.5">{zoneCounts[z.id] ?? 0}</p>
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="relative" ref={scatterChartRef}>
      <p className="absolute top-3 right-6 z-10 text-[24px] text-black italic pointer-events-none leading-tight text-right max-w-xs">
        Presionar y mantener sobre un punto (participante) para ver su tendencia.
      </p>
      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart margin={{ top: 10, right: 20, bottom: 55, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />

          {/* Background zones */}
          <ReferenceArea x1={0}  x2={X}   y1={Y_LOW} y2={maxY} fill="#FFCDD2" fillOpacity={highlightZone ? (highlightZone === 'no_learning' ? 0.7 : 0.15) : 0.45} />
          <ReferenceArea x1={0}  x2={X}   y1={0}     y2={Y_LOW} fill="#FFF9C4" fillOpacity={highlightZone ? (highlightZone === 'new_in_position' ? 0.8 : 0.15) : 0.55} />
          <ReferenceArea x1={X}  x2={150} y1={Y_HIGH} y2={maxY} fill="#BBDEFB" fillOpacity={highlightZone ? (highlightZone === 'ready' ? 0.7 : 0.15) : 0.5} />
          <ReferenceArea x1={X}  x2={150} y1={Y_LOW}  y2={Y_HIGH} fill="#C8E6C9" fillOpacity={highlightZone ? (highlightZone === 'growth_mindset' ? 0.7 : 0.15) : 0.5} />
          <ReferenceArea x1={X}  x2={150} y1={0}      y2={Y_LOW} fill="#E1BEE7" fillOpacity={highlightZone ? (highlightZone === 'high_potential' ? 0.8 : 0.15) : 0.6} />

          {/* Zone labels */}
          <ReferenceArea x1={2}   x2={X-2} y1={Y_LOW+2} y2={maxY-2}   fill="transparent" label={{ value: 'No learning', fill: '#C62828', fontSize: 10, fontWeight: 600 }} />
          <ReferenceArea x1={2}   x2={X-2} y1={2}       y2={Y_LOW-2}  fill="transparent" label={{ value: 'New in position', fill: '#856404', fontSize: 10, fontWeight: 600 }} />
          <ReferenceArea x1={X+1} x2={148} y1={Y_HIGH+2} y2={maxY-2}  fill="transparent" label={{ value: 'Ready for next challenge', fill: '#1565C0', fontSize: 10, fontWeight: 600 }} />
          <ReferenceArea x1={X+1} x2={148} y1={Y_LOW+1}  y2={Y_HIGH-1} fill="transparent" label={{ value: 'Growth mindset', fill: '#2E7D32', fontSize: 10, fontWeight: 600 }} />
          <ReferenceArea x1={X+1} x2={148} y1={2}        y2={Y_LOW-2}  fill="transparent" label={{ value: 'High potential', fill: '#6A1B9A', fontSize: 10, fontWeight: 600 }} />

          {/* Threshold lines */}
          <ReferenceLine x={X}     stroke="#1E3A5F" strokeDasharray="5 3" strokeWidth={1.5} />
          <ReferenceLine y={Y_LOW}  stroke="#64748B" strokeDasharray="4 2" />
          <ReferenceLine y={Y_HIGH} stroke="#64748B" strokeDasharray="4 2" />

          <XAxis type="number" dataKey="apego_pct" name="Apego" unit="%" domain={[0, 150]}
            tick={{ fontSize: 10, fill: '#64748B' }}
            label={{ value: '% Apego al perfil', position: 'insideBottom', offset: -15, fontSize: 11, fill: '#475569' }} />
          <YAxis type="number" dataKey="meses_rol" name="Antigüedad" unit="m" domain={[0, maxY]}
            tick={{ fontSize: 10, fill: '#64748B' }}
            label={{ value: 'Antigüedad en el rol (meses)', angle: -90, position: 'insideLeft', offset: 15, fontSize: 11, fill: '#475569' }} />

          <Tooltip content={<CustomTooltip />} />

          {/* One Scatter series per tendencia */}
          {seriesByTend.map(s => (
            <Scatter key={s.key} name={s.label} data={s.points} fill={s.color}
              shape={(props: any) => {
                const { cx, cy, payload } = props
                const color = pointColor(payload)
                const isSelected = selectedPerson === payload.nombre
                return (
                  <circle
                    cx={cx} cy={cy}
                    r={isSelected ? 7 : 5}
                    fill={color}
                    fillOpacity={selectedPerson && !isSelected ? 0.35 : 0.85}
                    stroke={isSelected ? '#E65100' : 'none'}
                    strokeWidth={isSelected ? 1.5 : 0}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onMouseDown={(e) => { e.stopPropagation(); setSelectedPerson(payload.nombre) }}
                  />
                )
              }}
            >
              {s.points.map((_, i) => <Cell key={i} />)}
            </Scatter>
          ))}

          {/* Trend line for selected person */}
          {selectedPoints.length > 1 && (
            <Line
              data={selectedPoints}
              dataKey="meses_rol"
              dot={false}
              activeDot={false}
              stroke="#FF9800"
              strokeWidth={2.5}
              strokeDasharray="0"
              legendType="none"
              isAnimationActive={false}
            />
          )}

          <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11, paddingTop: 4, bottom: 0 }} />
        </ComposedChart>
      </ResponsiveContainer>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="space-y-2 border-t border-[#F1F5F9] pt-3">
          <p className="text-xs font-semibold text-[#1E293B]">Conclusiones automáticas</p>
          {insights.map((txt, i) => (
            <p key={i} className="text-xs text-[#475569] leading-relaxed">{txt}</p>
          ))}
        </div>
      )}
    </div>
  )
}
