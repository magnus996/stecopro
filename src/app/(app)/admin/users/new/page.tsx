// Create user page — Server Component.
// Role gate: admin or system_admin only.

import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/dal'
import UserForm from '../UserForm'

export default async function NewUserPage() {
  // Role gate in page (RESEARCH Pitfall 3)
  const user = await getCurrentUser()
  if (!user) return null
  if (!['admin', 'system_admin'].includes(user.role)) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Ny bruker</h1>

      <div className="max-w-md rounded-2xl bg-white px-8 py-8 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <UserForm mode="create" />
      </div>
    </div>
  )
}
