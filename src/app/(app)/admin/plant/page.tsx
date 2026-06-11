// Plant configuration page — Server Component.
// Access: produksjonsleder+ (operators are redirected to /dashboard).
// verifySession() called inside DAL accessors makes this route auto-dynamic.

import { redirect } from 'next/navigation'
import { getCurrentUser, getPlants, getPlantConfig } from '@/lib/dal'
import PlantConfigForm from './PlantConfigForm'

export default async function PlantConfigPage() {
  const user = await getCurrentUser()
  if (!user) return null

  // ROLE GATE: operators cannot access plant configuration (RESEARCH Pitfall 3).
  // The proxy only checks the /admin prefix — page must enforce sub-role.
  if (user.role === 'operator') {
    redirect('/dashboard')
  }

  const plants = await getPlants()
  const plant = plants[0] ?? null

  if (!plant) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Anleggsoppsett</h1>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Ingen anlegg tilgjengelig.</p>
        </div>
      </div>
    )
  }

  const config = await getPlantConfig(plant.id)

  if (!config) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Anleggsoppsett</h1>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Anlegg ikke funnet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Anleggsoppsett — {plant.name}
      </h1>

      {/* Editable plant config form */}
      <PlantConfigForm config={config} />

      {/* Read-only shift times card (RESEARCH Pattern 4 — shift times are
          hardcoded in src/lib/time.ts and cannot safely be edited via UI) */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Skifttider
        </h2>
        <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
          <li>
            <span className="font-medium">Dag:</span>{' '}
            07:00–15:00
          </li>
          <li>
            <span className="font-medium">Kveld:</span>{' '}
            15:00–22:00
          </li>
        </ul>
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          Skifttider er fastsatt i systemkonfigurasjon og kan ikke endres her.
        </p>
      </div>
    </div>
  )
}
