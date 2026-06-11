# Phase 3: Live Dashboard - Research

**Researched:** 2026-06-11
**Domain:** Next.js 16 App Router dashboard, Recharts, OEE calculation, polling refresh, timezone shift handling
**Confidence:** HIGH (stack verified via npm info, official Next.js docs, direct DB queries, simulator source)

---

## Summary

Phase 3 builds the live production dashboard on top of the existing authenticated Next.js App Router shell and the SQLite database populated by the live simulator. All data already exists in the correct shape — this phase is entirely about querying and rendering it.

The charting library choice is resolved: **Recharts 3.8.1** has explicit React 19 peer dependency support (`^19.0.0`) and requires no workarounds. The auto-refresh pattern is settled by the STATE.md flag ("polling is fine"): a `'use client'` `AutoRefresh` component calls `router.refresh()` on a `setInterval` (30s interval is appropriate). `router.refresh()` re-runs all Server Components on the page and re-fetches their data without losing React or browser state.

The most important architectural decision is the caching behaviour of `better-sqlite3` in Next.js 16: synchronous DB calls complete during **prerendering** unless the component uses a Request-time API or calls `connection()`. The existing DAL pattern is safe — every DAL accessor calls `verifySession()` which calls `cookies()`, a Request-time API, so the entire call chain is already dynamic per-request. New dashboard DAL functions must follow the same pattern.

OEE should be implemented in a single shared module (`src/lib/oee.ts`) used by both Phase 3 (dashboard) and Phase 4 (reports). The formulas are fully derivable from existing tables using Unix-second timestamps.

**Primary recommendation:** Recharts 3.8.1 for charting; `router.refresh()` polling via a tiny client component; DAL functions that follow the `verifySession()` → `tenantId` pattern for all queries; `src/lib/oee.ts` shared module; `src/lib/simulator/time.ts` functions promoted to `src/lib/time.ts`.

---

## Standard Stack

### Core (new packages — all others already in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `recharts` | `^3.8.1` | Line/Area charts for current-draw, Bar for bale counts | React 19 peer dep supported; stable; most-used React charting library |

### No additional packages required

The rest of the stack is already present:
- `next` 16.2.9 — App Router, `useRouter`, `connection()`
- `react` / `react-dom` 19.2.4 — already installed
- `drizzle-orm` + `better-sqlite3` — already querying all required tables
- Tailwind v4 — all UI styling

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts 3.8.1 | Tremor | Tremor is higher-level but couples charts tightly to its own design system; harder to theme to match the existing zinc/Tailwind palette |
| Recharts 3.8.1 | visx | visx is lower-level D3 wrappers; more verbose for simple line + bar charts; no advantage here |
| `router.refresh()` polling | SWR / React Query | SWR/RQ are excellent for client-side data but require API routes; the server-component pattern avoids extra round-trips |
| `router.refresh()` polling | Server-Sent Events | SSE is better for sub-second latency; overkill when simulator ticks every 60 s |

**Installation:**
```bash
npm install --cache .npm-cache recharts
```

Recharts 3.8.1 peer dependencies (confirmed via `npm info recharts peerDependencies`):
```
react: '^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0'
react-dom: '^16.0.0 || ^17.0.0 || ^18.0.0 || ^19.0.0'
react-is: '^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0'
```
React 19.2.4 is within the `^19.0.0` range — **no `--legacy-peer-deps` required**.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   ├── oee.ts               # NEW: shared OEE calculation module (used by Phase 3 + 4)
│   ├── time.ts              # NEW: move osloHour/getShiftType/getShiftBoundsUtc here
│   │                        #   (currently in src/lib/simulator/time.ts — shared by dashboard + reports)
│   └── dal.ts               # EXTEND: add dashboard query functions
│
├── app/(app)/dashboard/
│   ├── page.tsx             # REPLACE: server component, fetches all widget data
│   └── components/
│       ├── AutoRefresh.tsx       # 'use client' — router.refresh() on interval
│       ├── PlantStatusCard.tsx   # server component (receives props)
│       ├── OeeCard.tsx           # server component (receives props)
│       ├── BaleCountsCard.tsx    # server component (receives props)
│       ├── RecentStopsCard.tsx   # server component (receives props)
│       └── CurrentDrawChart.tsx  # 'use client' — Recharts AreaChart
│
└── components/
    └── (existing: Nav.tsx, LogoutButton.tsx)
