// Shift detail page — Server Component.
// Auto-dynamic because getShiftReportDetail calls verifySession() which calls cookies().
// Tenant isolation: getShiftReportDetail returns null for shifts belonging to other tenants
// (the DAL filters by session.tenantId) — we call notFound() in that case.

import { notFound } from 'next/navigation'
import { getCurrentUser, getPlants, getShiftReportDetail, getShiftEnergyProxy, getOpticalSorterUtilization, getBunkerCurrentDraw } from '@/lib/dal'
import CurrentDrawChart from '@/app/(app)/dashboard/components/CurrentDrawChart'
import BeltUtilizationChart from '@/app/(app)/dashboard/components/BeltUtilizationChart'

/** Format a Date as 'HH:mm' in Oslo timezone. */
function toOsloHHmm(d: Date): string {
  return new Intl.DateTimeFormat('no', {
    timeZone: 'Europe/Oslo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/** Format a Date as 'dd.MM.yyyy' in Oslo timezone. */
function toOsloDate(d: Date): string {
  return new Intl.DateTimeFormat('no', {
    timeZone: 'Europe/Oslo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

/** Format a Date as 'dd.MM HH:mm' in Oslo timezone. */
function toOsloDayMonthTime(d: Date): string {
  return new Intl.DateTimeFormat('no', {
    timeZone: 'Europe/Oslo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function pct(v: number) {
  return `${(v * 100).toFixed(1)} %`
}

function secondsToHm(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}t ${m}min` : `${m} min`
}

function stopTypeLabel(t: string): string {
  if (t === 'fault') return 'Feil'
  if (t === 'idle') return 'Tomgang'
  if (t === 'planned') return 'Planlagt'
  return t
}

export default async function ShiftDetailPage({
  params,
}: {
  params: Promise<{ shiftId: string }>
}) {
  const { shiftId } = await params
  const id = parseInt(shiftId, 10)
  if (isNaN(id)) notFound()

  const user = await getCurrentUser()
  if (!user) return null

  const plants = await getPlants()
  const plant = plants[0] ?? null

  if (!plant) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Skiftrapport</h1>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Ingen anlegg</p>
        </div>
      </div>
    )
  }

  const detail = await getShiftReportDetail(plant.id, id)
  if (!detail) notFound()  // null = shift not found OR belongs to another tenant

  const energy = await getShiftEnergyProxy(plant.id, id)

  // Feed bunker (matebunker) current draw across the shift window
  const bunkerRows = await getBunkerCurrentDraw(
    plant.id,
    detail.shift.startAt,
    detail.shift.endAt,
  )
  const bunkerChartData = bunkerRows.map((r) => ({
    label: toOsloHHmm(r.recordedAt),
    currentA: Number(r.currentA ?? 0),
  }))

  // Belt utilisation (Tomra optical sorter) across the shift window
  const beltRows = await getOpticalSorterUtilization(
    plant.id,
    detail.shift.startAt,
    detail.shift.endAt,
  )
  const beltChartData = beltRows
    .filter((r) => r.coveragePct != null)
    .map((r) => ({ label: toOsloHHmm(r.recordedAt), coveragePct: Number(r.coveragePct) }))
  const beltAvg =
    beltChartData.length > 0
      ? Math.round(beltChartData.reduce((sum, r) => sum + r.coveragePct, 0) / beltChartData.length)
      : null

  const shiftLabel = detail.shift.shiftType === 'day' ? 'Dag' : 'Kveld'
  const dateLabel = toOsloDate(detail.shift.startAt)

  const uptimePct =
    detail.oee.plannedSeconds > 0
      ? ((detail.oee.runSeconds / detail.oee.plannedSeconds) * 100).toFixed(1)
      : '—'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Skiftrapport — {shiftLabel} {dateLabel}
      </h1>

      {/* OEE block — mirrors OeeCard structure from dashboard */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          OEE
        </h2>

        {/* Big OEE number */}
        <div className="mb-4 text-4xl font-bold text-zinc-900 dark:text-zinc-50">
          {(detail.oee.oee * 100).toFixed(1)}&thinsp;
          <span className="text-2xl font-normal text-zinc-500">%</span>
        </div>

        {/* A / P / Q breakdown */}
        <dl className="mb-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-800">
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Tilgjengelighet</dt>
            <dd className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {pct(detail.oee.availability)}
            </dd>
          </div>
          <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-800">
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Ytelse</dt>
            <dd className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {pct(detail.oee.performance)}
            </dd>
          </div>
          <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-800">
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Kvalitet</dt>
            <dd className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {pct(detail.oee.quality)}
            </dd>
          </div>
        </dl>

        {/* Uptime */}
        <div className="mb-3 text-sm text-zinc-700 dark:text-zinc-300">
          <span className="font-medium">Driftstid:</span>{' '}
          {secondsToHm(detail.oee.runSeconds)} av {secondsToHm(detail.oee.plannedSeconds)}
        </div>
        <div className="mb-4 text-sm text-zinc-700 dark:text-zinc-300">
          <span className="font-medium">Oppetid:</span>{' '}
          {uptimePct}&thinsp;%
        </div>

        {/* OEE definition — required by spec */}
        <p className="border-t border-zinc-100 pt-3 text-xs leading-relaxed text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
          OEE = Tilgjengelighet × Ytelse × Kvalitet.{' '}
          Tilgjengelighet = driftstid/planlagt tid.{' '}
          Ytelse = faktisk balerate/nominell rate.{' '}
          Kvalitet = konfigurerbar faktor (95&thinsp;%).
        </p>
      </div>

      {/* Stop list */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Stopp
        </h2>
        {detail.stops.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Ingen stopp registrert</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="py-2 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">Start</th>
                  <th className="py-2 pr-4 text-right font-medium text-zinc-500 dark:text-zinc-400">Varighet</th>
                  <th className="py-2 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">Årsak</th>
                  <th className="py-2 text-left font-medium text-zinc-500 dark:text-zinc-400">Type</th>
                </tr>
              </thead>
              <tbody>
                {detail.stops.map((stop, i) => {
                  const shiftEndMs = detail.shift.endAt.getTime()
                  const endMs = stop.endAt ? stop.endAt.getTime() : shiftEndMs
                  const durationMin = Math.max(0, Math.round((endMs - stop.startAt.getTime()) / 60_000))
                  return (
                    <tr
                      key={i}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                    >
                      <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-300">
                        {toOsloDayMonthTime(stop.startAt)}
                      </td>
                      <td className="py-2 pr-4 text-right text-zinc-700 dark:text-zinc-300">
                        {durationMin} min
                      </td>
                      <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-300">
                        {stop.reason ?? '—'}
                      </td>
                      <td className="py-2 text-zinc-700 dark:text-zinc-300">
                        {stopTypeLabel(stop.stopType)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bales per fraction */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Baler per fraksjon
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="py-2 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">Fraksjon</th>
              <th className="py-2 text-right font-medium text-zinc-500 dark:text-zinc-400">Baler</th>
            </tr>
          </thead>
          <tbody>
            {detail.balesByFraction.map((row) => (
              <tr key={row.fractionId} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-300">{row.name}</td>
                <td className="py-2 text-right text-zinc-700 dark:text-zinc-300">{row.count}</td>
              </tr>
            ))}
            <tr className="border-t border-zinc-200 dark:border-zinc-800">
              <td className="py-2 pr-4 font-semibold text-zinc-900 dark:text-zinc-50">Totalt</td>
              <td className="py-2 text-right font-semibold text-zinc-900 dark:text-zinc-50">
                {detail.totalBales}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Feed bunker (matebunker) current draw */}
      {bunkerChartData.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Strømtrekk – Doseringsbunker
          </h2>
          <CurrentDrawChart data={bunkerChartData} />
          {energy && energy.avgCurrentA != null && (
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
              Gjennomsnittlig strømtrekk: <span className="font-semibold">{energy.avgCurrentA} A</span>
              {energy.nominalCurrentA != null && <> av nominelt {energy.nominalCurrentA} A</>}
            </p>
          )}
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Stiplet linje ved 8 A = grense for «Bunker tom»-deteksjon. Indikasjon, ikke kWh.
          </p>
        </div>
      )}

      {/* Belt utilisation (Tomra optical sorter) */}
      {beltChartData.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Utnyttelsesgrad – Tomra Autosort 1
          </h2>
          <BeltUtilizationChart data={beltChartData} />
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            Gjennomsnittlig utnyttelse: <span className="font-semibold">{beltAvg} %</span>
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Utnyttelsesgrad normalisert mot metningspunktet (100 %, stiplet linje). Vedvarende fall
            indikerer redusert materialtilførsel.
          </p>
        </div>
      )}
    </div>
  )
}
