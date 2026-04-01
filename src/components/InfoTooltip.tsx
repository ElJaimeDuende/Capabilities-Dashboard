import { useState } from 'react'

export default function InfoTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false)
  return (
    <span className="relative inline-flex items-center ml-1 align-middle">
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onClick={() => setVisible(v => !v)}
        className="w-4 h-4 rounded-full bg-[#E2E8F0] text-[#64748B] text-[9px] font-bold flex items-center justify-center hover:bg-[#CBD5E1] transition-colors focus:outline-none shrink-0"
        aria-label="Más información"
      >
        ?
      </button>
      {visible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 bg-[#1E293B] text-white text-xs rounded-lg p-3 shadow-xl pointer-events-none">
          <p className="leading-relaxed whitespace-pre-line">{text}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1E293B]" />
        </div>
      )}
    </span>
  )
}
