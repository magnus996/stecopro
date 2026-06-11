// «Varsler» — Notification history (NOTI-02)
// Server Component: renders push toggle + last 48h notifiable stops.
// Works without push permission — PushToggle degrades gracefully.

import { getPlants, getRecentNotifiableStops } from '@/lib/dal'
import PushToggle from '@/components/PushToggle'
import TriggerStopButton from '@/components/TriggerStopButton'
import Link from 'next/link'

/** Format a Date as 'HH:mm' in Oslo timezone. */
function toOsloTime(d: Date): string {
  return new Intl.DateTimeFormat('no', {
    timeZone: 'Europe/Oslo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/** Format a Date as 'dd.MM HH:mm' in Oslo timezone. */
function toOsloDateTime(d: Date): string {
  return new Intl.DateTimeFormat('no', {
    timeZone: 'Europe/Oslo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export default async function VarslerPage() {
  const plants = await getPlants()
  const plant = plants[0] ?? null

  if (!plant) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Varsler</h1>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Ingen anlegg konfigurert.</p>
        </div>
      </div>
    )
  }

  const recentStops = await getRecentNotifiableStops(plant.id)

  // Serialise timestamps before client boundary
  const stopsWithTimes = recentStops.map((s) => ({
    id: s.id,
    startTime: toOsloDateTime(s.startAt),
    endTime: s.endAt ? toOsloTime(s.endAt) : null,
    reason: s.reason ?? '—',
    stopType: s.stopType,
    ackCount: s.ackCount,
    ackLabel: s.ackCount > 0 ? 'Kvittert' : 'Ikke kvittert',
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Varsler</h1>

      {/* Push toggle */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Aktiver varsler på denne enheten
        </h2>
        <PushToggle />
      </div>

      {/* Dev-only demo trigger */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Demo
          </h2>
          <TriggerStopButton />
        </div>
      )}

      {/* Recent notifiable stops (last 48h) */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Siste 48 timer — feil og bunker tom
        </h2>
        {stopsWithTimes.length === 0 ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            Ingen kritiske stopp siste 48 timer
          </p>
        ) : (
          <div className="space-y-3">
            {stopsWithTimes.map((stop) => (
              <Link
                key={stop.id}
                href={`/stopp/${stop.id}`}
                className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 p-4 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate">
                    {stop.reason}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {stop.startTime}
                    {stop.endTime ? ` – ${stop.endTime}` : ' (pågår)'}
                  </p>
                </div>
                <span
                  className={`shrink-0 ml-3 text-xs font-medium ${
                    stop.ackCount > 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {stop.ackLabel}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
