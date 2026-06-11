import { redirect } from 'next/navigation'
import Image from 'next/image'
import { getCurrentUser } from '@/lib/dal'
import Nav from '@/components/Nav'
import LogoutButton from '@/components/LogoutButton'
import PwaRegistrar from '@/components/PwaRegistrar'
import type { UserRole } from '@/db/schema'

const ROLE_LABELS: Record<UserRole, string> = {
  operator: 'Operatør',
  produksjonsleder: 'Produksjonsleder',
  admin: 'Administrator',
  system_admin: 'Systemadministrator',
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    // Valid JWT but no matching active user (stale cookie after a reseed,
    // or deactivated account): clear the cookie via the logout route —
    // redirecting straight to /login would loop, since the proxy bounces
    // cookie-holders back to /dashboard.
    redirect('/api/auth/logout')
  }

  const roleLabel = ROLE_LABELS[user.role]

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 md:flex-row dark:bg-zinc-950">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:flex">
        {/* App title */}
        <div className="border-b border-zinc-200 bg-zinc-900 px-4 py-5 dark:border-zinc-800">
          <Image src="/logo-hvit.png" alt="Steco" width={150} height={32}
            style={{ height: 'auto', width: '150px' }} priority />
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <Nav role={user.role} />
        </div>

        {/* User identity + logout */}
        <div className="border-t border-zinc-200 px-3 py-4 dark:border-zinc-800">
          <div className="mb-2 px-3">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate">
              {user.name}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              {roleLabel}
            </p>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex w-full flex-col md:hidden">
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="rounded bg-zinc-900 px-2 py-1">
            <Image src="/logo-hvit.png" alt="Steco" width={110} height={23}
              style={{ height: 'auto', width: '110px' }} priority />
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{user.name}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{roleLabel}</p>
          </div>
        </header>
        {/* Mobile nav */}
        <div className="overflow-x-auto border-b border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
          <Nav role={user.role} horizontal />
        </div>
      </div>

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>

      <PwaRegistrar />
    </div>
  )
}
