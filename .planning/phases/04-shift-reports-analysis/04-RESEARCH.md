# Phase 4: Shift Reports & Analysis - Research

**Researched:** 2026-06-11
**Domain:** Next.js App Router reports, Recharts ComposedChart + stacked bars, SQLite aggregate queries, CSV export
**Confidence:** HIGH (all critical findings verified against live DB, official Next.js docs, and existing codebase)

---

## Summary

Phase 4 builds two new route areas on top of the existing stack with no new dependencies required. All charting, auth, and DB tooling is already installed. The primary technical challenges are: (1) correct per-shift aggregation query design that avoids cartesian multiplication when joining stops + bales; (2) using `calculateOee` from `src/lib/oee.ts` for every per-shift KPI computation so numbers are identical to the dashboard; and (3) the Norwegian Excel CSV convention (semicolon separator + UTF-8 BOM).

The page/UX structure is two separate pages: `/reports/shifts` (shift list → shift detail) and `/reports` (date-range analysis). Both are server components that read `searchParams` from the page prop. Date range filtering uses plain HTML `<input type="date">` inputs inside a `<form method="GET">` — no client state library needed; the form submit reloads the page with updated URL params which the server component reads directly. Recharts `ComposedChart` with dual `YAxis` handles the Pareto chart natively; stacked `BarChart` handles bales-per-fraction by day.

Query strategy confirmed via live DB measurements: **two separate SQL queries per report** (one for stops, one for bales) avoids the cartesian product bug that inflates stop_seconds when both are LEFT JOINed in the same SELECT. Both queries return in <15 ms for all 27 shifts. The energy indication for SHFT-01 (avg current draw per shift from the bunker machine) takes ~32 ms for a single shift; this is acceptable for a dedicated shift-detail page but should be skipped from the shifts-list view.

**Primary recommendation:** Two queries per report (stops, bales), server-component pages with `searchParams` prop, `calculateOee` for every shift KPI, Recharts `ComposedChart` for Pareto, stacked `BarChart` for bales-per-day, route handler for CSV export returning semicolon-delimited UTF-8 BOM.

---

## Standard Stack

### Core (all already installed — no new packages required)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `next` | 16.2.9 | App Router server components, route handlers | Already in project |
| `recharts` | ^3.8.1 | ComposedChart (Pareto), BarChart (bales/fraction), LineChart (OEE trend) | Already installed Phase 3 |
| `drizzle-orm` | ^0.45.2 | Aggregate queries with `sql<>` template, `groupBy`, `between` | Already in project |
| `better-sqlite3` | ^12.10.0 | Synchronous DB, already WAL-mode configured | Already in project |
| `vitest` | ^4.1.8 | Unit tests for aggregation helpers | Already in project |

### No new installations required

Everything needed is already in `package.json`. The only runtime consideration is the npm cache flag `--cache .npm-cache` if any `npm install` is ever needed — there are none for Phase 4.

### Alternatives Considered

