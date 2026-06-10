import Link from 'next/link'
import { navItemsForRole } from '@/lib/nav'
import type { UserRole } from '@/db/schema'

interface NavProps {
  role: UserRole
  currentPath?: string
}

export default function Nav({ role, currentPath }: NavProps) {
  const items = navItemsForRole(role)

  return (
    <nav>
      <ul className="flex flex-col gap-1">
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
