import { useState, useEffect } from 'react'
import type { Summary, Gaps, Heatmap, Evolution, Rankings, CriticalFindings, BenchmarkData } from '../types'

function useJson<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(path)
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json() })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [path])

  return { data, loading, error }
}

export function useSummary() { return useJson<Summary>('/data/summary.json') }
export function useGaps() { return useJson<Gaps>('/data/gaps.json') }
export function useHeatmap() { return useJson<Heatmap>('/data/heatmap.json') }
export function useEvolution() { return useJson<Evolution>('/data/evolution.json') }
export function useRankings() { return useJson<Rankings>('/data/rankings.json') }
export function useCriticalFindings() { return useJson<CriticalFindings>('/data/critical_findings.json') }
export function useBenchmarks() { return useJson<BenchmarkData>('/data/benchmarks.json') }
