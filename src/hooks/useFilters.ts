import { useState, useCallback } from 'react'
import type { Filters, Granularidad, RankingRow, BuSummary } from '../types'

const EMPTY: Filters = {
  bus: [],
  work_locations: [],
  areas: [],
  roles: [],
  años: [],
  periodo: null,
  granularidad: 'año',
}

export function useFilters() {
  const [filters, setFilters] = useState<Filters>(EMPTY)

  const toggle = useCallback((key: keyof Pick<Filters, 'bus' | 'work_locations' | 'areas' | 'roles'>, value: string) => {
    setFilters(prev => {
      const arr = prev[key]
      return { ...prev, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] }
    })
  }, [])

  const toggleAño = useCallback((año: number) => {
    setFilters(prev => ({
      ...prev,
      años: prev.años.includes(año) ? prev.años.filter(a => a !== año) : [...prev.años, año],
    }))
  }, [])

  const setPeriodo = useCallback((label: string | null) => {
    setFilters(prev => ({ ...prev, periodo: prev.periodo === label ? null : label }))
  }, [])

  const setGranularidad = useCallback((g: Granularidad) => {
    setFilters(prev => ({ ...prev, granularidad: g, años: [], periodo: null }))
  }, [])

  const reset = useCallback(() => setFilters(EMPTY), [])

  const activeCount =
    filters.bus.length +
    filters.work_locations.length +
    filters.areas.length +
    filters.roles.length +
    filters.años.length +
    (filters.periodo ? 1 : 0)

  function filterRows(rows: RankingRow[]): RankingRow[] {
    return rows.filter(r => {
      if (filters.bus.length && !filters.bus.includes(r.bu)) return false
      if (filters.work_locations.length && !filters.work_locations.includes(r.work_location)) return false
      if (filters.areas.length && !filters.areas.includes(r.area)) return false
      if (filters.roles.length && !filters.roles.includes(r.rol)) return false
      if (filters.granularidad === 'año') {
        if (filters.años.length && !filters.años.includes(r.año)) return false
      } else {
        if (filters.periodo && `${r.año}-P${r.periodo}` !== filters.periodo) return false
      }
      return true
    })
  }

  function filterBuSummary(rows: BuSummary[]): BuSummary[] {
    if (!filters.bus.length) return rows
    return rows.filter(r => filters.bus.includes(r.bu))
  }

  return {
    filters,
    toggle,
    toggleAño,
    setPeriodo,
    setGranularidad,
    reset,
    activeCount,
    filterRows,
    filterBuSummary,
  }
}
