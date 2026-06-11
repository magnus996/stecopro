interface FractionCount {
  name: string
  count: number
}

interface BaleCountsCardProps {
  currentShift: FractionCount[]
  today: FractionCount[]
}

function CountTable({ rows }: { rows: FractionCount[] }) {
  const total = rows.reduce((s, r) => s + r.count, 0)
  return (
    <table className="w-full text-sm">
      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {rows.map((r) => (
          <tr key={r.name}>
            <td className="py-1.5 text-zinc-700 dark:text-zinc-300">{r.name}</td>
            <td className="py-1.5 text-right font-medium tabular-nums text-zinc-900 dark:text-zinc-50">
              {r.count}
            </td>
          </tr>
        ))}
        <tr className="border-t border-zinc-200 dark:border-zinc-700">
          <td className="pt-2 font-semibold text-zinc-900 dark:text-zinc-50">Totalt</td>
          <td className="pt-2 text-right font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {total}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

/**
 * Server card showing per-fraction bale counts for the current shift and for today
 * (since 07:00 Oslo). Fractions arrive pre-ordered by sortOrder from the DAL.
 */
export default function BaleCountsCard({ currentShift, today }: BaleCountsCardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Baler produsert
      </h2>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            Gjeldende skift
          </h3>
          {currentShift.length === 0 ? (
            <p className="text-sm text-zinc-400">Utenfor skift</p>
          ) : (
            <CountTable rows={currentShift} />
          )}
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            I dag
          </h3>
          <CountTable rows={today} />
        </div>
      </div>
    </div>
  )
}