```

### Pattern 1: Server Component Data Fetching with Recharts Client Leaf

Recharts uses browser-only DOM APIs and must be rendered client-side. The correct pattern passes serializable data from a server component down to a `'use client'` chart component.

```typescript
// src/app/(app)/dashboard/page.tsx (Server Component — no 'use client')
export default async function DashboardPage() {
  const readings = await getDashboardCurrentDraw(plantId)  // from DAL
  // ... other queries
  return (
    <div>
      <CurrentDrawChart data={readings} />  {/* client component */}
    </div>
  )
}

// src/app/(app)/dashboard/components/CurrentDrawChart.tsx
'use client'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export function CurrentDrawChart({ data }: { data: { t: string; currentA: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data}>
        <XAxis dataKey="t" />
        <YAxis domain={[0, 60]} />
        <Tooltip />
        <Area type="monotone" dataKey="currentA" stroke="#3b82f6" fill="#bfdbfe" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
```

Only serializable data (plain objects, numbers, strings) can cross the server/client boundary. Do not pass Date objects; convert to ISO string or formatted string before passing.

### Pattern 2: Auto-Refresh via router.refresh() Polling

`router.refresh()` re-runs all Server Components in the current route, re-fetches their data queries, and merges the updated RSC payload without resetting client-side `useState` or scroll position. This is the correct minimal approach for a 30s polling dashboard.

```typescript
// src/app/(app)/dashboard/components/AutoRefresh.tsx
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function AutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs)
    return () => clearInterval(id)
  }, [router, intervalMs])
  return null  // renders nothing
}
```

Place `<AutoRefresh />` anywhere in the dashboard server component's JSX — it renders nothing but keeps the data fresh.

**Important cache note for better-sqlite3:** `better-sqlite3` is a synchronous database driver. Per Next.js 16 docs, synchronous DB calls can complete during prerendering and be included in the static shell. The existing DAL pattern is safe because `verifySession()` calls `cookies()`, which is a Request-time API that automatically opts the entire component subtree into dynamic rendering. All new DAL functions must call `verifySession()` first — do not add `connection()` separately, the `cookies()` call already handles this.

### Pattern 3: DAL Extension for Dashboard Queries

Follow the established tenant-scoping pattern in `src/lib/dal.ts`. Every function:
1. Calls `verifySession()` first (provides `tenantId`, forces dynamic rendering via `cookies()`)
2. Scopes all queries with `eq(table.tenantId, session.tenantId)`
3. Never accepts `tenantId` as a parameter

```typescript
// src/lib/dal.ts additions
import { connection } from 'next/server'  // NOT needed — cookies() already opts into dynamic

export const getCurrentShift = cache(async (plantId: number) => {
  const session = await verifySession()  // this calls cookies() → dynamic rendering
  const nowSec = Math.floor(Date.now() / 1000)
  return db
    .select()
    .from(shifts)
    .where(
      and(
        eq(shifts.tenantId, session.tenantId),
        eq(shifts.plantId, plantId),
        lte(shifts.startAt, new Date(nowSec * 1000)),
        gt(shifts.endAt, new Date(nowSec * 1000)),
      )
    )
    .limit(1)
})
```

**Timestamp note:** Drizzle `integer({ mode: 'timestamp' })` stores and reads Unix **seconds** in `better-sqlite3`. When using `new Date(value)` for comparisons, multiply seconds by 1000. When storing `Date.now()` (which is ms), divide by 1000.

### Pattern 4: OEE Shared Module

```typescript
// src/lib/oee.ts
export interface OeeInput {
  plannedSeconds: number       // shift duration (28800s for 8h)
  stopEvents: {
    startAt: Date
    endAt: Date | null         // null = ongoing; treat as now
    stopType: 'fault' | 'idle' | 'planned'
  }[]
  baleEvents: {
    fractionId: number
    occurredAt: Date
  }[]
  nominalBalesPerShift: number // from params (120 total for returpapir plant)
  qualityFactor: number        // configurable constant, default 0.95
}

