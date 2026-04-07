import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts'
import { useBenchmarks, useSummary, useGaps } from '../hooks/useData'
import { pct } from '../utils/format'
import { NIVEL_ORDER } from '../types'

export default function Benchmarks() {
  const { data: benchmarks, loading: lb } = useBenchmarks()
  const { data: summary } = useSummary()
  const { data: gaps } = useGaps()

  if (lb || !benchmarks || !summary) return <Loader />

  // Distribution comparison
  const distData = NIVEL_ORDER.map(n => ({
    nivel: n.replace('Advanced Beginner', 'Adv. Beg.'),
    ABI: Math.round((summary.nivel_distribution[n] ?? 0) * 100),
    Madura: Math.round((benchmarks.nivel_distribution.mature_org[n] ?? 0) * 100),
    'En desarrollo': Math.round((benchmarks.nivel_distribution.developing_org[n] ?? 0) * 100),
  }))

  // Category radar
  const catData = Object.entries(benchmarks.capability_categories).map(([cat, capList]) => {
    if (!gaps) return { category: cat, Actual: 0, 'Benchmark (75%)': 75 }
    const capGaps = gaps.by_capability.filter(c => capList.includes(c.capability))
    const avg = capGaps.length ? capGaps.reduce((s, c) => s + (c.apego_actual ?? 0), 0) / capGaps.length : 0
    return { category: cat.length > 20 ? cat.slice(0, 18) + '…' : cat, ABI: Math.round(avg * 100), 'Benchmark (75%)': 75 }
  })

  const apego = summary.apego_promedio_global
  const apegoPct = Math.round((apego ?? 0) * 100)

  const gartnerStage = apego >= 0.80 ? 3 : apego >= 0.70 ? 3 : apego >= 0.60 ? 2 : 1
  const gartnerLabels = ['', 'Reaccionar (Stage 1)', 'Anticipar (Stage 2)', 'Integrar (Stage 3)', 'Colaborar (Stage 4)', 'Orquestar (Stage 5)']

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[#1E293B]">Benchmarks de Industria</h2>

      {/* Sources */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <h3 className="text-sm font-semibold text-[#1E293B] mb-2">Fuentes de referencia</h3>
        <div className="flex flex-wrap gap-2">
          {benchmarks.sources.map(s => (
            <span key={s.name} className="px-3 py-1.5 bg-[#F1F5F9] text-[#475569] rounded-full text-xs">{s.name}</span>
          ))}
        </div>
      </div>

      {/* Positioning gauge */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GaugeCard
          label="Apego al perfil"
          actual={`${apegoPct}%`}
          actualSub={apego >= 0.80 ? 'Best-in-class' : apego >= 0.75 ? 'Organización buena' : apego >= 0.60 ? 'En desarrollo' : 'Requiere acción'}
          color={apego >= 0.80 ? '#2E7D32' : apego >= 0.70 ? '#F9A825' : '#C62828'}
          benchmark="80-85%"
          benchmarkSub="Rango best-in-class" />
        <GaugeCard
          label="Posición Gartner"
          actual={gartnerLabels[gartnerStage]}
          actualSub="Tu organización"
          color="#1E3A5F"
          benchmark="Stage 2-3"
          benchmarkSub="Industria promedio" />
        <GaugeCard
          label="Revisan reporte"
          actual={pct(summary.reviso_reporte_pct)}
          actualSub="Adopción ABI"
          color={summary.reviso_reporte_pct >= 0.80 ? '#2E7D32' : '#F9A825'}
          benchmark="100%"
          benchmarkSub="Recomendado" />
      </div>

      {/* Distribution vs benchmarks */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <h3 className="text-sm font-semibold text-[#1E293B] mb-1">Distribución de niveles vs referencias de industria</h3>
        <p className="text-xs text-[#64748B] mb-4">Fuentes: Dreyfus Model, Gartner, McKinsey</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={distData} barGap={4} barCategoryGap="25%">
            <XAxis dataKey="nivel" tick={{ fontSize: 10, fill: '#64748B' }} />
            <YAxis unit="%" tick={{ fontSize: 10, fill: '#64748B' }} domain={[0, 50]} />
            <Tooltip formatter={(v: any) => `${v}%`} />
            <Bar dataKey="ABI" name="ABI" fill="#1E3A5F" radius={[4,4,0,0]} />
            <Bar dataKey="Madura" name="Org. madura" fill="#66BB6A" radius={[4,4,0,0]} />
            <Bar dataKey="En desarrollo" name="Org. en desarrollo" fill="#FFCA28" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-4 mt-2 justify-center">
          {[
            { color: '#1E3A5F', label: 'ABI' },
            { color: '#66BB6A', label: 'Org. madura (referencia)' },
            { color: '#FFCA28', label: 'Org. en desarrollo' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: l.color }} />
              <span className="text-xs text-[#64748B]">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Category radar */}
      {catData.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[#1E293B] mb-0.5">Apego promedio por categoría de capability</h3>
              <p className="text-xs text-[#64748B]">Fuentes: ISM, ASCM</p>
            </div>
            <div className="flex gap-3 text-xs shrink-0">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#1E3A5F] opacity-70" />
                <span className="text-[#1E293B] font-medium">ABI</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-[#66BB6A]" style={{ borderTop: '2px dashed #66BB6A', background: 'none' }} />
                <div className="w-3 h-3 rounded-full border-2 border-[#66BB6A] bg-[#E8F5E9]" />
                <span className="text-[#64748B]">Benchmark 75% (org. buena)</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={catData}>
              <PolarGrid stroke="#E2E8F0" />
              <PolarAngleAxis dataKey="category" tick={{ fontSize: 10, fill: '#475569' }} />
              <PolarRadiusAxis angle={30} domain={[0, 120]} tick={{ fontSize: 9, fill: '#94A3B8' }} unit="%" />
              <Radar name="Benchmark (75%)" dataKey="Benchmark (75%)" stroke="#66BB6A" fill="#66BB6A" fillOpacity={0.12} strokeDasharray="5 3" strokeWidth={1.5} />
              <Radar name="ABI" dataKey="ABI" stroke="#1E3A5F" fill="#1E3A5F" fillOpacity={0.35} strokeWidth={2} />
              <Tooltip formatter={(v: any, name: any) => [`${v}%`, name === 'Benchmark (75%)' ? 'Benchmark (org. buena)' : 'ABI']} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Profile adherence thresholds */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-[#1E293B]">Umbrales de apego al perfil</h3>
          <span className="text-xs text-[#64748B]">
            Resultado de ABI: <span className="font-semibold text-[#1E293B]">{apegoPct}%</span>
          </span>
        </div>
        <p className="text-xs text-[#64748B] mb-4">Fuente: DeGarmo Competency Fit Index, APICS, ISM</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(benchmarks.profile_adherence.threshold_labels).map(([key, label]) => {
            const threshold = benchmarks.profile_adherence.thresholds[key]
            const thresholds = benchmarks.profile_adherence.thresholds
            const colors: Record<string, string> = {
              strong_fit: '#2E7D32', good_fit: '#66BB6A', moderate_fit: '#F9A825', poor_fit: '#C62828'
            }
            const bgs: Record<string, string> = {
              strong_fit: '#E8F5E9', good_fit: '#F1F8E9', moderate_fit: '#FFFDE7', poor_fit: '#FFEBEE'
            }
            const actions: Record<string, string> = {
              strong_fit: 'Top performer / Avanzar',
              good_fit: 'Aceptable / Monitorear',
              moderate_fit: 'Plan de desarrollo',
              poor_fit: 'Acción urgente'
            }
            // Determine if org falls in this tier
            const isActive = key === 'strong_fit' ? apego >= thresholds.strong_fit
              : key === 'good_fit' ? apego >= thresholds.good_fit && apego < thresholds.strong_fit
              : key === 'moderate_fit' ? apego >= thresholds.moderate_fit && apego < thresholds.good_fit
              : apego < thresholds.moderate_fit
            return (
              <div key={key} className={`rounded-xl p-3 border-2 transition-all ${isActive ? 'shadow-md' : 'border-[#E2E8F0]'}`}
                style={isActive ? { borderColor: colors[key], background: bgs[key] } : {}}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-lg font-bold" style={{ color: colors[key] }}>{Math.round(threshold * 100)}%+</p>
                  {isActive && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: colors[key], color: '#fff' }}>
                      TU ORG
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium text-[#1E293B]">{label}</p>
                <p className="text-xs text-[#94A3B8] mt-0.5">{actions[key]}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function GaugeCard({ label, actual, actualSub, color, benchmark, benchmarkSub }: {
  label: string; actual: string; actualSub: string; color: string; benchmark: string; benchmarkSub: string
}) {
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 space-y-3">
      <p className="text-xs font-semibold text-[#1E293B] uppercase tracking-wide">{label}</p>
      <div className="flex items-stretch gap-3">
        {/* Actual */}
        <div className="flex-1 rounded-lg p-2.5" style={{ background: color + '12', border: `1px solid ${color}30` }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color }}>Resultado ABI</p>
          <p className="text-xl font-bold leading-tight" style={{ color }}>{actual}</p>
          <p className="text-[10px] mt-0.5" style={{ color: color + 'CC' }}>{actualSub}</p>
        </div>
        {/* Benchmark */}
        <div className="flex-1 rounded-lg p-2.5 bg-[#F8FAFC] border border-[#E2E8F0]">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B] mb-1">Benchmark</p>
          <p className="text-xl font-bold text-[#475569] leading-tight">{benchmark}</p>
          <p className="text-[10px] text-[#94A3B8] mt-0.5">{benchmarkSub}</p>
        </div>
      </div>
    </div>
  )
}

function Loader() {
  return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-[#1E3A5F] border-t-transparent rounded-full animate-spin" /></div>
}
