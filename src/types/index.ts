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
  areas: string[]
  roles: string[]
  capabilities: string[]
  periodos: number[]
  años: number[]
  nivel_distribution: Record<NivelDominio, number>
  nivel_counts: Record<NivelDominio, number>
  bu_summary: BuSummary[]
}

export interface CapabilityGap {
  capability: string
  perfil_requerido: number
  apego_actual: number
  gap: number
  by_bu: Record<string, { perfil: number; apego: number; n: number }>
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
  perfil: number
  apego: number
}

export interface Gaps {
  by_capability: CapabilityGap[]
  by_rol: RolGap[]
  by_bu_radar: Record<string, BuRadarItem[]>
}

export interface HeatmapCell {
  apego: number
  n: number
}

export interface HeatmapRow {
  label: string
  cells: Record<string, HeatmapCell>
}

export interface Heatmap {
  capabilities: string[]
  by_bu: HeatmapRow[]
  by_area: HeatmapRow[]
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

export interface Evolution {
  by_period: PeriodData[]
  movers: Mover[]
  top_mejoras: Mover[]
  top_retrocesos: Mover[]
  by_bu: BuEvolution[]
}

export interface RankingRow {
  nombre: string
  bu: string
  rol: string
  area: string
  año: number
  periodo: number
  puntaje: number
  apego: number
  nivel: NivelDominio
  reviso_reporte: string
  assessment_id: string
}

export interface ExpertiseInfo {
  n_experts: number
  experts: string[]
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

export interface Filters {
  bus: string[]
  areas: string[]
  roles: string[]
  periodo: number | null
}
