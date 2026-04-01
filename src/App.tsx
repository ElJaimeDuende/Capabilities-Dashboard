import { useState } from 'react'
import LoginScreen from './components/LoginScreen'
import Layout from './components/Layout'
import FilterBar from './components/FilterBar'
import Summary from './pages/Summary'
import Gaps from './pages/Gaps'
import HeatmapPage from './pages/Heatmap'
import Evolution from './pages/Evolution'
import Rankings from './pages/Rankings'
import Benchmarks from './pages/Benchmarks'
import { useSummary } from './hooks/useData'
import { useFilters } from './hooks/useFilters'

type Section = 'summary' | 'gaps' | 'heatmap' | 'evolution' | 'rankings' | 'benchmarks'

function Dashboard() {
  const [section, setSection] = useState<Section>('summary')
  const { data: summary } = useSummary()
  const {
    filters,
    toggle,
    toggleAño,
    setPeriodo,
    setGranularidad,
    reset,
    activeCount,
    filterRows,
    filterBuSummary,
  } = useFilters()

  const filterBar = summary ? (
    <FilterBar
      filters={filters}
      summary={summary}
      toggle={toggle}
      toggleAño={toggleAño}
      setPeriodo={setPeriodo}
      setGranularidad={setGranularidad}
      reset={reset}
      activeCount={activeCount}
    />
  ) : undefined

  return (
    <Layout activeSection={section} onNav={id => setSection(id as Section)} filterBar={filterBar}>
      {section === 'summary'    && <Summary filters={filters} filterBuSummary={filterBuSummary} />}
      {section === 'gaps'       && <Gaps filters={filters} />}
      {section === 'heatmap'    && <HeatmapPage filters={filters} />}
      {section === 'evolution'  && <Evolution filters={filters} filterRows={filterRows} />}
      {section === 'rankings'   && <Rankings filters={filters} filterRows={filterRows} />}
      {section === 'benchmarks' && <Benchmarks />}
    </Layout>
  )
}

export default function App() {
  const [auth, setAuth] = useState(() => sessionStorage.getItem('cap_auth') === '1')

  if (!auth) return <LoginScreen onSuccess={() => setAuth(true)} />
  return <Dashboard />
}
