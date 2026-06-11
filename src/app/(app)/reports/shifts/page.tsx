// Shift list page — Server Component.
// Auto-dynamic because getShiftReportList calls verifySession() which calls cookies()
// (same mechanism as dashboard/page.tsx — no explicit force-dynamic needed).

import Link from 'next/link'
import { getCurrentUser, getPlants, getShiftReportList } from '@/lib/dal'

/** Format a Date as 'dd.MM.yyyy' in Oslo timezone. */
function toOsloDate(d: Date): string {
  return new Intl.DateTimeFormat('no', {
    timeZone: 'Europe/Oslo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

export default async function ShiftListPage() {
  const user = await getCurrentUser()
  if (!user) return null

  const plants = await getPlants()
  const plant = plants[0] ?? null

  if (!plant) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Skiftrapporter</h1>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Ingen anlegg</p>
        </div>
      </div>
    )
  }

  // Default date range: last 14 days
  const now = new Date()
  const to = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo' }).format(now)
  const fromDate = new Date(Date.now() - 14 * 24 * 3600 * 1000)
  const from = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo' }).format(fromDate)

  const shifts = await getShiftReportList(plant.id, from, to)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Skiftrapporter</h1>

      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {shifts.length === 0 ? (
          <div className="p-6">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Ingen skift funnet for siste 14 dager.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Dato</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Skift</th>
                  <th className="px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400">OEE</th>
                  <th className="px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400">Tilgjengelighet</th>
                  <th className="px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400">Oppetid</th>
                  <th className="px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400">Stopp (antall)</th>
                  <th className="px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400">Stoppetid</th>
                  <th className="px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400">Baler</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((row) => {
                  const uptimePct =
                    row.uptimePlannedSeconds > 0
                      ? ((row.uptimeRunSeconds / row.uptimePlannedSeconds) * 100).toFixed(1)
                      : '—'
                  const stopMinutes = Math.round(row.stopSeconds / 60)
                  const dateLabel = toOsloDate(row.startAt)
                  const shiftLabel = row.shiftType === 'day' ? 'Dag' : 'Kveld'

                  return (
                    <tr
                      key={row.id}
                      className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/reports/shifts/${row.id}`}
                          className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                        >
                          {dateLabel}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/reports/shifts/${row.id}`}
                          className="text-zinc-700 hover:underline dark:text-zinc-300"
                        >
                          {shiftLabel}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                        {(row.oee * 100).toFixed(1)} %
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                        {(row.availability * 100).toFixed(1)} %
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                        {uptimePct} %
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                        {row.stopCount}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                        {stopMinutes} min
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                        {row.totalBales}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
