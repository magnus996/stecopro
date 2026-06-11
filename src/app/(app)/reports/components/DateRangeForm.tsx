// DateRangeForm — Server component (no client state needed; plain HTML GET form).
// Submitting reloads /reports with ?from=YYYY-MM-DD&to=YYYY-MM-DD.

interface DateRangeFormProps {
  from: string
  to: string
}

export function DateRangeForm({ from, to }: DateRangeFormProps) {
  return (
    <form method="GET" className="flex items-end gap-3">
      <div>
        <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">Fra</label>
        <input
          type="date"
          name="from"
          defaultValue={from}
          className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-sm text-zinc-900 dark:text-zinc-50"
        />
      </div>
      <div>
        <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">Til</label>
        <input
          type="date"
          name="to"
          defaultValue={to}
          className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-sm text-zinc-900 dark:text-zinc-50"
        />
      </div>
      <button
        type="submit"
        className="rounded bg-zinc-900 dark:bg-zinc-50 px-3 py-1 text-sm text-white dark:text-zinc-900"
      >
        Hent
      </button>
    </form>
  )
}
