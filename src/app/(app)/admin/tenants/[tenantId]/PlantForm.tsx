'use client'
import { useActionState } from 'react'
import { createPlantForTenant } from '@/actions/tenants'

interface Props {
  tenantId: number
}

export default function PlantForm({ tenantId }: Props) {
  const [state, formAction, isPending] = useActionState(createPlantForTenant, undefined)

  return (
    <form action={formAction} className="space-y-4">
      {/* Hidden tenantId — the server action uses form-supplied tenantId ONLY
          after verifying session.role === 'system_admin' */}
      <input type="hidden" name="tenantId" value={tenantId} />

      {state?.errors?._ && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.errors._[0]}</p>
      )}

      <div>
        <label
          htmlFor="plant-name"
          className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Navn <span className="text-red-500">*</span>
        </label>
        <input
          id="plant-name"
          name="name"
          type="text"
          required
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          placeholder="Returpapir Linje 1"
        />
        {state?.errors?.name && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.errors.name[0]}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="plant-description"
          className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Beskrivelse
        </label>
        <input
          id="plant-description"
          name="description"
          type="text"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          placeholder="Valgfri beskrivelse"
        />
      </div>

      <div>
        <label
          htmlFor="plant-capacity"
          className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Nominell kapasitet (t/t)
        </label>
        <input
          id="plant-capacity"
          name="nominalCapacityTph"
          type="number"
          step="0.1"
          min="0"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          placeholder="12.0"
        />
        {state?.errors?.nominalCapacityTph && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {state.errors.nominalCapacityTph[0]}
          </p>
        )}
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? 'Oppretter…' : 'Opprett anlegg'}
        </button>
      </div>
    </form>
  )
}
