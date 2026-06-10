'use client'
import { logout } from '@/actions/auth'

export default function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="w-full rounded-md px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 text-left"
      >
        Logg ut
      </button>
    </form>
  )
}