export interface OeeResult {
  availability: number   // 0-1
  performance: number    // 0-1
  quality: number        // 0-1
  oee: number            // 0-1  = A × P × Q
  runSeconds: number
  stopSeconds: number
  totalBales: number
}

export function calculateOee(input: OeeInput): OeeResult {
  const nowMs = Date.now()

  // Availability
  const stopSeconds = input.stopEvents.reduce((acc, s) => {
    const endMs = s.endAt ? s.endAt.getTime() : nowMs
    return acc + (endMs - s.startAt.getTime()) / 1000
  }, 0)
  const clampedStopSec = Math.min(stopSeconds, input.plannedSeconds)
  const runSeconds = input.plannedSeconds - clampedStopSec
  const availability = runSeconds / input.plannedSeconds

  // Performance: actual bales vs nominal bales at full availability
  // nominalBalesPerShift is at 100% availability → scale by run time ratio
  const nominalAtRunTime = input.nominalBalesPerShift * (runSeconds / input.plannedSeconds)
  const actualBales = input.baleEvents.length
  const performance = nominalAtRunTime > 0 ? Math.min(actualBales / nominalAtRunTime, 1) : 0

  // Quality: configurable constant
  const quality = input.qualityFactor

  return {
    availability,
    performance,
    quality,
    oee: availability * performance * quality,
    runSeconds,
    stopSeconds: clampedStopSec,
    totalBales: actualBales,
  }
}
```

**OEE definition for the UI (Norwegian labels):**
- **Tilgjengelighet (A)** = Driftstid / Planlagt skifttid
- **Ytelse (P)** = Faktisk balerate / Nominell balerate (justert for driftstid)
- **Kvalitet (K)** = Konfigurerbar faktor (standard 95%) — synlig definisjon i UI
- **OEE** = A × Y × K

### Pattern 5: Live Plant State Derivation

Plant state logic (in order of priority):
1. Check if `now` is within a shift (using `getShiftType()`). If not → `'outside_shift'`
2. Query latest stop event for the plant ordered by `startAt DESC LIMIT 1`
3. If open stop (`endAt IS NULL`) → check `stopType`:
   - `stopType = 'idle'` (reason = 'Bunker tom') → `'running_empty'`
   - `stopType = 'fault'` or `'planned'` → `'stopped'` (with reason string)
4. If no open stop (or latest stop has `endAt != null`) → `'running'`
5. Freshness guard: if `MAX(recordedAt)` of time_series_readings is more than 3 minutes behind `now` → `'no_data'` (simulator not running)

State display labels (Norwegian):
```
'running'       → 'Kjører'         (green indicator)
'running_empty' → 'Kjører – Bunker tom'  (yellow indicator)
'stopped'       → 'Stanset – {reason}'  (red indicator)
'outside_shift' → 'Utenfor skift'  (grey indicator)
'no_data'       → 'Ingen data'     (grey indicator)
```

**Live data freshness note:** The simulator runs in `next dev` mode via instrumentation.ts. The DB currently contains readings 3-4 hours ahead of wall-clock time (the catch-up backfill ran full simulated data; live tick adds 60s per tick). The freshness check using `MAX(recordedAt)` relative to wall-clock `now` will show "no data" when the server is not running. When `npm run dev` is active, readings advance in real time.

### Pattern 6: Current Draw Graph Data Query

Graph covers the current shift (or last 2 hours if outside shift), showing bunker current draw at 1-minute resolution with low values (5–8A) indicating "bunker empty" state.

```typescript
// Query pattern for CurrentDrawChart data
// Returns last N minutes of bunker readings, newest first
export const getCurrentDrawReadings = cache(async (plantId: number, minutes = 120) => {
  const session = await verifySession()
  const cutoffSec = Math.floor(Date.now() / 1000) - minutes * 60
  // Find bunker machine for this plant
  const [bunkerMachine] = await db
    .select({ id: machines.id })
    .from(machines)
    .where(and(
      eq(machines.plantId, plantId),
      eq(machines.tenantId, session.tenantId),
      eq(machines.type, 'bunker'),
    ))
    .limit(1)
  if (!bunkerMachine) return []
  return db
    .select({
      recordedAt: timeSeriesReadings.recordedAt,
      currentA: timeSeriesReadings.currentA,
      runState: timeSeriesReadings.runState,
    })
    .from(timeSeriesReadings)
    .where(and(
      eq(timeSeriesReadings.machineId, bunkerMachine.id),
      eq(timeSeriesReadings.tenantId, session.tenantId),
      gte(timeSeriesReadings.recordedAt, new Date(cutoffSec * 1000)),
    ))
    .orderBy(asc(timeSeriesReadings.recordedAt))
})
```

### Pattern 7: Timezone Helpers — Promote to Shared Module

`src/lib/simulator/time.ts` contains `osloHour()`, `getShiftType()`, and `getShiftBoundsUtc()`. These are needed by both the dashboard (Phase 3) and reports (Phase 4). They should be moved to `src/lib/time.ts` with re-export from the simulator module for backward compatibility.

```typescript
// src/lib/time.ts (new shared location)
export { osloHour, getShiftType, getShiftBoundsUtc } from './simulator/time'
// ... or copy and keep them canonical here
```

The simulator's `time.ts` uses `Intl.DateTimeFormat` with `Europe/Oslo` timezone — correct, DST-safe approach. Reuse exactly.

### Anti-Patterns to Avoid

- **Do not add `connection()` before DAL calls**: The `cookies()` call in `verifySession()` already forces dynamic rendering. Adding `connection()` is redundant.
- **Do not pass Date objects from server to client components**: Drizzle returns Date objects for timestamp columns. Convert to ISO string or Unix number before passing as chart data props.
- **Do not render Recharts in a Server Component**: Recharts uses `window` and `document` APIs. Always mark chart-containing components with `'use client'`.
- **Do not compare raw UTC hours to shift boundaries**: Always use `getShiftType()` from `time.ts` — it applies the Europe/Oslo offset correctly including DST transitions.
- **Do not use `router.refresh()` from a Server Component**: It can only be used in `'use client'` components via `useRouter()`.
- **Do not compute OEE inline per widget**: Use the shared `src/lib/oee.ts` module so Phase 4 reports produce identical numbers.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Area/line chart with tooltip | Custom SVG chart | Recharts 3.8.1 | Responsive, accessible, tooltip/zoom included |
| Polling auto-refresh | Custom fetch loop | `router.refresh()` + `setInterval` | Merges RSC payload without resetting state; simpler than managing fetch |
| Oslo timezone DST handling | Custom UTC offset math | `Intl.DateTimeFormat` with `timeZone: 'Europe/Oslo'` | Already in `src/lib/simulator/time.ts`; DST-correct |
| OEE percentage formatting | Manual `(0.913).toFixed(1) + '%'` | `(value * 100).toFixed(1) + ' %'` — inline, no library needed | Simple enough |

**Key insight:** The hardest part of this phase is the query design (OEE from stop events, per-fraction bale counts for current shift), not the UI framework. Invest time in correct timestamp math (Unix seconds × 1000 for Date constructor) and proper shift boundary queries.

---

## Common Pitfalls

### Pitfall 1: Recharts in a Server Component

**What goes wrong:** `ReferenceError: window is not defined` at build/runtime — Recharts accesses browser globals.
**Why it happens:** Forgetting `'use client'` on the chart-containing component when server components are the default in App Router.
**How to avoid:** Any component that imports from `recharts` MUST have `'use client'` as its first line.
**Warning signs:** Build error mentioning `window`, `document`, or `ResizeObserver`.

### Pitfall 2: Stale Prerendered Data

**What goes wrong:** Dashboard shows the same data even after simulator advances.
**Why it happens:** `better-sqlite3` queries complete during prerendering if no Request-time API is used. The page gets baked into the static shell.
**How to avoid:** All dashboard DAL functions call `verifySession()` which calls `cookies()` — this forces dynamic rendering. Confirm this is the case for every new function added.
**Warning signs:** Data never changes when `<AutoRefresh>` fires `router.refresh()`.

### Pitfall 3: Timestamp Unit Mismatch

**What goes wrong:** OEE calculation returns 0% or 100%; shift boundary queries return no rows.
**Why it happens:** Drizzle `integer({ mode: 'timestamp' })` with `better-sqlite3` stores **Unix seconds** in SQLite but Drizzle returns JavaScript `Date` objects. `Date.now()` returns **milliseconds**. Mixing units silently produces wrong comparisons.
**How to avoid:**
- Always use `new Date(unixSeconds * 1000)` when constructing Dates from DB values.
- `Math.floor(Date.now() / 1000)` to get a Unix seconds integer for DB comparisons.
- Verified: stop event `endAt - startAt = 840` means 840 seconds = 14 minutes (correct).
**Warning signs:** Shift lookup returns no rows; stop durations appear to be milliseconds (numbers like `840000`).

### Pitfall 4: ResponsiveContainer Requires a Sized Parent

**What goes wrong:** Chart renders at 0×0 or invisible.
**Why it happens:** `ResponsiveContainer width="100%"` requires a parent with an explicit height or a CSS height applied.
**How to avoid:** Wrap the chart component's outer div with an explicit height class (`h-48`, `h-64`) or use the Recharts 3 `responsive` prop with CSS `height: 100%` on a sized parent.
**Warning signs:** Chart renders but is invisible; no console error.

### Pitfall 5: OEE Stop Clamping for Ongoing Stops

**What goes wrong:** A stop that started at shift start and has no `endAt` causes OEE availability to go negative (stop duration > planned shift time).
**Why it happens:** An open stop (`endAt IS NULL`) uses `Date.now()` as end time, which may be outside the shift window.
**How to avoid:** Clamp stop duration to the shift boundaries: `stopEnd = min(endAt ?? now, shiftEnd)`, `stopStart = max(startAt, shiftStart)`. Only count overlap with the shift window.

### Pitfall 6: `React.cache()` Spans a Single Request

**What goes wrong:** Dev mode shows stale data; same data across multiple calls in same render.
**Why it happens:** `React.cache()` (used in `dal.ts`) deduplicates identical calls within a single request, not across requests. This is correct behaviour — each `router.refresh()` triggers a new request with fresh cache entries.
**How to avoid:** Understand this is correct; do not work around it.
**Warning signs:** None — this is expected behaviour.

---

## Code Examples

### Current Draw Chart (complete client component)

```typescript
// src/app/(app)/dashboard/components/CurrentDrawChart.tsx
'use client'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

