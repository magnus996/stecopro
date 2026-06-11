// Stop detail page (deep-link target: REPT-01/02/04)
// Server Component — getStopDetail returns null for foreign/missing stops → notFound()

import { notFound } from 'next/navigation'
import { getStopDetail } from '@/lib/dal'
import StopActions from '@/components/StopActions'
import Link from 'next/link'

/** Format a Date as 'dd.MM.yyyy HH:mm' in Oslo timezone. */
function toOsloDateTime(d: Date): string {
  return new Intl.DateTimeFormat('no', {
    timeZone: 'Europe/Oslo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/** Format a Date as 'HH:mm' in Oslo timezone. */
function toOsloTime(d: Date): string {
  return new Intl.DateTimeFormat('no', {
    timeZone: 'Europe/Oslo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function durationLabel(startAt: Date, endAt: Date | null): string {
  const endMs = endAt ? endAt.getTime() : Date.now()
  const sec = Math.max(0, Math.round((endMs - startAt.getTime()) / 1000))
  const min = Math.floor(sec / 60)
  const hrs = Math.floor(min / 60)
  if (hrs > 0) return `${hrs}t ${min % 60}m`
  if (min > 0) return `${min}m`
  return `${sec}s`
}

const STOP_TYPE_LABELS: Record<string, string> = {
  fault: 'Feil',
  idle: 'Venter/Bunker tom',
  planned: 'Planlagt stopp',
}

export default async function StopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const stopId = Number(id)

  if (isNaN(stopId)) {
    notFound()
  }

  const detail = await getStopDetail(stopId)
  if (!detail) {
    notFound()
  }

  const { stop, acks, comments } = detail

  // Serialise timestamps before passing to markup / client boundary
  const stopInfo = {
    reason: stop.reason ?? '—',
    stopType: STOP_TYPE_LABELS[stop.stopType] ?? stop.stopType,
    startAt: toOsloDateTime(stop.startAt),
    endAt: stop.endAt ? toOsloDateTime(stop.endAt) : null,
    duration: durationLabel(stop.startAt, stop.endAt),
    ongoing: !stop.endAt,
  }

  const acksWithTimes = acks.map((a) => ({
    userName: a.userName,
    createdAt: toOsloTime(a.createdAt),
  }))

  const commentsWithTimes = comments.map((c) => ({
    userName: c.userName,
    comment: c.comment,
    correctedReason: c.correctedReason,
    photoId: c.photoId,
    createdAt: toOsloTime(c.createdAt),
  }))

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/skift"
        className="inline-flex items-center text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        ← Tilbake til skift
      </Link>

      {/* Stop info header */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
          {stopInfo.reason}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          {stopInfo.stopType}
          {stopInfo.ongoing && (
            <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
              Pågår
            </span>
          )}
        </p>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-zinc-400 dark:text-zinc-500 text-xs uppercase tracking-wide">Start</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-50 mt-0.5">{stopInfo.startAt}</dd>
          </div>
          <div>
            <dt className="text-zinc-400 dark:text-zinc-500 text-xs uppercase tracking-wide">Slutt</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-50 mt-0.5">
              {stopInfo.endAt ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-400 dark:text-zinc-500 text-xs uppercase tracking-wide">Varighet</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-50 mt-0.5">{stopInfo.duration}</dd>
          </div>
          <div>
            <dt className="text-zinc-400 dark:text-zinc-500 text-xs uppercase tracking-wide">Kvitteringer</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-50 mt-0.5">{acks.length}</dd>
          </div>
        </dl>
      </div>

      {/* Acknowledgements */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Kvitteringer
        </h2>
        {acksWithTimes.length === 0 ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">Ingen kvitteringer ennå</p>
        ) : (
          <ul className="space-y-1">
            {acksWithTimes.map((a, i) => (
              <li key={i} className="flex justify-between text-sm">
                <span className="text-zinc-700 dark:text-zinc-300">{a.userName}</span>
                <span className="text-zinc-400 dark:text-zinc-500">{a.createdAt}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Comment thread */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Kommentarer
        </h2>
        {commentsWithTimes.length > 0 && (
          <div className="mb-6 space-y-3">
            {commentsWithTimes.map((c, i) => (
              <div
                key={i}
                className="rounded-md border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800"
              >
                {c.comment && (
                  <p className="text-sm text-zinc-800 dark:text-zinc-200">{c.comment}</p>
                )}
                {c.correctedReason && (
                  <p className="mt-1 text-sm font-medium text-blue-700 dark:text-blue-400">
                    Korrigert årsak: {c.correctedReason}
                  </p>
                )}
                {c.photoId && (
                  <img
                    src={`/api/photos/${c.photoId}`}
                    alt="Vedlagt bilde"
                    className="mt-2 max-h-48 rounded object-cover"
                  />
                )}
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                  {c.userName} · {c.createdAt}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Actions: kvitter + kommentar + kamera */}
        <StopActions stopId={stop.id} />
      </div>
    </div>
  )
}
