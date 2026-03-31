export const pct = (v: number | null | undefined, decimals = 1) =>
  v == null ? '—' : `${(v * 100).toFixed(decimals)}%`

export const score = (v: number | null | undefined, decimals = 2) =>
  v == null ? '—' : v.toFixed(decimals)

export const delta = (v: number | null | undefined) => {
  if (v == null) return '—'
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(2)}`
}

export function apegoBadge(apego: number | null): { label: string; color: string; bg: string } {
  if (apego == null) return { label: '—', color: '#757575', bg: '#F5F5F5' }
  if (apego >= 0.80) return { label: 'Alto', color: '#2E7D32', bg: '#E8F5E9' }
  if (apego >= 0.70) return { label: 'Bueno', color: '#388E3C', bg: '#F1F8E9' }
  if (apego >= 0.60) return { label: 'Moderado', color: '#F57F17', bg: '#FFFDE7' }
  return { label: 'Bajo', color: '#C62828', bg: '#FFEBEE' }
}

export function nivelBadgeColor(nivel: string): string {
  const map: Record<string, string> = {
    'Expert': '#1E3A5F',
    'Proficient': '#2E7D32',
    'Competent': '#F57F17',
    'Advanced Beginner': '#E65100',
    'Novice': '#C62828',
  }
  return map[nivel] ?? '#757575'
}

export function heatColor(apego: number | null): string {
  if (apego == null) return '#EEEEEE'
  if (apego >= 0.85) return '#1B5E20'
  if (apego >= 0.75) return '#2E7D32'
  if (apego >= 0.65) return '#66BB6A'
  if (apego >= 0.55) return '#FDD835'
  if (apego >= 0.45) return '#FF9800'
  return '#C62828'
}

export function heatTextColor(apego: number | null): string {
  if (apego == null) return '#757575'
  if (apego >= 0.65) return '#FFFFFF'
  return '#212121'
}
