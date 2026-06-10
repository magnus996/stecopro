import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/dal'
import Nav from '@/components/Nav'
import LogoutButton from '@/components/LogoutButton'
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
    redirect('/login')
  }

  const roleLabel = ROLE_LABELS[user.role]

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:flex">
        {/* App title */}
        <div className="border-b border-zinc-200 px-4 py-5 dark:border-zinc-800">
          <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Steco<span className="text-zinc-400">pro</span>
          </span>
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
          <span className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Steco<span className="text-zinc-400">pro</span>
          </span>
          <div className="text-right">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{user.name}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{roleLabel}</p>
          </div>
        </header>
        {/* Mobile nav */}
        <div className="overflow-x-auto border-b border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
          <Nav role={user.role} />
        </div>
      </div>

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  )
}
