// Tenant detail page — Server Component, system_admin only.
// Shows the tenant's plants and provides a create-plant form.
// Gate: getCurrentUser() + role check → redirect('/dashboard') for all other roles.

import { redirect } from 'next/navigation'
import { getCurrentUser, getTenantById } from '@/lib/dal'
import PlantForm from './PlantForm'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function TenantDetailPage({ params }: Props) {
  const user = await getCurrentUser()
  if (!user) return null
  if (user.role !== 'system_admin') redirect('/dashboard')

  const { tenantId: tenantIdStr } = await params
  const tenantId = Number(tenantIdStr)

  const data = await getTenantById(tenantId)

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Tenant</h1>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Tenant ikke funnet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Tenant — {data.tenant.name}
        </h1>
        <p className="mt-1 font-mono text-sm text-zinc-500 dark:text-zinc-400">
          {data.tenant.slug}
        </p>
      </div>

      {/* Plants section */}
      <div>
        <h2 className="mb-3 text-lg font-medium text-zinc-800 dark:text-zinc-200">Anlegg</h2>
        <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {data.plants.length === 0 ? (
            <div className="p-6">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Ingen anlegg ennå.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">
                      Navn
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">
                      Beskrivelse
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400">
                      Kapasitet t/t
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.plants.map((plant) => (
                    <tr
                      key={plant.id}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                    >
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                        {plant.name}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {plant.description ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                        {plant.nominalCapacityTph != null
                          ? `${plant.nominalCapacityTph}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create plant form */}
      <div>
        <h2 className="mb-3 text-lg font-medium text-zinc-800 dark:text-zinc-200">
          Legg til anlegg
        </h2>
        <div className="max-w-md rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <PlantForm tenantId={data.tenant.id} />
        </div>
      </div>
    </div>
  )
}
