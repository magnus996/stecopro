// Edit / deactivate user page — Server Component.
// Role gate: admin or system_admin only.
// getUserById is tenant-scoped → cross-tenant access naturally prevented.

import { redirect } from 'next/navigation'
import { getCurrentUser, getUserById } from '@/lib/dal'
import UserForm, { DeactivateButton } from '../UserForm'

interface EditUserPageProps {
  params: Promise<{ userId: string }>
}

export default async function EditUserPage({ params }: EditUserPageProps) {
  // params is a Promise in Next.js 15+ — await it
  const { userId } = await params

  // Role gate in page (RESEARCH Pitfall 3)
  const user = await getCurrentUser()
  if (!user) return null
  if (!['admin', 'system_admin'].includes(user.role)) {
    redirect('/dashboard')
  }

  const u = await getUserById(Number(userId))

  // Not found or cross-tenant id — show not-found card
  if (!u) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Rediger bruker</h1>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Bruker ikke funnet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Rediger bruker</h1>

      <div className="max-w-md rounded-2xl bg-white px-8 py-8 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <UserForm
          mode="edit"
          user={{
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            active: u.active,
          }}
        />

        {/* Deactivate / reactivate control — uses client boundary for feedback */}
        <DeactivateButton userId={u.id} active={u.active} />
      </div>
    </div>
  )
}
