// «Mitt skift» — Operator home page (REPT-01/02/03)
// Server Component: fetches today's stops, shift notes, plant status.
// All timestamps serialised to Norwegian strings before crossing to client components.

import { getPlants, getTodaysStopsWithAcks, getShiftNotes, getOpenStop } from '@/lib/dal'
import StopActions from '@/components/StopActions'
import ShiftNoteComposer from '@/components/ShiftNoteComposer'
import Link from 'next/link'

/** Format a Date as 'HH:mm' in Oslo timezone. */
function toOsloTime(d: Date): string {
  return new Intl.DateTimeFormat('no', {
    timeZone: 'Europe/Oslo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

const STOP_TYPE_LABELS: Record<string, string> = {
  fault: 'Feil',
  idle: 'Venter',
  planned: 'Planlagt',
}

export default async function SkiftPage() {
  const plants = await getPlants()
  const plant = plants[0] ?? null

  if (!plant) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Mitt skift</h1>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Ingen anlegg konfigurert.</p>
        </div>
      </div>
    )
  }

  const [todayStops, shiftNotes, openStop] = await Promise.all([
    getTodaysStopsWithAcks(plant.id),
    getShiftNotes(plant.id),
    getOpenStop(plant.id),
  ])

  // Serialise timestamps before client boundary
  const stopsWithTimes = todayStops.map((s) => ({
    id: s.id,
    startTime: toOsloTime(s.startAt),
    endTime: s.endAt ? toOsloTime(s.endAt) : null,
    reason: s.reason ?? '—',
    stopType: s.stopType,
    ackCount: s.ackCount,
  }))

  const notesWithTimes = shiftNotes.map((n) => ({
    id: n.id,
    content: n.content,
    photoId: n.photoId,
    userName: n.userName,
    createdAt: toOsloTime(n.createdAt),
  }))

  const plantStatusLabel = openStop
    ? openStop.stopType === 'idle'
      ? 'Går på tomgang'
      : `Stoppet: ${openStop.reason ?? 'ukjent årsak'}`
    : 'Anlegget kjører'

  const plantStatusColor = openStop
    ? openStop.stopType === 'idle'
      ? 'text-yellow-600 dark:text-yellow-400'
      : 'text-red-600 dark:text-red-400'
    : 'text-green-600 dark:text-green-400'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Mitt skift</h1>

      {/* Plant status */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
          {plant.name}
        </p>
        <p className={`text-sm font-semibold ${plantStatusColor}`}>{plantStatusLabel}</p>
      </div>

      {/* Dagens stopp */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Dagens stopp
        </h2>
        {stopsWithTimes.length === 0 ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">Ingen stopp registrert i dag</p>
        ) : (
          <div className="space-y-4">
            {stopsWithTimes.map((stop) => (
              <div
                key={stop.id}
                className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <Link
                      href={`/stopp/${stop.id}`}
                      className="text-sm font-medium text-zinc-900 dark:text-zinc-50 hover:text-blue-600 dark:hover:text-blue-400 truncate block"
                    >
                      {stop.reason}
                    </Link>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {STOP_TYPE_LABELS[stop.stopType] ?? stop.stopType}
                      {' · '}
                      {stop.startTime}
                      {stop.endTime ? ` – ${stop.endTime}` : ' (pågår)'}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                    {stop.ackCount > 0 ? `${stop.ackCount} kvit.` : 'Ikke kvittert'}
                  </span>
                </div>
                {/* Inline StopActions for quick kvittering/kommentar */}
                <StopActions stopId={stop.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Skiftlogg */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Skiftlogg
        </h2>
        <div className="mb-6">
          <ShiftNoteComposer />
        </div>
        {notesWithTimes.length === 0 ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">Ingen notater ennå</p>
        ) : (
          <div className="space-y-3">
            {notesWithTimes.map((note) => (
              <div
                key={note.id}
                className="rounded-md border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800"
              >
                <p className="text-sm text-zinc-800 dark:text-zinc-200">{note.content}</p>
                {note.photoId && (
                  <img
                    src={`/api/photos/${note.photoId}`}
                    alt="Skiftnotat bilde"
                    className="mt-2 max-h-40 rounded object-cover"
                  />
                )}
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                  {note.userName} · {note.createdAt}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
