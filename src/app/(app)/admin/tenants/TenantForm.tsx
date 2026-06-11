'use client'
import { useActionState } from 'react'
import { createTenant } from '@/actions/tenants'

export default function TenantForm() {
  const [state, formAction, isPending] = useActionState(createTenant, undefined)

  return (
    <form action={formAction} className="space-y-4">
      {state?.errors?._ && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.errors._[0]}</p>
      )}

      <div>
        <label
          htmlFor="name"
          className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Navn <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          placeholder="Steco Demo"
        />
        {state?.errors?.name && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.errors.name[0]}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="slug"
          className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Slug <span className="text-red-500">*</span>
        </label>
        <input
          id="slug"
          name="slug"
          type="text"
          required
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-mono text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          placeholder="steco-demo"
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Kun små bokstaver, tall og bindestrek (f.eks. steco-demo)
        </p>
        {state?.errors?.slug && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.errors.slug[0]}</p>
        )}
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? 'Oppretter…' : 'Opprett tenant'}
        </button>
      </div>
    </form>
  )
}
