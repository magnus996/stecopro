interface StopRow {
  startAt: string      // 'dd.MM HH:mm' or 'HH:mm' formatted string (serialised by page.tsx)
  durationMin: number  // computed by page.tsx: Math.round((endAt ?? now - startAt) / 60 000)
  reason: string | null
  stopType: string
}

interface RecentStopsCardProps {
  stops: StopRow[]
}

/**
 * Server card listing recent stops with start time, duration, and reason.
 * Props are pre-serialised by page.tsx — no Date objects cross the boundary.
 */
export default function RecentStopsCard({ stops }: RecentStopsCardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Siste stopp
      </h2>

      {stops.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Ingen stopp registrert</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <th className="pb-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Startet
                </th>
                <th className="pb-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Varighet
                </th>
                <th className="pb-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Årsak
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
              {stops.map((stop, i) => (
                <tr key={i}>
                  <td className="py-2 tabular-nums text-zinc-700 dark:text-zinc-300">
                    {stop.startAt}
                  </td>
                  <td className="py-2 tabular-nums text-zinc-700 dark:text-zinc-300">
                    {stop.durationMin} min
                  </td>
                  <td className="py-2 text-zinc-700 dark:text-zinc-300">
                    {stop.reason ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