| Instead of | Could Use | Why We Don't |
|------------|-----------|-------------|
| HTML date inputs + GET form | `nuqs` library | nuqs adds type-safe search params but is overkill; plain HTML date inputs with searchParams prop is simpler and has zero dependencies |
| Semicolon CSV | Comma CSV | Norwegian Excel uses semicolons; comma would break on import for the demo audience |
| Route handler CSV | `json2csv` library | Hand-rolling CSV for flat tabular data with ~10 columns is trivial; no library needed |

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   └── dal.ts                           # EXTEND: add report DAL accessors (getShiftList, getShiftKpis, getAnalysisData, getParetoData, getBalesPerDay, getDayVsEveningComparison)
│
├── app/(app)/
│   ├── reports/
│   │   ├── page.tsx                     # NEW: /reports — date-range analysis (produksjonsleder+)
│   │   ├── components/
│   │   │   ├── AnalysisDateForm.tsx      # 'use client' — date picker form (GET form with useRouter)
│   │   │   ├── OeeTrendChart.tsx         # 'use client' — Recharts LineChart (OEE over period)
│   │   │   ├── ParetoChart.tsx           # 'use client' — Recharts ComposedChart (bar+line, dual YAxis)
│   │   │   └── BalesPerDayChart.tsx      # 'use client' — Recharts BarChart stacked by fraction
│   │   └── shifts/
│   │       ├── page.tsx                  # NEW: /reports/shifts — list of all shifts (all roles)
│   │       └── [shiftId]/
│   │           └── page.tsx              # NEW: /reports/shifts/[shiftId] — single shift detail
│   └── api/
│       └── reports/
│           └── export/
│               └── route.ts              # NEW: GET /api/reports/export?from=&to= — CSV download
```

### Pattern 1: Server Component with searchParams for Date-Range Filtering

**What:** Page server component receives `searchParams` as an async prop. No client state needed for the filter form — the form submits GET and the URL changes, which triggers a new server render.

**Confirmed by:** Official Next.js 16.2.9 docs (`/docs/app/api-reference/file-conventions/page`) — `searchParams` is a `Promise<{ [key: string]: string | string[] | undefined }>` in Next.js 15+; must be awaited.

```typescript
// src/app/(app)/reports/page.tsx
export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  // Oslo-local date strings, e.g. '2026-05-29'
  const fromStr = typeof params.from === 'string' ? params.from : null
  const toStr   = typeof params.to   === 'string' ? params.to   : null

  // Default: last 14 days if no params
  const now = new Date()
  const osloToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo' }).format(now)
  const defaultFrom = osloDateMinusDays(osloToday, 14)

  const from = fromStr ?? defaultFrom
  const to   = toStr ?? osloToday

  const [analysisData, paretoData, balesPerDay, comparison] = await Promise.all([
    getAnalysisData(plant.id, from, to),
    getParetoData(plant.id, from, to),
    getBalesPerDayData(plant.id, from, to),
    getDayVsEveningComparison(plant.id, from, to),
  ])
  // ...
}
```

**Key constraint:** `searchParams` accessing opts the page into dynamic rendering automatically (it is a Request-time API per official docs). No need for `force-dynamic` or `connection()`.

### Pattern 2: Date Filter Form — HTML GET Form with Input Type Date

**What:** A `<form method="GET">` with two `<input type="date">` inputs. Submitting the form appends `?from=YYYY-MM-DD&to=YYYY-MM-DD` to the URL and triggers a full page re-render with new server data.

**Tradeoff:** Using a pure HTML form means the entire page re-renders on submit. This is acceptable for a reports page — not a real-time widget. If the form inputs need to be pre-populated with the current search params, they need to be client-side or passed as default values from the server via a form wrapper component.

**Pattern:**
```tsx
// DateRangeForm.tsx — can be server component with defaultValues from parent
export function DateRangeForm({ from, to }: { from: string; to: string }) {
  return (
    <form method="GET" className="flex items-end gap-3">
      <div>
        <label className="block text-xs text-zinc-500 mb-1">Fra</label>
        <input type="date" name="from" defaultValue={from}
          className="rounded border border-zinc-200 px-2 py-1 text-sm" />
      </div>
      <div>
        <label className="block text-xs text-zinc-500 mb-1">Til</label>
        <input type="date" name="to" defaultValue={to}
          className="rounded border border-zinc-200 px-2 py-1 text-sm" />
      </div>
      <button type="submit"
        className="rounded bg-zinc-900 px-3 py-1 text-sm text-white dark:bg-zinc-50 dark:text-zinc-900">
        Hent
      </button>
    </form>
  )
}
```

### Pattern 3: Shift List Page (/reports/shifts)

**What:** Lists all historical shifts in reverse-chronological order with summary KPIs (OEE %, uptime %, bale count, stop count). Each row links to `/reports/shifts/[shiftId]`.

**Implementation:** The shifts table has 27 rows for 14 days. No pagination needed for the demo. OEE for each shift must be computed using `calculateOee` — do NOT show raw stop_seconds / planned_seconds without going through the shared module.

**Data flow:**
1. `getShiftList(plantId)` — returns shifts with stop aggregate data (see Query Patterns section)
2. For each shift row: call `calculateOee` with the aggregated stop data — this ensures identical numbers to the dashboard

**Note on performance:** Computing `calculateOee` for all 27 shifts in JS (after a single DB query) takes <1 ms. The DB queries take ~15 ms total. No performance concern.

### Pattern 4: Shift Detail Page (/reports/shifts/[shiftId])

**What:** Full KPI report for one historical shift: OEE breakdown (A/P/Q), uptime, stop list, bales per fraction, energy indication.

**Route structure:**
```
src/app/(app)/reports/shifts/[shiftId]/page.tsx
// params is Promise<{ shiftId: string }>
const { shiftId } = await params
const shiftIdNum = parseInt(shiftId, 10)
```

**Access control:** All roles can see shift reports (per nav.ts: `roles: ['operator', 'produksjonsleder', 'admin', 'system_admin']`). The DAL enforces tenant isolation; `shiftId` from the URL is verified against the tenant.

**Energy indication (SHFT-01):** Present avg current draw from the bunker machine as a proxy for energy. Label explicitly: "Gjennomsnittlig strømtrekk (Doseringsbunker)". State visibly that this is an indication only, not kWh. Query takes ~32 ms for a single shift — acceptable.

### Pattern 5: Recharts Pareto Chart (ComposedChart with Dual YAxis)

**What:** Bars = total stop minutes per reason (left Y axis, absolute minutes). Line = cumulative percentage (right Y axis, 0–100%). Data sorted descending by total duration.

**Confirmed:** Recharts `ComposedChart` supports multiple `<YAxis>` components. Each `<Bar>` and `<Line>` references its axis via `yAxisId` prop. `<YAxis orientation="right" yAxisId="right">` places the second axis on the right.

```typescript
// ParetoChart.tsx — 'use client'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// Data shape after enrichment:
// { reason: string; minutes: number; cumPct: number }[]
// Sorted descending by minutes; cumPct is pre-computed (running % of total)

