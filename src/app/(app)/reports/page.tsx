// Analysis page — Server Component.
// Access: produksjonsleder+ (operators are redirected to /reports/shifts).
// searchParams is a Promise in Next.js 15+; must be awaited.
// verifySession() (called inside DAL accessors) sets cookies() making this route auto-dynamic.

import { redirect } from 'next/navigation'
import { getCurrentUser, getPlants, getShiftReportList, getParetoData, getBalesPerDayData, getDayVsEveningComparison } from '@/lib/dal'
import type { ParetoRow, BalesPerDayRow, ShiftComparisonRow } from '@/lib/dal'
import { DateRangeForm } from './components/DateRangeForm'
import { OeeTrendChart } from './components/OeeTrendChart'
import { ParetoChart } from './components/ParetoChart'
import { BalesPerDayChart } from './components/BalesPerDayChart'

// ---- Helpers ----------------------------------------------------------------

/** Subtract days from an Oslo date string 'YYYY-MM-DD'. */
function osloDateMinusDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`)  // noon UTC avoids DST edge cases
  d.setUTCDate(d.getUTCDate() - days)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo' }).format(d)
}

/** Format an Oslo date string 'YYYY-MM-DD' as 'dd.MM'. */
function osloDateToShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}.${m}`
}

/** Format a Date as 'dd.MM' in Oslo timezone. */
function toOsloDDMM(d: Date): string {
  return new Intl.DateTimeFormat('no', {
    timeZone: 'Europe/Oslo',
    day: '2-digit',
    month: '2-digit',
  }).format(d)
}

/** Enrich raw Pareto rows: sort descending, compute cumulative %. */
function enrichPareto(raw: ParetoRow[]): {
  reason: string
  minutes: number
  incidentCount: number
  cumPct: number
}[] {
  const sorted = [...raw].sort((a, b) => b.totalSeconds - a.totalSeconds)
  const totalSeconds = sorted.reduce((sum, r) => sum + r.totalSeconds, 0)
  let cumulative = 0
  return sorted.map((r) => {
    cumulative += r.totalSeconds
    return {
      reason: r.reason,
      minutes: Math.round(r.totalSeconds / 60),
      incidentCount: r.incidentCount,
      cumPct: totalSeconds > 0 ? Math.round((cumulative / totalSeconds) * 100) : 0,
    }
  })
}

/** Pivot bales-per-day long rows into wide format for Recharts stacked BarChart. */
function pivotBalesPerDay(
  rows: BalesPerDayRow[],
  fractionNames: string[],
): Record<string, number | string>[] {
  // Collect distinct sorted dates
  const dateSet = new Set<string>()
  for (const r of rows) dateSet.add(r.osloDate)
  const dates = [...dateSet].sort()

  return dates.map((osloDate) => {
    const row: Record<string, number | string> = {
      date: osloDateToShort(osloDate),
    }
    for (const name of fractionNames) {
      row[name] = 0
    }
    for (const r of rows) {
      if (r.osloDate === osloDate) {
        row[r.fractionName] = (Number(row[r.fractionName] ?? 0)) + r.count
      }
    }
    return row
  })
}

