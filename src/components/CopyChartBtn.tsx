import { useState, type RefObject } from 'react'
import { copyChartToClipboard } from '../utils/copyChart'

interface Props {
  chartRef: RefObject<HTMLDivElement | null>
}

export default function CopyChartBtn({ chartRef }: Props) {
  const [state, setState] = useState<'idle' | 'ok' | 'err'>('idle')

  async function handleCopy() {
    if (!chartRef.current) return
    try {
      await copyChartToClipboard(chartRef.current)
      setState('ok')
      setTimeout(() => setState('idle'), 2000)
    } catch {
      setState('err')
      setTimeout(() => setState('idle'), 2000)
    }
  }

  return (
    <button
      onClick={handleCopy}
      title="Copiar gráfica"
      className="text-xs text-[#94A3B8] hover:text-[#475569] border border-[#E2E8F0] rounded-lg px-2 py-1 transition-colors"
    >
      {state === 'ok' ? '✓' : state === 'err' ? '✗' : '⧉'}
    </button>
  )
}
