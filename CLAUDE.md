# Capabilities Dashboard

## Overview

Vite + React + TypeScript SPA for ABI supply chain capabilities assessment.
Static JSON architecture: Python ETL pre-aggregates Excel -> `public/data/*.json`.
Deployed to Vercel: https://self-abi-dashboard.vercel.app

## Key Paths

| What | Path |
|------|------|
| ETL script | `scripts/etl.py` |
| Source data | `../Data/Base de Datos.xlsx` |
| Generated JSON | `public/data/*.json` (7 files) |
| Types | `src/types/index.ts` |
| Filter hook | `src/hooks/useFilters.ts` |
| Data hooks | `src/hooks/useData.ts` |
| Layout + sidebar | `src/components/Layout.tsx` |
| Filter bar | `src/components/FilterBar.tsx` |
| Scatter chart | `src/components/TendenciasScatter.tsx` |
| Pages | `src/pages/{Summary,Gaps,Heatmap,Evolution,Rankings,Benchmarks}.tsx` |
| Assets | `public/{sci-logo.png,abi-logo.png}` |

## Architecture (PROTECTED)

### ETL Pipeline
- `scripts/etl.py` reads Excel, generates 7 JSON files in `public/data/`
- After `npm run build`, copy `public/data/` -> `dist/data/` before deploy
- Pre-aggregated breakdowns: `by_bu`, `by_area`, `by_year`, `by_bu_year`, `by_bu_area`, `by_area_bu`, `by_year_area`, `by_bu_year_area`, `by_work_location`
- `Work Location` merged into cap sheet from gen sheet via join keys
- `experts_detail` array in `expertise_concentration` enables frontend re-filtering

### Filter System
- Global filters: Vista (año/periodo), Tiempo, BU, Work Location, Área
- Rol filter removed from UI (data still supports it internally)
- `filterRows()` in `useFilters.ts` handles raw `RankingRow[]` filtering
- Pre-aggregated pages (Gaps capGaps, Heatmap) use dimensional breakdowns from JSON
- Evolution page recomputes from `scatter` array when filters lack pre-aggregated dimensions
- Work Location: full support in Summary, Rankings, Evolution, TendenciasScatter; partial in Gaps/Heatmap (WL-only, no cross-dimensional combos)

### Deploy
```bash
npm run build
cp -r public/data dist/data
cp public/sci-logo.png public/abi-logo.png dist/
npx vercel deploy --prod
npx vercel alias set <deployment-url> self-abi-dashboard.vercel.app
```

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| "ABI" instead of "Actual" | Selective replacement per element, user approved case-by-case |
| Sidebar black | Brand alignment with SCI + ABI logos |
| Rol filter hidden | Removed from FilterBar, kept in data/types for internal use |
| Scatter mousedown/mouseup | Hold-to-highlight person trend line, release to reset |
| Evolution "Todos" default | Shows aggregate puntaje/apego across all filtered persons |
| BU trend single-year warning | Yellow banner explains why no trend line visible |

## Patterns

### Heatmap Filter Cascade
`sourceRows` useMemo: WL-only -> Year+Area -> Year+BU -> Year -> Area -> BU -> period -> all

### Gaps Filter Cascade
Priority: BU+Year+Area -> BU+Year -> Year+Area -> BU -> Year -> Area -> WL -> Rol

### Evolution Recomputation
When pre-aggregated data lacks filter dimensions, recompute from `evolution.scatter`:
- `distData`: nivel distribution from scatter points
- `buTrend`: BU puntaje trend from scatter when area/WL filter active
- `filteredPersons`: filter `by_person` array including work_location

## Known Limitations

- Gaps/Heatmap: Work Location only works alone, not combined with Year/BU/Area (would need N-dimensional ETL)
- Scatter `funcion` field maps to Work Location (ETL column naming mismatch, works but confusing)
- `by_person` in evolution.json: `work_location` field added but only used for filtering, not displayed
- Chart chunk size warning (~695KB) - could code-split pages with dynamic imports

## Excluded Names (ETL)
`Manuel A Mendoza`, `Log Transformation Maz Log Transformation Maz`
