import Link from 'next/link'
import { navItemsForRole } from '@/lib/nav'
import type { UserRole } from '@/db/schema'

interface NavProps {
  role: UserRole
  currentPath?: string
  // Horizontal pill row for the mobile top bar; vertical list in the sidebar.
  horizontal?: boolean
}

export default function Nav({ role, currentPath, horizontal }: NavProps) {
  const items = navItemsForRole(role)

  return (
    <nav>
      <ul className={horizontal ? 'flex flex-row gap-1 whitespace-nowrap' : 'flex flex-col gap-1'}>
        {items.map((item) => {
          const isActive = currentPath === item.href
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900'
                    : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
