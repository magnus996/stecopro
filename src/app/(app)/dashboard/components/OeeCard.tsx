import type { OeeResult } from '@/lib/oee'

interface OeeCardProps {
  oee: OeeResult | null
  /** Current-shift uptime */
  shiftUptime: { runSeconds: number; plannedSeconds: number } | null
  /** Today uptime (since 07:00 Oslo) */
  todayUptime: { runSeconds: number; plannedSeconds: number }
}

function pct(v: number) {
  return `${(v * 100).toFixed(1)} %`
}

function secondsToHm(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}t ${m}min` : `${m} min`
}

/**
 * Server card showing OEE for the current shift with Tilgjengelighet/Ytelse/Kvalitet
 * breakdown and a visible definition text as required by the plan spec.
 */
export default function OeeCard({ oee, shiftUptime, todayUptime }: OeeCardProps) {
  const todayUptimePct =
    todayUptime.plannedSeconds > 0
      ? ((todayUptime.runSeconds / todayUptime.plannedSeconds) * 100).toFixed(1)
      : '—'

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        OEE – Gjeldende skift
      </h2>

      {oee === null ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Utenfor skift</p>
      ) : (
        <>
          {/* Big OEE number */}
          <div className="mb-4 text-4xl font-bold text-zinc-900 dark:text-zinc-50">
            {(oee.oee * 100).toFixed(1)}&thinsp;<span className="text-2xl font-normal text-zinc-500">%</span>
          </div>

          {/* A / P / Q breakdown */}
          <dl className="mb-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-800">
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">Tilgjengelighet</dt>
              <dd className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {pct(oee.availability)}
              </dd>
            </div>
            <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-800">
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">Ytelse</dt>
              <dd className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {pct(oee.performance)}
              </dd>
            </div>
            <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-800">
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">Kvalitet</dt>
              <dd className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {pct(oee.quality)}
              </dd>
            </div>
          </dl>

          {/* Uptime rows */}
          {shiftUptime && (
            <div className="mb-3 text-sm text-zinc-700 dark:text-zinc-300">
              <span className="font-medium">Driftstid (skift):</span>{' '}
              {secondsToHm(shiftUptime.runSeconds)} av{' '}
              {secondsToHm(shiftUptime.plannedSeconds)}
            </div>
          )}
          <div className="mb-4 text-sm text-zinc-700 dark:text-zinc-300">
            <span className="font-medium">Oppetid i dag:</span> {todayUptimePct}&thinsp;%
          </div>
        </>
      )}

      {/* Visible OEE definition — required by spec */}
      <p className="border-t border-zinc-100 pt-3 text-xs leading-relaxed text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        OEE = Tilgjengelighet × Ytelse × Kvalitet.{' '}
        Tilgjengelighet = driftstid/planlagt tid.{' '}
        Ytelse = faktisk balerate/nominell rate.{' '}
        Kvalitet = konfigurerbar faktor (95&thinsp;%).
      </p>
    </div>
  )
}
