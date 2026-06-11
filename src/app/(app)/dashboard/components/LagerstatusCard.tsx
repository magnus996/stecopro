interface StockRow {
  name: string
  stock: number
}

interface LagerstatusCardProps {
  rows: StockRow[]
}

/**
 * Server card showing current stock per fraction (produced − shipped).
 * Mirrors BaleCountsCard markup/style.
 */
export default function LagerstatusCard({ rows }: LagerstatusCardProps) {
  const total = rows.reduce((s, r) => s + r.stock, 0)

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Lagerstatus
      </h2>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((r) => (
            <tr key={r.name}>
              <td className="py-1.5 text-zinc-700 dark:text-zinc-300">{r.name}</td>
              <td className="py-1.5 text-right font-medium tabular-nums text-zinc-900 dark:text-zinc-50">
                {r.stock}
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
    </div>
  )
}
