// Dashboard page — Server Component.
// verifySession() (called inside getDashboardData + sub-accessors) sets cookies()
// which Next.js detects as a dynamic API, making this route auto-dynamic.
// No explicit `export const dynamic = 'force-dynamic'` required.

import { getCurrentUser, getPlants, getDashboardData } from '@/lib/dal'
import AutoRefresh from './components/AutoRefresh'
import PlantStatusCard from './components/PlantStatusCard'
import OeeCard from './components/OeeCard'
import BaleCountsCard from './components/BaleCountsCard'
import RecentStopsCard from './components/RecentStopsCard'
import CurrentDrawChart from './components/CurrentDrawChart'

/** Format a Date as 'HH:mm' in Oslo timezone. */
function toOsloHHmm(d: Date): string {
  return new Intl.DateTimeFormat('no', {
    timeZone: 'Europe/Oslo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/** Format a Date as 'dd.MM HH:mm' in Oslo timezone. */
function toOsloFullDateTime(d: Date): string {
  return new Intl.DateTimeFormat('no', {
    timeZone: 'Europe/Oslo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export default async function DashboardPage() {
  const user = await getCurrentUser()
  // getCurrentUser redirects to /login via verifySession if not authenticated.
  if (!user) return null

  const plants = await getPlants()
  const plant = plants[0] ?? null

  if (!plant) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Dashbord</h1>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Ingen anlegg</p>
        </div>
      </div>
    )
  }

  const data = await getDashboardData(plant.id)
  const nowMs = data.now.getTime()

  // Serialise currentDraw readings: recordedAt (Date) -> 'HH:mm' Oslo label
  const chartData = data.currentDraw.map((r) => ({
    label: toOsloHHmm(r.recordedAt),
    currentA: Number(r.currentA ?? 0),
  }))

  // Serialise recentStops: startAt/endAt (Date) -> strings + durationMin number
  const recentStopRows = data.recentStops.map((s) => {
    const endMs = s.endAt ? s.endAt.getTime() : nowMs
    const durationMin = Math.max(0, Math.round((endMs - s.startAt.getTime()) / 60_000))
    // Use full date/time for stops that started on a different calendar day
    const startAt = toOsloFullDateTime(s.startAt)
    return {
      startAt,
      durationMin,
      reason: s.reason,
      stopType: s.stopType,
    }
  })

  // Bale count arrays — already plain {name, count} via DAL, just strip fractionId/sortOrder
  const currentShiftBales = data.baleCounts.currentShift.map((r) => ({
    name: r.name,
    count: r.count,
  }))
  const todayBales = data.baleCounts.today.map((r) => ({
    name: r.name,
    count: r.count,
  }))

  // Shift uptime for OEE card
  const shiftUptime = data.oee
    ? { runSeconds: data.oee.runSeconds, plannedSeconds: data.oee.plannedSeconds }
    : null

  // Throughput / capacity utilisation
  const { expectedBalesSoFar, actualBalesSoFar, nominalCapacityTph } = data.throughput
  const capacityPct =
    expectedBalesSoFar > 0
      ? Math.round((actualBalesSoFar / expectedBalesSoFar) * 100)
      : null

  return (
    <div className="space-y-6">
      {/* Auto-refresh: re-fetches server data every 30 s while running */}
      <AutoRefresh />

      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Dashbord — {plant.name}
      </h1>

      {/* Throughput indicator */}
      <div className="rounded-lg border border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Kapasitetsutnyttelse
        </p>
        <p className="mt-0.5 text-sm text-zinc-700 dark:text-zinc-300">
          {actualBalesSoFar} baler produsert hittil i skiftet
          {expectedBalesSoFar > 0 ? ` (forventet ${expectedBalesSoFar})` : ''}
          {capacityPct !== null ? ` — ${capacityPct} %` : ''}
          {nominalCapacityTph !== null ? ` · Nominell kapasitet: ${nominalCapacityTph} t/h` : ''}
        </p>
      </div>

      {/* Main 2-column widget grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PlantStatusCard state={data.state} reason={data.openStopReason} />

        <OeeCard
          oee={data.oee}
          shiftUptime={shiftUptime}
          todayUptime={data.todayUptime}
        />

        <BaleCountsCard currentShift={currentShiftBales} today={todayBales} />

        <RecentStopsCard stops={recentStopRows} />
      </div>

      {/* Full-width current-draw chart */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Strømtrekk – Doseringsbunker
        </h2>
        <CurrentDrawChart data={chartData} />
        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
          Stiplet linje ved 8 A = grense for &laquo;Bunker tom&raquo;-deteksjon
        </p>
      </div>
    </div>
  )
}
