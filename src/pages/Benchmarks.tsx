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
    Actual: Math.round((summary.nivel_distribution[n] ?? 0) * 100),
    Madura: Math.round((benchmarks.nivel_distribution.mature_org[n] ?? 0) * 100),
    'En desarrollo': Math.round((benchmarks.nivel_distribution.developing_org[n] ?? 0) * 100),
  }))

  // Category radar
  const catData = Object.entries(benchmarks.capability_categories).map(([cat, capList]) => {
    if (!gaps) return { category: cat, Actual: 0 }
    const capGaps = gaps.by_capability.filter(c => capList.includes(c.capability))
    const avg = capGaps.length ? capGaps.reduce((s, c) => s + (c.apego_actual ?? 0), 0) / capGaps.length : 0
    return { category: cat.length > 20 ? cat.slice(0, 18) + '…' : cat, Actual: Math.round(avg * 100) }
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
          value={`${apegoPct}%`}
          sub={apego >= 0.80 ? 'Best-in-class (>80%)' : apego >= 0.75 ? 'Organización buena (75-80%)' : apego >= 0.60 ? 'En desarrollo (60-75%)' : 'Requiere acción (<60%)'}
          color={apego >= 0.80 ? '#2E7D32' : apego >= 0.70 ? '#F9A825' : '#C62828'}
          benchmark="Best-in-class: 80-85%" />
        <GaugeCard
          label="Posición Gartner"
          value={gartnerLabels[gartnerStage]}
          sub="Modelo de Madurez 5 etapas"
          color="#1E3A5F"
          benchmark="Industria promedio: Stage 2-3" />
        <GaugeCard
          label="Revisan reporte"
          value={pct(summary.reviso_reporte_pct)}
          sub="Adopción del proceso de assessment"
          color={summary.reviso_reporte_pct >= 0.80 ? '#2E7D32' : '#F9A825'}
          benchmark="Recomendado: 100%" />
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
            <Bar dataKey="Actual" name="Actual" fill="#1E3A5F" radius={[4,4,0,0]} />
            <Bar dataKey="Madura" name="Org. madura" fill="#66BB6A" radius={[4,4,0,0]} />
            <Bar dataKey="En desarrollo" name="Org. en desarrollo" fill="#FFCA28" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-4 mt-2 justify-center">
          {[
            { color: '#1E3A5F', label: 'Actual' },
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
          <h3 className="text-sm font-semibold text-[#1E293B] mb-1">Apego promedio por categoría de capability</h3>
          <p className="text-xs text-[#64748B] mb-4">Fuentes: ISM, ASCM. Línea de referencia: 75% (org. buena)</p>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={catData}>
              <PolarGrid stroke="#E2E8F0" />
              <PolarAngleAxis dataKey="category" tick={{ fontSize: 10, fill: '#475569' }} />
              <PolarRadiusAxis angle={30} domain={[0, 120]} tick={{ fontSize: 9, fill: '#94A3B8' }} unit="%" />
              <Radar name="Apego actual" dataKey="Actual" stroke="#1E3A5F" fill="#1E3A5F" fillOpacity={0.4} />
              <Tooltip formatter={(v: any) => `${v}%`} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Profile adherence thresholds */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <h3 className="text-sm font-semibold text-[#1E293B] mb-3">Umbrales de apego al perfil</h3>
        <p className="text-xs text-[#64748B] mb-4">Fuente: DeGarmo Competency Fit Index, APICS, ISM</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(benchmarks.profile_adherence.threshold_labels).map(([key, label]) => {
            const threshold = benchmarks.profile_adherence.thresholds[key]
            const colors: Record<string, string> = {
              strong_fit: '#2E7D32', good_fit: '#66BB6A', moderate_fit: '#F9A825', poor_fit: '#C62828'
            }
            const actions: Record<string, string> = {
              strong_fit: 'Top performer / Avanzar',
              good_fit: 'Aceptable / Monitorear',
              moderate_fit: 'Plan de desarrollo',
              poor_fit: 'Acción urgente'
            }
            return (
              <div key={key} className="border border-[#E2E8F0] rounded-xl p-3">
                <p className="text-lg font-bold" style={{ color: colors[key] }}>{Math.round(threshold * 100)}%+</p>
                <p className="text-xs font-medium text-[#1E293B] mt-1">{label}</p>
                <p className="text-xs text-[#94A3B8] mt-0.5">{actions[key]}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function GaugeCard({ label, value, sub, color, benchmark }: { label: string; value: string; sub: string; color: string; benchmark: string }) {
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
      <p className="text-xs text-[#64748B] font-medium">{label}</p>
      <p className="text-xl font-bold mt-1" style={{ color }}>{value}</p>
      <p className="text-xs text-[#1E293B] mt-1">{sub}</p>
      <p className="text-xs text-[#94A3B8] mt-2 italic">{benchmark}</p>
    </div>
  )
}

function Loader() {
  return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-[#1E3A5F] border-t-transparent rounded-full animate-spin" /></div>
}