export function ParetoChart({ data }: { data: ParetoPoint[] }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 40, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="reason" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
          <YAxis yAxisId="left" unit=" min" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar yAxisId="left" dataKey="minutes" fill="#3b82f6" isAnimationActive={false} />
          <Line yAxisId="right" type="monotone" dataKey="cumPct" stroke="#f59e0b"
            dot={{ r: 3 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
```

**Pitfall:** XAxis labels for stop reasons are long (~25 chars). Use `angle={-35}` + `textAnchor="end"` + `interval={0}` and increase `margin.bottom` to 60–80 to prevent clipping. Test with all 12 unique stop reasons in the demo data.

### Pattern 6: Recharts Stacked Bar Chart (Bales per Fraction by Day)

**What:** One bar per Oslo calendar day, stacked by fraction (Deink, Tetra, OCC, Miks). X axis = date string, Y axis = bale count.

**Data shape required by Recharts:**
```typescript
// Each entry is one day; fraction names are keys
[
  { date: '29.05', Deink: 84, 'Tetra/Emb': 45, OCC: 67, Miks: 26 },
  { date: '30.05', Deink: 91, 'Tetra/Emb': 38, OCC: 72, Miks: 29 },
  // ...
]
```

**How to build this from query results:** `getBalesPerDayData` returns rows grouped by (date, fraction_name). The page/DAL must pivot these into the wide format above before passing to the chart.

**Pattern:**
```typescript
// src/app/(app)/reports/components/BalesPerDayChart.tsx — 'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const FRACTION_COLORS: Record<string, string> = {
  'Deink': '#3b82f6',
  'Tetra/emballasjepapp': '#10b981',
  'OCC': '#f59e0b',
  'Miks': '#6b7280',
}

export function BalesPerDayChart({ data, fractions }: {
  data: Record<string, number | string>[]  // wide format
  fractions: string[]                      // ordered fraction names
}) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          {fractions.map(f => (
            <Bar key={f} dataKey={f} stackId="a" fill={FRACTION_COLORS[f] ?? '#8884d8'}
              isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

**Note:** `stackId="a"` makes all `Bar` components stack on the same column. Multiple Bar components with different `dataKey` but same `stackId` will stack.

### Pattern 7: CSV Export Route Handler

**What:** `GET /api/reports/export?from=YYYY-MM-DD&to=YYYY-MM-DD` returns a CSV file download.

**Session validation:** Route handlers can call `cookies()` from `next/headers` to read the session cookie. Use the same `verifySession()` pattern as the DAL. If unauthenticated → return 401.

**Norwegian CSV convention:** Norwegian Excel uses **semicolons** as delimiters (because comma is the decimal separator in `nb-NO` locale). Add **UTF-8 BOM** (`﻿`) so Excel opens it with correct encoding without the "import wizard."

**CSV separator choice decision:** Use semicolon + UTF-8 BOM. Document in the export header row comment. This is the correct choice for the demo audience (Norwegian plant operators using Excel with `nb-NO` locale).

```typescript
// src/app/api/reports/export/route.ts
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/dal'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  // Auth check
  const cookieStore = await cookies()
  const cookie = cookieStore.get('session')?.value
  // ... verify or return 401

  const { searchParams } = request.nextUrl
  const from = searchParams.get('from')
  const to   = searchParams.get('to')
  // ... validate params, fetch data, build CSV

  const SEP = ';'
  const BOM = '﻿'
  const header = ['Dato', 'Skift', 'OEE %', 'Tilgjengelighet %', 'Ytelse %', 'Oppetid (min)', 'Planlagt (min)', 'Stopp', 'Stoppetid (min)', 'Totalt baler'].join(SEP)
  const rows = shifts.map(s => [
    s.date, s.shiftType, (s.oee * 100).toFixed(1), /* ... */
  ].join(SEP))

  const csv = BOM + header + '\n' + rows.join('\n')
  const filename = 'produksjonsrapport_' + from + '_' + to + '.csv'

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
```

**Confirmed:** Official Next.js route handler docs show the `new Response(body, { headers: {...} })` pattern for non-JSON responses. Route handlers use Web API `Response`. No `json2csv` or similar library needed.

### Anti-Patterns to Avoid

- **Do NOT combine stops + bales in a single LEFT JOIN GROUP BY**: produces cartesian product multiplication of stop_seconds. **Verified in live DB**: separate queries give correct `stop_seconds = 2520` vs combined gives wrong `267120` for shift 13556. Always use two separate queries.
- **Do NOT recompute OEE inline**: must use `calculateOee` from `src/lib/oee.ts` to guarantee identical numbers to the dashboard (STATE.md flag).
- **Do NOT use `useSearchParams` hook in a Server Component**: use the `searchParams` Page prop instead (official Next.js docs).
- **Do NOT pass Date objects across server/client boundary**: convert to ISO strings or Oslo-formatted labels in the server component before passing to chart components.
- **Do NOT render Recharts in a Server Component**: same rule as Phase 3 — all chart components must have `'use client'`.
- **Do NOT use comma as CSV separator for the Norwegian audience**: Norwegian Excel defaults to semicolon; comma produces misaligned columns.
- **Do NOT compute cumulative percentage SQL-side**: compute in JS after fetching; SQLite window functions exist but Drizzle ORM support is limited and the dataset is tiny (12 stop reasons max).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pareto bar + line dual-axis | Custom SVG chart | Recharts `ComposedChart` with `yAxisId` | Already proven in codebase; dual YAxis is built-in |
| Stacked bar by fraction per day | Custom SVG | Recharts `BarChart` with `stackId="a"` | Same `stackId` on multiple `Bar` components stacks them |
| CSV file download | Custom stream | `new Response(csv, { headers })` route handler | Official Next.js pattern; no library |
| Date range URL state | `nuqs`, `react-query` | HTML `<form method="GET">` + `searchParams` Page prop | Zero deps; re-renders server component automatically |
| OEE calculation | New math | `calculateOee` from `src/lib/oee.ts` | Single source of truth; already tested |
| Stop window clamping | Reimplement | `calculateOee` handles clamping | Already handles `endAt=null`, overlap with shift bounds |

**Key insight:** The hardest correctness pitfall is the cartesian product in combined LEFT JOIN aggregates. The second hardest is OEE inconsistency if computed inline. Both are solved by existing patterns.

---

## Common Pitfalls

### Pitfall 1: Cartesian Product in Combined Stops + Bales JOIN

**What goes wrong:** A single query that LEFT JOINs both stop_events and bale_events gives multiplied stop_seconds (e.g., 267120 instead of 2520 for a shift with 5 stops and 106 bales).

**Why it happens:** Each stop row matches multiple bale rows, multiplying the duration. `SUM(stop.duration)` accumulates the duration once per bale row, not once per stop.

**How to avoid:** Always run stops and bales as **two separate queries**, then join in application code by `shiftId`.

**Verified:** Live DB test: combined query → `stop_seconds = 267120`; separate query → `stop_seconds = 2520` (correct). Ratio = 106 (bale count).

### Pitfall 2: searchParams Type Mismatch in Next.js 15+

**What goes wrong:** Build fails or TypeScript error — `searchParams.from` is not a string.

**Why it happens:** In Next.js 15+, `searchParams` is a `Promise<{ [key: string]: string | string[] | undefined }>`. Values can be `string[]` when the same param appears multiple times (`?from=X&from=Y`).

**How to avoid:**
```typescript
const params = await searchParams
const from = typeof params.from === 'string' ? params.from : null
```

**Confirmed:** Official Next.js 16.2.9 page docs show `searchParams: Promise<{ [key: string]: string | string[] | undefined }>`.

### Pitfall 3: OEE Numbers Differ Between Dashboard and Reports

**What goes wrong:** Users notice OEE % in a shift report differs from the dashboard for the same shift.

**Why it happens:** Inline OEE calculation without the `overlapSeconds` clamping logic gives different results when stops span shift boundaries.

**How to avoid:** Call `calculateOee` from `src/lib/oee.ts` for EVERY OEE value shown anywhere. Pass exact `shiftStart`, `shiftEnd`, and `nowMs` = `shiftEnd.getTime()` for historical shifts.

### Pitfall 4: Recharts XAxis Label Clipping on Pareto Chart

**What goes wrong:** Stop-reason labels (e.g., "Materialopphopning", "Driftsstans transportbånd") are clipped or overlap.

**Why it happens:** Labels are ~20–30 chars long. Default Recharts XAxis does not rotate or truncate.

**How to avoid:** Use `angle={-35} textAnchor="end" interval={0}` on XAxis. Set `margin={{ bottom: 80 }}` on the ComposedChart. Test with all 12 unique reasons from the live DB.

### Pitfall 5: CSV Encoding Issues in Norwegian Excel

**What goes wrong:** Exported CSV opens with garbled Norwegian characters (ø, æ, å) in Excel.

**Why it happens:** Excel on Windows with `nb-NO` locale expects UTF-8 with BOM; without BOM, it defaults to the Windows-1252 code page.

**How to avoid:** Prefix the CSV string with `'﻿'` (UTF-8 BOM). Set `Content-Type: text/csv; charset=utf-8`.

### Pitfall 6: shiftId Ownership Verification

**What goes wrong:** User changes the `[shiftId]` URL param to see another tenant's shift.

**Why it happens:** The URL param is untrusted user input.

**How to avoid:** In `getShiftById(shiftId)`, always add `eq(shifts.tenantId, session.tenantId)` to the WHERE clause. Return null if not found; redirect to 404 or back to the list.

### Pitfall 7: Energy Query Performance on Shift List Page

**What goes wrong:** `/reports/shifts` loads slowly if the energy proxy query (avg current draw) is run for every shift.

**Why it happens:** The `time_series_readings` table has 36,540 rows; joining it across all 27 shifts takes ~32 ms per query. Running 27 parallel queries would take ~32 ms total but adds complexity.

**How to avoid:** Do NOT include energy indication on the shift list page. Only compute it on the shift-detail page (`/reports/shifts/[shiftId]`) where a single shift query is acceptable.

---

## Code Examples

### Query Pattern: Per-Shift Aggregates (Two Separate Queries)

```typescript
// src/lib/dal.ts — report accessor

/**
 * Returns all shifts in [fromDate, toDate] for the plant with stop aggregate data.
 * NOTE: Bale counts fetched in a SEPARATE query — do not combine into this one.
 */
export const getShiftsWithStops = cache(async (
  plantId: number,
  fromDate: string,  // Oslo 'YYYY-MM-DD'
  toDate: string,
) => {
  const session = await verifySession()
  const { startMs: fromMs } = getShiftBoundsUtc(fromDate, 'day')
  const { endMs: toMs } = getShiftBoundsUtc(toDate, 'evening')

  // Query 1: shifts + stop aggregate (LEFT JOIN stop_events only)
  const shiftsWithStops = await db
    .select({
      id: shifts.id,
      shiftType: shifts.shiftType,
      startAt: shifts.startAt,
      endAt: shifts.endAt,
      stopCount: sql<number>`count(${stopEvents.id})`,
      stopSeconds: sql<number>`
        coalesce(sum(
          min(coalesce(${stopEvents.endAt}, ${shifts.endAt}), ${shifts.endAt}) -
          max(${stopEvents.startAt}, ${shifts.startAt})
        ), 0)
      `,
    })
    .from(shifts)
    .leftJoin(stopEvents,
      and(
        lt(stopEvents.startAt, shifts.endAt),
        or(isNull(stopEvents.endAt), gt(stopEvents.endAt, shifts.startAt)),
        eq(stopEvents.plantId, shifts.plantId),
        eq(stopEvents.tenantId, shifts.tenantId),
      )
    )
    .where(
      and(
        eq(shifts.tenantId, session.tenantId),
        eq(shifts.plantId, plantId),
        gte(shifts.startAt, new Date(fromMs)),
        lte(shifts.startAt, new Date(toMs)),
      )
    )
    .groupBy(shifts.id)
    .orderBy(asc(shifts.startAt))

  // Query 2: bale counts per shift per fraction (SEPARATE query)
  const baleRows = await db
    .select({
      shiftId: sql<number>`s.id`,
      fractionId: baleEvents.fractionId,
      baleCount: sql<number>`count(${baleEvents.id})`,
    })
    .from(shifts.as('s'))
    .innerJoin(baleEvents,
      and(
        gte(baleEvents.occurredAt, shifts.startAt),
        lt(baleEvents.occurredAt, shifts.endAt),
        eq(baleEvents.plantId, shifts.plantId),
        eq(baleEvents.tenantId, shifts.tenantId),
      )
    )
    .where(
      and(
        eq(shifts.tenantId, session.tenantId),
        eq(shifts.plantId, plantId),
        gte(shifts.startAt, new Date(fromMs)),
        lte(shifts.startAt, new Date(toMs)),
      )
    )
    .groupBy(shifts.id, baleEvents.fractionId)

  return { shiftsWithStops, baleRows }
})
```

**Note on Drizzle raw SQL for clamped stop overlap:** The `min(coalesce(...), ...)` expression is complex enough to require `sql<number>` template. Drizzle's typed operators do not cover `MIN(COALESCE(...), ...)` directly.

### Applying calculateOee to Historical Shifts

```typescript
// For each historical shift (shiftEnd is in the past), pass nowMs = shiftEnd to avoid
// treating the shift as "ongoing"
const oeeResult = calculateOee({
  shiftStart: shift.startAt,
  shiftEnd: shift.endAt,
  nowMs: shift.endAt.getTime(),   // <-- key: historical shift is fully elapsed
  stopEvents: shiftStopEvents.map(s => ({
    startAt: s.startAt,
    endAt: s.endAt,
    stopType: s.stopType as 'fault' | 'idle' | 'planned',
  })),
  baleCount: totalBalesForShift,
  nominalBalesPerShift: NOMINAL_BALES_PER_SHIFT,
  qualityFactor: QUALITY_FACTOR,
})
```

### Pareto Data Enrichment in JS

```typescript
// Compute cumulative percentage in JS after fetching (not SQL)
function enrichPareto(raw: { reason: string; total_seconds: number; incident_count: number }[]) {
  const sorted = [...raw].sort((a, b) => b.total_seconds - a.total_seconds)
  const totalSeconds = sorted.reduce((sum, r) => sum + r.total_seconds, 0)
  let cumulative = 0
  return sorted.map(r => {
    cumulative += r.total_seconds
    return {
      reason: r.reason,
      minutes: Math.round(r.total_seconds / 60),
      incidentCount: r.incident_count,
      cumPct: totalSeconds > 0 ? Math.round((cumulative / totalSeconds) * 100) : 0,
    }
  })
}
```

### Pareto SQL Query

```typescript
// src/lib/dal.ts
export const getParetoData = cache(async (plantId: number, from: string, to: string) => {
  const session = await verifySession()
  const { startMs } = getShiftBoundsUtc(from, 'day')
  const { endMs } = getShiftBoundsUtc(to, 'evening')

  return db
    .select({
      reason: stopEvents.reason,
      stopType: stopEvents.stopType,
      incidentCount: sql<number>`count(*)`,
      totalSeconds: sql<number>`sum(coalesce(${stopEvents.endAt}, unixepoch()) - ${stopEvents.startAt})`,
    })
    .from(stopEvents)
    .where(
      and(
        eq(stopEvents.tenantId, session.tenantId),
        eq(stopEvents.plantId, plantId),
        isNotNull(stopEvents.reason),
        isNotNull(stopEvents.endAt),
        gte(stopEvents.startAt, new Date(startMs)),
        lt(stopEvents.startAt, new Date(endMs)),
      )
    )
    .groupBy(stopEvents.reason, stopEvents.stopType)
    .orderBy(desc(sql`sum(coalesce(${stopEvents.endAt}, unixepoch()) - ${stopEvents.startAt})`))
})
```

### Day vs Evening Comparison

```typescript
// Aggregate by shiftType over period — produces two rows ('day' and 'evening')
export const getDayVsEveningComparison = cache(async (plantId: number, from: string, to: string) => {
  const session = await verifySession()
  // ... fetch all shifts in period, group by shiftType in JS
  // Use Promise.all([getShiftsWithStops(...)]) and reduce by shiftType
  // Compute avg OEE, avg uptime %, total bales, total stop time per shiftType
})
```

**Note:** Aggregating day vs evening by running `calculateOee` per shift and then averaging per `shiftType` in JS is simpler and more correct than doing OEE math in SQL. Given 27 shifts, this is trivial in JS.

### Energy Indication (Shift Detail)

```typescript
// Per-shift energy proxy: avg bunker current draw
export const getShiftEnergyProxy = cache(async (plantId: number, shiftId: number) => {
  const session = await verifySession()
  const [shift] = await db.select().from(shifts).where(
    and(eq(shifts.id, shiftId), eq(shifts.tenantId, session.tenantId), eq(shifts.plantId, plantId))
  ).limit(1)
  if (!shift) return null

  const [bunker] = await db.select({ id: machines.id, nominalCurrentA: machines.nominalCurrentA })
    .from(machines)
    .where(and(eq(machines.plantId, plantId), eq(machines.tenantId, session.tenantId), eq(machines.type, 'bunker')))
    .limit(1)
  if (!bunker) return null

  const [result] = await db
    .select({
      avgCurrentA: sql<number>`round(avg(${timeSeriesReadings.currentA}), 2)`,
      readingCount: sql<number>`count(*)`,
    })
    .from(timeSeriesReadings)
    .where(
      and(
        eq(timeSeriesReadings.machineId, bunker.id),
        eq(timeSeriesReadings.tenantId, session.tenantId),
        gte(timeSeriesReadings.recordedAt, shift.startAt),
        lt(timeSeriesReadings.recordedAt, shift.endAt),
      )
    )

  return {
    avgCurrentA: result?.avgCurrentA ?? null,
    nominalCurrentA: bunker.nominalCurrentA,
    label: 'Gjennomsnittlig strømtrekk (Doseringsbunker) — indikasjon, ikke kWh',
  }
})
```

---

## Live DB Facts (from direct verification)

These are ground truth for the demo dataset:

| Fact | Value |
|------|-------|
| Total shifts | 27 (14 days × 2, minus current incomplete day) |
| Shifts per type | ~13–14 day, ~13–14 evening |
| Stop events total | 133 |
| Stop events with reason | 133 (all have reasons in demo) |
| Unique stop reasons | 12 |
| Top downtime reason | "Bunker tom" (546 min, 73 incidents) |
| Bale events total | 2,904 |
| Fractions | 4 (ids 57–60: Deink, Tetra/emballasjepapp, OCC, Miks) |
| Time series readings | 36,540 (1-min resolution, 3 machines × 27 shifts × ~480 readings) |
| Shift duration (day) | 480 min (28,800 s); UTC 05:00–13:00 (Oslo 07:00–15:00) |
| Shift duration (evening) | 420 min (25,200 s); UTC 13:00–20:00 (Oslo 15:00–22:00) |
| Tenant IDs | 29 (Steco Demo), 30 (Isolasjonstest) |
| Plant ID | 15 (Returpapir Linje 1) |
| Bunker machine ID | 43, type='bunker', nominalCurrentA=45 |
| Column naming (SQLite) | snake_case physical (shift_type, stop_type) but Drizzle maps to camelCase in TypeScript |
| Timestamp format | Unix seconds (integer); Drizzle's `integer({ mode: 'timestamp' })` returns Date objects |

**Query performance (measured):**
- All-shifts stop aggregate (27 shifts): ~7 ms
- All-shifts bale aggregate by fraction: ~5 ms (part of 12 ms combined run)
- Pareto query (133 stops, 12 groups): ~1 ms
- Single-shift energy proxy (bunker): ~32 ms
- All-machines energy proxy (27 shifts): ~39 ms

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `searchParams` synchronous prop (Next.js 14) | `searchParams` is `Promise<...>` — must `await` (Next.js 15+) | Next.js 15.0.0 | Must `await searchParams` before accessing keys |
| `unstable_noStore()` for dynamic rendering | `connection()` or use of `cookies()` | Next.js 15 | `cookies()` already opts in — same as Phase 3 DAL pattern |
| Recharts 2.x React 19 incompatibility | Recharts 3.x with `^19.0.0` peer dep | Recharts 3.0 | Already resolved in Phase 3 |

**Deprecated/outdated:**
- Synchronous `searchParams` prop: deprecated in Next.js 15+; must `await`. Already committed to in project (Phase 3 dashboard page uses async/await).

---

## Open Questions

1. **Role gate on /reports/shifts/[shiftId]**
   - What we know: nav.ts gives `/reports/shifts` to all roles; shift detail pages are child routes under the same segment
   - What's unclear: should produksjonsleder-only content (e.g. energy cost indicator) be hidden from operators in the detail view, or is the gate per-page?
   - Recommendation: Keep shift detail accessible to all roles (per nav.ts intent); the energy indication is informational for all roles. Produksjonsleder-only gate applies only to `/reports` (analysis page).

2. **Date-range default for /reports analysis page**
   - What we know: 14 days of simulated data exists; today is 2026-06-11
   - What's unclear: should default range be "last 14 days" or "last 7 days" for demo impact?
   - Recommendation: Default to the full 14-day range — maximizes demo impact and shows the full Pareto. Users can narrow.

3. **OEE trend chart granularity**
   - What we know: 27 shifts = up to 27 data points on OEE trend line; X axis could be per-shift (27 points) or per-day (14 points)
   - What's unclear: per-shift (shows day/evening variation) vs per-day (cleaner trend line)
   - Recommendation: Per-shift (27 points), with day/evening color-coded. Shows the analysis depth and matches SHFT-03 (day vs evening comparison).

4. **CSV export scope**
   - What we know: RPRT-04 says "export report data"; multiple datasets exist (shifts, Pareto, bales per day)
   - What's unclear: one CSV with multiple sheets, or one CSV per dataset?
   - Recommendation: One CSV = the shift-level summary table (one row per shift: date, type, OEE, uptime, bales, stops). This is the highest-value export. Pareto and bales-per-day can be added as separate endpoints later; mark as out of scope for Phase 4.

---

## Sources

### Primary (HIGH confidence)

- Next.js 16.2.9 official docs (`/docs/app/api-reference/file-conventions/page`) — confirmed `searchParams` is `Promise<...>` in Next.js 15+; must `await`
- Next.js 16.2.9 official docs (`/docs/app/api-reference/file-conventions/route-handlers`) — confirmed `new Response(body, { headers })` for non-JSON route handler responses; `cookies()` for auth in route handlers
- Direct SQLite queries against `stecopro.db` — confirmed all table schemas, column names (snake_case physical), shift data (27 shifts), stop data (133 events, 12 reasons), bale data (2,904 events, 4 fractions), readings (36,540), tenant/plant IDs
- Query performance benchmark: two-query approach (stops + bales separate) = ~12 ms total; combined join gives WRONG results (cartesian product verified numerically)
- `src/lib/oee.ts`, `src/lib/time.ts`, `src/lib/dal.ts` — direct codebase read confirming existing patterns to reuse
- Recharts API docs (`recharts.github.io/en-US/api/ComposedChart/`, `/api/Bar/`) — confirmed `yAxisId` prop on Bar/Line, multiple YAxis support, `stackId` for stacked bars

### Secondary (MEDIUM confidence)

- WebSearch + Recharts official examples: ComposedChart dual YAxis Pareto pattern — verified against API docs
- WebSearch + Microsoft community: Norwegian Excel uses semicolon CSV separator — confirmed against multiple sources (consistent across results)
- Next.js `useSearchParams` docs — confirmed server-component pattern uses `searchParams` Page prop, not `useSearchParams` hook

### Tertiary (LOW confidence)

- None — all critical claims verified with primary sources

---

## Metadata

**Confidence breakdown:**
- Standard stack (no new deps): HIGH — verified in package.json
- searchParams Page prop pattern: HIGH — official Next.js 16.2.9 docs
- Query patterns and performance: HIGH — tested against live DB
- Cartesian product bug with combined LEFT JOIN: HIGH — numerically verified
- Recharts ComposedChart dual YAxis: HIGH — confirmed via official API docs
- CSV separator (Norwegian semicolon): MEDIUM — confirmed via multiple community sources; definitive regional docs not available
- Energy query performance (32 ms): HIGH — measured live

**Research date:** 2026-06-11
**Valid until:** 2026-09-11 (90 days — stable stack, no fast-moving dependencies)