// ---- Page -------------------------------------------------------------------

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const user = await getCurrentUser()
  if (!user) return null

  // ROLE GATE: operators are blocked from the analysis page; send them to shift list.
  if (user.role === 'operator') {
    redirect('/reports/shifts')
  }

  const plants = await getPlants()
  const plant = plants[0] ?? null

  if (!plant) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Analyser</h1>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Ingen anlegg tilgjengelig.</p>
        </div>
      </div>
    )
  }

  // Parse date range from searchParams (must await in Next.js 15+)
  const params = await searchParams
  const fromStr = typeof params.from === 'string' ? params.from : null
  const toStr = typeof params.to === 'string' ? params.to : null

  // Default range: last 14 days (Oslo calendar)
  const now = new Date()
  const osloToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo' }).format(now)
  const defaultFrom = osloDateMinusDays(osloToday, 14)

  const from = fromStr ?? defaultFrom
  const to = toStr ?? osloToday

  // Fetch all analysis data in parallel
  const [shiftRows, paretoRaw, balesData, comparison] = await Promise.all([
    getShiftReportList(plant.id, from, to),
    getParetoData(plant.id, from, to),
    getBalesPerDayData(plant.id, from, to),
    getDayVsEveningComparison(plant.id, from, to),
  ])

  // --- Build chart-ready data SERVER-SIDE (no Date objects across boundary) ---

  // OEE trend: reverse shiftRows (they come in desc order) to get chronological asc
  const oeeTrendData = [...shiftRows].reverse().map((r) => ({
    label: `${toOsloDDMM(r.startAt)} ${r.shiftType === 'day' ? 'Dag' : 'Kveld'}`,
    oeePct: +(r.oee * 100).toFixed(1),
    shiftType: r.shiftType,
  }))

  // Pareto: enrich with cumulative %
  const paretoData = enrichPareto(paretoRaw)

  // Bales per day: pivot to wide format
  const fractionNames = balesData.fractions.map((f) => f.name)
  const balesChartData = pivotBalesPerDay(balesData.rows, fractionNames)

  // --- Period totals (RPRT-01) ---
  const totalShifts = shiftRows.length
  const totalBales = shiftRows.reduce((s, r) => s + r.totalBales, 0)
  const totalStopMin = Math.round(
    shiftRows.reduce((s, r) => s + r.stopSeconds, 0) / 60,
  )
  const avgOeePct =
    totalShifts > 0
      ? +(
          (shiftRows.reduce((s, r) => s + r.oee, 0) / totalShifts) *
          100
        ).toFixed(1)
      : 0

  // --- Day vs evening comparison rows ---
  const comparisonSorted: ShiftComparisonRow[] = [...comparison].sort((a, b) =>
    a.shiftType === 'day' ? -1 : 1,
  )

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Analyser — {plant.name}
      </h1>

      {/* Date range filter form */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <DateRangeForm from={from} to={to} />
      </div>

      {/* Period totals summary (RPRT-01) */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Periode — totaler ({from} – {to})
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Skift</p>
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{totalShifts}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Totalt baler</p>
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{totalBales}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Stoppetid (min)</p>
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{totalStopMin}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Snitt OEE</p>
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{avgOeePct} %</p>
          </div>
        </div>
      </div>

      {/* CSV download link */}
      <div className="flex">
        <a
          href={`/api/reports/export?from=${from}&to=${to}`}
          className="inline-flex items-center rounded bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:opacity-80"
        >
          Last ned CSV
        </a>
      </div>

      {/* OEE trend chart */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          OEE-trend
        </h2>
        <OeeTrendChart data={oeeTrendData} />
      </div>

      {/* Downtime Pareto */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Nedetid – Pareto
        </h2>
        <ParetoChart data={paretoData} />
      </div>

      {/* Bales per fraction per day */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Baleproduksjon per fraksjon
        </h2>
        <BalesPerDayChart data={balesChartData} fractions={fractionNames} />
      </div>

      {/* Day vs evening comparison table (SHFT-03) */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Dag vs. kveld
        </h2>
        {comparisonSorted.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Ingen skiftdata i perioden.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700 text-left text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  <th className="pb-2 pr-4">Skift</th>
                  <th className="pb-2 pr-4 text-right">Antall</th>
                  <th className="pb-2 pr-4 text-right">Snitt OEE %</th>
                  <th className="pb-2 pr-4 text-right">Snitt tilgj. %</th>
                  <th className="pb-2 pr-4 text-right">Totalt baler</th>
                  <th className="pb-2 text-right">Stoppetid (min)</th>
                </tr>
              </thead>
              <tbody>
                {comparisonSorted.map((row) => (
                  <tr
                    key={row.shiftType}
                    className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300"
                  >
                    <td className="py-2 pr-4 font-medium">
                      {row.shiftType === 'day' ? 'Dag' : 'Kveld'}
                    </td>
                    <td className="py-2 pr-4 text-right">{row.shiftCount}</td>
                    <td className="py-2 pr-4 text-right">{(row.avgOee * 100).toFixed(1)}</td>
                    <td className="py-2 pr-4 text-right">
                      {(row.avgUptimePct * 100).toFixed(1)}
                    </td>
                    <td className="py-2 pr-4 text-right">{row.totalBales}</td>
                    <td className="py-2 text-right">
                      {Math.round(row.totalStopSeconds / 60)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
