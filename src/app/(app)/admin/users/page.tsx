// User list page — Server Component.
// Role gate: admin or system_admin only.
// Auto-dynamic because getUsersForTenant calls verifySession() → cookies().

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser, getUsersForTenant } from '@/lib/dal'

/** Map role key to Norwegian label. */
function roleLabel(role: string): string {
  switch (role) {
    case 'operator': return 'Operatør'
    case 'produksjonsleder': return 'Produksjonsleder'
    case 'admin': return 'Administrator'
    case 'system_admin': return 'Systemadministrator'
    default: return role
  }
}

export default async function UsersListPage() {
  // Role gate in page (RESEARCH Pitfall 3 — proxy only checks /admin prefix)
  const user = await getCurrentUser()
  if (!user) return null
  if (!['admin', 'system_admin'].includes(user.role)) {
    redirect('/dashboard')
  }

  const rows = await getUsersForTenant()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Brukere</h1>
        <Link
          href="/admin/users/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Ny bruker
        </Link>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {rows.length === 0 ? (
          <div className="p-6">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Ingen brukere funnet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Navn</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">E-post</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Rolle</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50 ${!row.active ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                      {row.name}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{row.email}</td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{roleLabel(row.role)}</td>
                    <td className="px-4 py-3">
                      {row.active ? (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                          Aktiv
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 ring-1 ring-inset ring-zinc-500/20">
                          Inaktiv
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/users/${row.id}`}
                        className="text-sm text-zinc-600 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
                      >
                        Rediger
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
