export type NivelDominio = 'Novice' | 'Advanced Beginner' | 'Competent' | 'Proficient' | 'Expert'

export const NIVEL_ORDER: NivelDominio[] = ['Novice', 'Advanced Beginner', 'Competent', 'Proficient', 'Expert']

export const NIVEL_COLORS: Record<NivelDominio, string> = {
  'Novice': '#EF5350',
  'Advanced Beginner': '#FF9800',
  'Competent': '#FDD835',
  'Proficient': '#66BB6A',
  'Expert': '#1E3A5F',
}

export interface BuSummary {
  bu: string
  n: number
  puntaje_promedio: number
  apego_promedio: number
  niveles: Record<NivelDominio, number>
}

export interface Summary {
  total_participantes: number
  total_assessments: number
  assessments_finalizados: number
  assessments_en_curso: number
  puntaje_promedio_global: number
  apego_promedio_global: number
  reviso_reporte_pct: number
  bus: string[]
  work_locations: string[]
  areas: string[]
  roles: string[]
  capabilities: string[]
  periodos: number[]
  años: number[]
  period_labels: string[]
  nivel_distribution: Record<NivelDominio, number>
  nivel_counts: Record<NivelDominio, number>
  bu_summary: BuSummary[]
}

export interface CapabilityGap {
  capability: string
  perfil_requerido: number
  apego_actual: number
  gap: number
  by_bu: Record<string, { apego: number; n: number }>
  by_year: Record<number, { apego: number; n: number }>
  by_bu_year: Record<string, Record<number, { apego: number; n: number }>>
  by_area: Record<string, { apego: number; n: number }>
  by_rol: Record<string, { apego: number; n: number }>
  by_year_area: Record<number, Record<string, { apego: number; n: number }>>
  by_bu_year_area: Record<string, Record<number, Record<string, { apego: number; n: number }>>>
  by_work_location: Record<string, { apego: number; n: number }>
}

export interface RolGap {
  rol: string
  n: number
  puntaje_promedio: number
  apego_promedio: number
  nivel_predominante: NivelDominio
}

export interface BuRadarItem {
  capability: string
  apego: number
  gap: number
}

export interface Gaps {
  by_capability: CapabilityGap[]
  by_rol: RolGap[]
  by_bu_radar: Record<string, BuRadarItem[]>
}

export interface HeatmapCell {
  apego: number | null
  n: number
}

export interface HeatmapRow {
  label: string
  cells: Record<string, HeatmapCell>
}

export interface HeatmapPeriod {
  by_bu: HeatmapRow[]
  by_area: HeatmapRow[]
  by_bu_area: Record<string, HeatmapRow[]>
  by_area_bu: Record<string, HeatmapRow[]>
}

export interface Heatmap {
  capabilities: string[]
  by_bu: HeatmapRow[]
  by_area: HeatmapRow[]
  by_period: Record<string, HeatmapPeriod>
  by_year: Record<number, HeatmapPeriod>
  by_bu_area: Record<string, HeatmapRow[]>
  by_area_bu: Record<string, HeatmapRow[]>
  by_work_location: Record<string, { by_bu: HeatmapRow[]; by_area: HeatmapRow[] }>
  benchmark_threshold: number
}

export interface PeriodData {
  año: number
  periodo: number
  label: string
  n: number
  puntaje_promedio: number
  apego_promedio: number
  nivel_counts: Record<NivelDominio, number>
  nivel_pct: Record<NivelDominio, number>
}

export interface YearData {
  año: number
  label: string
  n: number
  puntaje_promedio: number
  apego_promedio: number
  nivel_counts: Record<NivelDominio, number>
  nivel_pct: Record<NivelDominio, number>
}

export interface Mover {
  nombre: string
  bu: string
  rol: string
  puntaje_p1: number
  puntaje_p2: number
  apego_p1: number
  apego_p2: number
  nivel_p1: NivelDominio
  nivel_p2: NivelDominio
  delta_puntaje: number
  delta_apego: number
  mejoro: boolean
}

export interface BuEvolution {
  bu: string
  periods: { label: string; año: number; periodo: number; n: number; puntaje_promedio: number; apego_promedio: number }[]
}

export interface BuEvolutionAnnual {
  bu: string
  years: { label: string; año: number; n: number; puntaje_promedio: number; apego_promedio: number }[]
}

export interface ScatterPoint {
  nombre: string
  bu: string
  rol: string
  area: string
  funcion: string
  año: number
  periodo: number
  label: string
  apego: number
  apego_pct: number
  puntaje: number
  nivel: NivelDominio
  meses_rol: number | null
  tendencia: 'mejora' | 'empeora' | 'igual' | 'nuevo'
  delta_apego: number | null
}

export interface ScatterThresholds {
  x_thresh: number
  y_low: number
  y_high: number
}

export interface PersonPeriod {
  label: string
  año: number
  periodo: number
  puntaje: number
  apego: number
  nivel: NivelDominio
}

export interface PersonEvolution {
  nombre: string
  bu: string
  rol: string
  area: string
  work_location?: string
  periods: PersonPeriod[]
}

export interface Evolution {
  by_period: PeriodData[]
  by_year: YearData[]
  movers: Mover[]
  top_mejoras: Mover[]
  top_retrocesos: Mover[]
  by_bu: BuEvolution[]
  by_bu_annual: BuEvolutionAnnual[]
  by_person: PersonEvolution[]
  scatter: ScatterPoint[]
  scatter_thresholds: ScatterThresholds
}

export interface RankingRow {
  nombre: string
  bu: string
  work_location: string
  rol: string
  area: string
  año: number
  periodo: number
  puntaje: number
  puntaje_maximo: number
  puntaje_requerido: number | null
  apego: number
  nivel: NivelDominio
  reviso_reporte: string
  assessment_id: string
}

export interface ExpertDetail {
  nombre: string
  bu: string
  area: string
  año: number | null
}

export interface ExpertiseInfo {
  n_experts: number
  experts: string[]
  experts_detail: ExpertDetail[]
  risk: 'alto' | 'medio' | 'bajo'
}

export interface Rankings {
  all: RankingRow[]
  top_performers: RankingRow[]
  needs_development: RankingRow[]
  expertise_concentration: Record<string, ExpertiseInfo>
}

export interface Finding {
  severity: 'alta' | 'media' | 'positivo'
  category: string
  title: string
  detail: string
  benchmark: string
  bu?: string
  capability?: string
  capabilities?: string[]
}

export interface CriticalFindings {
  total: number
  alta_severidad: number
  media_severidad: number
  positivos: number
  findings: Finding[]
}

export interface BenchmarkData {
  sources: { name: string; url?: string }[]
  nivel_distribution: {
    mature_org: Record<NivelDominio, number>
    developing_org: Record<NivelDominio, number>
    label_mature: string
    label_developing: string
  }
  profile_adherence: {
    best_in_class_min: number
    best_in_class_max: number
    good_min: number
    good_max: number
    developing_min: number
    developing_max: number
    thresholds: Record<string, number>
    threshold_labels: Record<string, string>
  }
  capability_categories: Record<string, string[]>
}

export type Granularidad = 'año' | 'periodo'

export interface Filters {
  bus: string[]
  work_locations: string[]
  areas: string[]
  roles: string[]
  años: number[]
  periodo: string | null   // label like "2025-P1", used only in period mode
  granularidad: Granularidad
}
