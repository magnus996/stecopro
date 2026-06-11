// Tenant list — Server Component, system_admin only.
// Gate: getCurrentUser() + role check → redirect('/dashboard') for all other roles.
// The middleware/proxy only checks /admin prefix; this page enforces the sub-role.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser, getTenantList } from '@/lib/dal'

export default async function TenantsPage() {
  const user = await getCurrentUser()
  if (!user) return null
  if (user.role !== 'system_admin') redirect('/dashboard')

  const rows = await getTenantList()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Tenants</h1>
        <Link
          href="/admin/tenants/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Ny tenant
        </Link>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {rows.length === 0 ? (
          <div className="p-6">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Ingen tenants ennå.</p>
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
                    Slug
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400">
                    Brukere
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400">
                    Anlegg
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400">
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((tenant) => (
                  <tr
                    key={tenant.id}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                  >
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                      {tenant.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-400">
                      {tenant.slug}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                      {tenant.userCount}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                      {tenant.plantCount}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/tenants/${tenant.id}`}
                        className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                      >
                        Åpne
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