interface Reading {
  label: string   // formatted time 'HH:mm'
  currentA: number
}

// Empty detection threshold from params: CURRENT_BUNKER_EMPTY_MAX = 8A
const EMPTY_THRESHOLD = 8

export function CurrentDrawChart({ data }: { data: Reading[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis domain={[0, 60]} tick={{ fontSize: 11 }} unit=" A" width={40} />
        <Tooltip formatter={(v: number) => [`${v.toFixed(1)} A`, 'Strømtrekk']} />
        <ReferenceLine y={EMPTY_THRESHOLD} stroke="#f59e0b" strokeDasharray="3 3"
          label={{ value: 'Bunker tom', position: 'insideTopLeft', fontSize: 10 }} />
        <Area
          type="monotone"
          dataKey="currentA"
          stroke="#3b82f6"
          fill="#dbeafe"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
```

### Auto-Refresh Component

```typescript
// src/app/(app)/dashboard/components/AutoRefresh.tsx
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function AutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs)
    return () => clearInterval(id)
  }, [router, intervalMs])
  return null
}
```

### OEE Calculation Query Pattern

```typescript
// src/lib/dal.ts additions (simplified)
export const getShiftStopEvents = cache(async (plantId: number, shiftStartAt: Date, shiftEndAt: Date) => {
  const session = await verifySession()
  return db
    .select()
    .from(stopEvents)
    .where(and(
      eq(stopEvents.tenantId, session.tenantId),
      eq(stopEvents.plantId, plantId),
      // Include stops that overlap the shift window (started before shift end)
      lt(stopEvents.startAt, shiftEndAt),
      // AND either ongoing (endAt IS NULL) or ended after shift start
      or(
        isNull(stopEvents.endAt),
        gt(stopEvents.endAt, shiftStartAt),
      ),
    ))
    .orderBy(desc(stopEvents.startAt))
})
```

### Shift Boundary Lookup

```typescript
// Current shift: find the shift row whose window covers now
export const getCurrentShiftForPlant = cache(async (plantId: number) => {
  const session = await verifySession()
  const now = new Date()
  const [shift] = await db
    .select()
    .from(shifts)
    .where(and(
      eq(shifts.tenantId, session.tenantId),
      eq(shifts.plantId, plantId),
      lte(shifts.startAt, now),
      gt(shifts.endAt, now),
    ))
    .limit(1)
  return shift ?? null  // null = outside shift hours
})
```

### Norwegian UI Labels

```typescript
// Dashboard widget labels (Norwegian)
const LABELS = {
  plantStatus: 'Anleggsstatus',
  running: 'Kjører',
  runningEmpty: 'Kjører – Bunker tom',
  stopped: (reason: string) => `Stanset – ${reason}`,
  outsideShift: 'Utenfor skift',
  noData: 'Ingen data',

  oeeTitle: 'OEE – Gjeldende skift',
  availability: 'Tilgjengelighet',
  performance: 'Ytelse',
  quality: 'Kvalitet',
  oeeDefinition: 'OEE = Tilgjengelighet × Ytelse × Kvalitet. Tilgjengelighet = driftstid/planlagt tid. Ytelse = faktisk balerate/nominell rate. Kvalitet = konfigurerbar faktor (95%).',

  baleCounts: 'Baler produsert',
  currentShift: 'Gjeldende skift',
  today: 'I dag',

  currentDraw: 'Strømtrekk – Doseringsbunker',
  recentStops: 'Siste stopp',
  stopReason: 'Årsak',
  duration: 'Varighet',
  stopStart: 'Startet',

  uptime: 'Oppetid',
  throughput: 'Kapasitetsutnyttelse',
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `unstable_noStore()` to opt out of prerendering | `connection()` from `next/server` | Next.js 15.0.0 | Same semantics, stable API |
| `ResponsiveContainer` always required | Recharts 3.3+ `responsive` prop on chart | Recharts 3.3 | Either approach works |
| `react-is` peer dep mismatch causing React 19 install failure | Recharts 3.x declares `^19.0.0` peer dep | Recharts 3.x series | No install flag needed |
| Recharts 2.x uses internal `CategoricalChartState` in `<Customized>` | Recharts 3.x provides hooks (`useActiveTooltipLabel`) | Recharts 3.0 | Breaking change but we don't use Customized |

**Deprecated/outdated:**
- `unstable_noStore`: replaced by `connection()` — do not use in new code
- Recharts 2.x: React 19 required alpha builds; 3.x is stable with full support

---

## Open Questions

1. **Quality factor source**: Where should the `qualityFactor` constant (default 0.95) live?
   - What we know: PROJECT.md says "configurable constant" but no config table exists yet
   - What's unclear: Per-plant config table (Phase 5 ADMN-01) vs hardcoded constant for Phase 3
   - **Recommendation:** Hardcode `QUALITY_FACTOR = 0.95` in `src/lib/oee.ts` for Phase 3; Phase 5 adds per-plant config override. Note the hardcoded value visibly in the OEE widget definition text.

2. **Dashboard plant selector**: The current shell shows all plants for the tenant. For Phase 3, should the dashboard show a plant selector, or default to the first plant?
   - What we know: Demo has one plant per tenant; `getPlants()` returns one row for the demo tenant
   - What's unclear: UX for multi-plant tenants
   - **Recommendation:** Default to `plants[0]`; show plant name as heading. Add selector later (Phase 5).

3. **"Today" bale counts boundary**: Should "today" mean since midnight Oslo time, or the entire calendar day?
   - What we know: Shifts are 07:00-15:00 and 15:00-22:00; no shift covers 22:00-07:00
   - **Recommendation:** "Today" = since 07:00 Oslo time today (i.e., day shift start). This covers all shifts that are operational "today" and excludes the overnight dead period.

4. **Performance metric with empty-bunker time**: Bunker-empty stops are `stopType = 'idle'`, counted in downtime. Should they reduce Performance or Availability?
   - **Recommendation:** Count `idle` stops in Availability (they reduce run time). This is consistent with the ISO 22400-2 definition where any unplanned production loss reduces availability, and Performance measures speed losses during actual running time.

---

## Sources

### Primary (HIGH confidence)
- npm registry (`npm info recharts`) — confirmed recharts 3.8.1 peer deps include React `^19.0.0`
- `https://nextjs.org/docs/app/api-reference/functions/use-router` — confirmed `router.refresh()` semantics (re-runs server components, merges RSC payload)
- `https://nextjs.org/docs/app/getting-started/caching` — confirmed `better-sqlite3` prerendering behaviour, `connection()` API
- `https://nextjs.org/docs/app/api-reference/functions/connection` — confirmed cookies() is a Request-time API that already opts into dynamic rendering; `connection()` docs include explicit `better-sqlite3` example
- Direct SQLite queries against `stecopro.db` — confirmed timestamp format (Unix seconds), shift structure (28800s = 8h), stop event format, current draw data shape

### Secondary (MEDIUM confidence)
- `https://github.com/recharts/recharts/wiki/3.0-migration-guide` — Recharts 3 breaking changes (CategoricalChartState removed, `responsive` prop added in 3.3)
- WebSearch: Recharts + Next.js App Router server/client component pattern — confirmed `'use client'` requirement, data-passing pattern

### Tertiary (LOW confidence)
- WebSearch results on SSE as alternative to polling — not pursued (polling confirmed appropriate by STATE.md)

---

## Metadata

**Confidence breakdown:**
- Standard stack (Recharts install): HIGH — verified via `npm info`
- Auto-refresh pattern: HIGH — verified against official Next.js docs
- Caching / dynamic rendering: HIGH — verified against official Next.js 16.2.9 docs including better-sqlite3 example
- OEE formulas: HIGH — derived from actual DB data, confirmed via params.ts nominal rates
- Timezone handling: HIGH — existing `src/lib/simulator/time.ts` is verified correct
- Recharts API (AreaChart, BarChart): MEDIUM — confirmed from community examples; API unchanged in 3.x for these components

**Research date:** 2026-06-11
**Valid until:** 2026-09-11 (90 days — Next.js and Recharts move fast but core APIs are stable)
