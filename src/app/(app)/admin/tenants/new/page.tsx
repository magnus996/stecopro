// New tenant page — Server Component, system_admin only.
// Gate: getCurrentUser() + role check → redirect('/dashboard') for all other roles.

import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/dal'
import TenantForm from '../TenantForm'

export default async function NewTenantPage() {
  const user = await getCurrentUser()
  if (!user) return null
  if (user.role !== 'system_admin') redirect('/dashboard')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Ny tenant</h1>

      <div className="max-w-md rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <TenantForm />
      </div>
    </div>
  )
}
