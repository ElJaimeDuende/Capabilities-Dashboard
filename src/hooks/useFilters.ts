import { useState, useCallback } from 'react'
import type { Filters, RankingRow, BuSummary } from '../types'

const EMPTY: Filters = { bus: [], areas: [], roles: [], periodo: null }

export function useFilters() {
  const [filters, setFilters] = useState<Filters>(EMPTY)

  const toggle = useCallback((key: keyof Omit<Filters, 'periodo'>, value: string) => {
    setFilters(prev => {
      const arr = prev[key] as string[]
      return { ...prev, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] }
    })
  }, [])

  const setPeriodo = useCallback((p: number | null) => {
    setFilters(prev => ({ ...prev, periodo: prev.periodo === p ? null : p }))
  }, [])

  const reset = useCallback(() => setFilters(EMPTY), [])

  const activeCount = filters.bus.length + filters.areas.length + filters.roles.length + (filters.periodo ? 1 : 0)

  function filterRows(rows: RankingRow[]): RankingRow[] {
    return rows.filter(r => {
      if (filters.bus.length && !filters.bus.includes(r.bu)) return false
      if (filters.areas.length && !filters.areas.includes(r.area)) return false
      if (filters.roles.length && !filters.roles.includes(r.rol)) return false
      if (filters.periodo && r.periodo !== filters.periodo) return false
      return true
    })
  }

  function filterBuSummary(rows: BuSummary[]): BuSummary[] {
    if (!filters.bus.length) return rows
    return rows.filter(r => filters.bus.includes(r.bu))
  }

  return { filters, toggle, setPeriodo, reset, activeCount, filterRows, filterBuSummary }
}
