import type { PlantState } from '@/lib/dal'

interface PlantStatusCardProps {
  state: PlantState
  reason: string | null
}

const STATE_CONFIG: Record<PlantState, { label: (reason: string | null) => string; dotClass: string }> = {
  running:       { label: () => 'Kjører',                    dotClass: 'bg-green-500' },
  running_empty: { label: () => 'Kjører – Bunker tom', dotClass: 'bg-amber-400' },
  stopped:       { label: (r) => `Stanset – ${r ?? 'ukjent årsak'}`, dotClass: 'bg-red-500' },
  outside_shift: { label: () => 'Utenfor skift',             dotClass: 'bg-zinc-400' },
  no_data:       { label: () => 'Ingen data',                dotClass: 'bg-zinc-300 dark:bg-zinc-600' },
}

/**
 * Server card showing the current plant state with a colour indicator dot and a
 * Norwegian label. Part of the Phase 3 live dashboard.
 */
export default function PlantStatusCard({ state, reason }: PlantStatusCardProps) {
  const config = STATE_CONFIG[state]
  const label = config.label(reason)

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Anleggsstatus
      </h2>
      <div className="flex items-center gap-3">
        <span
          className={`h-4 w-4 flex-shrink-0 rounded-full ${config.dotClass}`}
          aria-hidden="true"
        />
        <span className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{label}</span>
      </div>
    </div>
  )
}
