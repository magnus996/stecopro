import { getCurrentUser, getPlants, getTenant } from '@/lib/dal'
import type { UserRole } from '@/db/schema'

const ROLE_LABELS: Record<UserRole, string> = {
  operator: 'Operatør',
  produksjonsleder: 'Produksjonsleder',
  admin: 'Administrator',
  system_admin: 'Systemadministrator',
}

export default async function DashboardPage() {
  const user = await getCurrentUser()
  const plants = await getPlants()
  const tenant = await getTenant()

  // getCurrentUser redirects to /login if not authenticated (via verifySession in DAL)
  // So user is guaranteed to be non-null here if we reach this point.
  // We type-assert to keep TypeScript happy since the layout also redirects on null.
  if (!user) return null

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Dashbord</h1>

      {/* Auth + tenant context card */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Innlogget kontekst
        </h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Navn</dt>
            <dd className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-50">{user.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">E-post</dt>
            <dd className="mt-0.5 text-sm text-zinc-700 dark:text-zinc-300">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Rolle</dt>
            <dd className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-50">{ROLE_LABELS[user.role]}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Tenant</dt>
            <dd className="mt-0.5 text-sm text-zinc-700 dark:text-zinc-300">{tenant?.name ?? user.tenantId}</dd>
          </div>
        </dl>
      </div>

      {/* Tenant-scoped plant list */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Anlegg for denne tenanten ({plants.length})
        </h2>
        {plants.length === 0 ? (
          <p className="text-sm text-zinc-500">Ingen anlegg funnet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {plants.map((plant) => (
              <li key={plant.id} className="py-3">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{plant.name}</p>
                {plant.description && (
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{plant.description}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Phase notice */}
      <p className="text-xs text-zinc-400 dark:text-zinc-600">
        Live anleggsdata kommer i fase 3.
      </p>
    </div>
  )
}
