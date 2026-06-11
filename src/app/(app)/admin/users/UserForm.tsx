'use client'
import { useActionState } from 'react'
import { createUser, updateUser, deactivateUser, reactivateUser } from '@/actions/users'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type FormState =
  | { errors?: Record<string, string[]>; success?: boolean }
  | undefined

interface UserFormProps {
  mode: 'create' | 'edit'
  user?: {
    id: number
    name: string
    email: string
    role: string
    active: boolean
  }
}

// ---------------------------------------------------------------------------
// DeactivateButton — separate client component to surface useActionState feedback
// Colocated here per plan guidance.
// ---------------------------------------------------------------------------
export function DeactivateButton({ userId, active }: { userId: number; active: boolean }) {
  const action = active ? deactivateUser : reactivateUser
  const [state, formAction, isPending] = useActionState<FormState, FormData>(action, undefined)

  return (
    <div className="mt-6 border-t border-zinc-200 pt-6 dark:border-zinc-700">
      {state?.success && (
        <p className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 ring-1 ring-inset ring-green-600/20">
          {active ? 'Brukeren er nå deaktivert.' : 'Brukeren er nå reaktivert.'}
        </p>
      )}
      {state?.errors?._ && (
        <p className="mb-4 text-sm text-red-600">{state.errors._[0]}</p>
      )}
      <form action={formAction}>
        <input type="hidden" name="userId" value={userId} />
        <button
          type="submit"
          disabled={isPending}
          className={`rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${
            active
              ? 'bg-red-600 text-white hover:bg-red-500 focus:ring-red-600'
              : 'bg-zinc-200 text-zinc-900 hover:bg-zinc-300 focus:ring-zinc-500'
          }`}
        >
          {isPending
            ? active ? 'Deaktiverer…' : 'Reaktiverer…'
            : active ? 'Deaktiver bruker' : 'Reaktiver bruker'}
        </button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// UserForm — shared create/edit form
// ---------------------------------------------------------------------------
export default function UserForm({ mode, user }: UserFormProps) {
  const action = mode === 'create' ? createUser : updateUser
  const [state, formAction, isPending] = useActionState<FormState, FormData>(action, undefined)

  return (
    <form action={formAction} className="space-y-5">
      {/* Hidden userId for edit mode */}
      {mode === 'edit' && user && (
        <input type="hidden" name="userId" value={user.id} />
      )}

      {/* Email — editable on create, read-only on edit */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          E-post
        </label>
        {mode === 'create' ? (
          <>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="bruker@eksempel.no"
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
            {state?.errors?.email && (
              <p className="mt-1 text-sm text-red-600">{state.errors.email[0]}</p>
            )}
          </>
        ) : (
          <p className="mt-1 block w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
            {user?.email}
          </p>
        )}
      </div>

      {/* Password — create mode only */}
      {mode === 'create' && (
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Passord <span className="text-zinc-400 font-normal">(minimum 8 tegn)</span>
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="••••••••"
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
          {state?.errors?.password && (
            <p className="mt-1 text-sm text-red-600">{state.errors.password[0]}</p>
          )}
        </div>
      )}

      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Navn
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={user?.name ?? ''}
          placeholder="Ola Nordmann"
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
        {state?.errors?.name && (
          <p className="mt-1 text-sm text-red-600">{state.errors.name[0]}</p>
        )}
      </div>

      {/* Role — system_admin excluded (RESEARCH Pitfall 2) */}
      <div>
        <label htmlFor="role" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Rolle
        </label>
        <select
          id="role"
          name="role"
          defaultValue={user?.role ?? 'operator'}
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        >
          <option value="operator">Operatør</option>
          <option value="produksjonsleder">Produksjonsleder</option>
          <option value="admin">Administrator</option>
          {/* system_admin intentionally excluded — only created via seed */}
        </select>
        {state?.errors?.role && (
          <p className="mt-1 text-sm text-red-600">{state.errors.role[0]}</p>
        )}
      </div>

      {/* General errors */}
      {state?.errors?._ && (
        <p className="text-sm text-red-600">{state.errors._[0]}</p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {isPending
          ? mode === 'create' ? 'Oppretter…' : 'Lagrer…'
          : mode === 'create' ? 'Opprett' : 'Lagre'}
      </button>
    </form>
  )
}
