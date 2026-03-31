import { useState } from 'react'
import type { ReactNode } from 'react'

const NAV = [
  { id: 'summary',    label: 'Resumen',       icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'gaps',       label: 'Gap Analysis',  icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'heatmap',    label: 'Heat Maps',     icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
  { id: 'evolution',  label: 'Evolución',     icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  { id: 'rankings',   label: 'Rankings',      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 'benchmarks', label: 'Benchmarks',   icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064' },
]

interface Props {
  activeSection: string
  onNav: (id: string) => void
  children: ReactNode
  filterBar?: ReactNode
}

export default function Layout({ activeSection, onNav, children, filterBar }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col w-56 bg-[#1E3A5F] text-white shrink-0 fixed inset-y-0 left-0 z-30">
        <div className="px-5 py-5 border-b border-white/10">
          <p className="font-semibold text-sm leading-tight">Capabilities</p>
          <p className="text-white/60 text-xs mt-0.5">Planning · Regional</p>
        </div>
        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {NAV.map(item => (
            <button key={item.id} onClick={() => onNav(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors text-left
                ${activeSection === item.id ? 'bg-white/15 text-white font-medium' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-white/10">
          <p className="text-white/40 text-xs">2025-P2 · 2026-P1</p>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 bg-[#1E3A5F] text-white flex items-center px-4 h-14 gap-3">
        <button onClick={() => setSidebarOpen(true)} className="p-1.5 -ml-1.5 rounded-lg hover:bg-white/10">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <p className="font-semibold text-sm">{NAV.find(n => n.id === activeSection)?.label ?? 'Dashboard'}</p>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 bg-[#1E3A5F] text-white flex flex-col">
            <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">Capabilities</p>
                <p className="text-white/60 text-xs mt-0.5">Planning · Regional</p>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-1 rounded-lg hover:bg-white/10">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 py-3 space-y-0.5 px-2">
              {NAV.map(item => (
                <button key={item.id} onClick={() => { onNav(item.id); setSidebarOpen(false) }}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-colors text-left
                    ${activeSection === item.id ? 'bg-white/15 text-white font-medium' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-56 flex flex-col min-h-screen">
        <div className="lg:hidden h-14" />
        {filterBar && (
          <div className="sticky top-0 lg:top-0 z-20 bg-white border-b border-[#E2E8F0] shadow-sm">
            {filterBar}
          </div>
        )}
        <main className="flex-1 p-4 lg:p-6 max-w-screen-2xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
